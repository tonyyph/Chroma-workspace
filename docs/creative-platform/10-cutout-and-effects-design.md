# 10 — Chroma Cutout and the effects layer

**Status:** design, approved in outline 2026-08-19. Not implemented.
**Decision it implements:** D4 (iOS Vision, iOS-only) from `00-repository-audit.md` §15.
**Supersedes:** the "seam only" scope recorded for Cutout in `08-implementation-plan.md`.

---

## 0. What this document is not

**Every Swift signature below is unverified.** They come from Apple's
documentation and from memory, not from a compiler. Nothing here has been built,
run, or seen. Items that need checking against the SDK are marked **[verify]**,
and they are not incidental — one of them decides how the outline is drawn.

This matters more than usual because the feature is native and iOS-only: the
author of this document cannot run any of it.

---

## 1. Decisions taken

| #   | Decision                                                        | Consequence                                                                                                                                                                 |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Native returns pre-cut RGBA images**, not a mask to composite | No renderer compositing work. **Cutting is permanent**: no edge refinement, no restoring erased areas, no editing a cut after the fact. Re-cutting means re-running Vision. |
| 2   | **Vision returns each instance separately**; the author chooses | Two people in a frame become two independently movable subjects — which is also how the brief's "duplicate and layer the subject" is satisfied, with no separate feature.   |
| 3   | **Cutout and the full effects set ship together**, in one spec  | Against the recommendation to decompose. Recorded so the scope is a choice on the record rather than a drift.                                                               |
| 4   | **Cutting is free; effects are Pro**                            | One new `Entitlement`, `cutout_effects`. The line stays where `entitlements.ts` put it — systems work, not core capability.                                                 |

### Brief items this removes

Decision 1 drops three things the brief asks for: **refine mask edges**,
**restore erased areas**, and editing a cut after it is made. They are not
deferred — the chosen shape cannot express them. Recovering them means revisiting
decision 1.

---

## 2. The native boundary

A local Expo module, `modules/chromawave-subject-cutout/`, following
`modules/chromawave-shared-container/` exactly: `expo-module.config.json` with
`platforms: ["apple"]`, a podspec depending on `ExpoModulesCore`, and a Swift
class extending `Module`.

**The podspec stays at iOS 15.1.** Raising the app's deployment target for one
feature charges every user who will never reach it. The Vision code sits behind
`if #available(iOS 17.0, *)`; outside that block the module still builds and can
still answer whether it is usable.

**One deliberate departure from the precedent.** `ChromawaveSharedContainer` is
synchronous throughout and states why: "a save must not fail because a widget
could not be updated." Vision takes roughly 100–500ms and cannot be synchronous,
so this module uses `AsyncFunction`. Named here so it reads as an exception with
a reason rather than as inconsistency.

### Surface

```
availability() -> { status: 'available' }
              |  { status: 'unavailable', reason: CutoutUnavailableReason }

extract(sourceUri: String, destinationDir: String) -> [Instance]   // async
Instance = { uri: String, width: Int, height: Int, confidence: Double }
```

**Native writes files; it never returns bytes.** A 4096px RGBA image is roughly
67MB. Passing that over the bridge as base64 is what the brief forbids and what
`project.ts` already refuses for photographs. The caller supplies the destination
— `story-assets/<storyId>/`, which `StoryAssetManager` already owns.

**[verify]** `VNInstanceMaskObservation.confidence` — believed to exist via
`VNObservation`. If it does not, `confidence` must be dropped from the model
rather than filled with a constant. A fabricated confidence is worse than none.

**[verify]** The exact request/handler pairing for
`VNGenerateForegroundInstanceMaskRequest`, and how an instance mask is applied to
produce a cut image (`generateMaskedImage(ofInstances:from:croppedToInstancesExtent:)`
is the believed API).

### Availability, and why the three states already exist

`requireOptionalNativeModule` returns null off-platform, and availability is
resolved once at construction — the pattern `ExpoSharedContainer` established.
The three states map onto the union already written in
`packages/domain/src/story/cutout.ts`:

| Situation                                | `reason`             |
| ---------------------------------------- | -------------------- |
| Module null — Android, Expo Go, Jest     | `not-implemented`    |
| Module present, OS below iOS 17          | `os-too-old`         |
| iOS 17+, request throws or device cannot | `device-unsupported` |

---

## 3. The document model

### `maskAssetId` becomes `cutoutAssetId`

The rename is free: nothing can produce a mask today, so no record carries a
value, and zod strips unknown keys — an existing record with `maskAssetId: null`
parses, the key is dropped, and the new field takes its default. **No schema
version bump.**

**Semantics.** The photo element keeps its original `assetId` and gains
`cutoutAssetId`. The renderer draws the cutout when present.

Keeping the original in the manifest is what satisfies the brief's "replace the
background without modifying the original asset", and it means the cutout can be
switched off without losing anything.

### Effects live in one nested object

A single widening with a default, rather than five fields scattered across the
element. Placed on the photo element only this time; text effects are a separate
widening later.

**The brief's list reduces, and not by dropping anything:**

| Brief lists                     | What it actually is                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Outline, glow, grain, shadow    | **Four real primitives.** Skia paint over an asset that already has alpha.                                                               |
| Paper-cut                       | **A preset** of outline + hard shadow, not a fifth primitive.                                                                            |
| Duplicate and layer the subject | **Not an effect.** Another element with the same `cutoutAssetId` — `duplicateElement` has done this since Phase 1.                       |
| Parallax                        | **Motion, not a static effect.** Export is still images, so it cannot be exported at all. It belongs with Living Palette's motion story. |

So the work is **four primitives and one preset**.

### Bounds are part of the schema

Grain 0–1; outline width and shadow offset in canvas units with ceilings. Not for
tidiness: `applyStoryPatch` has to reject a composer proposing a 4000-unit shadow
offset, and the way it rejects is that the bound is in the schema.

### Colours are passed in

Effect colours are hex values supplied by the caller, never literals — the same
rule text colour follows, for the same reason: two skins, two grounds.
`no-appearance-leaks.test.ts` enforces it.

### Consistency with what exists

- **Effects travel in a remix recipe; `cutoutAssetId` does not.** Effects are
  design, which is what a recipe carries. Assets never are. This falls out of the
  Phase 7 boundary rather than needing a new rule.
- **Templates do not set effects.** They arrange; effects are the author's
  choice. That keeps "a template rearranges, it does not replace" true.

---

## 4. Rendering

**Still one renderer.** `drawScene` draws effects, and the editor and the
exporter both go through it — so the preview cannot disagree with the export,
because they are the same code.

### Fixed order

```
glow  →  shadow  →  outline  →  image  →  grain
(behind, even)  (behind, offset)  (behind, spread)   (above, clipped to alpha)
```

Grain is clipped to the element's alpha rather than covering the frame. Over a
cut subject those are different effects, and the one the author asked for is the
first.

### How each is drawn, including one deliberately worse choice

Shadow and glow are both `ImageFilter.MakeDropShadowOnly` — shadow is offset and
blurred, glow is zero offset with a large sigma. One primitive, two calls.

**Outline uses dilate.** Verified against the installed `.d.ts` on 2026-08-19:
`ImageFilter.MakeDilate(rx, ry, input?, cropRect?)` exists in RN Skia 2.4.18.

So the outline is `MakeDilate` on the alpha, tinted with
`ColorFilter.MakeBlend(colour, SrcIn)` through `MakeColorFilter`, drawn behind
the image. One draw.

An earlier draft of this document specified drawing the image eight times around
a circle, because dilate was believed unavailable and specifying a hoped-for API
is how a plan turns into a surprise at build time. Checking took a minute and
removed seven draws per outlined element.

### Grain must be deterministic

Turbulence with a fixed seed, and **the seed is stored in the document**. Grain
re-randomised per render would break the "reproducible exports" property held
since Phase 1 — and break it quietly, because two exports would look _nearly_
the same.

### The largest risk in this design

`drawScene` calls `canvas.scale(scale, scale)` once at the top, so geometry in
canvas units scales automatically. **Blur sigma may not follow the same rule** —
in some Skia filter constructions it is in device space.

If so: the preview shows a 4px outline and the export shows a 12px one. Same
code, same document, different result.

This is precisely the class of bug the whole `scale` design exists to prevent,
and effects are where it is easiest to reintroduce. It becomes a **mandatory
device check**: export a slide carrying a shadow, screenshot the same slide in
the editor, and compare the blur — not "check the effects look right", but
compare two numbers.

### Cost

The picture is re-recorded per edit, not per frame, so the editor tolerates this.
The exporter draws blurs at up to 4096px, which is expensive and must be measured
on a device rather than estimated.

---

## 5. UI and flow

### Absence, with one distinction

D4 said the feature is absent rather than disabled. The reason it is absent
changes what should be said:

| Reason                               | Behaviour                                 | Why                                                                                |
| ------------------------------------ | ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `not-implemented` — Android, Expo Go | **Entirely absent.** No control, no text. | There is nothing the user can do. Saying so only describes something out of reach. |
| `os-too-old` — iOS 16                | **One line stating the reason.**          | Updating iOS _is_ actionable. Silence here hides something the user could act on.  |
| `device-unsupported`                 | Reason shown after the attempt.           | Only knowable once it has run.                                                     |

### Cutting

On the selected photo element:

- **0 instances** → "no subject found". A real answer, not an error: Vision ran
  correctly and the answer was none.
- **1 instance** → applied directly. A picker with one option is a tax.
- **N instances** → a picker, with **multi-select**.

Each chosen instance becomes **its own element**, sharing the original `assetId`
and carrying its own `cutoutAssetId`.

**The original element is kept, not removed.** The author hides or deletes it.
The same rule `applyTemplate` follows: nothing of the author's disappears because
the app decided it should.

### Effect controls

A chip row on the selected element, each effect opening a sheet built on the
existing `ui/Sheet` and `ui/Slider`.

**Defaults must look good immediately.** An effect that needs tuning before it
stops looking broken is an effect people switch off. The default values are part
of this design, not numbers filled in later.

### Monetization

Cutting is **free** — it is the capability, and `entitlements.ts` puts the paid
line on systems work rather than on core ability. Effects are Pro, through a
second `Entitlement` member, `cutout_effects`. Within the "at most one or two"
budget doc 01 set, and no second system.

**The gate is on setting an effect, not on rendering one.** A story made while
subscribed keeps its effects, and they keep drawing and keep exporting, if the
subscription later lapses. Only the controls become unavailable.

The alternative — effects that stop rendering when a subscription ends — would
silently alter a finished composition someone already published from. That is a
worse thing to do to a person than to leave a feature they can no longer add to,
and it is the same principle behind refusing quantity caps: the product does not
take back work it has already accepted.

---

## 6. Testing, and where the line falls

The boundary between what can be proven and what cannot runs through the middle
of this feature, so it is stated rather than discovered.

**Provable by unit test:** effect arithmetic (outline ring offsets, shadow offset
in canvas units, bound clamping); schema (defaults, out-of-bounds rejection, old
records still parsing); a remix recipe carrying effects and never
`cutoutAssetId`; the patch validator rejecting out-of-range effect values; grain
seed determinism; the three availability states through a fake module; and the
N-instances-to-N-elements transformation with the original element intact.

**Only a device can answer:** whether Vision returns instances at all; the
blur-versus-scale divergence in §4; the cost of blurs at 4096px; the iOS 16 path.

### Failure states

| Condition                     | Answer                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| 0 subjects                    | "No subject found" — an answer, not an error                  |
| Vision throws                 | `device-unsupported`, said once                               |
| Call hangs                    | Timeout, then treated as failed. Never an unresolving spinner |
| Disk full writing the cut PNG | The same `write-failed` shape the exporter uses               |
| **Cutout file later missing** | **Falls back to the original asset**, not to a gap            |

That last row is a property of the design rather than of error handling: because
the original asset stays in the manifest, a lost cutout degrades to "the
background came back" instead of to a missing photograph.

### Existing guards still apply

New screens register in `screens.test.tsx`; `no-appearance-leaks` covers every
colour; `en` and `vi` stay in lockstep within their character budgets.

---

## 7. Open items before implementation

**Resolved 2026-08-19**, by reading the installed type definitions:

- `ImageFilter.MakeDilate`, `MakeDropShadowOnly`, `MakeBlur`, `MakeOffset`,
  `MakeColorFilter` — all present.
- `Shader.MakeTurbulence(..., seed, ...)` — present, and seeded.
- `ColorFilter.MakeBlend(color, mode)`, `Paint.setImageFilter`,
  `setColorFilter`, `setBlendMode` — all present.

§4 was rewritten to use dilate as a result.

**Still open — these need Xcode or a device:**

1. **[verify]** `VNInstanceMaskObservation.confidence` exists. If not, drop the
   field — do not substitute a constant.
2. **[verify]** The exact Vision request/handler/masked-image API surface.
3. **[verify]** Whether blur sigma scales with the canvas transform. **This one
   changes the design if the answer is no**, and it is the mandatory device check
   described in §4.
4. **Effect defaults** need to be chosen by eye on a device, not derived.
