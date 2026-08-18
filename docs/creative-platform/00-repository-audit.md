# 00 — Repository audit (Phase 0)

**Audited commit:** `02270b3` (branch `chromawave-v6`).
**Date:** 2026-08-17.
**Method:** read from source, then verified by running the checks. Where a
document in `docs/` contradicts the source, the source won and the contradiction
is recorded here.

**Working tree state at audit time:** tracked files clean; two _untracked_
documents exist from a prior session —
`docs/chroma-story-studio-audit.md` and
`docs/chroma-story-studio-adr-canvas-export.md`. They are discussed in §12.
This audit modified nothing except adding files under `docs/creative-platform/`.

---

## 1. Baseline — exact commands and results

Run at `02270b3`, before any change.

| Command                      | Exit  | Result                                           |
| ---------------------------- | ----- | ------------------------------------------------ |
| `corepack pnpm typecheck`    | **0** | `tsc --noEmit` across all four packages          |
| `corepack pnpm lint`         | **0** | `expo lint` (mobile) + `tsc --noEmit` (packages) |
| `corepack pnpm test`         | **0** | 832 passed, 0 failed                             |
| `corepack pnpm format:check` | **1** | **fails** — see below                            |

Test totals, measured per package:

| Package                     | Runner                            | Files     | Tests                    |
| --------------------------- | --------------------------------- | --------- | ------------------------ |
| `@chromawave/mobile`        | jest + `jest-expo`, `--runInBand` | 51 suites | 439 passed               |
| `@chromawave/domain`        | vitest                            | 18 files  | 376 passed               |
| `@chromawave/design-tokens` | vitest                            | 1 file    | 17 passed                |
| `@chromawave/analytics`     | vitest `--passWithNoTests`        | 0         | 0                        |
| **Total**                   |                                   | **70**    | **832 passed, 0 failed** |

Zero snapshots. Mobile ~36s, domain ~1.0s.

### Pre-existing failures — not caused by this work

1. **`pnpm format:check` fails.** Prettier reports one file:
   `docs/chroma-story-studio-audit.md` (untracked, written by a prior session).
   Because `pnpm check` runs `typecheck && lint && test && format:check`, the
   aggregate `pnpm check` is **red at baseline**. This is a documentation
   formatting issue only — no source file is unformatted. It must be fixed or
   the file removed before `pnpm check` can be used as a phase gate.
2. **React `act(...)` warning** from `providers/EntitlementProvider.tsx:55`
   (`setReady(true)` inside a `.finally()` outside `act`). Emits during the
   mobile suite. Does not fail any test.
3. **13 React Compiler bail-outs**, per `apps/mobile/AGENTS.md`, including
   `PreferencesProvider` — the provider every screen reads. A bailed-out file
   memoises nothing beyond its hand-written `useMemo`/`useCallback`.
   Healthcheck: `node apps/mobile/scripts/react-compiler-healthcheck.mjs`.

Any new failure introduced from here is distinguishable from these four.

---

## 2. Platform, package manager, versions (verified in manifests)

Monorepo: **pnpm workspaces**, `pnpm@10.18.3`, Node `>=20.19.0 <23`.
Members (`pnpm-workspace.yaml`): `apps/*`, `packages/*`, `tools/*` →
`@chromawave/mobile`, `@chromawave/domain`, `@chromawave/design-tokens`,
`@chromawave/analytics`, `@chromawave/brand-assets`.

| Concern                                                         | Version                              | Note                                                    |
| --------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Expo SDK                                                        | `~55.0.28`                           | read the v55 docs, not general Expo docs                |
| React Native                                                    | `0.83.10`                            |                                                         |
| React                                                           | `19.2.0`                             |                                                         |
| Expo Router                                                     | `~55.0.17`                           | `typedRoutes: true`                                     |
| `@shopify/react-native-skia`                                    | **`2.4.18`**                         | already installed, used in 14 source files              |
| `react-native-reanimated`                                       | `4.2.1`                              | + `react-native-worklets` `0.7.4`                       |
| `react-native-gesture-handler`                                  | `~2.30.0`                            | used in only **4** files                                |
| `react-native-svg`                                              | `15.15.3`                            | decorative use only                                     |
| `react-native-mmkv`                                             | `^4.3.2`                             | the persistence layer                                   |
| `zustand`                                                       | `^5.0.14`                            | client state                                            |
| `zod`                                                           | `^4.1.5`                             | domain package only                                     |
| `expo-audio`                                                    | `~55.0.16`                           | preview playback                                        |
| `expo-image-manipulator`                                        | `~55.0.19`                           | used once, in `lib/decodable.ts`                        |
| `expo-image-picker` / `expo-media-library` / `expo-file-system` | `~55.0.22` / `~55.0.19` / `~55.0.24` | file system uses the new `File`/`Directory`/`Paths` API |
| `react-native-vision-camera`                                    | `^5.2.0`                             |                                                         |
| `react-native-nitro-image` / `nitro-modules`                    | `^0.15.1` / `^0.36.3`                |                                                         |
| TypeScript                                                      | `~5.9.2`                             |                                                         |

**Absent, and load-bearing for this brief:**

- **No video dependency of any kind.** No `expo-video`, no `expo-av`, no
  `react-native-video`, in any manifest or import.
- **No `expo-sharing`.** Sharing goes through React Native's built-in `Share`
  (`lib/export.ts:44`).
- **No TanStack Query, no Supabase client, no Spotify SDK** — despite root
  `AGENT.md` instructing "keep server state in TanStack Query" and "do not call
  Supabase or music providers directly from screens." **`AGENT.md` is stale on
  these three points.** Verified: zero matches for `@tanstack`, `supabase`,
  `spotify` in any manifest.
- **No AI/LLM client.** No Anthropic, OpenAI, or HTTP AI package.
- **No billing SDK.** No RevenueCat, no `expo-in-app-purchases`.
- **No auth.** No user accounts, no session, no identity anywhere.

### TypeScript strictness shapes new code

`tsconfig.base.json` + `apps/mobile/tsconfig.json`: `strict`,
`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `isolatedModules`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `moduleResolution: "Bundler"`,
`target: ES2022`, `allowJs: false`.

`noUncheckedIndexedAccess` means every array index yields `T | undefined`. A
document model addressed by index (`slides[i]`, `layers[z]`) must expect that at
every access — this is a real design constraint on the schema, not a lint nit.

Aliases: `@/*` → `apps/mobile/src/*`; `@cw/domain`, `@cw/tokens`,
`@cw/analytics` → package sources directly. Note the alias prefix is `@cw/`
while package _names_ are `@chromawave/*`.

---

## 3. Navigation and route structure

Expo Router, file-based, rooted at **`apps/mobile/src/app`** (not `apps/mobile/app`).

```
app/_layout.tsx             root stack + providers
app/index.tsx               entry redirect
app/(tabs)/_layout.tsx      custom TabBar: 4 tabs + centre capture action → /source
  (tabs)/index.tsx          Library
  (tabs)/explore.tsx        Explore
  (tabs)/sets.tsx           Sets
  (tabs)/you.tsx            You
app/source.tsx              capture entry sheet (reworked in the last 6 commits)
app/capture.tsx             viewfinder
app/capture/result.tsx      extracted palette
app/capture/studio.tsx      CameraStudioScreen
app/pair.tsx                music pairing
app/palette/[id].tsx        memory detail
app/set/[id].tsx, set/new.tsx
app/paywall.tsx, app/onboarding.tsx, app/trending.tsx, app/+not-found.tsx
app/tools/*.tsx             13 routes: grade, gradient, export, contrast, compare,
                            scan, pick, living, rewind, activity, theme, widgets,
                            spike-liveread
```

**Naming collision, confirmed:** `src/features/studio/` is already taken by the
**camera** studio (`CameraStudioScreen.tsx` + `useCameraControls.ts`, routed at
`/capture/studio`). The new creative platform must not occupy that folder or the
`studio` route segment without disambiguation.

**Deep linking is shallow.** `scheme: "chromawave"` is declared and
`Linking.createURL('/set/<id>')` is used to copy a link
(`CollectionScreen.tsx:115`), but there is no inbound link handler, no route
resolution for external URLs, and no tests for it. Anything in this brief that
depends on a shareable Chromawave deep link (music-link cards, remix links, QR
codes) is building on an unfinished foundation.

---

## 4. Domain model — what already exists

`packages/domain/src/` — 23 modules, all barrel-exported from `index.ts`, 18 with
tests. Framework-free: no React, no Expo, no provider types.

The aggregate is `ChromaticMemory` (`memory.ts`), `schemaVersion: 2`, zod-validated
with a `superRefine`:

```
ChromaticMemory {
  schemaVersion: 2, id, createdAt/updatedAt/capturedAt (ISO)
  image:           { localUri, width, height, source, thumbnailUri, grade|null }
  palette:         { colors[2..8], deltaE, confidence, space, tuned, source }
  atmosphere:      AtmosphereReading      (computed, never null)
  visualAnalysis:  VisualAnalysis | null  (needs a network; null on every real memory)
  musicPairing:    MusicPairing
  personalContext: { title, note, mood, tags[≤8], location{name}|null }
  facets:          MemoryFacets           (denormalised scalars for filtering)
  collectionIds:   uuid[≤50]
  isPinned:        boolean
}
```

Invariants enforced at parse time (`memory.ts:166-204`):

- colour `weight`s sum to 1 ± 0.02 — **every proportional band in the app divides
  by this**, so a palette strip gets true proportions for free;
- roles `dominant` / `support` / `signal` are unique, `extra` repeats;
- a `paired` pairing must carry its track;
- `pending` is runtime-only and must never be persisted.

`deriveFacets` is the single writer of `facets`, called on every write.
`MemoryFacets` carries `dominantHue`, `dominantHex`, `warmth`, `energy`,
`luminosity`, `mood`, `paired`, `genres`, `monthKey` — a ready-made, already-stored
input vector for pacing and palette intelligence.

**Colour maths already implemented and tested** (`color.ts`, 595 lines + 294 lines
of tests): OKLab/OKLCH both directions, `contrastRatio`, `relativeLuminance`,
`safeForegroundFor`, `readableOn`, `deltaE00`, `clampOklch`, `rgbToDisplayP3`,
`simulateVision`. **Do not write new colour maths.**

---

## 5. Feature-by-feature reality check

This is the section that most changes the plan. Three of the seven requested
features already exist in partial, working, tested form; one has no foundation
at all.

| #   | Requested feature         | What exists today                                                                                                                                                                                                                                                                                                                               | Gap                                                                                                               |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **Chroma Story Studio**   | Nothing. No canvas, no document model, no multi-touch editing, no drafts.                                                                                                                                                                                                                                                                       | Everything. The largest build.                                                                                    |
| 2   | **Chroma Cutout**         | Nothing. No segmentation, no masks, no ML dependency, no native subject-lifting.                                                                                                                                                                                                                                                                | Everything, and provider choice is unresolved (§7).                                                               |
| 3   | **Beat-Synced Memory**    | `expo-audio` playback of provider previews (`PreviewPlayer`). Deterministic non-audio pacing in `livingMemory.ts`.                                                                                                                                                                                                                              | **All actual beat detection.** No decoder, no sample access, no FFT, no analysis service. See §6.                 |
| 4   | **Living Palette**        | **Substantially exists.** `domain/livingMemory.ts` builds a deterministic `Storyboard` (scenes, drift, pulse) from atmosphere; `features/living/LivingStage.tsx` renders it with **Skia Canvas + Reanimated shared values**; `/tools/living` routes to it.                                                                                      | Presets (Calm/Flow/Pulse/Rush), user controls, reduced-motion path, export, integration into a composition.       |
| 5   | **AI Story Director**     | The _abstraction_ exists: `domain/analysis.ts` defines `ImageUnderstandingProvider`, `RecommendationProvider`, `AnalysableImage`, plus validated-response helpers. Default impl is `NullImageUnderstandingProvider`, which throws.                                                                                                              | Any real provider, plus the composer schema. The anti-fabrication pattern to copy is already written (§8).        |
| 6   | **Remixable Memories**    | **Nothing, and no substrate.** No backend, no auth, no user identity, no upload. Explore/Trending is a _bundled editorial catalogue_, optionally refreshed from one static JSON URL.                                                                                                                                                            | Everything, including a backend that does not exist. See §9.                                                      |
| 7   | **Color DNA**             | **Substantially exists.** `domain/styleDna.ts` (`readStyleDna`: recency-weighted, 90-day half-life, derived-never-stored) and `domain/rewind.ts` (`smartCollections`, `onThisDay`, `recapFor`, `availableRecaps`, month/year periods). Wired into `features/rewind/RewindScreen.tsx`. `features/you/youInsights.ts` computes signature colours. | Shareable recap story, explanation copy, opt-out/delete UI, and reconciling two parallel implementations (§12.4). |
| —   | **Cross-Format Composer** | `lib/export.ts:SHARE_SIZES` already has 1:1, 4:5, 9:16.                                                                                                                                                                                                                                                                                         | Focal points, constraint-based adaptation, review screen. Depends entirely on feature 1.                          |

**Two duplicated `TasteEntry` types exist** — `domain/styleDna.ts:23` and
`features/you/youInsights.ts:25` — with different shapes (`weight`+`count` vs
`count`+`share`), operating on different inputs (`ChromaticMemory` vs `Palette`).
Color DNA work must consolidate these, not add a third.

**Two months are deliberately not seasons.** `rewind.ts:14-19` documents the
refusal: "December is summer for half the world," and the app knows `location`
only as free text a person typed, never a coordinate. **The brief asks for
seasonal patterns and seasonal recaps in Color DNA. That is not derivable from
the data the app holds** without asking for a hemisphere or a coordinate.

---

## 6. Music: measured capabilities and hard limits

`infrastructure/music/ITunesMusicProvider.ts` (tested). iTunes Search is the
default (`dependencies.ts`); `UnconfiguredMusicProvider` is a deliberately
reachable honest fallback.

Constraints stated in `domain/music.ts` as _measured_:

1. **No tempo, no valence, no danceability, no energy from any provider.**
   `music.ts:96-100` deliberately omits `tempo` from `recommendationReasonKinds`
   because "citing a number we did not measure would be the exact dishonesty this
   product is built to avoid." Spotify's audio-features and recommendation
   endpoints are closed to new applications, and Spotify removed 30-second
   preview access for new apps on 2024-11-27 (`music.ts:10-14`).

2. **Preview URLs are never persisted** (`music.ts:52-63`); a test asserts no
   audio URL appears in a serialised memory. `MusicPreview.providerSupplied` is
   the literal `true` — "there is no branch of this product that constructs,
   trims, or hosts audio." Previews re-resolve on demand and may return `null`;
   `previewUnavailableReasons` (`not-offered` / `expired` / `region-restricted` /
   `network`) are _displayed states_, not spinners.

3. **`attribution` is carried on every track reference** and is a licence
   condition. Any story surface showing a track must render it.

4. **No audio sample access anywhere.** `expo-audio` plays a URL; nothing decodes
   PCM, computes an FFT, or reads amplitude. There is no waveform data in this
   app and no dependency that could produce it.

**Consequence for Beat-Synced Memory (feature 3).** Real beat detection requires
one of: (a) a new on-device audio-analysis dependency _plus_ decodable audio the
app is licensed to decode — which provider previews are not; (b) user-imported
audio the user owns; (c) a backend analysis service — which does not exist. The
brief's own capability ladder (metadata only → external link → legal preview →
user-owned → royalty-free → backend-analysed) is the correct model, and **the
only rungs currently reachable are "metadata only" and "external link"**, with
"legal preview" reachable for playback but not for analysis.

`livingMemory.ts` already demonstrates the honest alternative: pacing derived
from the memory's own colour-derived atmosphere, deterministic and offline.

---

## 7. Chroma Cutout: nothing exists, and the options need a real decision

No segmentation code, no ML runtime, no mask type, no native module. Options, and
what the repo tells us about each:

- **iOS Vision `VNGenerateForegroundInstanceMaskRequest`** (iOS 17+) — highest
  quality, on-device, free, private, no network. Requires **new native code**;
  the repo already has a config-plugin precedent (`plugins/withChromawaveWidget`,
  a real iOS widget extension) and `modules/`, so this is proven ground, but it
  is iOS-only and Android would need a separate path.
- **On-device ML runtime (TFLite / MediaPipe / ONNX)** — cross-platform, but a
  large new native dependency, model asset weight, and quality well below Vision.
- **Backend service** — no backend exists, so this means building one, plus
  uploading private photographs, which conflicts with the app's stated
  local-first privacy posture (`.env.example`: "Cloud integration is
  intentionally disabled").
- **`react-native-nitro-image` is already a dependency** (`^0.15.1`) and its
  capabilities should be checked before adding anything new.

The brief's instruction is right and should be followed literally: build the
provider-independent interface plus a deterministic development fallback, and
ship the real implementation only once one of the above is chosen. **Do not fake
extraction quality.**

---

## 8. AI: the abstraction exists, the provider does not

`packages/domain/src/analysis.ts` defines the whole optional intelligence layer:
`ImageUnderstandingProvider` → `VisualAnalysis` (zod-validated, every field
nullable inside a nullable object); `RecommendationProvider` with `refineIntent`
and `explain`; `AnalysableImage` specified as "longest edge ≤1024, JPEG q0.7,
EXIF stripped, no location."

Shipped implementation is `NullImageUnderstandingProvider`, which throws
`AnalysisUnavailableError`. `visualAnalysis` is `null` on every real memory.

**The anti-fabrication pattern to copy verbatim** for AI Story Director:

- `acceptRefinedIntent(candidate, baseline)` — all-or-nothing zod validation with
  fallback to a locally computed baseline;
- `retainKnownExplanations(explanations, candidates)` — drops any id the caller
  did not supply, so a model cannot introduce a track the pipeline never offered.
  That is a property of the types, not a promise in a prompt.

Therefore the Story Director should return a **validated patch against an
already-constructed local baseline document** — never a document from scratch,
never anything executable. The deterministic local composer is not a stopgap; it
is the baseline the AI patches, and it must exist first.

---

## 9. Backend, auth, identity: none

Verified by grep across all source: **exactly one `fetch()` call exists in the
entire application** — `features/trending/trendingRepository.ts:152`, reading
`process.env.EXPO_PUBLIC_FIELD_NOTES_URL` (`trendingRepository.ts:81`), a static
JSON array on any CDN. Unset, the app never touches the network.

`.env.example` documents the intent: "Cloud integration is intentionally disabled
in the first local-first slice." Every Supabase, Spotify, RevenueCat and Sentry
key is present but blank.

`trendingRepository.ts:24-31` records that a `saves` counter was **removed** as
"fabricated social proof for a feed with no users behind it," and `featured`
replaced `popular` because popularity was a lie. The repository is deliberately
async and cancellable so that the day it reads an endpoint, only that file changes.

**Consequences:**

- **Remixable Memories (feature 6) has no substrate.** No publish, no accounts,
  no attribution chain, no discovery beyond a bundled catalogue. Per the brief:
  document the required API and implement local/private remixing first.
- **Discovery surfaces** ("Trending Remixes", "Rising Creators") **cannot be
  built truthfully** and the codebase has already deleted one attempt at
  simulating them.
- **Premium is unpurchasable.** `EntitlementProvider.devSetTier` is `null`
  outside `__DEV__`; `free` is the only tier a real device can reach.
  `paywall_converted` cannot fire in production. Pre-existing gap, out of scope.

---

## 10. Persistence, state, and what a project store must do

**Persistence:** MMKV (`infrastructure/MmkvStorage.ts`) behind a narrow
`KeyValueStorage` interface, one instance per repository (`dependencies.ts`).
Repositories: `StoredMemoryRepository`, `StoredPaletteRepository`,
`StoredSetRepository`, `StoredPreferencesRepository`, `StoredEntitlements` — all
tested.

Two patterns any project store must reuse:

- **`ChromaticMemoryRepository.listInvalid()`** (`memory.ts:351-364`) — v1 parsed
  the whole collection and threw on any bad record, losing the entire library to
  one corruption. v2 keeps what validates and _reports_ what does not. One
  corrupt project must not lose the rest.
- **`migrateMemories.ts` / `migration.ts`** — idempotent forward migration that
  **never deletes the source key**, because that key is the rollback.

**`MemoryBackedPaletteRepository`** answers "which model is real": memories are
the storage; the v1 `Palette` interface is a projection so ~17 older call sites
keep working. New work should read `ChromaticMemory`, not `Palette`.

**Client state:** zustand (`captureStore`, `libraryStore`, `pairingStore`,
`heroStore`) + three React context providers (`PreferencesProvider`,
`EntitlementProvider`, `SkinProvider`).

**There is no draft/project persistence of any kind.** The only "draft" is
in-flight capture state held in zustand (`captureStore`, `ResultRoute.tsx`),
lost on kill. **There is no undo/redo system** — the single `undo` in the app is
a toast affordance (`ui/Feedback.tsx`), not a history stack.

**Assets:** `lib/photos.ts` (`persistPhoto` / `deletePhoto`) copies temporary
picker/camera URIs into `Paths.document/palette-photos/` because iOS purges the
cache directory — "a palette saved in March showed a blank card in April." Any
project asset manager must follow the same rule, keyed separately so a project
and a memory cannot fight over a file.

---

## 11. Rendering and export — the most valuable existing asset

**The export pipeline the brief needs already exists, works, and is tested.**

`lib/grade/bakeGrade.ts` (`renderGraded`, tested in `bakeGrade.test.ts`):

```
decodeImage(uri)                       // lib/readPalette.ts → SkImage
  → targetSize(w, h, longEdge)         // pure, tested, no-upscale rule
  → Skia.Surface.MakeOffscreen(w, h)   // off-screen, NOT a view snapshot
  → image.makeShaderOptions(...)       // scaled draw
  → RuntimeEffect shader
  → canvas.drawRect / surface.flush()
  → surface.makeImageSnapshot().encodeToBytes()   // PNG bytes
  → new File(dir, name).write(bytes)   // expo-file-system
  → image.dispose()                    // in a finally
```

`lib/export.ts` adds `renderGradientPng`, `renderShareCard`, `gradientSvg`, and
`shareFile()` → RN `Share`. `renderShareCard` already draws **weighted palette
bands at true proportions**; `SHARE_SIZES` already covers 1:1, 4:5 and 9:16.
`lib/grade/saveGraded.ts` carries `expo-media-library` and its permission — the
codebase deliberately separates "a card you send" (share sheet) from "a
photograph you keep" (library).

**Memory-safety precedent, already documented and enforced**
(`bakeGrade.ts:29-39`): `EXPORT_LONG_EDGE = 4096` because "a 48MP photograph
through `Skia.Surface.MakeOffscreen` is the shortest route to an out-of-memory
crash on an older phone, and a crash while saving is a worse outcome than a
ceiling." `THUMBNAIL_LONG_EDGE = 1024`. Both exported and reusable.

**Rendering stacks in use:** Skia in 14 files (including all export and the
Living Stage), Reanimated in 21, `react-native-svg` in 5 (decorative only),
gesture-handler in **4** (`app/_layout.tsx`, `ui/Pressable.tsx`, `ui/Slider.tsx`,
one test). **There is no multi-touch pan/pinch/rotate precedent anywhere in this
codebase.**

`LivingStage.tsx` is the closest existing model for the whole platform: Skia
`Canvas` + `useSharedValue` + a deterministic domain-computed storyboard, with a
RuntimeEffect shader. It is the pattern to extend, not replace.

**EXIF orientation is never read.** `decodeImage` goes through Skia;
`expo-image-manipulator` is imported in exactly one file (`lib/decodable.ts`).
Orientation behaviour must be verified on device, not assumed.

---

## 12. Unfinished, duplicated, or contradictory functionality found

1. **Root `AGENT.md` is stale** on TanStack Query, Supabase, Spotify and (partly)
   Zod scope. It describes an architecture the repository does not have.
2. **Two product identities coexist in source.** `memory.ts` describes the
   aggregate as including "one piece of music"; `entitlements.ts:14-17` describes
   v1 as "a music-and-memory app **this one is no longer related to**" and removed
   `ai_pairing` / `spotify_playlist_export` as features that "had no
   implementation, screen, or trigger." Both are current. On disk the music
   pipeline _is_ implemented and tested, but every _paid_ surface is colour-tool
   work. This brief sits directly on that seam and should not resolve it silently.
3. **`features/studio/` is already the camera studio** (§3).
4. **Two `TasteEntry` types and two taste implementations** (`domain/styleDna.ts`
   vs `features/you/youInsights.ts`) — §5.
5. **`app/tools/spike-liveread.tsx`** — an experiment left in the route tree.
6. **`StoredPaletteRepository` and `MemoryBackedPaletteRepository` both exist**;
   only the latter is wired. The former is the migration rollback path — not dead
   code, but easy to mistake for it.
7. **Two untracked design documents from a prior session**
   (`docs/chroma-story-studio-audit.md`, `docs/chroma-story-studio-adr-canvas-export.md`).
   Their technical findings I re-verified independently and they hold. **However,
   the audit document asserts at §15 that three product decisions "were put to the
   product owner on 2026-08-17 and all three were decided." I have no evidence of
   that approval and am not treating those decisions as settled.** They are
   re-raised as open questions in §15 below. One of the two files is also the
   cause of the `format:check` baseline failure (§1).
8. **`EntitlementProvider` `act()` warning** and **13 React Compiler bail-outs**
   (§1).

---

## 13. Design tokens, skins, and enforced constraints

`packages/design-tokens/src/skins.ts` (458 lines, 17 tests). Two complete looks
over one component set, swapped at runtime by `SkinProvider` + `useStyles`.

- **`chroma`** — dark ground `#0C0B18`, violet `#7C5CFF`, drifting ambient field,
  glass surfaces, soft depth, rounded.
  `chrome: { backdrop: true, glass: true, depth: true, rules: false, shout: true }`
- **`swiss`** — paper `#F2F1EE`, ink, one signal red, **no backdrop, no glass, no
  depth**, square corners, structure from rules and labels, mono for labels and
  numbers.
  `chrome: { backdrop: false, glass: false, depth: false, rules: true, shout: true }`

`SkinChrome` exists because some differences cannot be a value — components branch
on those booleans. `SkinEffects` names five gradient roles so a screen never names
a colour stop.

**Consequence:** the glassmorphic floating inspector a canvas editor reaches for
by default _is not expressible in Swiss_. Design the tool dock as rule-separated
structure first (Swiss-native), and let chroma add depth — not the reverse. This
happens to match the brief's instruction to avoid excessive glass.

### Guard tests that will fail the build for new code

`src/__tests__/` holds source-scanning enforcement tests. These are not style
checks:

| Guard                                       | Forbids                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-appearance-leaks.test.ts`               | any file under `features/` or `app/` importing `ui`, `round`, `tint`, `elevation`, `glass`, `uiShadow`, `typeExtra`, or writing chroma's literal colours (`#7C5CFF`, `#0C0B18`, `rgba(8,7,14…)`, …). Only `ui/` primitives may read a skin. Opt-out requires the literal marker `appearance-exempt` in the file. |
| `no-dead-controls.test.ts`                  | a `Pressable` with a button role and no `onPress`; a `NavBar` with a trailing action and no `onTrailing`; `onPress={() => {}}`                                                                                                                                                                                   |
| `no-hot-cameras.test.ts`                    | camera sessions running on screens nobody is on                                                                                                                                                                                                                                                                  |
| `no-provider-leaks.test.ts`                 | provider-shaped data past the domain boundary                                                                                                                                                                                                                                                                    |
| `screens.test.tsx`, `keyboard-taps.test.ts` | every screen must render and its controls must press — **new screens are expected to be registered here**                                                                                                                                                                                                        |
| `localization.test.ts`                      | icon glyphs in strings; per-control character budgets (chip 16, button 34, tab 10)                                                                                                                                                                                                                               |

**Localization is mandatory.** `en.ts` (688 lines) and `vi.ts` (683 lines) are
kept in lockstep and the test asserts it. Vietnamese runs ~25–30% longer, against
enforced budgets — a dense editor toolbar is exactly where this bites.

**Accessibility today:** ~55 `accessibilityRole="button"` plus scattered labels.
Reduced motion is implemented in exactly **two** places — `ui/Carousel.tsx:84-133`
(`AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged` listener) and
`OnboardingScreen.tsx:68` (`ReduceMotion.System`). Adequate, not systematic. The
brief's accessibility bar is meaningfully above the current average.

---

## 14. Native configuration and its limits

`apps/mobile/app.json`:

- `scheme: "chromawave"`, bundle id / package `com.chromawave.app`.
- **`orientation: "portrait"`, `ios.supportsTablet: false`** — the editor is a
  portrait phone experience. There is no landscape canvas.
- `userInterfaceStyle: "dark"` — **the app declares a single interface style**;
  "test light/dark mode" from the brief's quality gates maps onto the _skin_
  system (chroma/swiss), not the OS appearance.
- `experiments: { typedRoutes: true, reactCompiler: true }`.
- `CFBundleLocalizations: ["en", "vi"]`.
- Permissions: camera; photo library via `expo-image-picker`; `expo-media-library`
  with **`granularPermissions: ["photo"]`**, `savePhotosPermission`,
  `isAccessMediaLocationEnabled: false`, `preventAutomaticLimitedAccessAlert: true`.
- Android permissions: `CAMERA` only.
- Config plugins: `./plugins/withIosResourceBundleSigning`,
  `./plugins/withChromawaveWidget` (a real iOS widget extension, App Group
  `group.com.chromawave.app`).
- EAS project provisioned; `expo-updates` configured.
- No `ios/`/`android/` directory committed — prebuild on demand;
  `prebuild:ios` runs `scripts/ensure-skia.mjs` first.

**`granularPermissions: ["photo"]` is photo-only.** Supporting video requires
changing it, adding a video permission string, adding a video dependency, and
solving frame extraction for export.

**`isAccessMediaLocationEnabled: false`** means the app cannot read photo GPS.
The brief's "location patterns with permission" in Color DNA would require
reversing a deliberate privacy decision.

---

## 15. Blocking decisions

A prior session's document claimed three of these were already resolved with the
product owner. There was no evidence of that approval, so all six were re-raised
from scratch.

**D1, D2, D3 and D5 were put to the product owner on 2026-08-17 and each was
decided in favour of the recommendation recorded below.** **D4 and D6 were
delegated back and decided the same day**, on the reasoning recorded in their
entries. All six are binding on the specification, the schema and the plan.

**D1 — Music's role in the visual system. DECIDED: colour-derived pacing only.**
Tempo, valence and danceability are
unavailable from any provider and the domain refuses to fabricate them (§6). The
brief asks for beat markers, downbeats, energy curves and drop candidates.
_Recommendation:_ drive the visual system from inputs we actually have —
`facets.energy` (colour-derived), `warmth`, `luminosity`, `mood`, plus the track's
`genres` and `releaseYear` — and ship any waveform element explicitly labelled as
a decorative palette-derived figure. Real beat sync waits for user-owned or
royalty-free audio plus a real analyser.

**D2 — Video. DECIDED: photo-only, schema-ready.** No dependency, no permission, no player, no frame source for Skia
composition (§2, §14). _Recommendation:_ photo-only in the first slice, with a
typed `video` element variant defined-but-not-constructible so the schema needs no
migration when video lands. Supporting video now roughly triples the first phase.

**D3 — Free/premium line. DECIDED: no quantity caps.** The brief suggests capping free drafts.
`entitlements.ts:1-18` records that quantity caps were **deliberately abolished**:
"a colour app whose answer to 'I used this a lot' is 'stop' has mistaken its core
loop for a cost centre." _Recommendation:_ keep the existing principle — unlimited
projects free, paid line on systems work (full template library with one free per
family mirroring `looks.ts`, AI Director, advanced Living Palette, high-resolution
export, watermark-free via the existing `watermark_free_share`).

**D4 — Chroma Cutout implementation route. DECIDED 2026-08-17: iOS Vision, iOS-only, behind the provider interface.** (§7)

The three routes were iOS Vision (`VNGenerateForegroundInstanceMaskRequest`,
iOS 17+), a cross-platform ML runtime, and a backend service. Vision wins on
every axis this product cares about: highest quality, fully on-device, no model
asset in the bundle, no network, no cost, and no private photograph ever leaving the
phone — which is the only route that does not contradict the local-first posture
`.env.example` states. A backend would mean uploading private photographs to
compute something the phone can already do. An ML runtime would mean a large
native dependency and a bundled model for materially worse masks.

**The accepted cost is that Cutout is an iOS feature.** That is defensible for
this app specifically — it is already iOS-leaning (`supportsTablet: false`, a
real iOS widget extension, EAS iOS profiles) — but it must be handled as a
_capability_, not a broken button: the provider reports availability, and on
Android the feature is **absent from the UI** rather than present and failing.
Android gets a real implementation when a cross-platform route is justified on
its own merits, not as a consolation.

Phase 3 therefore does need new native code, in the config-plugin shape
`plugins/withChromawaveWidget` already established.

**D5 — Remixable Memories without a backend. DECIDED: spec the API, local remix only.** (§9) No server, no auth, no
identity. _Recommendation:_ specify the API, build local/private remixing only,
and do not ship Trending Remixes / Rising Creators surfaces until real users
exist — the codebase has already deleted one attempt at simulated social proof.

**D6 — Seasons and location in Color DNA. DECIDED 2026-08-17: drop both; keep the month-based framing.** (§5, §14). Seasons are not derivable
(hemisphere unknown by design) and photo location is disabled by design.
_Recommendation:_ keep the existing month-based framing and drop seasonal and
location patterns from the Color DNA scope.

---

## 16. Risks

| #   | Risk                                                                                                                                                                                      | Severity           | Mitigation                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **No multi-touch gesture precedent** (gesture-handler in 4 files). Element pan/pinch/rotate vs canvas pan/zoom vs slide navigation is a three-way arbitration problem built from scratch. | **High**           | Decide arbitration before coding; prototype on a physical device before building anything on top.                                                                                                                           |
| R2  | **Cross-slide pixel-perfect slicing.** Rounding at boundaries produces seams or duplicated columns.                                                                                       | **High**           | One logical canvas, integer slide widths, each slice derived by translating the same scene by `-index * slideWidth`. Never render slides independently. Test that a sliced-and-recomposed cross-slide element is identical. |
| R3  | **Memory with many slides.** 20 full-resolution decodes will OOM — `bakeGrade.ts` documents this exact failure.                                                                           | **High**           | Reuse the existing ceiling discipline: previews ≤1024px, export streamed one slice at a time with `dispose()` in a `finally`, hard cap at `EXPORT_LONG_EDGE`.                                                               |
| R4  | **No backend** for feature 6, and no honest discovery surface.                                                                                                                            | **High**           | D5. Local-only remix; specify the API; ship no fabricated counters.                                                                                                                                                         |
| R5  | **No audio analysis is possible** for feature 3 as specified.                                                                                                                             | **High**           | D1. Honest capability ladder; deterministic colour-derived pacing as the shipped default.                                                                                                                                   |
| R6  | **EXIF orientation unverified** — nothing in the repo reads it.                                                                                                                           | Medium             | Verify on device with known-rotated fixtures early; normalise via `expo-image-manipulator` on import if Skia does not.                                                                                                      |
| R7  | **React Compiler bail-outs** — a bailed-out editor component memoises nothing, on the hottest path in the app.                                                                            | Medium             | Run `react-compiler-healthcheck.mjs` on every new file; avoid `try/finally` in components; keep manual memoisation where it bails.                                                                                          |
| R8  | **Vietnamese expansion ~25–30%** in a dense editor against enforced character budgets.                                                                                                    | Medium             | Write `vi.ts` alongside `en.ts`, not after; prefer icon-plus-label over text-only in the dock.                                                                                                                              |
| R9  | **Swiss skin vs. editor chrome** — no glass, no depth, no radii.                                                                                                                          | Medium             | Design Swiss-native structure first; chroma adds depth. Verify every surface in both skins.                                                                                                                                 |
| R10 | **`AnalyticsEventMap` and `PaywallTrigger` are closed unions**; none of the 21 requested events exist.                                                                                    | Low                | Widen both in `packages/analytics`. Typed by construction, so omissions fail typecheck.                                                                                                                                     |
| R11 | **No billing provider** — gates are unpurchasable.                                                                                                                                        | Low (pre-existing) | Gate correctly, emit `premium_gate_viewed`, treat conversion as out of scope.                                                                                                                                               |
| R12 | **`pnpm check` is red at baseline** (`format:check`).                                                                                                                                     | Low                | Fix or remove the offending doc before using `pnpm check` as a phase gate.                                                                                                                                                  |

---

## 17. Reuse map — what does not need to be built

| Need                                                        | Already exists                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| Off-screen deterministic raster export                      | `lib/grade/bakeGrade.ts:renderGraded`, `lib/export.ts`               |
| PNG encode + file write + share sheet                       | `lib/export.ts:shareFile`, `expo-file-system` File API               |
| Save to photo library + permission                          | `lib/grade/saveGraded.ts`                                            |
| Image decode to `SkImage`                                   | `lib/readPalette.ts:decodeImage`                                     |
| Durable asset storage away from the purged cache            | `lib/photos.ts`                                                      |
| Export size ceiling / no-upscale rule                       | `bakeGrade.ts:targetSize`, `EXPORT_LONG_EDGE`, `THUMBNAIL_LONG_EDGE` |
| Skia canvas + Reanimated + deterministic storyboard         | `features/living/LivingStage.tsx`, `domain/livingMemory.ts`          |
| Palette extraction, weights summing to 1                    | `domain/color.ts`, `domain/palette.ts`                               |
| OKLCH, ΔE00, contrast, `readableOn`, vision simulation      | `domain/color.ts`                                                    |
| Mood / warmth / energy / luminosity per memory              | `domain/atmosphere.ts`, `memory.ts:deriveFacets`                     |
| Recency-weighted taste profile, recaps, smart collections   | `domain/styleDna.ts`, `domain/rewind.ts`                             |
| Track model, attribution, preview-unavailable states        | `domain/music.ts`, `ITunesMusicProvider`, `PreviewPlayer`            |
| Validated-AI-response pattern                               | `domain/analysis.ts`                                                 |
| Versioned schema, idempotent migration, corruption recovery | `memory.ts`, `migration.ts`, `migrateMemories.ts`                    |
| MMKV behind a narrow interface                              | `infrastructure/MmkvStorage.ts`                                      |
| Entitlement gating, free-per-collection precedent           | `domain/entitlements.ts`, `domain/looks.ts`                          |
| Two-skin token system                                       | `packages/design-tokens/src/skins.ts`                                |
| Reduced-motion pattern                                      | `ui/Carousel.tsx:84-133`                                             |
| 3 of the requested export sizes                             | `lib/export.ts:SHARE_SIZES`                                          |
| Sheets, nav bars, sliders, chips, buttons, carousels        | `src/ui/*`                                                           |

---

## 18. Recommended implementation order

The brief's phase order is sound with two adjustments, both driven by findings
above.

1. **Phase 1 — Story Studio vertical slice.** Unchanged. This is the true
   critical path: features 4, 5 and the Cross-Format Composer all compose _into_
   it, and none can be finished without it.
2. **Phase 2 — Precision editing + Cross-Format Composer.** Unchanged.
3. **Phase 3 — Living Palette _before_ Chroma Cutout.** The brief pairs them.
   Living Palette has a working deterministic foundation (`livingMemory.ts` +
   `LivingStage.tsx`) and needs no new dependency or product decision; Cutout
   needs D4 resolved and possibly new native code. Doing the unblocked one first
   keeps Phase 3 shippable while D4 is decided.
4. **Phase 4 — Beat-Synced Memory**, scoped to the honestly reachable rungs of the
   capability ladder (D1).
5. **Phase 5 — AI Story Director**, built as a validated patch over the
   deterministic local composer (§8).
6. **Phase 7 → before Phase 6 — Color DNA before Remixable Memories.** Color DNA
   is ~60% built and needs no backend; Remixable Memories needs a backend that
   does not exist (D5). Shipping Color DNA earlier delivers real user value while
   the backend question is open.

Templates (eight families) are cross-cutting and should land with Phase 2–4 as
the schema stabilises, not as a separate phase at the end.

---

## 19. Status

Phase 0 is complete. Baseline recorded (§1) — green except the pre-existing
`format:check` failure.

**All six decisions D1–D6 were made on 2026-08-17** (§15). Nothing is blocked on
a product decision.

Next deliverables, in order, before any production code:

1. Product specification (`01-product-spec.md`).
2. Project schema (`02-project-schema.md`).
3. Canvas/export ADR (`03-canvas-export-adr.md`) — a prior untracked draft exists
   and its Skia conclusion is independently supported by §11.
4. Music-analysis ADR (`04`), AI-director ADR (`05`), remix-privacy model (`06`),
   Color DNA model (`07`), implementation plan (`08`).
