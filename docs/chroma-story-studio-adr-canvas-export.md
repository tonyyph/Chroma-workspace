# ADR — Chroma Story Studio: canvas rendering and export

**Status:** accepted
**Date:** 2026-08-17
**Context commit:** `994c1ec`
**Supersedes:** nothing. **Depends on:** `docs/chroma-story-studio-audit.md`

> **Status note, added after handover. This ADR held.** Implementation moved to a
> second session, which independently arrived at the same decision: Skia for both
> canvas and export, no new dependency, one logical coordinate system, slides
> derived by translating a single scene rather than composed per-slide.
>
> Only the identifiers differ — their slicing entry point is `sliceBounds` in
> `story/slicing.ts` rather than `sliceTransforms` in `geometry.ts`. §4's
> mechanism, §5's three-layer runtime split, and §6's memory strategy all apply
> unchanged. The `-0` defect recorded in §4 is real and was reported to them;
> `-format.width * 0` yields negative zero, which compares and serialises as its
> own value and will make an export-fidelity assertion flicker.

---

## 1. The decision, stated first

**Skia renders the canvas, and Skia renders the export, from the same scene
description.** Reanimated 4 worklets carry gesture state; React holds the
document; neither is on the frame path of the other.

No new dependency is added. `@shopify/react-native-skia@2.4.18`,
`react-native-reanimated@4.2.1` and `react-native-gesture-handler@~2.30.0` are
already in `apps/mobile/package.json`, already built (`pnpm.onlyBuiltDependencies`
in the root manifest, `scripts/ensure-skia.mjs` in the iOS prebuild), and already
load-bearing across 15 files.

---

## 2. The problem this decides

A seamless multi-slide carousel is only "seamless" if the exported images are
slices of one composition. That imposes three requirements that most canvas
approaches fail:

**P1 — Off-screen raster at arbitrary pixel dimensions.** Export size is a
property of the destination (1080×1350 for a 4:5 Instagram post), not of the
device. A 4:5 slide on a 390pt-wide phone is ~312pt wide; capturing that view and
scaling up produces a soft 1080px image from ~936 real pixels.

This is not a hypothetical. The codebase already learned it and wrote it down —
`lib/export.ts:16-19`:

> Both render off screen rather than snapshotting the view: the on-screen canvas
> is however many points wide the phone is, and a 4K wallpaper cropped up from
> 390pt is not a 4K wallpaper. Drawing again at the target size costs one frame
> and produces the real thing.

**P2 — Deterministic slicing with no seam.** Slide _n_ must contain exactly the
pixels of the logical canvas in `[n·W, (n+1)·W)`. Rendering each slide
independently and hoping the results abut is how you get a one-pixel gap or a
duplicated column at every boundary — the single most visible possible defect in
a product whose entire premise is that the boundary is invisible.

**P3 — One source of truth for what a slide looks like.** If the editor draws
with one renderer and the exporter with another, the two drift, and the drift is
discovered by users after they post. The preview must be the export at a
different scale, not a second implementation of it.

Plus two constraints from the audit: portrait phone only
(`app.json: orientation: "portrait"`, `supportsTablet: false`), and up to 20
slides of photographic content on phones that will happily run out of memory.

---

## 3. Options considered

### Option A — React Native views + Reanimated, export via view capture

Elements are RN views; transforms animate on the UI thread; export snapshots the
view tree.

- **P1: fails.** View capture is bounded by the on-screen layout's real pixel
  size. There is no way to ask a mounted view tree to rasterise at 1080×1350 when
  it occupies 312×390 points. Off-screen re-layout at export dimensions means
  mounting a hidden 1080-point-wide tree, which is neither reliable nor cheap.
- **P2: fails.** Snapshot boundaries land on device-pixel rounding, not on
  logical-canvas arithmetic.
- **P3: fails** for anything beyond plain rectangles — text metrics, blend modes
  and shadows would each need a second implementation for export.
- Would additionally require a new dependency for view capture.

**Rejected.** It fails the requirement the repository has already documented as
the reason its existing exports do not work this way.

### Option B — `react-native-svg`

- **P1: partial.** SVG can be serialised at any size, but rasterising it to PNG
  on device still needs a renderer. `react-native-svg` has no off-screen raster
  API; we would be back to view capture, or shipping SVG (unacceptable to
  Instagram and TikTok).
- **Photographic fidelity: fails.** Compositing 20 photographs with crops,
  rotations and shadows through SVG image elements is both slow and inconsistent
  across platforms.
- SVG stays useful for what it is already used for in this repo — flat decorative
  figures (`ui/BandField.tsx`, `EmptyGlyph.tsx`, `Loops.tsx`).

**Rejected as the canvas.** Retained as an internal detail of specific decorative
elements if it earns its place.

### Option C — Native image composition for export (Core Graphics / Android Canvas)

Edit in RN views, composite natively for export.

- **P1, P2: pass.** Native rasterisers do this well.
- **P3: fails hard.** Two renderers, two text layout engines, two blend-mode
  implementations, on two platforms — four ways for preview and export to
  disagree.
- Requires writing and maintaining native modules for both platforms, in a repo
  that currently ships no custom native rendering code and has no `ios/` or
  `android/` directory committed.

**Rejected.** It buys nothing Skia does not already provide, at the cost of the
largest maintenance burden of any option.

### Option D — Skia (chosen)

- **P1: passes, and is already proven in this repository.**
  `lib/grade/bakeGrade.ts:renderGraded` renders a photograph through a runtime
  shader into `Skia.Surface.MakeOffscreen(w, h)` at a computed target size and
  returns PNG bytes via `makeImageSnapshot().encodeToBytes()`. It has tests
  (`bakeGrade.test.ts`), a no-upscaling rule (`targetSize`), a memory ceiling
  (`EXPORT_LONG_EDGE = 4096`), and `image.dispose()` in a `finally`.
  `lib/export.ts:renderShareCard` does the same for palette cards at 1080×1080,
  1080×1350 and 1080×1920 — three of our five target formats already.
- **P2: passes.** Slicing becomes one line of arithmetic rather than a layout
  negotiation: translate the same scene by `−n·W` and draw it into a `W×H`
  surface. See §4.
- **P3: passes.** `@shopify/react-native-skia` exposes the same drawing
  primitives to the declarative on-screen `<Canvas>` and to the imperative
  off-screen `SkCanvas`. One scene description drives both.
- **Cost: zero new dependencies.** Already installed, already built, already
  load-bearing.

**Accepted.**

---

## 4. How slicing works, precisely

This is the mechanism P2 depends on, so it is specified here rather than left to
implementation.

The document holds **one logical canvas**. Its geometry is derived, never stored
per-slide:

```
slideWidth   = format.width          // integer pixels, e.g. 1080
slideHeight  = format.height         // integer pixels, e.g. 1350
canvasWidth  = slideWidth * slideCount
canvasHeight = slideHeight
```

Every element's position is expressed in **logical canvas pixels**, one
coordinate system, origin at the canvas's top-left. An element that crosses a
boundary is one element with one position — it is not split, duplicated, or
assigned to a slide.

Export of slide `n`:

```
surface = Skia.Surface.MakeOffscreen(slideWidth, slideHeight)
canvas  = surface.getCanvas()
canvas.translate(-n * slideWidth, 0)
drawScene(canvas, document)          // the identical function the editor uses
surface.flush()
bytes = surface.makeImageSnapshot().encodeToBytes()
```

Three properties follow, and each gets a test:

1. **No gap, no duplication.** Slide `n` covers exactly `[n·W, (n+1)·W)` because
   the translate is exact integer arithmetic and `slideWidth` is an integer. There
   is no rounding step anywhere in the path.
2. **Determinism.** Output dimensions are `format.width × format.height` for
   every slide, independent of device, density, or zoom level.
3. **Seam fidelity is verifiable.** Place a known element straddling a boundary,
   export both slides, and assert that re-concatenating the two slices reproduces
   the same pixel columns as rendering the pair as one `2W×H` surface. This is the
   visual export verification test the brief requires, and it is a real assertion
   rather than a snapshot.

Why integers matter: `format.width` is fixed per format (1080, 1080, 1080) and
`slideCount` is an integer, so `canvasWidth` and every boundary are integers by
construction. Zoom and pan affect only the _view_ transform, never the document,
so no amount of pinching can introduce a fractional boundary.

---

## 5. The three-layer runtime split

Gesture smoothness and export fidelity are different problems and get different
machinery. The brief's requirement that no gesture frame goes through React state
is satisfied structurally, not by discipline.

| Layer        | Lives in                                            | Updated                                 | Read by                            |
| ------------ | --------------------------------------------------- | --------------------------------------- | ---------------------------------- |
| **Document** | zustand store, immutable updates                    | on gesture _end_, and on discrete edits | export, autosave, undo, layer list |
| **Gesture**  | Reanimated shared values, UI thread                 | every frame, in a worklet               | the Skia scene's animated props    |
| **View**     | Reanimated shared values (pan/zoom of the _camera_) | every frame                             | the scene's root transform         |

During a drag, the moving element's offset is a shared value; the Skia canvas
reads it directly. React does not re-render, the store is untouched, and undo
history gains one entry on gesture end rather than sixty per second.

Corollary for `AGENTS.md`'s React Compiler warning: because the frame path does
not go through React at all, a bail-out in an editor component costs a re-render,
not a dropped frame. That materially lowers the risk R5 in the audit.

---

## 6. Memory strategy

Copied from the discipline `bakeGrade.ts` already documents, because it was
written in response to a real crash.

- **Editing previews, not originals.** On import, each asset gets a preview
  capped at 1024 px long edge (`THUMBNAIL_LONG_EDGE`, already exported). The
  editor decodes only previews. Twenty 1024px previews are affordable; twenty
  48MP originals are not.
- **Originals are never modified** and are referenced by URI. Crop, scale and
  rotation are stored as numbers, exactly as a `Grade` is stored as eleven
  numbers rather than as baked pixels.
- **Export is sequential and streamed.** One slide at a time: decode the
  originals that slide needs at export resolution, draw, encode, write, dispose,
  release. Peak memory is one slide, not twenty.
- **The 4096 px ceiling holds.** `EXPORT_LONG_EDGE` applies to any single source
  image drawn into a slide. A crash while exporting is worse than a ceiling.
- **`dispose()` in a `finally`**, on every `SkImage`, exactly as `renderGraded`
  does.

---

## 7. Consequences

**Good.**

- Zero new dependencies; no compatibility verification needed, no build risk, no
  bundle growth, nothing to justify against the "do not install large
  dependencies" rule.
- The export path is a generalisation of code that already ships and is tested.
- Preview genuinely _is_ the export, at a different scale.
- Slicing correctness is arithmetic, so it can be unit-tested without a device.

**Bad, and accepted.**

- **Skia is not free at rest.** A large scene redraws on every frame it is
  invalidated. Mitigation: elements not being manipulated render from cached
  `SkImage` previews; only the active element's transform animates.
- **Text layout is Skia's, not the platform's.** `lib/export.ts:280-291` already
  handles a missing system typeface by degrading to an untitled card. Story text
  needs real font loading (`@expo-google-fonts/space-grotesk` and
  `ibm-plex-mono` are already dependencies) and cannot silently fall back, because
  a caption is content, not decoration. **This is the largest new work in the
  render layer.**
- **Blend modes ship only where verified.** Skia supports them; the export path
  must be confirmed to match on-screen output per mode on a device before any mode
  is exposed. Modes that do not match are not offered. This follows the brief's
  "blend mode only when reliably exportable".
- **No video.** Skia has no video frame source here, which is one of the reasons
  Phase 1 is photo-only (audit §15, D2).

**Neutral.**

- SVG remains in the codebase for decorative figures. Two rendering stacks already
  coexist (`ui/BandCanvas.tsx` uses both); this ADR does not add a third and does
  not require removing the second.

---

## 8. What would overturn this

Recorded so the decision is falsifiable rather than permanent:

1. Device profiling shows a 20-slide scene cannot hold interactive frame rates
   even with preview caching — would push toward tiled rendering, not a different
   renderer.
2. Skia text layout proves unable to match a design requirement that the platform
   text engine meets — would push text specifically (not the canvas) toward a
   hybrid.
3. Skia is removed from the app for unrelated reasons — it is currently used by
   grading, capture, palette reading and gradients, so this is remote.

None of these change the slicing model in §4, which is renderer-independent.
