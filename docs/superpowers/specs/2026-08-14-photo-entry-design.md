# Photo Entry — Design

**Date:** 2026-08-14
**Status:** approved
**Supersedes nothing.** Extends `2026-08-13-cinematic-import-design.md`, which
built the grade path but left the way in unchanged.

## The problem

The app has three ways to acquire colour — camera, scan, import — and all three
hang off one door: the tab bar's `＋`, which opens the viewfinder. Everything
else is a room inside that door.

Tracing the commonest job, "get a palette (or a cinematic photo) out of a
picture already in my library":

```
＋ → [grant CAMERA] → live viewfinder → IMPORT → [system sheet]
   → pick → auto-read → EXTRACT → result sheet → name → Save
```

Five taps, one permission dialog, and a camera session started and torn down
without ever taking a frame.

### Six findings

1. **Import is unreachable when camera permission is denied.** `/tools/import`
   has exactly one entry — `ViewfinderScreen.tsx:197` — and that screen opens
   `if (!hasPermission) return <PermissionGate/>`, so the IMPORT button is never
   rendered. Anyone who taps "Don't Allow" on the camera loses the ability to
   import a photo permanently. Choosing a photo from the library has nothing to
   do with the camera: Expo SDK 55 states that `launchImageLibraryAsync` needs
   no permission at all. This is a defect, not a design choice.

2. **The four mode tabs are not tabs.** `selectMode` both sets local state and
   pushes a route (`ViewfinderScreen.tsx:90-98`). Returning from PHOTO leaves
   the underline on PHOTO while the screen shows LIVE. Only one of the four
   modes lives on the screen that draws them.

3. **Three `<Camera>` elements hard-code `isActive`.** Viewfinder, Scan and
   Studio each own a session, and mode switching _pushes_, so the previous
   camera keeps running underneath. Vision Camera expects `isActive` to follow
   screen focus. Costs battery, and contends for the sensor on device.

4. **Duplicate affordances.** The IMPORT side button and the PHOTO mode tab go
   to the same route; SCAN and SCAN likewise. Four controls, two destinations.

5. **The picker auto-opens on mount and cancelling is a dead end.**
   `ImportPickScreen` runs `useEffect(() => void pick())`. Dismiss the system
   sheet and what remains is an empty canvas above a radius slider and three
   mode chips that cannot do anything without a photo; the way out is a chip
   below all of it.

6. **The screen is titled "Pick points" but nobody needs to pick points.** The
   automatic whole-image read already produced the palette
   (`ImportPickScreen.tsx:100`). The radius slider, the three modes and the
   eight-point sampler are the advanced path, presented ahead of the common one.

## The shape

The door becomes a question; the camera becomes one of the answers.

```
＋  →  /source  (modal Sheet)
        ├─ recent photos strip ─┐
        ├─ All photos ──────────┼→ useImportPhoto → /tools/grade?id=
        ├─ Camera ──────────────→ /capture      (shutter → result sheet)
        └─ Scan ────────────────→ /tools/scan   (pins  → result sheet)
```

The commonest job becomes two taps with no permission dialog and no system
sheet. The camera goes from two taps to three: that is the price, stated
plainly, and it is paid because the camera is one job among several rather
than the only door.

### Where a chosen photo lands

One destination, not a fork. Tapping a photo saves its palette record and opens
`GradeScreen`, which already carries the look grid and the intensity dial. The
five extracted swatches are drawn beneath the photograph and lead to the
palette detail.

The EXTRACT / MAKE CINEMATIC fork is removed. It asked the user to declare an
intent before they had seen anything, and — since an imported photo always
writes a palette record (per the 2026-08-13 design) — both products exist
whichever branch was taken. The fork chose a screen, not an outcome.

## Units

### `useImportPhoto` — one uri in, one Palette out

`apps/mobile/src/features/capture/useImportPhoto.ts`

Composes what the import path already does, in order: `toDecodableUri` (an
iPhone library is mostly HEIC and the shipped Skia has no HEIF codec) →
`readPalette` → `begin` → `useCaptureCommit`.

Both the recents strip and the All-photos row call this. One implementation
means the two cannot drift into two behaviours for one job.

Returns a discriminated outcome rather than a nullable, because the three
failures want three different sentences:

```ts
type ImportOutcome =
  { ok: true; palette: Palette } | { ok: false; reason: 'decode' | 'tooFewColours' | 'write' };
```

`'tooFewColours'` is the case `tools/import.tsx:32` currently swallows with a
bare `return`. Tapping a photograph and having nothing happen is the worst
state this flow can reach, so it gets a sentence.

### `useRecentPhotos` — the permission state machine

`apps/mobile/src/features/capture/useRecentPhotos.ts`

Five states, five different strips:

| State           | The strip shows                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `unasked`       | a single "Show recent photos" tile; asks on **tap**, not on open                                |
| `granted`       | the twelve newest photos                                                                        |
| `limited` (iOS) | the shared assets, plus a trailing "Choose more" tile calling `presentPermissionsPickerAsync()` |
| `denied`        | nothing — the sheet collapses to its three rows                                                 |
| `unavailable`   | nothing, and no offer to grant — `isAvailableAsync()` said there is no library here             |

`unavailable` is separate from `denied` on purpose: "there is no photo library
on this device" is not a decision anyone can revisit, and offering a permission
button for it is offering a button that cannot work.

Permission is never a precondition. `launchImageLibraryAsync` runs out of
process and needs no grant, so **All photos works in every state**, including a
hard denial. The grant buys convenience only.

Asking on tap rather than on open matters: a permission dialog that appears
because a sheet opened is a dialog the user cannot connect to anything they
did.

`preventAutomaticLimitedAccessAlert: true` is added to the `expo-media-library`
plugin config. We draw our own "Choose more" affordance; left at the default,
iOS also nags once per launch.

Note: `expo-image-picker` and `expo-media-library` both write
`NSPhotoLibraryUsageDescription`. The strings are currently identical and must
stay so; media-library is listed second in `app.json` and therefore wins.

### `SourceSheet`

`apps/mobile/src/features/capture/SourceSheet.tsx`, route
`apps/mobile/src/app/source.tsx` with `presentation: 'modal'`.

Built on the existing `ui/Sheet`. A horizontal `ScrollView` of recents above
three rows: All photos, Camera, Scan. The ScrollView carries
`keyboardShouldPersistTaps="handled"` — the repo's `keyboard-taps` scan
enforces this and has caught it before.

## The camera fixes

**Lifecycle.** `isActive` binds to `useIsFocused()` in all three camera
screens. A new source scan, `no-hot-cameras`, fails on any `<Camera>` whose
`isActive` is written as a bare attribute or a literal `true`. This joins
`keyboard-taps`, `no-dead-controls`, `no-provider-leaks` and
`no-appearance-leaks`: a bug class that pressing things in a test cannot reach.

**Real modes.** The four fake tabs and the two side buttons are removed. What
remains is one row — `LIVE · SCAN · STUDIO` — navigating with `router.replace`.
Replacing rather than pushing is what makes them behave as modes: no stacked
cameras, no stale underline, and Back returns to the tab the user came from
rather than to a camera they already left.

**`ScanScreen` has no permission gate.** It prints "camera needed" and offers
no way to grant it. It gets the same `PermissionGate` the viewfinder uses.

## The point sampler

`ImportPickScreen` keeps its capability and loses its position on the main
path:

- the auto-launching `useEffect` is deleted; `uri` becomes a required prop
- the EXTRACT / MAKE CINEMATIC fork is replaced by one action returning the
  chosen colours to the palette it was opened from
- the route becomes `/tools/pick?id=<paletteId>`, reached from the palette
  detail and from the swatch strip on `GradeScreen`

The cancel-into-emptiness dead end disappears with the auto-launch: the screen
now always opens onto a photograph that already exists.

## Errors

Each step fails in its own words, never pooled into one message:

- the photo will not decode → the read failed, try another photo
- fewer than two colours → this photograph has too little colour to build a
  palette from
- the record will not write → the existing `palette.writeFailed` copy

Permission denial is not an error. The strip collapses and the sheet keeps
working.

## Testing

- `useImportPhoto` — HEIC is converted before reading; a successful read writes
  a palette; a failed read writes nothing and reports its reason
- `SourceSheet` — the four permission states render four strips, and All photos
  remains pressable under `denied`
- `no-hot-cameras` — the source scan described above
- **A reachability test:** with camera permission denied, importing a photo is
  still possible. This is finding 1, written down so it cannot come back.

## Out of scope

Batch grading (slice 5) and cinematic frames / share cards (slice 6) are
unchanged and unaddressed here. Android's `READ_MEDIA_VISUAL_USER_SELECTED`
partial access behaves like iOS `limited` through the same state machine and
needs no separate branch.
