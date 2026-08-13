# Cinematic import: turning a photograph from the library into a graded one

**Date:** 2026-08-13
**Status:** approved

## What this is

Import a photograph and get a cinematic version of it out the other end, and
make the grading half of the product worth paying for.

Everything here is an addition on top of `Grade` — the eleven scalars and two
tints already defined in `packages/domain/src/grading.ts`. There is no second
engine, and `gradeShader.ts` is not modified. That shader is asserted
pixel-for-pixel against `applyGradeToPixel`, and every change to it costs that
proof again; a feature that can be built without touching it should be.

## What the reading found

Three things changed the shape of the work.

### The import path already creates a palette

`/tools/import` does not drop the photograph. It calls `begin()` with the
colours and `photoUri` and hands off to `/capture/result`, which is the same
sheet the shutter feeds. A palette record with a photograph on it is therefore
already the outcome of an import.

### The grade is five steps from the import

`GradeScreen` reads its photograph through `usePaletteParam()`, and the only
link to it is `PaletteWorkbench`'s `{ route: 'grade' }` row. So reaching a grade
from an imported photograph is: import → result sheet → save → open the palette
→ workbench → grade.

Nothing about that sequence is broken. It is simply not what "make this
photograph cinematic" means, and no amount of new looks fixes a five-step path
to the looks.

### There is no way to save a graded photograph

`bakeGradedThumbnail` renders at a 1024px long edge, deliberately — it exists to
keep the library grid smooth, and its own comment calls it "a thumbnail with a
look, not a second master". `expo-media-library` is not in the dependency set, so
nothing in the app can write to the camera roll.

The feature the user asked for therefore does not exist at any resolution. This
is the real gap, and it is the second slice rather than the fourth.

## Free and Pro

**Export is unrestricted.** Full resolution, no watermark, for everyone. This is
a deliberate decision not to tax the output, and it means the purchase argument
has to be carried by the looks and the controls rather than by the file.

`entitlements.ts` already argues this position for the library, and the automatic
grade is already free for the same reason: it is the product's central claim.

Pro buys `advanced_grading` — the look library beyond the free tasters, and
per-parameter manual control. No new entitlement is introduced.

`watermark_free_share` is unaffected and keeps its current meaning: it governs
**share cards**, which carry the wordmark on the free tier. An exported
photograph is not a share card and never carries one.

## Slice 1 · The way in

`ImportPickScreen` gains a second primary action, **"Make cinematic"**, beside
the existing EXTRACT.

It commits the palette through the same write the result sheet uses, then
`router.replace('/tools/grade?id=<new>')` instead of `/capture/result`.

EXTRACT is untouched and still goes to the result sheet. Two intents, two
buttons, one record behind both. The palette is created either way, so the
photograph is in the library, `Rewind` and `Smart Collections` see it, and
re-grading it a year later starts from the original frame exactly as it does for
a captured one.

**New code: one button and one navigation branch.** No new component.

## Slice 2 · Full-resolution export and saving

The slice that makes the feature exist.

### Rendering

`bakeGrade.ts` splits: `renderGraded(uri, grade, { longEdge })` does the work,
and `bakeGradedThumbnail` becomes a call to it with `longEdge: 1024`. The
existing bake path keeps its behaviour, byte for byte — it is the same code with
its constant lifted into a parameter.

### The resolution ceiling

**4096px on the long edge, not the source's own size.**

A 48MP frame through `Skia.Surface.MakeOffscreen` is the shortest path to an
out-of-memory crash on an older device, and a crash while saving is worse than a
long edge someone has to be told about. 4096px prints A3 at 300dpi, which is past
where anyone is taking a phone photograph.

Photographs smaller than the ceiling are rendered at their own size and never
upscaled.

### Saving

`expo-media-library` is a new native dependency. It requires an iOS prebuild and
`NSPhotoLibraryAddUsageDescription` in `app.json`. This is the only native change
in the whole design.

`GradeScreen` gains **Save photo** and **Share**. Both act on the grade currently
shown, including an unsaved one — someone who has moved a slider and wants that
frame should not have to apply it to the record first.

### States

Permission denied is a real state and is drawn: iOS add-only permission can be
refused, and a Save button that silently does nothing is the worst outcome. A
render that returns null (undecodable file, surface allocation failure) reports
itself rather than appearing to succeed.

## Slice 3 · Look intensity

`scaleGrade(grade, amount)` in the domain — pure, total, unit-tested without a
GPU. Linear interpolation of each parameter towards `NEUTRAL_GRADE`.

Two decisions carry it.

**Tint hues do not interpolate; only `strength` does.** Interpolating a hue takes
the wrong way round the circle across the 0/360 seam, so a blue shadow would pass
through red on its way to nothing. The hue is already the right hue at any
strength.

**Intensity is never stored.** What lands on the record is the scaled `Grade`.
Storing an intensity alongside the grade would mean a schema migration and two
sources of truth for one look, and every consumer — the shader, the bake, the
library card, `describeGrade` — would have to learn to multiply before reading.
The slider is a way of producing a grade, not a property of one.

At `amount = 1` the result is the input grade unchanged; at `0` it is
`NEUTRAL_GRADE`. Both are asserted.

**Free.** It makes the automatic grade — the part that must stay free — usable
rather than take-it-or-leave-it.

## Slice 4 · The look library

`FILM_STOCKS` (six) becomes `LOOKS` (~30), each gaining a `collection` field.
Five or six named collections.

The type does not change, so `gradesEqual`, `describeGrade`, storage, the bake
and the shader learn nothing new. `filmStock(id)` is kept as a lookup over the
wider set so existing call sites and any stored `FilmStockId` keep resolving.

### Keeping thirty looks honest

Data is cheap to add and easy to fake, so two tests stand in for the judgement a
colourist would apply:

1. **No two looks are `gradesEqual`.** Two entries with the same numbers under
   different names is selling the same thing twice.
2. **Every look yields a non-empty `describeGrade` other than `['untouched']`.**
   A look that cannot be said in words is a look that does nothing.

Both are cheap, and both fail loudly the moment someone pads the list.

### Drawing the grid

Thirty preview tiles is thirty Skia canvases in a scrolling list, which is the
same trap `bakeGrade`'s comment describes for the library grid.

The photograph is decoded **once** at ~128px and the resulting `SkImage` is
shared by every tile. Each tile is then a small canvas over shared pixels with
its own uniforms — one decode, thirty cheap draws, and no file I/O per tile.

### The free tasters

**One look per collection is free**; the rest require `advanced_grading`.

A wall of thirty locked chips tells someone the app is not for them. One working
look per collection tells them what the collection is, which is the thing worth
paying to unlock.

This loosens what ships today, where all six stocks are Pro. That is intended:
six locked chips was already a wall, and it is a worse one at thirty.

## Slice 5 · Batch grading (Pro)

A screen of its own. It does not reuse `GradeScreen`: that screen is built around
one photograph, its live preview and its record, and none of those are singular
here.

Pick photographs, pick one look, export them all.

The queue is **sequential, not parallel** — each render holds an offscreen
surface at up to 4096px, and running several at once is the memory failure of
slice 2 multiplied. Progress reads `n of m`. A photograph that fails is named in
a list at the end and does not abort the others.

The most expensive slice, and last for that reason.

## Slice 6 · Cinematic frames and share cards

`renderShareCard` currently draws a palette. It gains a mode that draws the
**graded photograph**: a 2.39:1 frame, a film border, the look's name set small.

`SHARE_SIZES` and the `watermark_free_share` entitlement already exist and are
reused unchanged.

## Order, and why

**1 → 2 → 3 → 4 → 6 → 5**

Slices 1 and 2 are the whole promise; without an export there is no feature at
any number of looks. Slice 3 is cheap and multiplies the value of every look that
follows it. Slice 4 is the purchase argument. Slice 6 is a free marketing
channel. Slice 5 costs the most and is last.

## Verification

Every commit leaves `pnpm typecheck`, `pnpm lint`, `pnpm test` and
`pnpm format:check` green, the domain's vitest suite green, and
`expo export --platform ios` bundling.

New tests:

- `scaleGrade` — endpoints, monotonicity, tint hue preservation, schema validity
  across the range.
- `LOOKS` — distinctness, describability, and that every entry parses as
  `gradeSchema`.
- `renderGraded` — that the ceiling caps the long edge and never upscales.

**Nothing here can be judged on this machine.** Whether a look reads as cinematic
needs a device and an eye. What the tests protect is that the arithmetic is
sound, the looks are distinct, and nothing silently fails.
