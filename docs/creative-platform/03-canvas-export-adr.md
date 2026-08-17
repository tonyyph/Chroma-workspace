# 03 — ADR: canvas rendering and export

**Status:** accepted, implemented in Phase 1.
**Date:** 2026-08-17.

---

## 1. Decision

**Skia, for both the on-screen canvas and the export, through one renderer.**

`drawScene` is called by the editor with a fractional scale and preview images,
and by the exporter with `scale: 1` and full-resolution masters. Nothing else
differs. That is what makes the preview an actual preview rather than a second
implementation kept in agreement by hand.

**No new dependency was added.** `@shopify/react-native-skia@2.4.18` was already
installed, already used in fourteen source files, already had a build hook
(`scripts/ensure-skia.mjs`) and already appears in `pnpm.onlyBuiltDependencies`.

---

## 2. The problem

A story editor has to do two things that pull in opposite directions:

1. **Draw interactively at 60fps** while a finger drags an element across a
   canvas holding up to twenty photographs.
2. **Produce deterministic pixels at exact dimensions** — 1080×1350 per slide,
   identical on every device, with slices that abut perfectly.

Requirement 2 is the harder constraint and it eliminates most of the options.

---

## 3. Options considered

### A — React Native views + Reanimated, export by view capture

Elements as `<Image>`/`<Text>` in an `Animated.View`, exported with
`react-native-view-shot` or similar.

**Rejected, and the repo already says why.** `lib/export.ts:16-19` documents this
exact defect: a view capture snapshots at _device_ resolution. A 1080-wide slide
is ~390 points on screen; capturing it yields ~1170px on a 3× device and ~780px
on a 2× one. Export dimensions would depend on the phone, which fails
requirement 2 outright. Requirement 1 is fine; requirement 2 is unachievable.

### B — `react-native-svg`

**Rejected.** SVG cannot composite photographs with fidelity — no image
filtering control, no offscreen surface, and rasterisation is the platform's
rather than ours, so determinism is not ours to guarantee either. It is used in
this codebase for decorative line work, which is what it is good at.

### C — Native image composition (Core Graphics / Android Canvas)

**Rejected.** New native code on two platforms for a problem already solved in
JS, with a config plugin to maintain and no path to sharing the renderer with the
interactive canvas. The repo has native precedent (`plugins/withChromawaveWidget`)
so this was not dismissed as impossible — it was dismissed as unnecessary.

### D — Skia (chosen)

`Skia.Surface.MakeOffscreen(w, h)` produces a surface at exactly the requested
pixel dimensions, independent of screen density, and `encodeToBytes()` returns
PNG bytes. On screen, the same draw calls are recorded into an `SkPicture` and
rendered by `<Canvas>`.

**Decisively, the pipeline already exists and is tested.**
`lib/grade/bakeGrade.ts:renderGraded` already proves the whole shape:

```
decodeImage → targetSize → MakeOffscreen → draw → flush
  → makeImageSnapshot().encodeToBytes() → File.write → dispose() in a finally
```

`renderStory` is that pipeline with a scene instead of a shader.

---

## 4. How slicing works

`planSlices(format, slideCount)` yields one `SlicePlan` per slide:
`{ index, bounds, translateX, width, height }`.

The exporter loops the plans; for each it creates a surface of
`plan.width × plan.height` and calls `drawScene` with that plan. `drawScene`
translates every element's frame by `plan.translateX` and draws.

Slices differ by exactly one number. The full argument, and the `-0` trap that
made it worth stating, is in `02-project-schema.md` §5.

**`verifyTiling` runs before any byte is written.** A story that would export
with a seam returns `failed: 'seam-detected'` instead. A carousel someone posts
and only then notices is a much worse failure than an error message.

---

## 5. Memory strategy

The constraint is real: twenty 1080×1350 surfaces at four bytes a pixel is
~117MB before a single photograph is decoded, and masters are capped at 4096px.

1. **One slide at a time.** Render, encode, write, dispose, then the next. Peak
   is one slide, not one story.
2. **Only the assets a slide shows.** `assetsForSlice` is pure and exported
   precisely so the claim is asserted rather than assumed — a test proves that a
   twenty-slide, twenty-photograph story decodes exactly one master per slide.
3. **`dispose()` in a `finally`.** An image left undisposed because an encode
   threw is a leak that only appears on the twentieth slide, on someone else's
   phone. (`renderSlice` is a plain function, not a component, so the React
   Compiler bail-out that `finally` causes does not apply — see
   `apps/mobile/AGENTS.md`.)
4. **The editor never decodes masters.** `useStoryImages` loads previews
   (≤1024px) and disposes them all on unmount, because Skia images are native
   memory and leaving scope does not free them.

---

## 6. Interaction

**No gesture frame reaches React.** `useElementGesture` holds translation and
scale in Reanimated shared values on the UI thread; the document is written once,
on gesture end, through `runOnJS`. So the Skia picture is re-recorded per _edit_,
not per frame.

Arbitration is decided rather than raced — the largest interaction risk in the
audit (R1), given the codebase had no multi-touch precedent at all:

1. An element gesture requires a **selected** element and a touch that began on
   it. Selection is a deliberate tap, so nothing moves by accident.
2. Pinch is element-only. Canvas zoom is not in this slice, so there is no second
   interpretation of two fingers to arbitrate against — a decision, not an
   omission.
3. Slide navigation is the scroll view _outside_ the canvas, and stands down for
   the duration of an element gesture. Which gesture is **active** resolves it,
   never a threshold race — a threshold race is what produces a canvas that
   sometimes does the wrong thing.

---

## 7. Consequences

**Good.** No new dependency, no native code, no bundle growth. One renderer for
preview and export, so they cannot drift. Deterministic dimensions. The memory
discipline is inherited from tested code rather than invented.

**Accepted costs.**

- **Text needs Skia's font manager.** `matchFont` reaches native, so it is
  unavailable under jest and for a moment before Skia loads. `useStoryFonts`
  returns `null` there and the canvas renders nothing until fonts resolve —
  the same guard `LivingStage` applies to its `RuntimeEffect`. Export is disabled
  while fonts are null, because exporting slides with every caption missing is
  worse than not exporting.
- **The Skia scene is not a React tree.** No per-element React components means
  no per-element `onPress`; hit-testing against element frames is Phase 2 work.
- **`drawScene` cannot be unit-tested.** It needs a surface, a font and a decoded
  image. Following `bakeGrade.test.ts`'s precedent, the error-prone arithmetic is
  extracted and tested (`layout.ts`, `assetsForSlice`, `committedFrame`,
  `wrapText`) and the drawing itself is verified on a device.

---

## 8. What would overturn this

- Skia dropping deterministic offscreen surfaces, or the New Architecture
  breaking `MakeOffscreen`.
- Video arriving (decision D2): Skia has no video frame source, so video
  composition needs a different path for that element type — though not
  necessarily for the rest of the scene.
- A measured finding that recording an `SkPicture` per edit is too slow on a
  target device with a 200-element document. Not observed; not yet measured on
  hardware.
