# Import aliases and code optimisation

**Date:** 2026-08-12
**Status:** approved

## Why

The request was "optimise the code and shorten imports across the whole source".
Surveying the source first changed what that means:

- Imports are already short. 188 files, **3** relative `../` imports, seven
  barrels in place, `@/` alias everywhere. The only genuinely long specifier left
  is `@chromawave/*`, at 151 uses across 126 files.
- React Compiler is on (`app.json`, `experiments.reactCompiler`), yet the source
  carries 90 `useCallback`, 72 `useMemo` and 5 `memo()` written by hand. The
  render work is therefore mostly *removal*, not addition.
- The weight-and-drift maths that makes a palette's weights sum to one is copied
  into four files.

## Scope

Five pieces, one commit each, in order.

### §1 · `@cw/*` alias

`@chromawave/domain` → `@cw/domain`, `@chromawave/design-tokens` → `@cw/tokens`,
`@chromawave/analytics` → `@cw/analytics`, inside `apps/mobile` only.

- `apps/mobile/tsconfig.json` gains `paths` entries pointing at
  `../../packages/*/src/index.ts`.
- `apps/mobile/jest.config.js` `moduleNameMapper` mirrors them.
- Every app import is rewritten.

The packages keep their real names: they are separate build units, and
`@chromawave/analytics` imports `@chromawave/domain` through node_modules.

**Why this resolves at runtime.** Expo's Metro resolver reads `tsconfig.paths`
(`@expo/cli`, `withMetroMultiPlatform.js:288`). The alias resolves to the same
absolute file that the node_modules symlink resolves to, so Metro keeps one
module instance rather than bundling the domain twice.

### §2 · Barrels: none added

`@/features/**` accounts for ~45 imports, but a `features` barrel pulls every
screen into every route file, inflating the bundle and startup cost. The repo
already states this policy in `src/lib/index.ts` — lower layers import the
module they want so the data layer never depends on how things are drawn. The
only change here is removing the three remaining `../` imports.

This is a deliberate refusal of part of the original request. Shortening those
imports costs more than it saves.

### §3 · Deduplicate the weight maths

`weightedPalette()` moves into `packages/domain`, with vitest coverage there.
Four copies — `ScanScreen`, `ImportPickScreen`, `data/trending.ts`,
`data/seed.ts` — collapse to one call. "Weights sum to one" is a domain rule, not
a screen's business.

### §4 · Split the large screens

`YouScreen` (757 lines), `PaletteDetailScreen` (528), `ViewfinderScreen` (500)
split along display blocks. Behaviour unchanged; `src/__tests__/screens.test.tsx`
mounts each screen and presses every control, which is the safety net.

### §5 · Render

- Fix `ViewfinderScreen.tsx:116`, which assigns `photoRef.current` during render.
  A render-phase mutation is a real hazard under React Compiler, not a style
  point.
- Audit the 162 hand-written memo hooks and remove only those provably
  redundant. No blanket sweep: the diff would be enormous and some `memo()` calls
  still earn their place. Report the actual count changed.

## Verification

Each commit must leave `pnpm typecheck`, `pnpm lint`, `pnpm test` and
`pnpm format:check` green. §1 additionally needs a Metro resolution check — a
bundle export — because tsc and jest resolve aliases through their own
machinery, and neither proves the app bundles.

Nothing here is verifiable on hardware from this machine; device behaviour still
needs a build.
