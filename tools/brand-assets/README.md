# @chromawave/brand-assets

Generates the CHROMAWAVE production asset system for icon concepts **01 Bandwave**
and **07 Liquid Lens**, straight from the geometry published in
`CHROMAWAVE Identity.dc.html` (BRAND & ICON SYSTEM · V1 · JUL 2026).

```sh
corepack pnpm --filter @chromawave/brand-assets build
corepack pnpm --filter @chromawave/brand-assets build -- --concept liquid-lens
```

Output lands in `apps/mobile/assets/brand/`. The build is deterministic: it wipes and
rewrites each concept directory, so the tree is safe to commit and diff.

## Where the numbers come from

The identity document ships its artwork as a React generator (`class Component extends
DCLogic`, `icon(id, o)` and `frame(i)`). `src/primitives.mjs` and `src/concepts.mjs` are a
line-by-line port of that generator to SVG strings — same sampling constants (56 sine
steps, 160 squircle steps), same phase offsets, same colour literals. Diffing a future
revision of the document against these two files is the intended maintenance path.

| Concept                | Document geometry                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| 01 Bandwave            | midlines y=352/472/592/700 · amp 126→72 · stroke 80 · round cap · λ = 1.08 cycle / 768px        |
| 01 Bandwave, small cut | 3 bands, stroke 92                                                                              |
| 07 Liquid Lens         | squircle r=360 n=4 · bands at y=430/536/626, phase 0/1.1/2.2 · stdDeviation 44 · shadow #2A2440 |

## Phase 05 · ADJUST BEFORE PRODUCTION

The document lists five changes to make before shipping. Four are mechanical and are
applied by this generator (`production: true`, the default). Passing `production: false`
reproduces the exploration board byte-for-byte, for diffing.

1. **"Increase band gaps by ~4% at the 29px cut."** Simplified midlines move from
   400/520/640 to 395.2/520/644.8 — spacing widened 4% about the centre band.
2. **"Lock the field gradient to a two-stop vertical only; the diagonal muddies at 20px."**
   Field gradients run `0,0 → 0,1024` instead of the board's `0,0 → 1024,1024`.
3. **"Test the light variant on iOS 26 tinted/clear icon modes — supply a flat
   single-layer fallback."** Emitted as `app-icon/tinted/` — the mono cut on transparent,
   no field and no glow, so iOS applies its own tint ramp.
4. **"Cap user-recolouring to bands 2–4; band 1 stays violet."** Encoded at runtime in
   `@chromawave/design-tokens` (`brandIdentities[…].recolourableBands`), not here.

The fifth — trademark clearance on banded-wave marks in classes 9 and 42 — is a legal
step and is tracked in the risk list, not in code.

## Two judgement calls, both forced by the document's own findings

Concept 07 is scored **55/80** and the sheet is explicit about why. Two production
deliverables cannot be taken from its master build:

- **Small sizes.** "SMALL SIZE Poor — becomes a pale rounded square. Would require a
  separate flat small-size mark." Sizes ≤87 therefore use a _flat_ cut: same geometry,
  blur dropped, band opacity raised to 1. Without it the ≤40px icons are blank slabs.
- **Greyscale.** "loses all internal structure in greyscale." The mono deliverable uses
  the same flat cut for the same reason.

Concept 07's dark build is a re-render, not a recolour, as the sheet requires: on the dark
field the glass body itself becomes dark glass (`#141026` base, violet-tinted specular at
0.30/0.16/0.34) so the dispersion reads as emitted light rather than as a hole in the
wallpaper. Swapping only the background produced a white slab.

## Export rules (Phase 06)

- App icons are flat sRGB PNG, **alpha removed**, no pre-applied corner mask.
- Sizes ≥120 come from the full master; ≤87 from the simplified cut.
- Alternate icons (`dev`, `beta`, `premium`) are emitted at 120/180 only — 60@2x/60@3x,
  which is all `CFBundleAlternateIcons` consumes.
- Splash statics are baked WebP **and** PNG per scale (@1x/@2x/@3x): the document
  specifies WebP, `expo-splash-screen` consumes PNG.
- Splash _motion_ is deliberately not baked — "never a video, never a PNG sequence". The
  eight storyboard frames under `splash/frames/` are reference renders for the runtime
  sequence, not shipped assets.
- Empty states and premium badges are flat SVG drawn in `currentColor` so they recolour
  with theme.

## Not generated

Per the document's own FORMAT MATRIX these are runtime or photographic, not baked assets:
onboarding artwork (photographic drop-in slots), share cards (`runtime → PNG`, data-driven
via `makeImageSnapshot`), gradient blobs / particles / waveform fragments (runtime,
palette-driven). `premium-crown-alt.svg` appears on the board but ASSET SYSTEM · E opens
with "No crown", so it is treated as a rejected alternate.

PDF companions for the symbol and wordmark (`SVG + PDF` in the matrix) need a vector
application; only the SVG masters are produced here.

## Fonts

The `DEV` / `BETA` channel badges and the `PRO` / `PREMIUM` pills are the only assets with
type. They request `Space Grotesk` (the identity typeface) and fall back through
Helvetica Neue → Arial → DejaVu Sans. Install Space Grotesk locally before generating
store-bound builds; every other asset is pure geometry and renders identically anywhere.
