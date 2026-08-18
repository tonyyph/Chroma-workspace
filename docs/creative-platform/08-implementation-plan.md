# 08 — Implementation plan

**Updated:** 2026-08-17, after Phase 1 was built.

---

## Status at a glance

| Phase | Scope                                     | Status                                     |
| ----- | ----------------------------------------- | ------------------------------------------ |
| 0     | Repository audit, baseline, decisions     | **done**                                   |
| 1     | Story Studio vertical slice               | **code complete, device-unverified**       |
| 2     | Precision editing + Cross-Format Composer | **partly built** — see below               |
| 3     | Living Palette, then Chroma Cutout        | **Living Palette built; Cutout seam only** |
| 4     | Beat-Synced Memory (scoped by D1)         | not started                                |
| 5     | AI Story Director                         | not started                                |
| 6     | Color DNA (~60% pre-existing)             | not started (D6 decided)                   |
| 7     | Remixable Memories, local only (D5)       | not started                                |

Baseline was 832 tests. It is now **1073**, with `corepack pnpm check` at exit 0.

---

## Phase 1 — what shipped

**Domain** — `packages/domain/src/story/`: `formats`, `geometry`, `elements`,
`project`, `document`, `history`, `slicing`, `migration`, plus `elementAt`
hit-testing. One logical canvas; slides are windows onto it.

**Persistence** — `StoryAssetManager` (4096px master + 1024px preview under
`Paths.document`, HEIC transcode) and `StoredStoryRepository` (one MMKV key per
project, ids-only index, per-record quarantine that never deletes the offending
key).

**State** — `storyStore` (document, bounded 50-step history, debounced autosave
with flush on exit) and `storyEditorStore` (transient selection, never persisted).
Gesture state lives in Reanimated shared values and never reaches React.

**Render and export** — one `drawScene` used by both the editor and the exporter;
`exportStory` renders one slide at a time, decoding only that slide's masters and
disposing in a `finally`. `verifyTiling` runs before any byte is written.

**UI** — `NewStoryScreen`, `StoryEditorScreen`, `StoryPreviewScreen`; routes under
`app/story/`; entry point on the You tab; `en`/`vi` in lockstep; seven analytics
events, all of which fire.

### Two gaps found by review, not by tests

Both would have shipped as "complete" features that could not be used:

1. **No way to select an element.** The scene is one recorded Skia picture, so
   there are no per-element views to press. Without hit-testing, move, resize,
   delete and lock were all unreachable. Fixed with `elementAt` and a tap gesture.
2. **No way to reach Story Studio.** The routes existed; nothing navigated to
   them. Fixed with a row on the You tab.

The lesson worth carrying into Phase 2: a passing test suite says the parts work,
not that they are connected.

### Phase 1 acceptance criteria

| #   | Criterion                                    | Status                                   |
| --- | -------------------------------------------- | ---------------------------------------- |
| 1   | typecheck / lint / test / format all green   | **met**                                  |
| 2   | Project survives app kill and reopens intact | met (tested)                             |
| 3   | One corrupt project does not lose the others | met (tested)                             |
| 4   | Cross-slide slice recomposes exactly         | met (tested, every format × 1–20 slides) |
| 5   | Deterministic export dimensions              | met                                      |
| 6   | Undo/redo exact and bounded                  | met (tested)                             |
| 7   | Missing asset degrades visibly               | met                                      |
| 8   | Verified in both skins                       | **not verified on device**               |
| 9   | Gestures do not re-render per frame          | by construction, **not measured**        |
| 10  | Runs on a physical device end to end         | **not done**                             |
| 11  | Capture/Pair/Collect/Discover still work     | tests green, **not device-verified**     |
| 12  | `vi.ts` complete and within budgets          | met (tested)                             |

**Phase 1 is not complete until 8, 9, 10 and 11 are closed on hardware.** The
procedure is `09-device-qa.md`. Per the brief's own rule, Phase 2 does not start
before that.

---

## Phase 2 — precision editing and Cross-Format Composer

### Built

- **Snapping** (`domain/snapping.ts`, 18 tests) — slide centres and edges, canvas
  edges, other elements' edges and centres. Three rules it is built around: a
  snap moves and never resizes; one snap per axis, the nearest; nothing reaches
  beyond the threshold. Applied **on release only** — snapping mid-drag makes an
  element stick to guides while the finger keeps moving, which reads as lag.
- **Guides and the selection outline**, drawn as an editor-only overlay that
  `exportStory` never calls, so a guide cannot reach an exported slide. The
  outline is a shape rather than a tint, because selection must not be signalled
  by colour alone.
- **Focal points** on photo elements (`.default({x:0.5,y:0.5})`, a widening with
  no migration).
- **Cross-Format Composer** (`domain/adapt.ts`, 26 tests) — proportional
  repositioning, refocus-aware recropping, width-only type scaling, per-axis
  safe-area nudging, and an `AdaptationNote` list for the review. Pure, returning
  a new project, so trying a 9:16 version cannot damage the finished 4:5 one.
- **Safe insets on every format, and `tiktok`** — the same 1080×1920 as `story`
  with a different safe zone, because its action rail covers ~240 units the
  Instagram layout does not. Now earned rather than speculative: the review
  screen draws it.
- **Layer panel** — the accessibility surface for the canvas. The scene is one
  Skia picture with no per-element views, so a screen reader has nothing to walk;
  this list is how anyone not using tap hit-testing selects, reorders, hides and
  locks. Reordering is by button, not drag, for the same reason.
- **Export review** — format chips, an adapted preview, and a summary of what was
  moved, reframed or left under the platform's chrome.

### Not built

Slide add/remove/reorder UI (`setSlideCount` exists, nothing calls it); the
rotation gesture (the property renders, no gesture drives it); shapes, frames and
gradients; grid snapping.

### One bug worth recording

`nudgeIntoSafeArea` originally treated "does not fit" as a single verdict, so a
caption 900 units wide — too wide for TikTok's 840-unit safe width — was left
sitting under the caption bar rather than being lifted off it. The axes are now
independent. Caught by a test, not by review.

---

## Phase 3 — Living Palette, then Chroma Cutout

### Living Palette — built

`domain/livingPalette.ts` (29 tests) plus the renderer and editor controls.

**The invariant it is built around: motion never changes what the palette
claims.** `LivingBands` in the existing Living Memory screen had already found
this — "a band that changed width would change what the palette claims about the
photograph" — and the widths are the product's central assertion, measured from
real pixels. So `breathe` modulates opacity only, and `flow` moves bands along
the strip while every band keeps its own width. Tests assert that total covered
length is exactly the span at every phase, and that each colour's share survives
the wrap when a band is split at the seam.

**Two styles, not the nine the brief lists.** Rings, particles, light leaks and
topographic motion need a renderer this palette strip does not have; they arrive
with one rather than as enum values nothing draws.

**Deterministic**: every style is a pure function of `(colors, config, phase)`.
No randomness, no clock inside the module — the caller owns time. That is what
makes an export reproducible.

**Reduced motion is a complete composition, not a frozen animation.**
`bandsToDraw` short-circuits to the _static_ bands rather than evaluating the
animation at phase zero. This mattered: a staggered breathe at phase zero leaves
later bands part-way dimmed, which is a diminished palette. A test caught it.

**Honest limitation, written into the code.** The palette is drawn inside the
Skia picture, so animating it means re-recording the scene. `usePalettePhase`
therefore ticks at 12fps and says so in its own comment: this is a _preview_ of
the motion, not the motion. Smooth playback needs the palette lifted into its own
layer — a renderer change, not this phase's work.

### Chroma Cutout — seam only, and deliberately

Decision D4 chose **iOS Vision**, which needs a native module this build does not
have. So what exists is the interface, the validated mask model, the capability
report and a wired `UnavailableSubjectExtractor` — and **no UI at all**.

There is deliberately no development fallback that returns a rectangle. A
rectangular "mask" is not a cutout; shipping one would teach people the feature
works badly rather than that it is not here yet. `NullImageUnderstandingProvider`
set that precedent and this follows it.

Next step is the native module plus a build, at which point the UI can appear —
and must consult `availability()` and stay **absent on Android** rather than
present and failing.

---

## Phases 4–7

**4 — built, and not called Beat-Synced.** ADR 04 required a name that describes
what the feature does, and this one does not synchronise to a beat.

- `domain/capability.ts` (10 tests) — the ladder, as data. A test asserts that
  **no reachable rung permits audio analysis**, so the rule cannot quietly lapse.
  `trackCapability` returns a narrowed `ReachableRung`, so a screen writing copy
  for each case has four to write rather than seven — three of which describe
  states that cannot occur.
- `domain/pacing.ts` (20 tests) — ordering (`chronological`, `building`,
  `colour-flow`) and holds derived from `facets.energy` and `atmosphere`.
  Deterministic; a test asserts the same ids in the same order whatever order the
  input array arrived in.
- `composeFromMemories` (11 tests) — the entry point that makes the rest work.
- The preview screen now states what the attached track can actually do, from
  `trackCapability`, alongside the standing "images carry no audio".

**The structural finding this phase turned up.** `paceStory` reads
`facets.energy` and `atmosphere` — signals only a _memory_ carries. The Phase 1
creation path picks files from the photo library, which carry none of them, so
colour-derived pacing had no input at all. Building "create from memories" was
not an extra: it was the precondition. It also fixed a smaller dishonesty —
stories built from raw photographs get a placeholder pair of skin colours for
their palette strip, while stories built from memories carry each memory's own
extracted palette at its own weights, which is the product's real claim.

**5 — built as the local composer. There is no provider, and it is not called AI.**

- `domain/patch.ts` (20 tests) — the validated patch layer. A composer may
  propose ordering, crops, typography and a palette preset; it may not propose an
  element, an asset or a caption, because the schema has nowhere to put one.
  Refusals are **reported, not repaired**: an out-of-range crop is dropped and
  named, since silently clamping it would leave the author with a composition
  nobody chose and no way to find out why.
- `domain/director.ts` (16 tests) — the deterministic composer. Everything it
  proposes comes from something measured: mood, contrast and energy, all computed
  from the photographs' own colours.
- `ComposePanel` — a proposal that changes nothing until Apply, with structured
  reasons rather than prose, and a line saying the suggestion came from the app's
  own reading of the colours and that no service was contacted.

**Three properties worth naming, each covered by a test:**

1. **The local path is not privileged.** The composer's output goes through the
   same `applyStoryPatch` a provider's would. One validator, one accept path, no
   shortcut for the app's own suggestion.
2. **A locked element is never overridden.** Locking is the author's decision;
   the composer reports that it wanted to change something and does not.
3. **It cannot make text unreadable.** Emphasising a caption that fails 4.5:1
   against the ground is refused, using the contrast maths `color.ts` already has.

**Captions are not generated.** A generated caption on someone's memory makes a
claim about their experience. The composer may surface a memory's _own_ title —
the author's words — and there is deliberately no field in the patch for anything
else.

**6 — built.** Decision D6 applied: months, no seasons, no location.

- **The duplication is gone.** `domain/styleDna.ts` and
  `features/you/youInsights.ts` had each grown a `TasteEntry` — one with
  `count`+`weight`, the other with `count`+`share`, over different inputs. There
  is now one type carrying all three, each answering a different question, and
  the app module re-exports it rather than redeclaring it.
- `domain/colorDna.ts` (18 tests) — explanations as **structured data, not
  prose**: a kind, a subject, a count and a total. A reader sees "12 of 40" and
  judges the strength themselves rather than trusting an adjective.
- `composeRecap.ts` (9 tests) — a recap becomes an ordinary `StoryProject`. This
  is the bridge the two halves of the product needed: without it a recap is a
  screen you can look at and nothing else.
- `colorDnaEnabled` preference — opt-out. There is deliberately **no delete
  button**, because there is nothing stored to delete: the profile is derived on
  every read, and deleting a memory already removes its influence everywhere at
  once. A delete control would imply a stored thing that does not exist.

**Three refusals, each with a test:**

1. **Nothing below three memories is named.** The same floor `rewind.ts` uses,
   because a library should not tell someone two things are a habit.
2. **"Rarest colour" needs something to be rarer than.** With one qualifying
   colour it returned that colour — which in a library where it is also the most
   common called the dominant colour the rarest. Two are now required.
3. **Sound is reported against paired memories, not the library.** "In 60% of
   your memories" is wrong when only half ever got a track, and it is the kind of
   number nobody checks.

A recap story carries the colours, the counts and the photographs. A test asserts
it carries **no private note**, and that the only text it writes is the period
key — a date, not a sentence about it.

**7 — built, local only.** Decision D5 held: no publish, no accounts, no
community surfaces, no counters.

- `domain/remix.ts` (21 tests) — the recipe. **A recipe carries slots, not
  content.** Where a story has a photograph, a recipe has a rectangle; where it
  has a caption someone wrote, a recipe has a text slot with a role and no words.
  There is no field anywhere in the schema that can hold a file, a URI, an asset
  id or authored text — so "a remix leaked my photograph" is not a bug a careless
  caller can introduce. It is a shape the type cannot express.
- `StoredRecipeRepository` (10 tests) — a shelf on this device. One test asserts
  **no URI is ever written to disk**, checked by searching the serialised blob
  rather than field by field, so a future field cannot quietly reintroduce one.
- Attribution with a bounded chain, and `attributionIntact` to detect a chain
  that has been shortened or a source swapped — "silent removal of attribution"
  is the first failure `06` names, and the way to prevent it is to check.

**What travels and what does not:** the arrangement and the palette travel — the
palette is the design being shared, and it is a derived measurement rather than
media. Photographs, words, notes and source memory ids do not. An unfilled photo
slot is **counted, not drawn as a placeholder**: a grey rectangle is something
someone exports without noticing.

---

## Templates — built

`domain/templates.ts` (23 tests). All eight families the brief names, as
**functions rather than screens**: `(slideCount, format, palette, track)` to a
list of layout slots. A hard-coded template works at one slide count in one
format with one palette; these produce three slides or twelve, portrait or 9:16,
and consume whatever colours the author's photographs actually had.

**They contain no colours of their own.** Every colour placed comes from the
palette handed in, or is computed for contrast against the ground the caller
named. A test builds each family against both skins' grounds and asserts the text
colours differ — a template that hard-coded one would produce the same colour for
both, which is the appearance leak.

**They supply no words.** A text slot declares a `purpose` — title, caption,
track, index, date — and carries no content. A template says what belongs in a
place; it never says what it says.

**A music family with no track omits the slot** rather than drawing an empty
card, the same rule `livingMemory.ts` applies to its scenes. Tested in both
directions: musical families place a track slot when given one and none when not,
and non-musical families place none even when handed a track.

### Wired into the editor

`applyTemplate` (10 tests) plus a picker.

**A template rearranges; it does not replace.** Photographs, crops and words
already written are the author's work, so existing elements are matched to slots
by kind and in order and keep everything they carry — only their _frames_ change.
A story with four photographs under a three-slot layout **keeps the fourth**,
reported rather than deleted: silently removing someone's photograph is not
something undo should have to rescue them from.

**The thumbnail is drawn from the template's own slots.** A baked PNG would be a
picture of what the layout looked like on the day it was exported and would stop
matching the first time the layout changed. Drawing the slots means the preview
cannot disagree with the layout, because it _is_ the layout.

**Gating reuses the existing system** — one new `Entitlement` member,
`template_library`, and the existing paywall. One template per family is free,
the line `looks.ts` set. A locked template still shows its layout: the shape is
what is being sold, so hiding it would sell nothing.

### Three bugs the tests caught

1. **`album-notes` ran off the foot of a square slide.** A square plate at 78% of
   a 1080-wide square leaves no room for the strip and notes beneath it. The
   layout now sizes against height as well as width — it has to fit the shortest
   format it claims to support, not only the tallest.
2. **`before-the-song-ends` declared `usesMusic` and never named the track.** A
   family called that which never says which song was claiming a capability it
   had not earned.
3. **A test asserted an assumption, not a property.** It compared the first
   slot's height across formats — but `album-notes` draws a _square_ plate, which
   is correctly identical in both. Now asserted on the whole layout.

---

## Standing quality gate

At every phase boundary: `corepack pnpm check`; new focused tests; both skins;
reduced motion; offline and failure states; a physical device; recorded
performance numbers; screenshots; documented limitations; and confirmation that
Capture, Pair, Collect and Discover still work.

**A feature is complete only when its data model, interaction, persistence,
loading, empty, failure, accessibility, analytics, tests, performance and output
are all functional.** UI alone is not completion — and neither is a green test
suite over parts nothing connects.

---

## Open decisions

| #   | Decision                           | Due                          |
| --- | ---------------------------------- | ---------------------------- |
| D4  | Chroma Cutout implementation route | before Phase 3's cutout work |
| D6  | Seasons and location in Color DNA  | before Phase 6               |

D1, D2, D3 and D5 were decided on 2026-08-17 and are recorded in
`00-repository-audit.md` §15.
