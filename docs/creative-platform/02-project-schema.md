# 02 — Story project schema

**Status:** implemented and shipping in Phase 1.
**Source of truth:** `packages/domain/src/story/`. Where this document and the
code disagree, the code is right and this document is stale — every claim below
is asserted by a test named in the last column.

---

## 1. The one idea everything else follows from

**A story is one logical canvas, not N slides.**

The canvas is `slideWidth × slideCount` wide and `slideHeight` tall. Every
element carries its position in that single coordinate space. A slide is a
_window_ onto it, and export slices the same scene N times, translating by
`-index × slideWidth` each time.

The alternative — per-slide coordinates with an offset bookkept somewhere — puts
the seam in the data model, where no amount of care at render time removes it.
Under this model, two adjacent slices agree at their shared edge because they are
the same drawing offset by an integer. There is no second opinion available.

Everything in §5 is a consequence of this choice.

---

## 2. The document

```
StoryProject {
  schemaVersion: 1
  id, title|null, createdAt, updatedAt
  format:      'portrait' | 'square' | 'story'
  slideCount:  1..20
  canvas:      { width, height }        // stored AND checked (see §4)
  layers:      StoryElement[]           // back to front; the array IS the z-order
  assets:      StoryAsset[]             // id → durable uri + preview
  sourceMemoryIds: uuid[]
  track:       MusicTrackReference | null
  status:      'draft' | 'finished'
}
```

### What the brief asked for and this does not carry

The brief specifies a project also holding musical analysis, an animation
timeline, AI composition metadata, template origin and remix attribution. None of
those features exist yet. Guessing at five schemas now means migrating away from
the wrong guesses later, so each arrives with the phase that builds it — as a
widening with a default, which `imageRefSchema.grade` already proves costs no
migration.

**There is no `owner`.** The app has no accounts, no auth and no identity
(audit §9). A field that would hold the same constant on every record on every
device is not an owner; it is a decoration that makes the document look
multi-user. It arrives with a backend or not at all.

---

## 3. Elements

A discriminated union on `kind`, so a renderer that forgets a case fails to
compile rather than drawing nothing.

| Kind           | Carries                                                     | Notes                                                |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `photo`        | `assetId`, `sourceWidth/Height`, `crop`                     | never a file path — see §6                           |
| `text`         | `text`, `role`, `align`, `scale`, `colorHex`                | role not font name — see below                       |
| `paletteStrip` | `colors[2..8]`, `sourceMemoryId`, `orientation`, `weighted` | weights must sum to 1                                |
| `video`        | full shape                                                  | **defined, and impossible to construct** — see below |

Common to all: `id`, `frame`, `rotation`, `opacity`, `locked`, `hidden`.

**Z-order is the array position, not a field.** Two elements with the same
`zIndex` is a state the array cannot represent, and reordering becomes a list
operation rather than a renumbering pass.

**Text stores a role, never a font.** The app has two complete skins and `swiss`
sets labels in mono while `chroma` does not. A stored "Space Grotesk 42px" would
render as chroma's idea of a title under both — the appearance leak
`no-appearance-leaks.test.ts` fails the build over. Sizes are canvas-relative
(`storyFonts.ts`), families come from the skin.

**Video is defined and cannot be built.** Decision D2. The case exists in the
union so every `switch` already handles it and the renderer carries a real
branch, but `videoElementSchema` always adds an issue, so no document containing
one can be stored or loaded. When video lands, that refinement is deleted and
nothing else about the document model changes. There is no path by which a user
sees a video element that does not work.

---

## 4. Invariants, enforced at parse time

Following `chromaticMemorySchema`, which enforces rather than trusts.

| Invariant                                          | Why                                                                                                                                         | Test                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `canvas` equals `slideWidth × slideCount`          | A stored value proven on read is a checksum, not duplication. Catches a document written by a build whose formats disagree with this one's. | `project.test.ts` — "the canvas checksum" |
| Element ids unique                                 | Two elements answering to one id means an edit lands on either.                                                                             | `project.test.ts`                         |
| Asset ids unique                                   |                                                                                                                                             | `project.test.ts`                         |
| Every `photo`/`video` `assetId` is in the manifest | A missing _file_ is recoverable and expected; a missing _manifest entry_ is a bug in whatever wrote the document.                           | `project.test.ts`                         |
| Elements within `±1` canvas of the canvas          | Bleed is a technique, not a mistake — but an element parked 4000 units away is lost, not placed.                                            | `geometry.test.ts`, `project.test.ts`     |
| Palette weights sum to 1 ± 0.02                    | Same invariant, same tolerance, same reason as the memory palette: every proportional band divides by it.                                   | `project.test.ts`                         |
| `layers.length ≤ 200`                              | Past this a document is a memory-exhaustion test.                                                                                           | `project.test.ts`                         |
| No video element validates                         | Decision D2.                                                                                                                                | `project.test.ts`                         |

---

## 5. Slicing — the seamlessness argument

**Claim.** For a story of N slides, the N exported images laid edge to edge
reproduce the logical canvas exactly: every pixel once, none twice, none missing.

**Why it holds.**

1. `slideWidth` is an integer and `index` is an integer, so every translation is
   an integer. No sub-pixel offset is ever introduced.
2. Slice _i_ covers `[i·w, (i+1)·w)` and slice _i+1_ covers `[(i+1)·w, …)`. They
   share a boundary and no interior, by arithmetic. Nothing to round into, nothing
   to round out of.
3. Nothing is computed per slide. An element's position is a property of the
   element, so two slices cannot disagree about it.

**`verifyTiling` turns the claim into an assertion.** It detects gap, overlap,
fractional edge, height mismatch and incomplete coverage. It runs in
`slicing.test.ts` across **every format at every slide count 1–20**, and again in
`exportStory` before a single byte is written — a story that would export with a
seam refuses to export at all.

**One bug worth naming.** `translateX` is `bounds.x === 0 ? 0 : -bounds.x`, not
`-bounds.x`. Plain negation yields `-0` for the first slide, which serialises as
`0` but fails `Object.is`, and both vitest and jest compare with `Object.is` — so
an export-fidelity assertion would pass or fail depending on which slide it looked
at first. Found by the session that wrote the first version of this module; the
guard is kept because this implementation had the identical shape, and the first
test written against it reproduced the trap in its own expected value.

---

## 6. Assets

Elements reference an `assetId`, never a path. The indirection is what makes a
project survivable: file URIs move — iOS purges caches, a reinstall changes the
container path — so one place resolves and repairs them, and a missing file
degrades into a visible, replaceable gap rather than a crash.

Two sizes per asset:

- **master**, ≤ 4096px long edge — what the exporter reads;
- **preview**, ≤ 1024px long edge — what the canvas draws.

The editor must never decode masters. Twenty 48MP frames live at once is the
out-of-memory crash `bakeGrade.ts` documents at this exact ceiling. Files live
under `Paths.document/story-assets/<storyId>/`, never the cache directory, for the
reason `lib/photos.ts` exists: "a palette saved in March showed a blank card in
April."

**No base64 anywhere.** Assets are URIs in the document and bytes on disk.

---

## 7. Storage

**One MMKV key per project**, plus an ids-only index — not one key for the
library. Autosave fires during editing; a single key would serialise every
project a user has ever made to record one moved element, on the interaction
path, forever. Per-project keys also isolate corruption at the JSON level, not
only the schema level.

The index carries ids and nothing else. An index with titles and timestamps is
denormalised data with two writers, and the copy that goes stale is always the
one the list screen reads.

**Write order is deliberate.** `save` writes the record _then_ the index;
`remove` updates the index _then_ deletes the record. Both orders leave an
orphaned key on interruption — invisible and costing only storage — rather than
an index entry pointing at nothing, which every later read reports as a corrupt
project the user never made.

**One bad record never costs the library.** Per-record `safeParse`, valid records
kept, invalid ones reported to a bounded quarantine — and **the offending key is
never deleted**. The difference between "we are not showing this" and "we deleted
this" is the whole reason the quarantine exists rather than a `catch` returning
an empty list. Six tests in `StoredStoryRepository.test.ts` cover this.

---

## 8. Migration

`schemaVersion: 1` is the first, so nothing upgrades yet. `migrateRecord` exists
anyway and dispatches on the stored version, so version 2's arrival is a new case
in a function rather than a new architecture under time pressure.

Forward-only and idempotent. A record from a _newer_ build is quarantined, never
rewritten — guessing at a shape from the future is how data gets destroyed.

---

## 9. State separation

The brief requires six separated layers. Phase 1 ships four; the other two belong
to features that do not exist.

| Layer               | Where                                         | Note                                                              |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Persistent document | `storyStore` (zustand) + `history`            | immutable updates, bounded to 50 steps                            |
| Transient editor    | `storyEditorStore`                            | selection, active slide, overview — never written to disk         |
| Gesture             | Reanimated shared values                      | **never reaches React**; the document is written once, on release |
| Render/export       | `exportStory` progress + `StoryPreviewScreen` | its own progress and cancellation                                 |
| Playback            | —                                             | no audio playback in a story yet                                  |
| Server/community    | —                                             | no backend (audit §9, decision D5)                                |

**Undo keeps states, not inverse operations.** Because `document.ts` is
immutable, the previous state is still the same object — restoring it is exact by
construction, and the class of bug where undo restores _almost_ the previous
state cannot occur. Structural sharing makes a history entry a spine, not a copy;
nothing in it holds pixels.

---

## 10. What is deliberately absent

- **Snapping, guides, layer panel** — Phase 2.
- **Rotation editing** — the property exists and renders; no gesture drives it yet.
- **Slide add/remove/reorder** — `setSlideCount` exists; no UI.
- **Templates, cutout, animation, AI, remix** — later phases, each with its own schema addition.
