# Chroma Story Studio — product and technical specification

**Status:** product intent current · **§6's schema detail is superseded**
**Date:** 2026-08-17
**Depends on:** `docs/chroma-story-studio-audit.md`,
`docs/chroma-story-studio-adr-canvas-export.md`
**Normative schema:** `packages/domain/src/story/` (code, not prose)

> **Read this before §6.** The implementation was handed to a second session,
> which built the domain module to a different shape. The source remains the
> normative schema — but it is now _their_ schema, and §6 below describes mine.
> Concretely, the code uses `kind` where §6 says `type`, `layers` where it says
> `elements`, three formats rather than four, four element kinds rather than
> eleven, and blocks video by making its schema always fail rather than by
> excluding it from a constructible list.
>
> **What still holds:** everything that is not the element model. The product
> goal, the two entry points, setup, the seamless-canvas premise, gesture
> arbitration (§7), palette and music intelligence (§8) — including the honest-
> inputs-only rule — templates, editor layout, export requirements, persistence
> principles, accessibility, monetization and analytics are all unaffected by the
> schema divergence and were written against constraints that have not changed.

---

## 1. What it is

Chroma Story Studio turns one or more Chromatic Memories into a **seamless
multi-slide carousel** — a single continuous composition, sliced into
pixel-aligned images that read as one picture when swiped.

It is not a collage editor that happens to live in Chromawave. The distinction is
carried by four things nothing else in the category has:

1. **The palette is real.** Every memory carries measured colours at measured
   proportions, with weights that sum to one and roles that mean something
   (`dominant`, `support`, `signal`). A palette strip here is a reading, not a
   decoration.
2. **The atmosphere is measured, offline, from the photograph itself** — warmth,
   saturation, contrast, spread, luminosity, mood. It is what the app already
   uses to choose music, and it is what will choose pacing and colour progression.
3. **Colour Flow** — a controlled palette transition across the whole carousel,
   which only makes sense in a product that treats the carousel as one canvas.
4. **The track is attached and credited honestly**, with no claim that a static
   image contains audio.

## 2. Non-goals

- Not a general design tool. No arbitrary font upload, no imported sticker packs,
  no vector pen tool.
- **No video in Phase 1.** Audit decision D2. The element type exists in the
  schema and is deliberately not constructible.
- No second subscription system. Gates reuse `EntitlementProvider`.
- No cloning of any competitor's templates, layouts, copy, or identity.
- Does not modify Capture, Pair, Collect or Discover.

---

## 3. Entry points

**A — from a memory.** `Memory → Create Story`, on `PaletteDetailScreen`. The
memory's photograph, palette, atmosphere and attached track pre-populate the
project; `origin: 'memory'`, `sourceMemoryIds: [id]`.

**B — from the Studio.** `Studio → New Story → select photos`. Multi-select of
1–20 items from the library or the photo picker. `origin: 'blank'` or
`'template'`.

Both converge on the same setup sheet and the same editor. There is no second
code path.

---

## 4. Story setup

The setup sheet collects four things and nothing else:

| Choice     | Options                                                | Default                              |
| ---------- | ------------------------------------------------------ | ------------------------------------ |
| Media      | 1–20 photos                                            | the selection that opened it         |
| Format     | 4:5 post · 1:1 square · 9:16 story · 9:16 TikTok cover | 4:5                                  |
| Slides     | 1–20                                                   | one per selected photo, capped at 20 |
| Start from | Blank · a template                                     | Blank                                |

Custom/freeform sizes are **not offered**. Every format in `STORY_FORMATS` is
1080px wide with an integer height, which is precisely what makes the slicing
arithmetic in the ADR exact. An arbitrary user-entered size reintroduces
fractional boundaries — the one thing the architecture is built to exclude — for
a case no listed destination needs.

**On import**, for each item, in this order:

1. Copy the original into `Paths.document/story-assets/`, following
   `lib/photos.ts`'s rule — picker and camera hand back cache paths, and iOS
   purges those.
2. Read and normalise orientation; record what was applied in
   `StoryAsset.appliedOrientation`. This is stored rather than assumed because
   nothing in this codebase reads EXIF today (risk R4).
3. Generate an editing preview at ≤1024px long edge (`THUMBNAIL_LONG_EDGE`).
4. Record `byteSize`, so the drafts screen can show storage impact truthfully.

Originals are never modified. Export reads originals; the editor reads previews.

A draft is created and autosaved **before the editor opens**, so a crash during
first edit loses nothing.

---

## 5. The canvas

One logical canvas, `slideWidth × slideCount` wide. Slide boundaries are guides,
not containers. An element crossing one is one element.

**Navigation.** Pan and pinch move a _camera_ (`geometry.ts:Camera`); the
document never changes. Two states are one tap apart: `fitAll` (the whole
composition) and `fitSlide` (one slide filling the viewport). A filmstrip below
the canvas selects slides and reorders them by drag.

**Guides.** Slide boundaries always; grid, safe zones and bleed on toggle
(`StoryEditorState`). Safe insets are advisory and never clip — a TikTok cover's
right rail is drawn, not enforced.

**Slides.** Add, remove, reorder, up to 20. Removing a slide does not delete
elements; it narrows the canvas, and elements beyond the new edge stay in the
document as off-canvas content. This is recoverable and visible in the layer
list, which is better than destroying work as a side effect of a layout change.

---

## 6. Elements

Defined normatively in `packages/domain/src/story/elements.ts`. Eleven types:
photo, video _(not constructible)_, text, shape, paletteStrip, gradient,
musicCard, waveform, frame, sticker, stroke.

Shared by all: `id`, `frame` (logical pixels), `rotation`, `opacity`,
`blendMode`, `locked`, `hidden`, `shadow`. Layer order is the array index — index
0 draws first. Every mutation is immutable and produces a new document.

Three decisions worth restating because they are load-bearing:

- **Text stores a role, not a font.** `hero`/`display`/`title`/`body`/`caption`/
  `mono` resolve through the active skin, so the same story typesets correctly in
  both Chroma and Swiss. Storing a family name would bake one skin into the
  user's work.
- **Crop is normalised (0–1), not pixels**, so it means the same thing against a
  1024px preview and a 4096px original. A pixel crop would silently differ
  between edit and export — a seam of a different kind.
- **Blend modes are a closed list of five**, each verified to export identically.
  The brief's rule is "only when reliably exportable"; the honest implementation
  of that rule is an allowlist a device test can extend, not Skia's full set.

The **musicCard holds no track data** — it points at `StoryProject.track`. Two
copies of a title is one copy too many, and the stale one is always the one on
screen. The schema refuses a music card with no track, exactly as `memory.ts`
refuses a paired memory with no track.

The **waveform is declared decorative** in the schema comment, in the UI label,
and in this spec. No provider available to this app reports waveform data, tempo,
or audio energy. It is a deterministic figure from a seed, shaped by the
_colour_-derived energy the app genuinely measures. It is never presented as a
visualisation of sound.

---

## 7. Gestures and precision

Gesture arbitration is designed explicitly, because the audit found no
multi-touch precedent in this codebase to inherit (risk R1).

| Input                           | When nothing is selected                 | When an element is selected                   |
| ------------------------------- | ---------------------------------------- | --------------------------------------------- |
| One-finger drag on empty canvas | pan camera                               | pan camera                                    |
| One-finger drag on an element   | select, then move                        | move it                                       |
| One-finger drag on a handle     | —                                        | resize / rotate                               |
| Two-finger pinch                | zoom camera                              | zoom camera                                   |
| Two-finger rotate               | —                                        | rotate the element                            |
| Tap                             | select topmost unlocked, visible element | select, or deselect on empty                  |
| Long press                      | —                                        | quick actions: duplicate, lock, delete, order |

The rules that keep this unambiguous:

1. **A gesture's role is decided at its start and never changes mid-gesture.** A
   drag that began on the canvas pans the canvas even if it passes over an
   element.
2. **Element manipulation always wins over camera panning** when the gesture
   starts on a selected element. Canvas pan requires an empty-space start.
3. **Two-finger rotation is enabled only while an element is selected**, and only
   past a rotation threshold, so a slightly-uneven pinch zooms rather than
   spinning the user's photograph.
4. **Locked and hidden elements are not hit-testable.** They remain selectable
   from the layer list, which is also the screen-reader path.
5. **Slide navigation is not a gesture.** It is the filmstrip and the
   fit-all/fit-slide toggle. Making it a swipe would compete with both canvas
   panning and element dragging, and the brief explicitly requires that element
   manipulation never trigger slide navigation.

**No gesture frame reaches React.** Transforms live in Reanimated shared values;
the document is written once, on gesture end. Undo therefore gains one entry per
gesture rather than sixty per second.

**Snapping** (Phase 2) targets, in priority order: slide edges and boundaries,
canvas centre, slide centres, the grid, and nearby element edges/centres.
Threshold in _view_ pixels, converted to logical via the camera scale, so
snapping feels identical at every zoom level. Haptic feedback on engage
(`ExpoHapticsService`), on hitting a canvas boundary, and on destructive actions.
Numeric inspectors give exact position, size, rotation and opacity.

---

## 8. Chromawave intelligence

### 8.1 Palette intelligence

From the selected memories:

- Gather each memory's colours (already measured, weights already summing to one).
- Derive a unified **story palette**: `colors`, `background`, `foreground`,
  `accent`.
- `foreground` is chosen with `readableOn(color, background, 4.5)` from
  `domain/color.ts`, so text contrast is accessible by construction, not by
  review.
- Report warm/cool balance (`facets.warmth`), contrast and visual rhythm
  (`atmosphere.contrast`, `atmosphere.spread`).
- `lockedIndices` pins brand colours against templates and Colour Flow.
- "Apply to all slides" rewrites background/foreground/accent across the
  document in one undoable action.

All of this uses `domain/color.ts` and `domain/atmosphere.ts` as they are. **No
new colour maths is written.**

### 8.2 Colour Flow

A controlled progression across the full carousel: interpolate the background
(and optionally accent) from the first slide's colour to the last, in **OKLab**,
sampling at each slide's centre. Locked colours are fixed points the ramp passes
through rather than over. This is the tool that only exists because the carousel
is one canvas.

### 8.3 Music

Attach a track from the memory's existing pairing, or search via the existing
`MusicProvider`. The story stores a full `MusicTrackReference` — and **no preview
URL**, because those are provider-controlled, temporary, and never persisted.

Rendered surfaces: artwork, title, artist, the music card, the decorative
waveform, and `attribution` — which is a licence condition and therefore not
optional in the schema.

**Music's influence on the visual system uses only inputs we actually have**
(audit decision D1). Tempo, valence and danceability are unavailable from every
provider open to this app, and `music.ts` refuses to pretend otherwise. The
deterministic inputs are:

| Input            | Source                              | Drives                                      |
| ---------------- | ----------------------------------- | ------------------------------------------- |
| energy (0–1)     | `facets.energy` — colour-derived    | waveform amplitude variance, layout density |
| warmth (−1–1)    | `atmosphere.warmth`                 | palette bias                                |
| luminosity (0–1) | `atmosphere.luminosity`             | background weight, scrim strength           |
| mood             | `atmosphere.mood`                   | typography mood, pacing                     |
| genre / era      | `track.genres`, `track.releaseYear` | template texture and type treatment         |

A short in-app preview plays only where the provider supplies one, through the
existing single `PreviewPlayer`. Where it does not, the reason is shown
(`previewUnavailableReasons`), never a spinner.

**Exported images never imply embedded audio.** No play button is rendered into a
slice. The music card shows a track; it does not show a player.

### 8.4 AI Story Composer

Optional action, premium. Analyses the selected memories and proposes slide
order, pacing, focal image per slide, crop suggestions, palette progression,
typography mood, short captions, and a track.

Three rules, taken directly from the pattern `analysis.ts` already enforces:

1. **The model returns a validated JSON patch against an already-constructed
   local baseline** — never a document from scratch, never executable UI code.
   Anything that fails validation is discarded whole, and the baseline stands.
   This mirrors `acceptRefinedIntent`, which is all-or-nothing for the stated
   reason that merging the valid half of a malformed response "would produce an
   intent no one designed — part measurement, part corruption — and it would do
   so silently."
2. **The model cannot introduce media or tracks.** Patches reference only asset
   ids and track ids the caller supplied, and unknown ids are dropped — the
   `retainKnownExplanations` rule.
3. **The result is a starting point and stays fully editable**, and arrives as a
   single undoable action.

**No AI provider is implemented in this repo**, so the shipped default is the
**deterministic local composer**: order by `capturedAt`, focal crop by palette
weight centroid, palette progression by Colour Flow, pacing by `atmosphere.mood`.
It is a real feature that runs offline, not a stub. The remote interface is
defined so a provider can be added without touching the editor.

---

## 9. Templates

Eight original families, data-driven — a template is a function from
`(slideCount, media, palette, track, skin)` to a set of elements, not a hard-coded
screen. Each adapts to slide count, handles portrait and landscape media, consumes
the palette, optionally consumes track metadata, renders in both skins, stays
editable after application, and declares free/premium.

1. **Chromatic Journey** — Colour Flow made visible; background migrates across
   the carousel, photographs float on it.
2. **Sound in Color** — built around the music card; palette bands keyed to the
   track's era and genre.
3. **Film Diary** — dated frames, hairline rules, mono captions. Swiss-native.
4. **Album Notes** — a sleeve and a liner note; track metadata as typography.
5. **Mood Spectrum** — one slide per mood reading, ordered by `atmosphere`.
6. **Minimal Swiss Sequence** — grid, rules, one signal colour, no depth.
7. **Chroma Editorial** — large display type crossing slide boundaries; the most
   explicit use of the seamless canvas.
8. **Before the Song Ends** — narrative pacing; the last slide is the resolution.

**One template per family is free**, mirroring `looks.ts`'s reasoning: "a wall of
locked chips tells someone the app is not for them."

Preview thumbnails are generated by rendering the template against fixture media
at small size through the same Skia path — so a template preview cannot drift
from the template.

---

## 10. Editor interface

```
┌───────────────────────────────────────────┐
│ ✕   Story title            ↶ ↷    Preview │  top bar
├───────────────────────────────────────────┤
│                                           │
│         continuous carousel canvas        │  ~70% of the screen
│         (slide guides visible)            │
│                                           │
├───────────────────────────────────────────┤
│  ▭ ▭ ▭ ▭ ▭                                │  filmstrip
├───────────────────────────────────────────┤
│ Media  Layout  Text  Color  Music  ⋯      │  tool dock
└───────────────────────────────────────────┘
```

The canvas gets the majority of the screen. Tools open bottom sheets
(`ui/Sheet`), never permanent side panels. Selecting an element swaps the dock for
that element's contextual tools; deselecting restores it.

Built from `useStyles`/`useSkin` throughout — `no-appearance-leaks.test.ts` fails
the build otherwise. Swiss gets rules and structure; Chroma gets depth. The dock
is designed Swiss-first, because a design that works without glass works with it.

Explicitly avoided, per the brief: oversized cards, heavy glassmorphism,
permanent panels, deep hierarchies, touch targets under 48×48, and controls that
vanish without explanation.

---

## 11. Preview and export

**Preview** is a swipeable run of the final slides, rendered through the same
`drawScene` as the export at screen scale. It is the export, smaller — not a
second implementation.

**Export** slices per the ADR: for each slide, an offscreen surface at exactly
`format.width × format.height`, translated by `−n·slideWidth`, drawn with the
same scene function, encoded, written, disposed. Sequential, so peak memory is
one slide.

Requirements and how each is met:

| Requirement                           | Mechanism                                                             |
| ------------------------------------- | --------------------------------------------------------------------- |
| Deterministic dimensions              | `sliceTransforms` returns fixed integers; tested                      |
| No gaps or duplicated boundary pixels | exact integer partition; tested                                       |
| No UI controls in output              | export renders the document, never the view tree                      |
| Correct order                         | slices are index-ordered by construction                              |
| Progress and cancellation             | per-slide progress; an `AbortSignal` checked between slides           |
| Memory safety                         | one slide at a time, `dispose()` in `finally`, 4096px source ceiling  |
| Retry after partial failure           | per-slide results; only failed indices are retried                    |
| Share                                 | system share sheet via `shareFile`; save-all via `expo-media-library` |
| Unsupported combinations              | stated plainly before export begins, never after                      |

A **visual export verification test** renders a known element straddling a
boundary, exports both slides, and asserts the recomposed pair is pixel-identical
to the pair rendered as one surface. This runs against Skia and is the check that
the seam is genuinely absent rather than merely intended.

---

## 12. Persistence

Schema: `packages/domain/src/story/project.ts`, `schemaVersion: 1`, zod-validated,
with invariants in `superRefine`.

- **Atomic autosave**, debounced, write-to-temp-then-rename, so a kill mid-write
  leaves the previous good draft.
- **Crash recovery** via `migrateStoryProject`, which repairs a current-version
  draft that will not parse. Every repair removes or clamps and **never
  invents**, and every repair is reported so the user is told what changed.
- **One bad draft costs one draft.** `listInvalid()` mirrors
  `ChromaticMemoryRepository`, whose comment records why: v1 parsed the whole
  collection and threw, losing an entire library for one bad record.
- **Forward migration never deletes the previous key** — it is the rollback.
- **A document from a newer build is refused, not stripped**, because we cannot
  know what its unknown fields mean.
- **Media by URI only.** There is nowhere in the schema to put base64; a test
  asserts a serialised project contains no `data:image` and no `base64`.
- **Orphan collection** via `orphanedAssetIds`, which reports rather than
  deletes, so an undo can still reach a photograph.

State separation, as required:

| Layer               | Home                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| document            | zustand, immutable, bounded undo                                     |
| selection / gesture | Reanimated shared values, UI thread                                  |
| render              | derived from document + camera                                       |
| export              | its own machine: idle → running(n/total) → done / failed / cancelled |

---

## 13. Performance targets

- Interactive gestures at 60fps on a physical mid-range device; no full-document
  React re-render on a movement frame (structural — see §7).
- Editor decodes previews (≤1024px), never originals.
- Template and media lists virtualised.
- Undo history bounded (50 entries).
- Export off the interaction path, with progress; peak memory one slide.
- Backgrounding flushes the autosave; memory warnings drop preview caches for
  off-screen slides.

Measured on device at each phase boundary, not asserted.

---

## 14. Accessibility

Minimum 48×48 targets. An accessibility label on every editing action. Logical
focus order. Announcements for selection, undo/redo, delete, snap engagement and
export progress. Selection indicated by handles and an outline, never by colour
alone. Sufficient contrast in both skins.

**The layer list is a first-class alternative to direct manipulation** — every
element reachable, reorderable, lockable and deletable without a drag. This is
the screen-reader path and it is not a degraded one.

**Reduced motion means immediate state changes, not missing functionality**:
camera transitions become instant, the ambient backdrop stops, gestures and
snapping continue to work. Follow `ui/Carousel.tsx:84-133`, which is the app's
existing correct implementation.

Dynamic Type applies to chrome and sheets. The canvas itself renders at document
scale — a story's typography is content, and reflowing a user's composition
because they changed a system setting would corrupt their work rather than help
them.

---

## 15. Monetization

Per audit decision D3, the existing principle holds: **the line is at systems
work, not quantity.** Drafts are unlimited and free.

| Free                                                                   | Premium                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| Blank projects, unlimited drafts                                       | Full template library                                        |
| All core tools: move, scale, crop, text, shapes, palette strip, colour | AI Story Composer                                            |
| One template per family (8)                                            | Advanced Colour Flow                                         |
| Standard-resolution export, all formats                                | High-resolution export                                       |
| Music attachment and card                                              | Brand/palette kits, advanced typography, premium visualizers |
| No watermark on the user's own composition                             | —                                                            |

Reuses `EntitlementProvider` and `hasEntitlement`. New entitlements:
`story_templates`, `story_ai_composer`, `story_high_res_export`. `PaywallTrigger`
widens with `story-template`, `story-ai`, `story-export`.

There is no billing provider in this app, so gates are enforced and nothing is
purchasable. That is a pre-existing product gap, stated here so it is not
mistaken for a Story Studio defect.

---

## 16. Analytics

Through `@chromawave/analytics`, typed. Thirteen events: `studio_opened`,
`story_created`, `media_added`, `template_applied`, `ai_composer_started`,
`ai_composer_completed`, `music_attached`, `export_started`, `export_completed`,
`export_failed`, `share_started`, `draft_recovered`, `premium_gate_viewed`.

**Privacy decision, made explicitly:** no photo content, no captions, no raw
palettes, no track queries, no titles. Properties are counts, enums, durations
and ids the user cannot be identified by. This matches the existing comment in
`analytics/src/index.ts` — "the typed contract intentionally excludes photos,
URIs, notes, and location" — and is enforced by the same mechanism: the property
types simply have nowhere to put such data.

---

## 17. Localization

Every string in `en.ts` and `vi.ts` at the same time. Vietnamese runs ~25–30%
longer, and `localization.test.ts` enforces per-control character budgets (chip
16, button 34, tab 10). The dock uses icons with short labels for this reason.
Numbers, hex values and the wordmark never translate.
