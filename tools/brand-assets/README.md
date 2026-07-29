# @chromawave/brand-assets

Generates the CHROMAWAVE production asset system from the geometry published in
`CHROMAWAVE Final Concept.dc.html` — **CONCEPT 07 · CHROMA SIGNAL · V1 · JUL 2026**,
marked FINAL · LOCKED. One mark, no alternates.

```sh
corepack pnpm brand:assets                       # everything, ~6s
node src/generate.mjs --group icon               # one asset group
node src/generate.mjs --group icon,runtime       # several
```

Output lands in `apps/mobile/assets/brand/`. A full run is deterministic: it wipes and
rewrites the tree, so the result is safe to commit and diff.

| Flag            | Default                    | Notes                                          |
| --------------- | -------------------------- | ---------------------------------------------- |
| `--group`       | all                        | `icon,splash,onboarding,states,social,runtime` |
| `--concurrency` | `min(cores-1, 8)`          | Render workers                                 |
| `--out`         | `apps/mobile/assets/brand` | Output root                                    |

A partial run skips the directory wipe so it cannot delete the groups it is not
rebuilding, and leaves `manifest.json` alone rather than replacing it with a listing of
the subset.

## Where the numbers come from

The document ships its artwork as a React generator (`class Component extends DCLogic`).
`src/primitives.mjs`, `src/mark.mjs` and `src/scenes.mjs` are a line-by-line port of that
generator to SVG strings — same sampling constants (56 sine steps, 160 squircle steps),
same phase offsets, same colour literals, same option names. Diffing a future revision of
the document against those three files is the intended maintenance path.

`src/builds.mjs` names section 02's nine exports; `src/generate.mjs` maps them onto
section 09's export checklist.

## The tree

| Path          | Checklist line                                                     |
| ------------- | ------------------------------------------------------------------ |
| `icon/`       | `icon/master.svg · 1024 squircle, bands as strokes`, plus variants |
| `ios/`        | `ios/AppIcon.appiconset · 1024 + 180/120/87/80/60/58/40/29`        |
| `android/`    | `ic_launcher` foreground 432 in 108dp, and the themed-icon layer   |
| `web/`        | `favicon.svg + 180 apple-touch + maskable 512`                     |
| `splash/`     | storyboard frames + the native pre-JS assets                       |
| `social/`     | `social/*.webp · 1:1 · 4:5 · 9:16 · 1.91:1`                        |
| `textures/`   | `grain.png · 128px tile, 4% opacity`                               |
| `onboarding/` | the five layout references from section 07                         |
| `states/`     | the four empty glyphs and the free/pro tier marks                  |
| `runtime/`    | the handful of rasters the app itself imports                      |

## Three derivations, and why each is forced

Everything else is the document rendered as published. These three are not on its board:

1. **`field: false`.** The board always shows the mark flattened onto its field. The
   Android foreground and every in-app lockup need the silhouette on transparent, so
   `icon()` gained one option that drops the background rect and its cast shadow. The
   "always flatten onto the glass gradient" guardrail governs the app icon, which is
   still emitted opaque.

2. **The themed-icon layer is the FLAT cut, not MONO.** Android tints that drawable by
   its **alpha** and discards colour. MONO's alpha is a filled squircle, so the launcher
   would render a solid blob — precisely the failure the submission note warns about
   ("Android themed icons force single-colour: ship MONO or the launcher looks broken").
   The FLAT cut already draws the structure as solid strokes with no glass and no blur,
   so in white it puts the mark into the alpha channel where Android reads it.

3. **Share cards at 1:1, 4:5 and 9:16.** The document draws the 1.91:1 card and states
   the rule for the rest — "Same three-zone grid across 1:1, 4:5, 9:16, 1.91:1 — photo
   slot, band strip, metadata block". The landscape build is verbatim; the three portrait
   ratios reflow those same zones.

The empty-state glyphs also swap the document's literal `rgba(237,234,227,.55)` stroke for
`currentColor` at the same opacity, so they recolour with theme. Band colours inside them
stay literal, as drawn.

## Why it uses worker threads

`Resvg.render()` is synchronous and CPU-bound — about 190ms for a 1024px icon, roughly 90%
of the per-file cost (PNG encoding is ~20ms). Awaiting each file in turn therefore pinned
the whole build to one core. Jobs are collected declaratively and handed to a pool of
workers instead.

PNG compression stays at level 9 despite being the cheaper knob: dropping to level 6 saves
about 2s across the tree but adds 10% to every committed asset.

## Not generated

- **`splash/launch.json`** — the checklist's 1480ms Lottie cold-start fallback. Authoring
  Lottie keyframes with layer blurs is not something this pipeline can produce or verify,
  and section 06 puts the primary path in Reanimated worklets. The PNGs under
  `splash/frames/` document the sequence instead.
- **Onboarding photography** — "Photos are placeholders — supply real assets before
  build." The panels are emitted as layout references with the dashed slot in place.
- **The wordmark** — section 05 specifies lockups but the export checklist does not list a
  wordmark file, and it is type rather than geometry.

## Fonts

The `DEV` / `β` / `★` channel badges and the wordmark inside the splash and share renders
are the only assets with type. They request Space Grotesk and IBM Plex Mono and fall back
through Helvetica Neue → Arial → DejaVu Sans. Install both locally before generating
store-bound builds; every other asset is pure geometry and renders identically anywhere.
