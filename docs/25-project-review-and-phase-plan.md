# 25 · Project Review & Phase Plan

Snapshot of `chroma-v3` after a 26-commit redesign and architecture pass.

Written to be argued with. Every "done" below is qualified by whether it has been
_seen running_ — the gap between "built" and "verified" is this project's largest
risk right now, and collapsing the two would make this document useless.

---

## 1. What the product is

A local-first colour instrument. Point the camera at the world → an OKLab k-means
extraction returns a perceptually clustered palette with true area weights, three
semantic roles and a ΔE00 stability verdict → keep it privately → group palettes
into projects that compute a working colour system.

**No backend, no account, no telemetry.** That is a position, not a gap.

**Differentiation, in order of strength**

1. The colour science is genuine _and visible_. Weights are real area share, ΔE00
   drives a stability reading, roles are semantic. Competitors show five equal
   chips.
2. The app takes its own colour from whatever content is in view — ambient shader
   bands and screen accents both follow the palette.
3. Local-first, in a category where everything else wants a login.

---

## 2. Scale of this pass

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| Commits       | 26                                                            |
| Files changed | 133 (+6,478 / −2,678)                                         |
| Source files  | 147 non-test                                                  |
| Test files    | 31                                                            |
| Tests         | **339** — mobile 228, domain 94, design-tokens 17             |
| Typecheck     | 0 errors across 5 packages                                    |
| Lint          | 11 warnings, all pre-existing `require()` in test mocks       |
| Format        | 8 files failing — all pre-existing, none touched by this work |

---

## 3. Architecture

```
packages/
  domain/          Pure TS + Zod. OKLab / OKLCh / CIEDE2000 / WCAG / P3 / CVD,
                   k-means extraction, mergePalettes, paletteGaps,
                   entitlements, preferences.        ← zero React or Expo
  design-tokens/   brand · ui (chroma's values) · skins (chroma + swiss + effects)
  analytics/       Typed 27-event contract, Development / Noop implementations

apps/mobile/src/
  ui/              34 files — every primitive reads the active skin
  features/        41 files — screens, all skin-clean (enforced by test)
  app/             26 files — expo-router
  providers/       Preferences · Entitlement · Skin
  store/           library · capture · hero (zustand)
  infrastructure/  MMKV repositories, notifications, haptics, sound, entitlements
```

### The two-skin system

`preferences.skin → SkinProvider → useSkin()`.

A skin is every appearance **value**, plus:

- four chrome flags — `backdrop`, `glass`, `depth`, `rules` — for the differences
  that cannot be expressed as a colour (no arrangement of values says _"do not
  render the ambient field"_);
- five semantic gradient roles — `scrimBottom(weight)`, `scrimTop(weight)`,
  `fadeToGround`, `screenWash`, `surfaceWash`;
- three `accents` for the one-per-item pattern, distinct from `brandBands`, which
  is artwork and does not move between skins.

Screens consume **intent**, never skin identity. Enforced by
`apps/mobile/src/__tests__/no-appearance-leaks.test.ts`, which scans every screen
for appearance-token imports and for chroma's colours written as literals. Files
may opt out with an `appearance-exempt` marker and a stated reason; three do.

---

## 4. Feature maturity

| Feature                    | State              | Note                                              |
| -------------------------- | ------------------ | ------------------------------------------------- |
| Colour science             | **Production**     | 94 domain tests, incl. gamut-mapped OKLCh inverse |
| Design system + two skins  | **Production**     | 17 token tests pin both skins                     |
| Persistence (MMKV + Zod)   | **Production**     | Orphan-free photo deletion                        |
| Localization EN/VI         | **Production**     | Exact key parity, expansion budgets enforced      |
| Library / archive redesign | Built, **unseen**  | Ribbon + month grouping                           |
| Palette detail redesign    | Built, **unseen**  | Hero / spec / workbench                           |
| Capture result             | Built, **unseen**  | Now actually shows the photograph                 |
| Working Sets               | Built, **unseen**  | Merged system + gap analysis                      |
| Chromatic adaptation       | Built, **unseen**  | Field and accents follow content                  |
| Hero transition            | Built, **unseen**  | ⚠ Highest-risk item                               |
| Swiss skin                 | Built, **unseen**  | ⚠ Needs design judgment, not just QA              |
| **Live read**              | **Does not exist** | Probe written, never run                          |
| **Onboarding**             | **Untouched**      | Still five static slides                          |
| **Billing**                | **Does not exist** | CTA is `router.back()`                            |
| Field Notes                | Machinery only     | Needs a CDN URL and a weekly author               |
| ~10 tool screens           | Old standard       | Tune 9, Gradient 7, Activity 5 Card/Chip uses     |

---

## 5. Optimization opportunities

Ranked by real risk × cheapness to fix.

### 5.1 Month merges recompute on every filter change — **highest**

`LibraryScreen` runs `useMemo(() => toLibraryRows(visible), [visible])`, and
`toLibraryRows` calls `mergePalettes(group)` per month. `mergePalettes` compares
every colour against every kept colour using `hexDeltaE00` — trig-heavy CIEDE2000.

Cost is roughly `5N × D/2` calls, where N is palettes in the month and D the
number of distinct colours. A 500-palette library is on the order of **1.2M ΔE00
calls per recompute**, and it recomputes on every filter tap and every save.

`LibrarySignature` already caps at the most recent 60 for exactly this reason.
The month path does not. Options: cap per month, persist month signatures the way
`PaletteSet.merged` is persisted, or move the work off the render path.

**Effort: S · Impact: High.** This is the one thing that will make the app feel
broken on a real library.

### 5.2 `libraryStore` rewrites every affected set on each palette save

`savePalette` → `rewriteSets` → recompute and persist every set containing that
palette. Correct, and fine at current scale; O(sets × merge) as sets grow.

**Effort: S · Impact: Medium**

### 5.3 The ambient shader mounts per screen

Every `Screen` paints its own `UnderScreenCanvas`, a full-screen SkSL pass.
`freezeOnBlur` should idle covered screens, but this has never been profiled.
Swiss disables the field entirely, so Swiss is likely the cheaper skin — worth
measuring both rather than assuming.

**Effort: S to measure · Impact: unknown until measured**

### 5.4 Dead weight and broken scripts

- `react-native-nitro-image` is still excluded from `expo doctor` and still not
  imported by production code — only the dev probe reaches it, transitively.
- `expo-asset`, `expo-constants`, `expo-system-ui` — zero imports.
- `apps/mobile/src/app/tools/spike-liveread.tsx` is still in the tree.
- `.gitignore` contains `.github/`, so CI workflow changes are invisible to git.
- `eas.json` has no `development-simulator` profile and no Android submit profile,
  yet two root `package.json` scripts reference them. Both fail today.

**Effort: S · Impact: Low visually, real for build hygiene**

### 5.5 Documentation describes a product that no longer exists

**12 of 26 files in `docs/` still describe the abandoned v1** — a "synesthetic
memory platform" with music, Spotify and a pairing engine. `08-music-provider-
architecture.md` and `09-pairing-engine.md` document subsystems with no code
behind them; `00-product-brief.md`, `02`, `03`, `04`, `14`, `15`, `16`, `17`
describe the wrong domain model and roadmap.

The only code that mentions any of it is a comment in `entitlements.ts`
explaining what was deleted.

This is the highest-leverage cheap fix in the list: it actively misleads anyone
new to the repo, human or agent, and it cost real time during this session's
audit.

**Effort: S–M · Impact: High for onboarding anyone onto the project**

### 5.6 The test suite cannot see what now matters

339 tests, none of which can look at a screen. Two regressions this session were
caught by **lint warnings**, not tests:

- a dropped loading plate in `BandSweep` (an unused-import warning);
- a worklet calling a non-worklet, which jest structurally cannot reproduce
  because it mocks Reanimated — it only appeared on device.

Options: snapshot resolved style objects per skin, or add a screenshot harness.
Neither is free, and the second is the only one that would have caught either bug.

**Effort: M · Impact: High for a two-skin system**

### 5.7 Chroma drift to confirm

Two deliberate consolidations, both stated when made: the You signature scrim now
starts transparent rather than at 15%, and four `borderRadius: 9/10` pills snapped
to `round.chip` (11). Sub-perceptual by argument, but confirm on device rather
than assume.

---

## 6. What is actually blocking

| Blocker        | Needs                                                                |
| -------------- | -------------------------------------------------------------------- |
| Live read      | Running `/tools/spike-liveread` on a **physical device**             |
| Swiss sign-off | Flipping Appearance in You and judging the result                    |
| Field Notes    | A CDN URL and a weekly author — or a decision to cut it              |
| Billing        | A decision on RevenueCat (native module, prebuild, App Store review) |

None of these is blocked by the codebase. They are decisions or device time.

---

## 7. Phase plan

### Phase A — Verify and harden _(recommended first)_

No new features. Convert unverified work into confirmed work.

1. Device pass across both skins; screenshot the six redesigned screens.
2. Run the live-read probe → decide the live read **in or out, permanently**.
3. Fix §5.1 — the one real performance bug.
4. Clear §5.4 dead weight and the broken EAS scripts.
5. Retire or rewrite the 12 stale docs (§5.5).
6. Delete `spike-liveread.tsx` once the gate is decided.

**Effort: S–M · Unblocks everything else.**

### Phase B — Close the product gaps

1. **Onboarding** — five static slides today, time-to-value ≈ 90s. Should end
   with the user's own first palette. Degrades gracefully if the live read is out.
2. **Live read**, if the probe passes. The headline claim is still a placeholder,
   and `usePhotoRead` still documents it as abandoned.

**Effort: M–L · Highest activation impact.**

### Phase C — Bring the tools up to standard

Ten screens remain at the pre-redesign standard: Tune, Gradient, Export, Compare,
Contrast, Scan, Import, Activity, ApplyTheme, Widgets. All are reachable from the
most-visited screen, so they undercut the work already done.

**Effort: L · Medium impact, high consistency value.**

### Phase D — Monetization

Entitlements are wired and gate real features; nothing can be bought. Needs
RevenueCat, a prebuild, and review copy.

**Effort: M–L · Blocked on a business decision, not on code.**

---

## 8. Recommendation

**Phase A, then B.**

Roughly a dozen commits of visual work have never been seen running. One of them
— the hero transition's _computed_ landing position — is exactly the kind of
thing that looks obviously wrong on device and is a single constant to correct.
Verifying is cheap; discovering it later, after building on top of it, is not.

Phase C is tempting because it is mechanical and produces visible progress. But
polishing ten tool screens while the core capture claim is still a placeholder
optimises the wrong end of the funnel.

---

## 9. Verification

```bash
pnpm check     # typecheck + lint + test + format:check, all packages
pnpm ios       # device build
```

Baseline to hold: **0 type errors · 339 tests · 11 lint warnings · 8 format
files.** Any increase in the last two is new debt, not pre-existing.

Device checks that no test can replace:

- hero flight landing position;
- ribbon height and month-rule weight;
- Swiss scrims over real photographs;
- adapted backdrop legibility against arbitrary palettes;
- Reduce Motion producing static fallbacks rather than frozen animation.
