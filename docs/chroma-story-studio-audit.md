# Chroma Story Studio — Phase 0 Repository Audit

**Audited commit:** `994c1ec` (branch `chromawave-v6`), working tree clean.
**Date:** 2026-08-17.
**Method:** read from source. Where this document contradicts an existing doc in
`docs/`, the source won and the contradiction is called out.

Nothing in the repository has been modified by this audit.

> **Status note, added 2026-08-17 after handover.** A second session audited the
> same repository in parallel and produced `docs/creative-platform/00-repository-audit.md`.
> The two agree on every substantive finding — same baseline (832 tests), Skia
> already present and load-bearing, no video support, tempo/valence unobtainable,
> the source-scanning guard tests. **Treat that document as canonical** if only
> one can be; it audits the later commit `02270b3` and belongs to the session that
> owns the implementation.
>
> Everything in _this_ document is repository fact and remains accurate. Only the
> forward-looking sections — §15's decisions and §17–18's proposed architecture —
> were superseded when implementation moved. See the plan document for what
> actually shipped.

---

## 1. Baseline — exact commands and results

All three ran on the clean tree at `994c1ec`, before any change.

| Command                   | Result     | Notes                                            |
| ------------------------- | ---------- | ------------------------------------------------ |
| `corepack pnpm typecheck` | **exit 0** | `tsc --noEmit` across all four packages          |
| `corepack pnpm lint`      | **exit 0** | `expo lint` (mobile) + `tsc --noEmit` (packages) |
| `corepack pnpm test`      | **exit 0** | totals below                                     |

Test totals, per package:

| Package                     | Runner           | Files                   | Tests                    |
| --------------------------- | ---------------- | ----------------------- | ------------------------ |
| `@chromawave/mobile`        | jest + jest-expo | 51 suites               | **439 passed**           |
| `@chromawave/domain`        | vitest           | 18 files                | **376 passed**           |
| `@chromawave/design-tokens` | vitest           | 1 file                  | **17 passed**            |
| `@chromawave/analytics`     | vitest           | 0 (`--passWithNoTests`) | 0                        |
| **Total**                   |                  | **70**                  | **832 passed, 0 failed** |

Zero snapshots. Mobile run time ~38s; domain ~1.1s.

**One pre-existing warning, not a failure:** `EntitlementProvider.tsx:55` emits a
React `act(...)` warning during the mobile suite (a `setReady(true)` in a
`.finally()` outside `act`). It does not fail any test. Worth knowing because
`AGENTS.md` separately flags `PreferencesProvider` as a React Compiler bail-out —
the providers are the app's rough edge.

Other available commands: `pnpm format:check` (prettier), `pnpm check` (all four
in sequence), `node apps/mobile/scripts/react-compiler-healthcheck.mjs`.

---

## 2. Platform and dependency versions (verified in `apps/mobile/package.json`)

| Concern                          | Version                                               |
| -------------------------------- | ----------------------------------------------------- |
| Expo SDK                         | `~55.0.28`                                            |
| React Native                     | `0.83.10`                                             |
| React                            | `19.2.0`                                              |
| Expo Router                      | `~55.0.17`, `typedRoutes: true`                       |
| **`@shopify/react-native-skia`** | **`2.4.18` — already installed and used in 15 files** |
| `react-native-reanimated`        | `4.2.1` (+ `react-native-worklets` `0.7.4`)           |
| `react-native-gesture-handler`   | `~2.30.0`                                             |
| `react-native-svg`               | `15.15.3`                                             |
| `react-native-mmkv`              | `^4.3.2`                                              |
| `zustand`                        | `^5.0.14`                                             |
| `zod`                            | `^4.1.5` (domain package)                             |
| `expo-image-manipulator`         | `~55.0.19`                                            |
| `expo-image-picker`              | `~55.0.22`                                            |
| `expo-media-library`             | `~55.0.19`                                            |
| `expo-file-system`               | `~55.0.24` (new `File`/`Directory`/`Paths` API)       |
| `react-native-vision-camera`     | `^5.2.0`                                              |
| TypeScript                       | `~5.9.2`                                              |

**No video dependency exists.** There is no `expo-video`, no `expo-av`, no
`react-native-video` anywhere in the manifest or the source. See §12.

**No `expo-sharing`.** Sharing goes through React Native's built-in `Share` API
(`lib/export.ts:44`).

TypeScript is configured strictly, and this shapes how new code must be written:
`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`isolatedModules`, `moduleResolution: "Bundler"`. Array indexing yields
`T | undefined` everywhere — a document model addressed by index needs to expect
that.

Module aliases (`apps/mobile/tsconfig.json`) are `@/*` → `src/*`, and
`@cw/domain`, `@cw/tokens`, `@cw/analytics` → the package sources directly. Note
the alias prefix is `@cw/`, while the package _names_ are `@chromawave/*`; app
code imports the short form.

---

## 3. Navigation structure

Expo Router, file-based, rooted at `apps/mobile/src/app` (not `apps/mobile/app`).

```
app/_layout.tsx            root stack + providers
app/index.tsx              entry redirect
app/(tabs)/_layout.tsx     custom TabBar, 4 tabs + centre capture action
  (tabs)/index.tsx         Library
  (tabs)/explore.tsx       Explore
  (tabs)/sets.tsx          Sets
  (tabs)/you.tsx           You
app/source.tsx             the capture entry sheet (recent 5 commits reworked this)
app/capture.tsx            viewfinder
app/capture/result.tsx     extracted palette
app/capture/studio.tsx     CameraStudioScreen
app/pair.tsx               music pairing
app/palette/[id].tsx       memory detail
app/set/[id].tsx, set/new.tsx
app/paywall.tsx
app/onboarding.tsx
app/trending.tsx
app/tools/*.tsx            12 tool routes (grade, gradient, export, contrast,
                           compare, scan, pick, living, rewind, activity,
                           theme, widgets, spike-liveread)
```

The centre tab-bar button routes to `/source` (`(tabs)/_layout.tsx:48`).

**Naming collision to resolve now:** `src/features/studio/` already exists and is
`CameraStudioScreen.tsx` + `useCameraControls.ts` — a _camera_ studio, routed at
`/capture/studio`. Chroma Story Studio must not be dropped into that folder or
claim the `studio` route segment. Recommendation: new feature lives at
`src/features/story/`, routes under `app/story/`, and the user-facing name
"Studio" in the tab/nav is disambiguated from the existing camera studio (which
is reached only from inside capture, so the collision is navigational-only, not
user-facing).

---

## 4. The domain model — what a "memory" actually is

`packages/domain/src/memory.ts`. The aggregate is `ChromaticMemory`,
`schemaVersion: 2`, validated by zod with a `superRefine`:

```
ChromaticMemory {
  schemaVersion: 2, id: uuid, createdAt/updatedAt/capturedAt: ISO
  image:           { localUri, width, height, source, thumbnailUri, grade|null }
  palette:         { colors[2..8], deltaE, confidence, space, tuned, source }
  atmosphere:      AtmosphereReading   (computed, never null)
  visualAnalysis:  VisualAnalysis | null   (needs a network; usually null)
  musicPairing:    MusicPairing
  personalContext: { title, note, mood, tags[≤8], location{name} | null }
  facets:          MemoryFacets   (denormalised scalars for filtering)
  collectionIds:   uuid[≤50]
  isPinned:        boolean
}
```

Invariants enforced at parse time (`memory.ts:166-204`) and directly relevant to
anything that reads a palette into a story:

- colour `weight`s must sum to 1 ± 0.02 — **every proportional band in the app
  divides by this**, so a palette strip element gets its proportions for free;
- the named roles `dominant` / `support` / `signal` are unique; `extra` repeats;
- a `paired` pairing must carry its track;
- `pending` is a runtime-only status and must never be persisted.

`deriveFacets` is the single writer of `facets` and is called on every write.
`MemoryFacets` already carries `dominantHue`, `dominantHex`, `warmth`, `energy`,
`luminosity`, `mood`, `paired`, `genres`, `monthKey` — this is a ready-made input
vector for palette and pacing intelligence, and it is already computed and stored.

`AtmosphereReading` (`atmosphere.ts`) supplies `warmth`, `saturation`, `contrast`,
`spread`, `luminosity`, `mood`. Again: already computed, offline, sub-millisecond.

**Colour maths available for reuse** (`packages/domain/src/color.ts`, 595 lines,
294 lines of tests): OKLab/OKLCH conversions both ways, `contrastRatio`,
`relativeLuminance`, `safeForegroundFor`, `readableOn(hex, bg, minRatio)`,
`deltaE00` / `hexDeltaE00`, `clampOklch`, `rgbToDisplayP3`, `simulateVision`
(colour-vision simulation). Everything Colour Flow and accessible-contrast text
selection needs already exists and is tested. **Do not write new colour maths.**

---

## 5. Capture → Pair → Collect → Discover, as actually wired

- **Capture** — `/source` presents the entry sheet (reworked in commits
  `808f9e7`…`293e59f`); routes to the Vision Camera viewfinder or
  `expo-image-picker`. `lib/readPalette.ts` decodes via Skia,
  `domain/color.ts:extractPaletteFromRgba` extracts. Result at `/capture/result`.
- **Pair** — `/pair`, `features/pairing/PairScreen.tsx` + `store/pairingStore.ts`.
  Derives a `MusicIntent`, issues one bare-genre query per genre, ranks, and lets
  the user select a track. Preview playback via `infrastructure/audio/PreviewPlayer`.
- **Collect** — Sets (`/set/[id]`, `/set/new`), `StoredSetRepository`,
  `collectionIds` on the memory.
- **Discover** — Explore tab + `/trending`, backed by `domain/discovery.ts` and
  `data/trending.ts`.

All four must keep working. The guard tests in §10 are the main mechanism that
will tell us if they stop.

---

## 6. Music provider and its real limitations

`infrastructure/music/ITunesMusicProvider.ts` (9 KB, tested). iTunes Search is
the default in `dependencies.ts:69`; `UnconfiguredMusicProvider` is the honest
fallback and is deliberately kept wired as a reachable path.

Constraints the domain documents as _measured_, not assumed:

1. **No tempo, no valence, no danceability, no energy — from any provider.**
   `music.ts:101-111` states this explicitly and deliberately omits `tempo` from
   `recommendationReasonKinds`, because "citing a number we did not measure would
   be the exact dishonesty this product is built to avoid." Spotify's audio-features
   and recommendation endpoints are closed to new applications, and Spotify removed
   30-second preview access for new apps on 2024-11-27 (`music.ts:10-14`).

   > **This contradicts the brief.** §5 of the request asks music to drive the
   > visual system through "energy, valence/mood, tempo range". Tempo and valence
   > are not obtainable. `energy` _is_ available but it is derived from **colour**
   > (`memory.ts:227-230`), not from audio. Design decision recorded in §15.

2. **Preview URLs are never persisted** (`music.ts:52-63`) and a test asserts no
   audio URL appears in a serialised memory. Previews are re-resolved on demand
   and may legitimately return `null` — `previewUnavailableReasons` models
   `not-offered` / `expired` / `region-restricted` / `network` as _displayed_
   states, not spinners.

3. **`attribution` is carried on every track reference** and is a licence
   condition — any story surface showing a track must render it.

4. **No waveform data exists.** Nothing decodes audio samples. A "waveform"
   element must be declared decorative and derived deterministically from
   palette/metadata, or it is a fabrication.

---

## 7. AI — interfaces exist, no provider

`packages/domain/src/analysis.ts` defines the whole optional intelligence layer:

- `ImageUnderstandingProvider` → `VisualAnalysis` (zod-validated, every field
  nullable inside a nullable object). Default shipped implementation is
  `NullImageUnderstandingProvider`, which throws `AnalysisUnavailableError`.
- `RecommendationProvider` with `refineIntent` and `explain`.
- `AnalysableImage` — "longest edge ≤1024, JPEG q0.7, EXIF stripped, no location."

**No concrete AI provider is implemented anywhere in the repo.** No Anthropic,
OpenAI, or any HTTP AI client. `visualAnalysis` is `null` on every real memory.

The anti-fabrication pattern is already established and should be copied verbatim
for the AI Story Composer:

- `acceptRefinedIntent(candidate, baseline)` — all-or-nothing zod validation with
  fallback to a locally computed baseline (`analysis.ts`);
- `retainKnownExplanations(explanations, candidates)` — drops any id the caller
  did not supply, so "a model cannot add a track to this pipeline… that is a
  property of the types, not a promise in a prompt."

The Story Composer should therefore return a **validated JSON patch against an
already-constructed local baseline document**, never a document from scratch, and
never anything executable. There is a deterministic local composer to fall back
to, because atmosphere + facets already give us ordering and pacing signals
offline.

---

## 8. Image processing and export — the single most valuable existing asset

This is the finding that most changes the architecture, and it is what makes the
Skia-vs-alternatives comparison short.

**The exact export pipeline Phase 1 needs already exists, works, and is tested:**

`lib/grade/bakeGrade.ts` (`renderGraded`, tested in `bakeGrade.test.ts`):

```
decodeImage(uri)                        // lib/readPalette.ts → SkImage
  → targetSize(w, h, longEdge)          // pure, tested, no-upscale rule
  → Skia.Surface.MakeOffscreen(w, h)    // off-screen, not a view snapshot
  → image.makeShaderOptions(...matrix)  // scaled draw
  → RuntimeEffect shader (11 uniforms)
  → canvas.drawRect / surface.flush()
  → surface.makeImageSnapshot().encodeToBytes()   // PNG bytes
  → new File(dir, name).write(bytes)    // expo-file-system
  → image.dispose()                     // in a finally
```

`lib/export.ts` adds `renderGradientPng`, `renderShareCard`, `gradientSvg`, and
`shareFile(data, filename)` → RN `Share`. `renderShareCard` already draws
**weighted palette bands at true proportions** at 1080×1080 / 1080×1350 /
1080×1920 — `SHARE_SIZES` already contains 1:1, 4:5 and 9:16.

`lib/grade/saveGraded.ts` carries `expo-media-library` and its permission; the
codebase deliberately separates "a card you send" (share sheet) from "a photograph
you keep" (media library).

Memory-safety precedent worth keeping (`bakeGrade.ts:33-39`): export long edge is
capped at **4096 px** because "a 48MP photograph through
`Skia.Surface.MakeOffscreen` is the shortest route to an out-of-memory crash on an
older phone, and a crash while saving is a worse outcome than a ceiling."
Thumbnails bake at 1024 px. Both constants are exported and reusable.

`lib/photos.ts` — `persistPhoto` / `deletePhoto`: copies temporary picker/camera
URIs into `Paths.document/palette-photos/` because iOS purges the cache directory
("a palette saved in March showed a blank card in April"). Any story asset manager
must follow the same rule, keyed differently so a story and a memory do not fight
over the same file.

**EXIF:** not currently read. `decodeImage` goes through Skia; orientation
handling needs to be verified on device rather than assumed (risk R4).

---

## 9. Persistence and state management

**Persistence:** MMKV (`infrastructure/MmkvStorage.ts`) behind a narrow
`KeyValueStorage` interface, one instance for every repository
(`dependencies.ts:25`). Repositories: `StoredMemoryRepository`,
`StoredPaletteRepository`, `StoredSetRepository`, `StoredPreferencesRepository`,
`StoredEntitlements`. All tested.

Two patterns to reuse:

- `ChromaticMemoryRepository.listInvalid()` (`memory.ts:351-364`) — v1 parsed the
  whole collection and threw on any bad record, losing the entire library for one
  corruption. v2 keeps what validates and **reports** what does not. A story draft
  store must do the same: one corrupt draft must not lose the others.
- `migrateMemories.ts` / `migration.ts` — idempotent forward migration that
  **never deletes the source key**, because that key is the rollback.

**`MemoryBackedPaletteRepository`** is the answer to "is the memory model or the
palette model the real one": memories are the storage, and the v1 `Palette`
interface is a _projection_ over them so ~17 older call sites keep working. It is
a facade, not a duplicate. Story Studio should read `ChromaticMemory`, not
`Palette`.

**State:** zustand (`store/captureStore`, `libraryStore`, `pairingStore`,
`heroStore`) + React context providers (`PreferencesProvider`,
`EntitlementProvider`, `SkinProvider`). No Redux, no react-query.

**Reanimated 4.2.1 + worklets 0.7.4** are present, but note: gesture-handler is
currently used in only four files (`app/_layout.tsx`, `ui/Pressable.tsx`,
`ui/Slider.tsx`, and a test). **There is no existing multi-touch pan/pinch/rotate
precedent in this codebase.** Gesture arbitration for the canvas is genuinely new
work and is the largest interaction risk (R1).

---

## 10. Tests, and the guard tests that will constrain new code

Runners: jest + `jest-expo` (mobile, `--runInBand`), vitest (packages).
`@testing-library/react-native` for screens.

Beyond ordinary unit tests, `src/__tests__/` holds **source-scanning guard tests**
that any new screen must satisfy. These are not optional style checks; they fail
the build:

| Guard                                       | What it forbids                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-dead-controls.test.ts`                  | a `Pressable` with a button role and no `onPress`; a `NavBar` with a trailing action and no `onTrailing`; `onPress={() => {}}`                                                                                                                                                  |
| `no-appearance-leaks.test.ts`               | any file under `features/` or `app/` importing `ui`, `round`, `tint`, `elevation`, `glass`, `uiShadow`, `typeExtra`, or writing chroma's literal colours (`#7C5CFF`, `rgba(8,7,14…)`, …). Screens must go through `useSkin`/`useStyles`. Only `ui/` primitives may read a skin. |
| `no-hot-cameras.test.ts`                    | camera sessions running on screens nobody is on                                                                                                                                                                                                                                 |
| `no-provider-leaks.test.ts`                 | provider-shaped data past the domain boundary                                                                                                                                                                                                                                   |
| `keyboard-taps.test.ts`, `screens.test.tsx` | every screen renders and its controls press                                                                                                                                                                                                                                     |
| `localization.test.ts`                      | no icon glyphs in strings; per-control character budgets (chip 16, button 34, tab 10) because **Vietnamese runs ~25–30% longer**                                                                                                                                                |

`screens.test.tsx` imports every screen by name — a new Story Studio screen is
expected to be added to it.

**Localization is mandatory, not optional:** `en.ts` (688 lines) and `vi.ts`
(683 lines) are kept in lockstep and the test asserts it. Every string in the new
feature needs both, inside the budgets.

---

## 11. Design tokens and the two skins

`packages/design-tokens/src/skins.ts` (458 lines, 17 tests). Two complete looks
over one component set, swapped at runtime via `SkinProvider` + `useStyles`.

- **`chroma`** — dark ground `#0C0B18`, violet accent `#7C5CFF`, drifting ambient
  metaball field, glass surfaces, soft depth, rounded.
- **`swiss`** — paper `#F2F1EE`, ink `#101010`, one signal red `#E8320C`, **no
  backdrop, no glass, no depth at all**, square corners (`round.*: 0`), structure
  from rules and labels, mono for every label and number.

`SkinChrome` exists precisely because some differences cannot be a value:
`{ backdrop, glass, depth, rules, shout }` are booleans a component branches on.
`SkinEffects` gives five named gradient roles (`scrimBottom`, `scrimTop`,
`fadeToGround`, `screenWash`, `surfaceWash`) so a screen never names a colour stop.

**Consequence for the editor:** the editor chrome must be built from skin tokens
and `SkinChrome` branches, and must be checked in _both_ skins. Swiss will not
tolerate the glassmorphic floating panels that a canvas editor reaches for by
default — which happens to align with the brief's instruction to avoid excessive
glassmorphism. Template designs must consume the skin too, not bake chroma's
palette.

Reusable UI primitives (`src/ui/index.ts`): `Screen`, `Card`, `CardGroup`,
`Gutter`, `NavBar`, `ScreenHeader`, `SectionHead`, `Sheet`, `SheetGrabber`,
`Button`, `Chip`, `Slider`, `Toggle`, `Field`, `Icon`, `Pressable`, `Text`,
`Carousel`, `FilterRail`, `SwatchStrip`, `ColorRow`, `Toast`, `InlineError`,
`CardSkeleton`, `GradientCanvas`, `BandCanvas`.

`ui/Carousel.tsx` already handles reduced motion correctly
(`AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged` listener,
lines 84-133) — copy that pattern rather than reinventing it. It is currently the
_only_ reduced-motion implementation in the app.

Accessibility today: 55 `accessibilityRole="button"` and a scattering of others.
Adequate but not systematic; the editor will need to do better than the current
average, not merely match it.

---

## 12. iOS / Android native configuration

`apps/mobile/app.json`:

- `scheme: "chromawave"`, bundle id / package `com.chromawave.app`.
- **`orientation: "portrait"`, `ios.supportsTablet: false`** — the editor is a
  portrait phone experience. No landscape canvas.
- `userInterfaceStyle: "dark"`.
- `experiments: { typedRoutes: true, reactCompiler: true }`.
- `CFBundleLocalizations: ["en", "vi"]`.
- Permissions declared: camera, photo library (`expo-image-picker`),
  media library with `granularPermissions: ["photo"]`,
  `savePhotosPermission` present, `isAccessMediaLocationEnabled: false`,
  `preventAutomaticLimitedAccessAlert: true`.
- Custom config plugins: `./plugins/withIosResourceBundleSigning`,
  `./plugins/withChromawaveWidget` (a real iOS widget extension, App Group
  `group.com.chromawave.app`).
- EAS project provisioned; `updates` (expo-updates) configured.
- No `ios/` or `android/` directory committed — prebuild is on demand, and
  `prebuild:ios` runs `scripts/ensure-skia.mjs` first.

**`granularPermissions: ["photo"]` is photo-only.** Adding video would require
changing this, adding a video permission string, and adding a video dependency.

---

## 13. Premium / paywall — current state

`domain/entitlements.ts`. Two tiers, `free` and `pro`. Six entitlements:
`watermark_free_share`, `semantic_export_names`, `structured_export`,
`locked_white_balance`, `wide_gamut_export`, `advanced_grading`.

The documented principle (`entitlements.ts:1-18`) is explicit and must be
respected by any Story Studio pricing: **the line is drawn at systems work, not at
quantity.** The previous model capped the free library at 10 palettes and was
deliberately removed — "a colour app whose answer to 'I used this a lot' is
'stop' has mistaken its core loop for a cost centre."

> **This contradicts the brief.** The request suggests gating a "small number of
> active drafts" free and "unlimited drafts" premium. That is exactly the quantity
> cap this codebase deliberately abolished. Recommendation in §15.

Gating pattern: `useEntitlement('advanced_grading')` returns a boolean;
`ready` is false until storage answers so no gate flashes unlocked-then-locked.
`looks.ts` shows the intended free/premium shape for a content library — **one
free item per collection**, because "a wall of locked chips tells someone the app
is not for them."

**There is no billing provider.** `EntitlementProvider.devSetTier` is `null`
outside `__DEV__`; `free` is the only tier a real device can reach today. Story
Studio can define and enforce gates, but nothing can be purchased, and the
paywall's `paywall_converted` event cannot fire in production. This is a known
product gap, not something to solve in this feature.

`PaywallTrigger` in `@chromawave/analytics` is a closed union
(`'watermark' | 'json-export' | 'semantic-names' | 'auto-wb' | 'pro-tools' | 'unknown'`)
— new triggers require widening it.

---

## 14. Unfinished, duplicated, or contradictory functionality found

1. **Two product identities in one repo.** `memory.ts` describes the aggregate as
   "a photograph, the colour system inside it, the atmosphere that colour implies,
   **one piece of music**, and the reason those belong together."
   `entitlements.ts` describes v1 as "a music-and-memory app **this one is no
   longer related to**" and removed `ai_pairing` / `spotify_playlist_export` as
   features that "had no implementation, screen, or trigger." Both are current
   source. The reality on disk: the music pipeline _is_ implemented and wired
   (iTunes provider, pairing store, pair screen, preview player, all tested), but
   the _paid_ surface is entirely colour-tool work. Story Studio sits across this
   seam and should not be used to resolve it silently — see §15, decision D1.

2. **`features/studio/` is already taken** by the camera studio (§3).

3. **`app/tools/spike-liveread.tsx`** — a route named "spike", i.e. an
   experiment left in the tree.

4. **`ui/BandCanvas.tsx` and `ui/Sequences.tsx` import both Skia and SVG**;
   `ui/BandField.tsx`, `EmptyGlyph.tsx`, `Loops.tsx` are SVG-only. Two rendering
   stacks coexist for decorative work. Not a defect, but the Story Studio should
   pick one and not add a third.

5. **`StoredPaletteRepository` and `MemoryBackedPaletteRepository` both exist**
   and both implement the palette interface; only the latter is wired in
   `dependencies.ts`. The former is retained for the migration/rollback path.
   Not dead code, but easy to mistake for it.

6. **`EntitlementProvider` `act()` warning** in the test suite (§1).

7. **The 13 React Compiler bail-outs** noted in `AGENTS.md`, including
   `PreferencesProvider` — the provider every screen reads. Manual memoisation in
   bailed-out files is the only memoisation those files have.

---

## 15. Decisions this audit forces, and my recommendations

Three of these were product decisions that materially change scope. All three
were put to the product owner on 2026-08-17 and **all three were decided in
favour of the recommendation below.** They are now settled and binding on the
ADR, the schema and Phase 1.

**D1 — Music's role in the visual system. DECIDED: honest inputs only.**
Tempo, valence and danceability are unavailable and the domain refuses to
fabricate them. I recommend the visual system be driven by inputs we actually
have: the memory's `facets.energy` (colour-derived), `warmth`, `luminosity`,
`mood` (`AtmosphereReading`), and the track's `genres` and `releaseYear`. Music
then influences layout through _genre and era texture plus the memory's own
colour_, which is honest and needs no new provider. "Beat-derived spacing" and a
real waveform are not implementable and I will not fake them — a waveform element
would ship explicitly labelled as a decorative palette-derived figure.

**D2 — Video. DECIDED: photo-only in Phase 1, schema-ready for video.**
There is no video support in the app at any level: no dependency, no permission,
no player, and Skia offscreen composition has no video frame source. Supporting
video means adding `expo-video`, widening `granularPermissions`, adding
permission strings, and solving frame extraction for export. I recommend Phase 1
ships **photo-only**, with the element model carrying a typed `video` variant that
is defined-but-not-constructible, so the schema does not need a migration when
video lands. Doing otherwise triples Phase 1.

**D3 — Draft limits and the free/premium line. DECIDED: no quantity caps; the
existing "systems work, not quantity" principle wins.**
The brief suggests capping free drafts. This codebase deliberately abolished
quantity caps as a matter of stated principle. I recommend following the existing
principle: **unlimited drafts free**, and put the paid line on systems work —
full template library (with one free template per family, mirroring `looks.ts`),
AI Story Composer, advanced Colour Flow, high-resolution export, and
watermark-free export via the existing `watermark_free_share` entitlement. This
needs at most one or two new `Entitlement` members rather than a new system.

**Decided without asking:**

- **Canvas/export stack: Skia, and the ADR is nearly written by the repo.**
  Skia 2.4.18 is already a dependency, already has a build hook
  (`scripts/ensure-skia.mjs`), already appears in `pnpm.onlyBuiltDependencies`,
  and — decisively — `renderGraded` already proves off-screen deterministic
  raster export at arbitrary pixel dimensions with a memory ceiling and tests.
  RN views + Reanimated cannot produce a deterministic off-screen raster (they can
  only snapshot a view at device resolution, which is the exact bug
  `lib/export.ts:16-19` calls out). SVG cannot composite photos with fidelity.
  Native composition would be new native code for a problem already solved in JS.
  **No new dependency is required for the canvas or the export.** The full ADR is
  the next deliverable.
- **Gestures:** interaction runs on Reanimated 4 worklets and gesture-handler,
  with element transforms held in shared values and committed to the zustand
  document only on gesture end. No gesture frame touches React state.
- **Document model:** a new zod-validated, versioned `storyProject` schema in
  `packages/domain/src/story/`, following `memory.ts`'s conventions —
  `schemaVersion` literal, `superRefine` invariants, forward-only idempotent
  migration that never deletes the previous key, and a `listInvalid()`-style
  recovery path so one corrupt draft cannot lose the rest.
- **Assets:** a story asset manager modelled on `lib/photos.ts`, writing to
  `Paths.document/story-assets/`, storing URIs only — never base64 — with
  optimised editing previews capped like `THUMBNAIL_LONG_EDGE` and export
  independent at `EXPORT_LONG_EDGE`.
- **Feature location:** `src/features/story/`, routes `app/story/*`,
  domain in `packages/domain/src/story/`.
- **Skins:** every editor surface built through `useStyles`/`useSkin` and verified
  in both, because `no-appearance-leaks.test.ts` will fail the build otherwise.

---

## 16. Technical risks

| #   | Risk                                                                                                                                                                                | Severity           | Mitigation                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **No multi-touch gesture precedent in the codebase.** Pan/pinch/rotate on elements vs. canvas pan/zoom vs. slide navigation is a three-way arbitration problem, built from scratch. | **High**           | Design arbitration explicitly before coding: element gestures win when an element is selected; canvas gestures require an empty-space start or two fingers; slide navigation is a separate mode, not a competing gesture. Prototype on a physical device before building the rest.     |
| R2  | **Cross-slide pixel-perfect slicing.** Rounding at slide boundaries produces seams or duplicated columns.                                                                           | **High**           | One logical canvas, integer slide widths, derive each slice by translating the same scene by `-slideIndex * slideWidth` — never re-render per slide independently. Add the visual verification test the brief asks for: a cross-slide element sliced and recomposed must be identical. |
| R3  | **Memory on 20 slides.** 20 full-resolution decodes will OOM; `bakeGrade.ts` already documents this exact failure.                                                                  | **High**           | Reuse the existing ceiling discipline: previews at ≤1024 px long edge, export streamed one slide at a time with `image.dispose()` in a `finally`, hard cap at `EXPORT_LONG_EDGE`.                                                                                                      |
| R4  | **EXIF orientation is unverified.** Nothing in the repo reads EXIF; Skia's decode behaviour must be confirmed, not assumed.                                                         | Medium             | Verify on device with known-rotated fixtures early in Phase 1; use `expo-image-manipulator` to normalise on import if Skia does not.                                                                                                                                                   |
| R5  | **React Compiler bail-outs.** A bailed-out editor component memoises nothing, on the hottest path in the app.                                                                       | Medium             | Run `react-compiler-healthcheck.mjs` on every new file; avoid `try/finally` in components; keep manual memoisation where it bails.                                                                                                                                                     |
| R6  | **Vietnamese string expansion (~25–30%)** in a dense editor with tiny controls, against enforced character budgets.                                                                 | Medium             | Write `vi.ts` entries at the same time as `en.ts`, not after; prefer icons with labels over text-only controls in the tool dock.                                                                                                                                                       |
| R7  | **Swiss skin vs. editor chrome.** Swiss has no glass, no depth, no radii; a floating translucent inspector is not expressible in it.                                                | Medium             | Design the dock and inspectors as rule-separated structure first (Swiss-native), and let chroma add depth — not the reverse.                                                                                                                                                           |
| R8  | **No billing provider**, so premium gates are unpurchasable.                                                                                                                        | Low (pre-existing) | Gate correctly, emit `premium_gate_viewed`, and treat conversion as out of scope.                                                                                                                                                                                                      |
| R9  | **`PaywallTrigger` and `AnalyticsEventMap` are closed unions**; the 13 requested events do not exist.                                                                               | Low                | Widen both in `packages/analytics`; typed by construction, so omissions fail typecheck.                                                                                                                                                                                                |
| R10 | Story Studio adds a second large feature across the memory/palette seam (§14.1).                                                                                                    | Low                | Read `ChromaticMemory` only; do not extend the `Palette` projection.                                                                                                                                                                                                                   |

---

## 17. Recommended architecture (summary)

```
packages/domain/src/story/
  project.ts       storyProjectSchema (versioned, zod, superRefine invariants)
  elements.ts      discriminated union of typed elements, stable ids
  geometry.ts      logical↔slide coordinate transforms  (pure, heavily tested)
  snapping.ts      alignment/snap calculation           (pure, heavily tested)
  slicing.ts       logical canvas → N deterministic slide rects
  palette.ts       story palette derivation + Colour Flow  (wraps domain/color.ts)
  compose.ts       AI Story Composer patch schema + deterministic local baseline
  migration.ts     forward-only, idempotent, keeps the previous key

apps/mobile/src/features/story/
  StudioScreen.tsx / EditorScreen.tsx / PreviewScreen.tsx
  canvas/          Skia scene graph + Reanimated gesture layer
  dock/            contextual tools; sheets built on ui/Sheet
  export/          slice → Skia offscreen → bytes → share/save
  assets/          StoryAssetManager (modelled on lib/photos.ts)
  store/           zustand: document | selection/gesture | render | export, separated
```

Four separated state layers, as the brief requires: the **document** in zustand
(immutable updates, bounded undo history), **transient gesture state** in
Reanimated shared values (never React state), **render state** derived, and
**export state** its own machine with progress and cancellation.

---

## 18. Implementation plan

Unchanged in shape from the brief; sequenced against what this audit found.

**Phase 1 — vertical slice.** Story schema + migration; asset manager; logical
canvas with 3 slides; Skia render; element model for photo / text / palette-strip;
move / scale / crop; undo/redo; atomic autosave + crash recovery; preview; slice
export at deterministic dimensions; share. Tests: geometry, slicing, schema,
autosave/recovery, cross-slide slice fidelity, missing-asset behaviour.

**Phase 2 — precision.** Snapping and guides, layer panel, lock/hide, slide
add/remove/reorder, shapes/frames/gradients, remaining formats.

**Phase 3 — differentiation.** Palette intelligence, Colour Flow, track
attachment + music card (with attribution), decorative palette-derived waveform,
AI Composer interface + validated patch schema + deterministic local fallback.

**Phase 4 — templates and monetization.** Eight data-driven adaptive template
families, skin-aware and palette-consuming; discovery; entitlement gates; the 13
analytics events; onboarding.

**Phase 5 — hardening.** Device profiling, 20-slide memory testing, export
fidelity, accessibility audit, crash recovery, offline, `vi` localization pass,
migration tests.

At each boundary: `pnpm typecheck && pnpm lint && pnpm test`, new focused tests,
device verification, documented limitations, and Capture/Pair/Collect/Discover
confirmed still working.

---

## 19. Reuse map — what Phase 1 does _not_ need to build

| Need                                                          | Already exists                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Off-screen deterministic raster export                        | `lib/grade/bakeGrade.ts:renderGraded`, `lib/export.ts`               |
| PNG encode + file write + share sheet                         | `lib/export.ts:shareFile`, `expo-file-system` File API               |
| Save to photo library + permission                            | `lib/grade/saveGraded.ts`                                            |
| Image decode to `SkImage`                                     | `lib/readPalette.ts:decodeImage`                                     |
| Durable asset storage away from the purged cache              | `lib/photos.ts`                                                      |
| Export size ceiling / no-upscale rule                         | `bakeGrade.ts:targetSize`, `EXPORT_LONG_EDGE`, `THUMBNAIL_LONG_EDGE` |
| Palette extraction + weights that sum to 1                    | `domain/color.ts`, `domain/palette.ts`                               |
| OKLCH, ΔE00, contrast, `readableOn`, vision simulation        | `domain/color.ts`                                                    |
| Mood / warmth / energy / luminosity per memory                | `domain/atmosphere.ts`, `memory.ts:deriveFacets`                     |
| Track model, attribution, preview rules                       | `domain/music.ts`, `ITunesMusicProvider`                             |
| Validated-AI-response pattern                                 | `domain/analysis.ts`                                                 |
| Versioned schema + idempotent migration + corruption recovery | `memory.ts`, `migration.ts`, `migrateMemories.ts`                    |
| MMKV storage behind a narrow interface                        | `infrastructure/MmkvStorage.ts`                                      |
| Entitlement gating + free-per-collection precedent            | `domain/entitlements.ts`, `domain/looks.ts`                          |
| Two-skin token system                                         | `packages/design-tokens/src/skins.ts`                                |
| Reduced-motion pattern                                        | `ui/Carousel.tsx:84-133`                                             |
| Sheets, nav bars, sliders, chips, buttons                     | `src/ui/*`                                                           |
| 3 of the 5 requested export sizes                             | `lib/export.ts:SHARE_SIZES`                                          |

---

## 20. Status

Phase 0 is complete. Baseline recorded and green (§1). All three open product
decisions were resolved on 2026-08-17 (§15, D1–D3) and no question remains
blocking.

Next deliverables, in order, before any Phase 1 code:

1. Product/technical specification for Chroma Story Studio.
2. Architecture decision record for the canvas and export approach — the
   Skia-vs-RN-views-vs-SVG-vs-native comparison, whose conclusion §15 already
   anticipates but which must be argued and recorded properly.
3. The versioned `storyProject` schema.
4. The implementation plan with dependencies and risks.

Then Phase 1, against the vertical slice in §18.
