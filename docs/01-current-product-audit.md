# 01 · Current product audit

Established by reading the repository at `a7be7bb`, not by trusting
`archive/25-project-review-and-phase-plan.md`. Every claim below cites a file.

## 1. Packages and application structure

```
packages/
  domain/          Pure TS + Zod, zero React/Expo.  2 634 LOC, 94 tests.
                   color.ts (611) · palette.ts (323) · discovery.ts (470)
                   preferences.ts (128) · entitlements.ts (59) · errors.ts (16)
  design-tokens/   brand.ts · ui.ts (chroma's raw values) · skins.ts (both skins)
                   17 tests pinning both skins.
  analytics/       Typed 27-event contract. Development + Noop implementations.
                   No network transport exists.
tools/
  brand-assets/    Node scripts that render the mark. Not shipped in the app.
apps/mobile/       Expo 55 · RN 0.83.10 · React 19.2 · expo-router 55
                   21 274 LOC across src/. 228 tests.
```

`pnpm-workspace.yaml` covers `apps/*`, `packages/*`, `tools/*`. Five packages
typecheck.

**Notable dependencies already present:** `expo-audio` (used only for four UI
sound cues), `expo-image`, `expo-image-manipulator`, `expo-crypto`,
`@shopify/react-native-skia` 2.4.18, `react-native-vision-camera` 5.2.0,
`react-native-mmkv` 4.3.2, `zustand` 5, `react-native-reanimated` 4.2.1.

There is **no** HTTP client, no `react-native-track-player`, no music SDK, no AI
SDK. One `fetch` exists in the entire app: `features/trending/trendingRepository.ts:152`.

## 2. Routes and screens

26 route files under `src/app/`. Root `Stack` in `app/_layout.tsx`; a four-tab
`Tabs` with a custom `TabBar` that centres capture as a raised action.

| Route                  | Screen                | Notes                                                                       |
| ---------------------- | --------------------- | --------------------------------------------------------------------------- |
| `index`                | redirect              | → `onboarding` or `(tabs)`                                                  |
| `onboarding`           | `OnboardingScreen`    | **5 static slides**, camera permission last                                 |
| `(tabs)/index`         | `LibraryScreen`       | Month-grouped ribbon archive                                                |
| `(tabs)/explore`       | `ExploreScreen`       | Search + discovery filters                                                  |
| `(tabs)/sets`          | `CollectionScreen`    | Working Sets                                                                |
| `(tabs)/you`           | `YouScreen`           | 757 LOC — preferences, insights, skin picker                                |
| `capture`              | `ViewfinderScreen`    | Vision Camera shutter                                                       |
| `capture/result`       | `ResultRoute`         | Result sheet + Tune, owns pending capture                                   |
| `palette/[id]`         | `PaletteDetailScreen` | Hero / spec / workbench                                                     |
| `set/[id]`, `set/new`  | Sets detail + create  |                                                                             |
| `trending`             | `TrendingScreen`      | "Field notes" weekly drop                                                   |
| `paywall`              | `PaywallScreen`       | **CTA calls `router.back()`** (`:130`)                                      |
| `tools/*` (10 routes)  | Colour tools          | scan, compare, contrast, export, gradient, theme, import, activity, widgets |
| `tools/spike-liveread` | dev probe             | 350 LOC, never run on device                                                |

**Capture is a modal over the tabs**, pushed from the raised tab-bar button
(`app/(tabs)/_layout.tsx:47`).

## 3. Domain entities

Everything the app persists, in full:

| Entity             | File                 | Shape                                                                                                                                                      |
| ------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Color`            | `palette.ts:48`      | hex · rgb · oklch · role · weight · locked. rgb validated against hex                                                                                      |
| `Palette`          | `palette.ts:69`      | id · name · createdAt · capturedAt · source · colors[2..8] · tags · location · photoUri · deltaE · confidence · space · tuned · setIds · isPinned          |
| `PaletteSet`       | `palette.ts:116`     | id · name · timestamps · paletteIds · members · merged                                                                                                     |
| `UserPreferences`  | `preferences.ts:25`  | haptics · notifications · reminderTime · language · **skin** · colorSpace · sound · ambientBackdrop · defaultExport · onboardingCompleted · activityReadAt |
| `SubscriptionTier` | `entitlements.ts:20` | `free` \| `pro`                                                                                                                                            |

`ColorRole = 'dominant' | 'support' | 'signal' | 'extra'`.
`PaletteSource = 'live' | 'photo' | 'scan'` — note `'live'` is a value the schema
accepts for a feature that **does not exist**.

**There is no `Memory`, no `Track`, no `Pairing`, no `MusicIntent`.**
`archive/03-domain-model.md` described a `Memory` aggregate that was never built.

Non-persisted domain logic worth keeping: `discovery.ts` (470 LOC) computes
palette gaps, mood/style axes and search — directly reusable as music-intent
signal.

## 4. Persistence schemas

One MMKV instance behind four repositories (`infrastructure/dependencies.ts`).

| Key                       | Written by                    | Validation                    |
| ------------------------- | ----------------------------- | ----------------------------- |
| `@chromawave/palettes:v1` | `StoredPaletteRepository`     | `paletteListSchema.parse`     |
| sets key                  | `StoredSetRepository`         | `setListSchema.parse`         |
| preferences key           | `StoredPreferencesRepository` | `userPreferencesSchema.parse` |
| entitlements key          | `StoredEntitlements`          | —                             |

Every schema carries `schemaVersion: z.literal(1)`. `MmkvStorage.migrateFromAsyncStorage(LEGACY_KEYS)`
already exists and runs on launch, so there is precedent for a migration step.

**Migration hazard (highest data risk in the project).**
`StoredPaletteRepository.list()` calls `paletteListSchema.parse` and, on failure,
throws `DomainError('PERSISTED_DATA_INVALID')`. It does not skip the bad record —
**one invalid palette makes the entire library unreadable.** Any schema change
that is not perfectly backward-compatible destroys access to every saved palette
at once. `09-persistence-migration-plan.md` is built around this.

## 5. Entitlement gates

Five entitlements, all colour-tooling (`entitlements.ts:23`):
`watermark_free_share`, `semantic_export_names`, `structured_export`,
`locked_white_balance`, `wide_gamut_export`.

`PaywallTrigger` in `packages/analytics`: `watermark | json-export |
semantic-names | auto-wb | pro-tools | unknown`.

**Nothing can be purchased.** `PaywallScreen.tsx:128` — the buy button calls
`router.back()`. No RevenueCat, no StoreKit, no receipt validation. The gates are
real; the transaction is not.

## 6. Music-related code or documentation

**Code: none.** A case-insensitive scan for `music|spotify|deezer|song|track|
pairing` across `apps/mobile/src` and `packages` returns only:

- `collection.pairing*` localization keys — _contrast_ pairings (`en.ts:249`);
- `gapKinds: 'no-safe-pairing'` in `discovery.ts:239` — again contrast;
- the explanatory comment in `entitlements.ts:11`.

**Documentation: eight files described it**, now in `archive/`. The two with real
residual value:

- `archive/08-music-provider-architecture.md` — correctly called for a
  provider-neutral boundary and for keeping token refresh out of components.
  That principle is carried into `07`.
- `archive/09-pairing-engine.md` — a seven-step deterministic pipeline ending in
  "No large language model is required." **This was right**, and is the backbone
  of `06-ai-recommendation-architecture.md`. Restoring the vision does not mean
  restoring an LLM-first design; the original design was better.

## 7. AI integration

**None.** No provider, no client, no key handling, no `.env` reference to one.
`.env.example` exists (547 bytes) and predates this; it is not read by any
shipped module.

## 8. Image-analysis pipeline

Real, and good (`lib/readPalette.ts`):

1. `Skia.Data.fromURI` → `MakeImageFromEncoded` (async decode).
2. Draw into a **128×128** offscreen surface, cover-fit, `MipmapMode` + `FilterMode.Linear`
   — the GPU box-filters every pixel, so nothing is unsampled.
3. `extractPaletteFromRgba` — OKLab k-means, ≤14 iterations, ≤4096 samples,
   linear-light cluster means, roles assigned by weight order.
4. ΔE00 mean of every sample to its cluster → `deltaE`; `confidence = 1 - ΔE/10`.

Runs on the captured still, **not** on a live frame. `hooks/usePhotoRead.ts:9`
documents why: `react-native-vision-camera-worklets` does not compile against RN
0.83's prebuilt React pods (it includes the private header
`React/RCTMessageThread.h`).

This is the single most reusable asset in the repository for the restored vision:
it already produces exactly the structured signal a music intent needs.

## 9. Built but unverified

Per `archive/25`, and not re-verified here — no device pass has occurred in this
session:

| Item                 | State                                                          |
| -------------------- | -------------------------------------------------------------- |
| Library archive      | Implemented, unseen. **And it was shipping a Swiss bug** (§11) |
| Palette detail       | Implemented, unseen                                            |
| Capture result       | Implemented, unseen                                            |
| Working Sets merge   | Implemented, unseen                                            |
| Chromatic adaptation | Implemented, unseen                                            |
| Hero transition      | Implemented, unseen — computed landing position                |
| Swiss skin           | Implemented, unseen                                            |
| Live read            | **Does not exist.** Probe written, never run                   |
| Billing              | Does not exist                                                 |

## 10. Working-tree state

Clean at session start (`git status` empty, HEAD `a7be7bb`).
This pass has since modified `LibraryScreen.tsx` and restructured `docs/`.

## 11. Tests and checks available

`pnpm check` = `typecheck && lint && test && format:check` across 5 packages.

**Verified baseline at HEAD — the previous review was wrong:**

| Check     | Claimed | Actual at HEAD       | After this pass |
| --------- | ------- | -------------------- | --------------- |
| Typecheck | 0       | 0 ✓                  | 0               |
| Tests     | 339 ✓   | **338 pass, 1 FAIL** | **339 pass**    |
| Lint      | 11      | **12** warnings      | 12              |
| Format    | 8 files | 8 files ✓            | 8 files         |

The failure: `no-appearance-leaks › imports no appearance token` — introduced by
the most recent commit, `a7be7bb`. `LibraryScreen.tsx` imported `round` from
`@chromawave/design-tokens` and applied `round.full` to the month band's end
caps. That is chroma's pill radius hardcoded into a screen, which is exactly what
the boundary test exists to stop, and it would have rendered rounded bands on
Swiss's paper ground. Fixed by reading `skin.round.full` from the active skin.

**Test coverage shape:** 339 tests, none of which can look at a screen. Two
regressions in the previous session were caught by _lint warnings_, not tests.
Jest mocks Reanimated, so worklet bugs are structurally invisible. A two-skin
product with no visual regression strategy is the gap that matters most as UI
work begins — addressed in `14-verification-matrix.md`.

## 12. Migration risk for already-persisted user data

| Risk                                                                   | Severity | Note                                                                        |
| ---------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `parse` on the whole list throws on one bad record                     | **High** | Loses the entire library, not one item. Must move to per-record `safeParse` |
| `schemaVersion: z.literal(1)` rejects any v2 record                    | **High** | A v2 write followed by a downgrade bricks reads                             |
| `photoUri` points into app documents; memories add a second asset path | Medium   | Orphan cleanup already exists for palettes and must extend                  |
| `paletteSource` accepts `'live'` for a nonexistent feature             | Low      | Harmless, but should not be carried into v2 unexamined                      |
| Sets store a `merged` cache that is recomputed on write                | Low      | Already handled by `libraryStore.rewriteSets`                               |

## 13. Performance findings confirmed

`LibraryScreen.tsx:101` — `useMemo(() => toLibraryRows(visible), [visible])`.
`libraryRows.ts:64` calls `mergePalettes(group)` **per month**, and
`mergePalettes` (`palette.ts:281`) compares every colour against every kept colour
with `hexDeltaE00` — trigonometry-heavy CIEDE2000.

Cost ≈ `5N × D/2` ΔE00 calls per month. A 500-palette library is on the order of
**10⁶ calls per recompute**, and it recomputes on **every search keystroke**
(`visible` derives from `query`). `LibrarySignature` already caps at 60 for this
exact reason; the month path does not. This must be fixed before Library gains
the mood/colour/genre filters the restored vision needs.
