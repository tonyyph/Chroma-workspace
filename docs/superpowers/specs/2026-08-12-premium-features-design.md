# Premium features: review, selection, and the first slice

**Date:** 2026-08-12
**Status:** approved

## What the review found

Seven features were proposed. Reading the source first changed the shape of the
work in four ways.

### One proposal is already built

**AI Music Pairing** is not a new feature; it is the product's spine, and it is
roughly ninety per cent complete: `atmosphere.ts` reads mood from OKLCh offline
in under a millisecond, `intent.ts` is the typed intermediate representation
between colour science and a catalogue, `ranking.ts` scores candidates and
already carries a `preferenceBias` learned from the device, `pairing.ts` runs the
five-stage pipeline with partial success and named degraded states, and
`PairScreen` plays previews through `PreviewPlayer` before anything is committed
to a memory. Rebuilding it would be demolition. Feeding it — with Style DNA — is
the work worth doing.

### Three technical claims in the proposals are not currently true

1. **A 60 FPS professional camera filter is blocked below the JavaScript layer.**
   `usePhotoRead.ts` records it: `react-native-vision-camera-worklets` fails to
   compile against React Native 0.83 because it includes
   `React/RCTMessageThread.h`, a private header the prebuilt React pods do not
   expose. No frame processor means no access to preview pixels. What is
   achievable is a Skia composite over the preview as an approximation, plus an
   exact grade applied to the frame the shutter captures. Selling "real-time 60
   FPS filters" without saying this would be selling something that does not
   exist.
2. **Living Memory has no video encoder available.** Animated playback inside the
   app is straightforward with Skia and Reanimated. Writing an `.mp4` needs a
   native module that is not in the dependency set.
3. **"Group by person and place" has no data behind it.** There is no face data,
   and `palette.location` is a free-text field, not a coordinate. Season, mood,
   colour, music and time are free; people and places are a separate project with
   their own privacy cost.

### The word "AI" is an architectural decision, and it is already made

`atmosphere.ts` states the philosophy plainly: deterministic, total and pure, so
the product "works on a plane, costs nothing per capture, can be unit-tested at
its thresholds, and cannot hallucinate". `analysis.ts` already defines vision and
language provider interfaces, unwired, under a standing rule — a model may
_refine_ a reading and may never _originate_ one.

**Decision: grading infers on device, deterministically.** Photographs never
leave the phone. The UI does not call it AI, because it is not one, and naming it
honestly is part of the finish.

## Selection

**Chromatic Grade → Living Memory → Smart Collections & Rewind.**

Camera Studio ranks fourth on purpose: the grading engine must exist before a
camera has anything to preview, so building the camera first is building it
backwards. Style DNA is not a product anyone buys on its own; it is a multiplier,
and it attaches to Rewind rather than occupying one of the three places.

## Slice 1 · Chromatic Grade

### The grade

Parametric — eleven scalars and two tints — not a LUT and not a colour matrix.

| Group      | Parameters                                                               |
| ---------- | ------------------------------------------------------------------------ |
| Exposure   | `exposure`, `contrast`, `lift` (raise or crush blacks — the filmic part) |
| Colour     | `saturation`, `temperature`, `tint`                                      |
| Split tone | `shadowTint {hue, strength}`, `highlightTint {hue, strength}`            |
| Texture    | `vignette`, `grain`                                                      |

A LUT was rejected: it cannot be derived arithmetically from a measurement, cannot
be explained in a sentence, cannot be nudged, and costs ~100KB each. A colour
matrix was rejected: it cannot express split-toning or lift, which are precisely
what makes a grade read as film.

### Where a grade comes from

`gradeForAtmosphere(atmosphere, metrics)` — pure and total, the same contract as
`atmosphere.ts`. Each of the eight moods carries a base grade, modulated by
measurements the app already takes: `meanLightness` drives exposure,
`lightnessRange` drives contrast, `meanChroma` drives saturation, and the
dominant hue drives temperature. Deterministic, so it is testable at its
thresholds.

Film stocks are presets **in the same shape**, which makes the automatic grade and
a named stock one type, and makes "start from the automatic one and nudge it"
nothing more than editing numbers.

### Rendering

One SkSL runtime effect, with two consumers: a GPU preview in a `<Canvas>`, and an
offscreen surface for export, following the pattern `readPalette` already uses.

A pure-JavaScript reference implementation, `applyGradeToRgba`, lives in the
domain. The maths is tested without a GPU, and the shader is asserted against the
reference at sample points. That agreement is what makes the whole feature
testable rather than eyeballed.

### Placement and persistence

Reachable from the capture result and from a palette's workbench, at
`/tools/grade`. The grade is stored on the memory record as a new nullable field,
which is a widening migration and a `schemaVersion` bump.

### Free and Pro

The automatic grade, applying it, and saving it are **free**. It is the product's
central claim, and `entitlements.ts` already warns against taxing the action the
product needs someone to repeat.

Pro buys `advanced_grading`: the film stock set, per-parameter manual control,
full-resolution graded export, and graded wide-gamut export.

### States

There is no offline state, because nothing here leaves the device — that is a
selling point, not a limitation. An undecodable file reuses `toDecodableUri`.
Sliders carry `accessibilityValue`, and `describeGrade` renders a grade as a
sentence for screen readers.

## Slices 2 and 3, in outline

**Living Memory** — built. A memory is performed rather than listed: the graded
photograph drifts, the palette breathes, the atmosphere is named, the track plays
under it.

Two decisions carry it. The **motion is derived, not templated** — pacing comes
from the atmosphere, so a serene memory breathes at 2.6 seconds a cycle and a
vivid one at 0.7; a template would say the same thing about a still lake and a
lit dance floor. And **the audio is the clock** whenever audio is playing: a
picture on its own timer and music on the audio device disagree within seconds,
and a cut landing off the music is what makes a montage feel cheap.

The invariant the player leans on is that scenes tile the runtime with no gap and
no overlap — a gap is a black frame in the middle of someone's memory — asserted
directly rather than watched for.

**No video export, and no button that would fail.** Nothing in the dependency set
can encode one. The screen says what is missing. Adding it means adding a native
encoder first.

**Smart Collections & Rewind** — built. Collections form themselves by month,
mood, colour, artist and genre; "on this day" and month/year recaps look back;
Style DNA is the profile all three read from and feeds `ranking` at about a
third the strength of explicit feedback — turning a track down is a statement,
photographing warm rooms is a habit, and a habit must not shout over a statement.

Everything is derived and nothing is stored, the rule
`feedback.accumulatePreference` already set: one source of truth, deleting a
memory genuinely removes its influence, and changing how taste is read takes
effect immediately.

Two thresholds carry the honesty. Three members before a collection exists — two
of a thing is a coincidence. Four before a recap exists, because rendering
"0 memories, no mood, no colours" at someone about a quiet month is a thing an
app should not say.

**No seasons, and the reason is stated in the module.** A season is not a
property of a date — December is summer for half the world — and `location` is
free text a person typed, never a coordinate, so the hemisphere would have to be
guessed. Months say something true everywhere. The related timezone limit in
"on this day" is asserted in a test rather than hidden: `capturedAt` is an
instant and the offset was never stored, so fixing it properly means changing
the capture record.

## Verification

Every commit leaves `pnpm typecheck`, `pnpm lint`, `pnpm test` and
`pnpm format:check` green, and the domain's own vitest suite green. Metro must
still bundle: `expo export --platform ios`.

Nothing here can be verified on hardware from this machine. Grade rendering, in
particular, needs a device before anyone claims it looks right.
