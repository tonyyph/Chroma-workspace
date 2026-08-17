# 08 — Implementation plan

**Updated:** 2026-08-17, after Phase 1 was built.

---

## Status at a glance

| Phase | Scope                                     | Status                               |
| ----- | ----------------------------------------- | ------------------------------------ |
| 0     | Repository audit, baseline, decisions     | **done**                             |
| 1     | Story Studio vertical slice               | **code complete, device-unverified** |
| 2     | Precision editing + Cross-Format Composer | not started                          |
| 3     | Living Palette, then Chroma Cutout        | not started, D4 open                 |
| 4     | Beat-Synced Memory (scoped by D1)         | not started                          |
| 5     | AI Story Director                         | not started                          |
| 6     | Color DNA (~60% pre-existing)             | not started                          |
| 7     | Remixable Memories, local only (D5)       | not started                          |

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

Snapping and smart guides (pure, testable, in the domain); alignment to centre,
edges, grid and nearby objects; a layer panel that is screen-reader navigable;
lock/hide from the panel; slide add/remove/reorder; rotation gesture; shapes,
frames and gradients; focal points; adaptation between 4:5, 1:1 and 9:16; an
export review screen.

Also here: **TikTok as a safe-zone profile**, not a fourth canvas — the same
1080×1920 with different insets, because its action rail eats ~240px that
Instagram's story layout does not. `StoryFormat` grows `safeInsets`; no geometry
changes. It lands with the review screen that can actually draw the inset.

Risks: snapping that fights the user is worse than none; a layer panel is where
accessibility is either done properly or not at all.

---

## Phase 3 — Living Palette, then Chroma Cutout

**Living Palette first** because it is unblocked and already has a deterministic
foundation. Presets (Calm / Flow / Pulse / Rush), user controls for intensity,
speed, palette order and loop, a reduced-motion path that produces a complete
static composition rather than removing content, and deterministic export.

**Cutout second, and blocked on decision D4.** Build the provider interface,
request state, validated response model and a deterministic development fallback
regardless. Ship a real implementation only once the route is chosen: iOS Vision
(best quality, native code, iOS-only), a cross-platform ML runtime (heavier,
lower quality), or a backend (does not exist, conflicts with local-first).

---

## Phases 4–7

**4 — Beat-Synced Memory**, scoped by ADR 04: colour-derived pacing, honest
capability ladder, truthful export. Ships under a name that describes what it
does.

**5 — AI Story Director**, per ADR 05: the deterministic local composer first, as
a real feature; then the patch schema and validation; the provider is a separate,
separately approved decision.

**6 — Color DNA**, per model 07: consolidate the two `TasteEntry`
implementations, add explanation copy, opt-out and deletion UI, and the shareable
recap story — which is also the first feature to compose _into_ Story Studio.
Decision D6 due before this starts.

**7 — Remixable Memories**, per model 06: recipe schema, local remixing,
attribution chain, documented API. No publish, no accounts, no community
surfaces.

---

## Templates

Cross-cutting rather than a phase. The eight families land with Phases 2–4 as the
schema stabilises. Each must be data-driven rather than a hard-coded screen,
adapt across formats and slide counts, consume the user's palette, declare its
supported features and free/premium status, work in both skins, and contain no
third-party assets.

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
