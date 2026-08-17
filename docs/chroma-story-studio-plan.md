# Chroma Story Studio — implementation plan

**Date:** 2026-08-17
**Baseline:** `994c1ec`, typecheck/lint/test green (832 tests)
**Status:** **handed over — see the status note below before using §2 or §6**
**Depends on:** the audit, the ADR, and the spec

> **What actually happened.** Implementation of this plan was handed to a second
> session (`docs/creative-platform/`), which owns `packages/domain/src/story/`
> and the mobile feature. The domain schema, repository, store, renderer and
> exporter I had built to §2's Phase 1 list were deleted on 2026-08-17 after that
> session rewrote the foundation to an incompatible design; the earlier claim of
> "899 tests green" described work that no longer exists and has been removed
> rather than left standing.
>
> **What survives from my side:** `apps/mobile/src/features/story/render/wrapText.ts`
> and its 16 tests — schema-independent line breaking with an injected measurer —
> plus `export * from './story'` in the domain barrel. Both retained at the other
> session's request.
>
> **What is still worth reading here:** §1's dependency table (no new runtime
> dependency is needed, and why), §3's risk register, §4's guard-test list, and
> §5's known limitations. None of those depend on whose schema won. §2's task
> breakdown and §6's status block are historical.

---

## 1. Dependencies

**New runtime dependencies: none.**

Everything the feature needs is already installed and load-bearing:

| Need                                | Package                        | Version  | Already used by                                         |
| ----------------------------------- | ------------------------------ | -------- | ------------------------------------------------------- |
| Canvas + export raster              | `@shopify/react-native-skia`   | 2.4.18   | grading, capture, gradients, palette reading (15 files) |
| Gesture transforms on the UI thread | `react-native-reanimated`      | 4.2.1    | 20 files                                                |
| Worklets runtime                    | `react-native-worklets`        | 0.7.4    | Reanimated 4                                            |
| Multi-touch recognition             | `react-native-gesture-handler` | ~2.30.0  | `ui/Pressable`, `ui/Slider`                             |
| Document store                      | `zustand`                      | ^5.0.14  | 4 existing stores                                       |
| Schema validation                   | `zod`                          | ^4.1.5   | the whole domain                                        |
| Draft storage                       | `react-native-mmkv`            | ^4.3.2   | every repository                                        |
| Asset files                         | `expo-file-system`             | ~55.0.24 | `lib/photos.ts`, `bakeGrade.ts`                         |
| Preview generation                  | `expo-image-manipulator`       | ~55.0.19 | available, currently unused                             |
| Media selection                     | `expo-image-picker`            | ~55.0.22 | capture import                                          |
| Save to library                     | `expo-media-library`           | ~55.0.19 | `lib/grade/saveGraded.ts`                               |
| Haptics                             | `expo-haptics`                 | ~55.0.16 | `ExpoHapticsService`                                    |
| Fonts                               | `@expo-google-fonts/*`         | ^0.4.1   | app-wide                                                |

This is the plan's single largest de-risking fact, and it is why the ADR spends
its length on _which_ renderer rather than on whether to add one.

**Deferred dependency (not Phase 1):** video would require `expo-video`, a widened
`granularPermissions`, new permission strings, and a frame source for the
compositor. Decision D2 defers it; the schema is already shaped for it.

---

## 2. Sequencing

Each phase ends with `pnpm typecheck && pnpm lint && pnpm test`, new focused
tests, a device pass, documented limitations, and Capture/Pair/Collect/Discover
confirmed working.

### Phase 0 — audit ✅ complete

Audit written, baseline recorded, three product decisions resolved.

### Phase 0.5 — architecture ✅ complete

ADR, spec, and the versioned schema as validated code with 67 tests.

| File                        | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `domain/story/geometry.ts`  | formats, canvas, slide rects, slicing, camera  |
| `domain/story/elements.ts`  | the eleven-type element union                  |
| `domain/story/project.ts`   | document, assets, palette, repository contract |
| `domain/story/migration.ts` | version migration + corrupted-draft recovery   |

### Phase 1 — vertical slice

The whole flow, production quality, before any breadth.

| #    | Task                                                                                                        | Depends on                            |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1.1  | `StoryAssetManager` — import, orientation normalise, preview generation, document-dir storage, orphan sweep | `lib/photos.ts` pattern               |
| 1.2  | `StoredStoryRepository` on MMKV — atomic write, `listInvalid`, summaries                                    | 1.1, `StoredMemoryRepository` pattern |
| 1.3  | `storyStore` (zustand) — document, immutable ops, bounded undo/redo                                         | schema                                |
| 1.4  | `drawScene(canvas, document, options)` — the one renderer                                                   | Skia                                  |
| 1.5  | Canvas view: camera pan/zoom, slide guides, fit-all / fit-slide                                             | 1.4                                   |
| 1.6  | Gesture layer: select, move, scale, per §7 arbitration                                                      | 1.5                                   |
| 1.7  | Crop mode for photos                                                                                        | 1.6                                   |
| 1.8  | Text and palette-strip elements + inspectors                                                                | 1.4                                   |
| 1.9  | Autosave (debounced, atomic) + recovery on open                                                             | 1.2, 1.3                              |
| 1.10 | Preview mode                                                                                                | 1.4                                   |
| 1.11 | Export: slice → offscreen → encode → share, with progress and cancel                                        | 1.4                                   |
| 1.12 | Setup sheet, routes `app/story/*`, entry from memory and studio                                             | all                                   |
| 1.13 | `en.ts` / `vi.ts` strings; add screens to `screens.test.tsx`                                                | 1.12                                  |

**Exit criteria.** Create a project from 2–5 photos; a continuous 3-slide canvas;
move/scale/crop; a palette strip and text; undo/redo; autosave survives a force
quit; preview matches; export produces 3 images at exactly 1080×1350 that swipe
seamlessly; both skins correct; guard tests pass.

**Phase 1 tests:** coordinate transforms ✅, slicing ✅, schema ✅, migration ✅,
recovery ✅, plus — undo/redo, autosave/recovery round-trip, missing-asset
behaviour, aspect-ratio cropping, deterministic export dimensions, and the
cross-slide visual export verification.

### Phase 2 — precision editing

Snapping and guides (`domain/story/snapping.ts`, pure and tested), layer panel,
lock/hide, slide add/remove/reorder, shapes, frames, gradients, remaining
formats, complete draft recovery UI.

### Phase 3 — differentiation

Palette intelligence, Colour Flow, track attachment, music card, decorative
waveform, AI Composer interface + validated patch schema + deterministic local
composer.

### Phase 4 — templates and monetization

Eight adaptive template families, discovery, thumbnail generation, entitlement
gates, the thirteen analytics events, onboarding.

### Phase 5 — hardening

Device profiling, 20-slide memory testing, export fidelity, accessibility audit,
crash recovery, offline, full `vi` pass, migration tests.

---

## 3. Risks, carried forward with mitigations

Severity as assessed in the audit; two have already moved.

| #   | Risk                                                           | Now                | Mitigation                                                                                                                                                                                             |
| --- | -------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | No multi-touch gesture precedent in the codebase               | **High**           | Arbitration specified in spec §7 before coding. Build 1.6 as a device prototype first and validate before 1.7–1.13 depend on it.                                                                       |
| R2  | Cross-slide pixel-perfect slicing                              | **Reduced to Low** | Slicing is integer arithmetic in `sliceTransforms`, now tested for exact partition, no gap, no overlap, no `-0`. Remaining exposure is the Skia draw, covered by the visual verification test in 1.11. |
| R3  | Memory on 20 slides                                            | High               | Previews ≤1024px; sequential export; `dispose()` in `finally`; 4096px source ceiling. Test at 20 slides in Phase 5, not at the end.                                                                    |
| R4  | EXIF orientation unverified                                    | Medium             | Resolve in 1.1 with rotated fixtures on device; `StoryAsset.appliedOrientation` records the answer once rather than re-guessing.                                                                       |
| R5  | React Compiler bail-outs                                       | **Reduced to Low** | The frame path does not go through React (ADR §5), so a bail-out costs a re-render, not a dropped frame. Still run `react-compiler-healthcheck.mjs` per file.                                          |
| R6  | Vietnamese expansion vs. dense editor chrome                   | Medium             | Write `vi.ts` alongside `en.ts` in 1.13; icon-plus-short-label dock.                                                                                                                                   |
| R7  | Swiss skin vs. editor chrome                                   | Medium             | Design the dock Swiss-first; verify both skins at every phase boundary.                                                                                                                                |
| R8  | No billing provider                                            | Low (pre-existing) | Gate correctly, emit `premium_gate_viewed`, treat conversion as out of scope.                                                                                                                          |
| R9  | Closed analytics/paywall unions                                | Low                | Widen in Phase 4; typed, so omissions fail typecheck.                                                                                                                                                  |
| R10 | Memory/palette seam                                            | Low                | Read `ChromaticMemory` only; never extend the `Palette` projection.                                                                                                                                    |
| R11 | **New** — Skia text layout is the largest untested render area | Medium             | Prototype text rendering and font loading early in 1.8; degrade visibly, never silently.                                                                                                               |

---

## 4. Guard tests this feature must satisfy

Not optional; they fail the build.

- `no-appearance-leaks` — every new screen through `useSkin`/`useStyles`; no raw
  token imports, no chroma literals.
- `no-dead-controls` — no labelled control without a working handler.
- `screens.test.tsx` — new screens registered and rendering.
- `localization.test.ts` — `en`/`vi` parity, no icon glyphs, character budgets.
- `keyboard-taps`, `no-provider-leaks`, `no-hot-cameras`.

---

## 5. Known limitations, stated up front

1. **No video.** Decision D2. The type exists; nothing constructs it.
2. **No tempo, valence or danceability**, and therefore no beat-derived spacing
   or true audio waveform. Decision D1. The waveform element is decorative and
   labelled as such.
3. **No AI provider is configured.** The Composer ships with its deterministic
   local implementation; the remote interface is defined and unimplemented.
4. **Nothing is purchasable.** Gates work; there is no billing provider.
5. **Portrait phone only** — `app.json` sets `orientation: "portrait"` and
   `supportsTablet: false`.
6. **No custom/freeform canvas size.** Every format is 1080px wide with an
   integer height, which is what makes the slicing exact.
7. **Blend modes limited to five verified-exportable modes.**
8. **QR / deep link to a memory** is possible (`scheme: "chromawave"`, typed
   routes) but there is no backend, so a link only resolves on the device that
   holds the memory. Deferred to Phase 3 and scoped honestly there.

---

## 6. Status — historical

Phases 0 and 0.5 were delivered from this session and verified green at the time:
the audit, the ADR, this plan, the spec, and a versioned schema with 141 passing
tests across the domain module, the draft repository and text layout.

**That implementation no longer exists.** On 2026-08-17 a second session,
working concurrently in the same tree, rewrote `packages/domain/src/story/` to an
incompatible design and took ownership of the feature. Its own Phase 0 audit is
at `docs/creative-platform/00-repository-audit.md`. My schema, repository, store,
renderer and exporter were removed so the tree would build; only `wrapText.ts`
and its 16 tests were kept, at that session's request.

The sequencing in §2 was never executed past task 1.4. Anyone resuming should
take the phase _shape_ from §2 — vertical slice before breadth, and the exit
criteria — and the task list from the owning session's own plan.

**One process note worth keeping.** Two agents ran Phase 0 and Phase 1 against
the same working tree at the same time. The duplicated audits were survivable;
the concurrent writes to one module were not, and cost roughly an hour plus a
red tree. If this feature is ever parallelised again, give each session an
isolated checkout (`EnterWorktree`, or the `using-git-worktrees` skill) rather
than relying on a `git status` check that goes stale the moment it is read.
