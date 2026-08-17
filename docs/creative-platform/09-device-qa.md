# 09 — Device QA

**Date:** 2026-08-17
**Covers:** Phase 1 as actually built at `ec0e51f`, not as specified.

> **Two changes landed after this checklist was written**, both of which §3's
> critical path now exercises:
>
> - **Tap-to-select** on the canvas (`elementAt` in the domain, plus a tap gesture
>   composed with the drag). Before it, nothing could be selected, which made
>   move, resize, delete and lock unreachable. Worth testing deliberately: tap
>   overlapping elements and confirm the **topmost** is selected, and that a tap
>   on empty space deselects.
> - **The You-tab entry point**, which makes §10 item 3 accurate as written.
>
> The rest of §10 stands unchanged.
> **Why it exists:** the brief forbids claiming completion "without testing the full
> create → edit → preview → export flow", and none of that can be verified in Jest.
> Skia's offscreen surfaces, Vision Camera, MMKV and the photo picker are all
> native; a simulator covers some of it and a real phone covers the rest.

This checklist was written by reading the shipped source, so every item below
corresponds to something that exists. Items the brief asks for but Phase 1 does
not yet build are listed in §10 as **gaps, not failures** — do not raise bugs for
them.

---

## 1. Before you start

**Expo Go will not work.** The app depends on `@shopify/react-native-skia`,
`react-native-vision-camera`, `react-native-mmkv` and `react-native-nitro-image`,
none of which are in the Go runtime. You need a development build.

```sh
corepack pnpm ios                      # local dev build, runs ensure-skia first
corepack pnpm eas:build:dev:ios        # or EAS, if you are not on a Mac
corepack pnpm eas:build:dev:android
```

Then `corepack pnpm dev` to start the bundler.

**Device matters.** Export renders 1080×1350 (or 1080×1920) offscreen surfaces
one slide at a time and decodes source photographs at up to 4096px. A current
flagship will hide the problems this is most likely to have. Test at least one
older device — the memory ceiling in `bakeGrade.ts` exists because of a real
out-of-memory crash on one.

**Have ready:** a photo library with at least 5 images, including one portrait,
one landscape, and one shot rotated (to exercise EXIF orientation, risk R4).

---

## 2. Scope of this pass

In: create a story, place photos, edit on a continuous canvas, undo/redo,
autosave, preview, export, share.

Out (later phases): templates, music attachment, palette intelligence, Colour
Flow, the AI composer, snapping and guides, the layer panel, video.

---

## 3. Critical path — create → edit → preview → export

The single flow the brief says must work end to end. If any step here fails,
Phase 1 is not done.

| #    | Step                                      | Expected                                                     | ✅  |
| ---- | ----------------------------------------- | ------------------------------------------------------------ | --- |
| 3.1  | You tab → the Story Studio entry          | Opens `/story/new`                                           | ☐   |
| 3.2  | Pick photos                               | Picker allows up to **5**; count reflects the selection      | ☐   |
| 3.3  | Choose a format                           | Three offered: portrait 4:5, square 1:1, story 9:16          | ☐   |
| 3.4  | Create                                    | Lands in the editor; one slide per photograph                | ☐   |
| 3.5  | Each photo is full-bleed on its own slide | No letterboxing, no blank trailing slide                     | ☐   |
| 3.6  | Drag a photo                              | Follows the finger with no lag; does not jump on first touch | ☐   |
| 3.7  | Pinch a photo                             | Scales about the pinch centre; stays put when released       | ☐   |
| 3.8  | Drag a photo **across a slide boundary**  | Crosses freely; is one element, not two                      | ☐   |
| 3.9  | Add text                                  | Appears, is editable, wraps inside its frame                 | ☐   |
| 3.10 | Add a palette strip                       | Bands are **proportional**, not equal, and match the source  | ☐   |
| 3.11 | Undo repeatedly                           | Reverses one gesture per tap, not one frame per tap          | ☐   |
| 3.12 | Redo                                      | Restores exactly what undo removed                           | ☐   |
| 3.13 | Preview                                   | Shows the slides as they will export; swipes cleanly         | ☐   |
| 3.14 | Export                                    | Progress advances; completes; correct number of images       | ☐   |
| 3.15 | Share sheet                               | Opens with all slides, **in order**                          | ☐   |

---

## 4. The seam — the thing the whole feature is for

This is the differentiator, and the only part that cannot be judged one slide at
a time. Do it deliberately.

- ☐ **4.1** Place one element so it straddles a slide boundary — a wide photo, or
  a text line, roughly centred on the join.
- ☐ **4.2** Export.
- ☐ **4.3** Open the two exported images side by side in Photos. The element must
  continue **exactly** across the cut: no gap, no doubled column of pixels, no
  half-pixel blur on either edge.
- ☐ **4.4** Post the set to a real Instagram carousel (a private/test account) and
  swipe. The transition should read as one continuous picture.
- ☐ **4.5** Repeat at 1:1 and at 9:16. The arithmetic is format-independent, so a
  failure at one ratio and not another points at the format table, not the slicer.
- ☐ **4.6** Zoom the canvas right in, then right out, then export again. Camera
  zoom must not affect output at all — it is a view transform, not a document one.

**If 4.3 fails, stop and report it.** Everything else in this document is
secondary to that one property.

---

## 5. Export fidelity

- ☐ **5.1** Exported files are exactly 1080×1350 (portrait), 1080×1080 (square),
  1080×1920 (story). Check in Photos → Info, not by eye.
- ☐ **5.2** Every slide is the same dimensions as every other.
- ☐ **5.3** No editor furniture in the output — no slide dividers, no selection
  handles, no grid, no safe-zone rectangles.
- ☐ **5.4** Colours in the export match the canvas. A visible shift means a
  colour-space problem, not a rendering one.
- ☐ **5.5** A photograph placed at full bleed is sharp, not upscaled-soft — the
  export must be reading the master, not the 1024px editing preview.
- ☐ **5.6** Filenames sort in slide order in the share sheet.
- ☐ **5.7** Cancel an export midway. It stops promptly, leaves no partial file in
  the share sheet, and the editor is still usable.
- ☐ **5.8** Export twice in a row. The second run does not accumulate duplicates
  from the first.

---

## 6. Persistence, autosave and crash recovery

- ☐ **6.1** Edit, wait ~2s, force-quit from the app switcher, reopen. The edit
  survived.
- ☐ **6.2** Edit and force-quit **immediately** (under the autosave debounce). The
  story still opens — losing the last edit is acceptable; losing the story is not.
- ☐ **6.3** Background the app mid-edit, return after a minute. State intact, no
  blank canvas.
- ☐ **6.4** Create two stories. Corrupting or losing one must never affect the
  other (one key per story is the design; this checks it holds).
- ☐ **6.5** Delete the source photograph from the iOS photo library, then reopen
  the story. It must render the imported copy, not a blank — the app copies into
  its own document directory precisely so this works.
- ☐ **6.6** Leave the app for long enough that iOS purges caches (or use a
  low-storage device). Reopen. Slides still render.

---

## 7. Performance and memory — treat as a product feature

- ☐ **7.1** Drag an element continuously for ~10 seconds. No dropped frames, no
  progressive slowdown.
- ☐ **7.2** With 5 slides, pan and pinch the whole canvas. Stays smooth.
- ☐ **7.3** Watch memory in Xcode Instruments during an export. It should stay
  roughly flat — one slide's surface at a time — not climb per slide.
- ☐ **7.4** Export on the oldest device you have. It completes rather than being
  killed.
- ☐ **7.5** Trigger a memory warning (Instruments → Simulate Memory Warning) mid
  edit. The app survives; the canvas re-renders rather than crashing.
- ☐ **7.6** Rapid undo/redo spam does not stall the UI.

---

## 8. Both skins, and both languages

The app has two complete appearances and ships EN + VI. Every screen must be
checked in all four combinations — this is where the guard tests cannot help.

- ☐ **8.1** Editor in **chroma**: depth, glass, the violet field. Legible.
- ☐ **8.2** Editor in **swiss**: paper, ink, one signal red, **no glass and no
  depth**. Controls must still read as controls without shadow to separate them.
- ☐ **8.3** Text elements typeset correctly in both — a story stores a _role_, so
  the same document should look right under either skin, not identical.
- ☐ **8.4** Switch skin **while the editor is open**. Nothing breaks; the document
  is unchanged.
- ☐ **8.5** Switch to Vietnamese. No truncated buttons, chips or tab labels —
  Vietnamese runs ~25–30% longer and the editor dock is the tightest space in the
  app.
- ☐ **8.6** No untranslated English strings anywhere in the flow.

---

## 9. Accessibility

- ☐ **9.1** VoiceOver: every editing control has a meaningful label, not "button".
- ☐ **9.2** VoiceOver announces undo and redo (the code calls
  `announceForAccessibility`; confirm it is actually spoken).
- ☐ **9.3** Selection is indicated by more than colour alone.
- ☐ **9.4** Touch targets are comfortably hittable — the brief's floor is 48×48.
- ☐ **9.5** Enable **Reduce Motion**. Canvas transitions become immediate; nothing
  becomes _unavailable_. Reduced motion must not mean reduced function.
- ☐ **9.6** Increase text size. App chrome adapts; the canvas itself does not
  reflow — a story's typography is content, and resizing it would corrupt the
  user's composition.

---

## 10. Known gaps — do not file these as bugs

Verified against the source at `ec0e51f`. These are Phase 1 boundaries, several
of them deliberate decisions recorded in the audit.

1. **Up to 5 photographs, not 20.** `MAX_PHOTOS = 5` in `NewStoryScreen`.
2. **Three formats, not four.** No TikTok cover yet — it is a second safe-zone
   profile over the existing 1080×1920, deferred until something draws safe zones.
3. **One entry point.** Reachable from the You tab only; `Memory → Create Story`
   is not wired yet.
4. **No templates, music, palette intelligence, Colour Flow or AI composer** —
   Phases 3 and 4.
5. **No snapping, guides or layer panel** — Phase 2.
6. **No video.** Decision D2: the app has no video dependency, no video
   permission, and Skia's offscreen compositor has no video frame source. The
   element type exists in the schema and cannot be constructed.
7. **Nothing is purchasable.** There is no billing provider in this app; `free` is
   the only tier a device can reach. Premium gates can be exercised only via the
   dev tier toggle in a `__DEV__` build.
8. **Waveform elements, when they arrive, are decorative.** No provider available
   to this app reports tempo, valence or waveform data, and nothing decodes audio.

---

## 11. Reporting

For anything that fails, record: device and OS, skin, language, format, slide
count, and whether it reproduces on a second device. For §4 failures attach both
exported images uncropped — a seam is invisible in a screenshot of one slide.

Re-run `corepack pnpm check` before and after any fix; it was green at `ec0e51f`.
