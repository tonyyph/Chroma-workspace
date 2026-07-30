# App redesign — Chroma Signal product UI

Source of truth: `CHROMAWAVE App.dc.html` — APP UI · 390×844 · iOS FIRST · V1 · JUL 2026.

The design is a colour-palette tool. The previous build was a "Memory" app —
photo + palette + **music pairing**, tabs Today/Archive/Capture/Atelier/Settings.
The two share almost nothing structurally, so this is a rebuild rather than a
re-skin, agreed with the product owner before starting.

## What the rebuild replaced

| Removed                                      | Reason                                 |
| -------------------------------------------- | -------------------------------------- |
| `Memory`, `MusicTrack`, `MusicPairing`       | No music anywhere in the design        |
| `library.ts`, `collections.ts`, `schemas.ts` | Built on `Memory`                      |
| Today / Archive / Atelier / Settings tabs    | Replaced by LIB / EXPLORE / SETS / YOU |
| `capture/{review,palette,pairing,compose}`   | Replaced by flow B                     |
| The serif editorial token set                | Replaced by SYSTEM F                   |

Preferences survive: `UserPreferences` is unchanged and the repository still
round-trips it.

## Foundation

- **Type.** Space Grotesk + IBM Plex Mono, replacing Playfair Display and Source
  Serif 4. The whole design is built on them, so nothing else could match.
- **Tokens.** `packages/design-tokens/src/ui.ts` transcribes SYSTEM F: the type
  scale with tracking resolved from em to points, the 4pt grid, the radius set
  (chip 11 · card 18 · sheet 28 · pill 27), the semantic colours, and the motion
  and haptics table. Screens set no raw sizes.
- **Primitives.** `apps/mobile/src/ui/` — Button (6 appearances), Chip (6 tones),
  Toggle, Slider, Field, Card, CardGroup, Sheet, NavBar, ScreenHeader, TabBar,
  SwatchStrip, ColorRow, BandField, EmptyGlyph, Toast, InlineError, CardSkeleton.
- **Domain.** `packages/domain/src/palette.ts`. Weights must sum to one and each
  role is unique, both enforced in the schema. `color.ts`'s k-means extraction was
  retargeted rather than rewritten — it now emits roled swatches plus the ΔE and
  confidence figures B2 displays.

`BandField` is a direct port of the document's `bands()` generator, so hero
artwork is drawn from published geometry rather than approximated.

## Screens built

| Screen              | State                                                 |
| ------------------- | ----------------------------------------------------- |
| C1 · Library        | Built — filter rail, two-column grid, empty states    |
| C2 · Explore        | Built — editorial banner, trending rows (seeded data) |
| B4 · Palette detail | Built — proportional hero, tags, hex list, export row |
| D2 · Profile (YOU)  | Built — identity, stat tiles, grouped settings        |
| B1 · Viewfinder     | **Chrome only** — see below                           |
| C3 · Sets           | **Empty state only** — see below                      |

## Not built yet

Named honestly rather than stubbed behind fake data:

- **B1's live read.** The viewfinder chrome, reticle and shutter are the design's,
  but there is no camera feed: `expo-camera` is not a dependency and adding it
  needs a native rebuild. The LIVE READ strip shows the document's sample values
  and is labelled `CAMERA NOT WIRED` on screen.
- **B2 result sheet, B3 tune.** Both depend on a real capture.
- **A1–A4 onboarding.** The old onboarding was deleted with the memory model; the
  new flow is not built, so the app opens straight on the library.
- **C3 Sets.** No collection model yet — the tab shows the FLOW E empty state.
- **C4 share sheet, D1 paywall, G1–G9.** Not started.

## Seeded content

`apps/mobile/src/data/seed.ts` holds the four library palettes and three trending
rows, transcribed from the design document so built screens can be diffed against
it directly. Trending saves and handles are fixture values — this build is
local-first with no server. The library seeds once and records that it did, so
deleting every palette does not resurrect them.

## Known divergences

- **Tab accents.** The design shows LIB active in violet and EXPLORE active in
  cyan, so the accent is per-tab. SETS continues the band order into coral; YOU
  uses action/primary. Only the first two are evidenced.
- **Role assignment.** FLOW A3 describes Signal as "the accent that makes people
  look", which suggests salience, but the document's own reference palette assigns
  roles in share order (38 / 24 / 18%). The extractor follows share order so it
  reproduces the reference exactly.
- **The status bar row.** The design draws "9:41 · 5G ▮▮▮" inside each frame; that
  is the device's own status bar, so screens reserve the safe-area inset instead.
