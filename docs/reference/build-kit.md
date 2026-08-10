# Build kit implementation

Source: `Chroma Wave Build Kit.dc.html` — CONCEPT 07 · MOTION + ASSETS + ENGINEERING · V1 · JUL 2026.

This is the third document in the set. The identity file fixed the mark, the app
file fixed the screens, and this one fixes how they move, sound, export and are
built. Where it contradicts what was already implemented, **the kit wins** — two
of its sections corrected real defects, listed below.

## Coverage, section by section

| §   | Section           | Where it lives                                                          |
| --- | ----------------- | ----------------------------------------------------------------------- |
| 1   | Motion language   | `design-tokens/ui.ts` — `duration`, `easing`, `motionRules`, `uiMotion` |
| 2   | Frame storyboards | `design-tokens/ui.ts` — `storyboard`; `ui/Sequences.tsx`                |
| 3   | Live loops        | `ui/Loops.tsx` — `BandSweep`, `Shimmer`, `LiveReadPulse`, `SyncOrbit`   |
| 4   | Lottie & assets   | `brand-assets/src/lottie.mjs`; budgets in `motionBudget`                |
| 5   | Haptics & sound   | `ExpoHapticsService`, `ExpoSoundService`, `brand-assets/src/sound.mjs`  |
| 6   | Export manifest   | `brand-assets/src/generate.mjs` groups + naming                         |
| 7   | IA & data         | `domain/palette.ts` core model; `analytics` event list; route tree      |
| 8   | Engineering       | `domain/color.ts` colour correctness; gates recorded below              |

## Two defects the kit caught

**1 · Extraction averaged gamma-encoded pixels.** Section 8: _"Extract in linear
light, not sRGB-encoded values — averaging gamma-encoded pixels shifts every
result muddy."_ The k-means accumulator was summing 0–255 sRGB values. It now
linearises before accumulating and re-encodes once after the mean. A test pins
it: black + white averages to ~188, not the muddy 128 it produced before.

**2 · ΔE was not ΔE.** Section 8: _"Report ΔE00, never ΔE76."_ The reported
figure was a scaled OKLab Euclidean distance. `deltaE00` is now a full CIEDE2000
implementation, verified against seven pairs from the Sharma, Wu & Dalal
reference table to three decimal places. G3 Compare's matrix and B2's stability
verdict both read from it.

## Motion

Eight duration tokens and three curves; nothing animates on a number that is not
one of them. Every loop and sequence checks `useReducedMotion()` and substitutes
the static three-band bar the kit prescribes, with opacity crossing at 120ms.

The four live loops are real components, not placeholders, and the kit's rules are
enforced structurally rather than by convention:

- **No spinner exists anywhere.** `BandSweep` is what stands in for one.
- **The shimmer is violet at 22%, never white** — a white sweep would read as a
  highlight on the glass.
- **`SyncOrbit` is the only rotating element**, and it rotates bare arcs rather
  than the mark, which the DO NOT list forbids.
- **Stagger is 60ms capped at five items** — `staggerDelay()` is the only way to
  compute it.

## Lottie

Seven JSON files, generated as shape layers only — no expressions, no merge
paths, no image layers, exactly as the kit requires for cross-platform parity.
Each ships a same-named PNG poster frame for the reduce-motion path.

Measured against the kit's runtime budget:

| File            | Size   | Budget |
| --------------- | ------ | ------ |
| `launch.json`   | 4.6 KB | 48 KB  |
| `loading-bands` | 2.3 KB | 20 KB  |
| `save-success`  | 3.9 KB | 20 KB  |
| `sync-orbit`    | 2.4 KB | 20 KB  |
| `empty-*` ×4    | 1.6 KB | 20 KB  |

Two shapes are approximations forced by the "no merge paths" constraint: the
glass mask reveal is a scale rather than a trim path, and the orbit arcs are
dashed ellipses rather than trimmed strokes. Both read identically at these sizes.

## Sound

Synthesised rather than sourced, so the cues carry no licence and are
reproducible. Durations are exact against the spec — 80 / 420 / 240 / 180ms,
verified by reading the WAV headers back.

`extract-done` is the one that needed care. The kit says the three-note rise
_"maps to the three bands: violet → cyan → coral, a major triad"_ — C4, E4, G4.
A first pass had each note fixed at 300ms, which meant C4 had decayed before the
cue ended and it resolved on G4 alone rather than as a chord. Each note is now
sized to end with the cue; a Goertzel check on the final 60ms shows all three
present (C4 60%, E4 64%, G4 100% of peak) against 6.6% for a non-triad D4.

## Skia and the camera

Both are now dependencies, which closed four of the gaps this document originally
listed.

**Band blur runs on the GPU.** `ui/BandCanvas.tsx` draws the field in Skia with a
single `Blur` layer wrapping all three bands, so the blur is one GPU pass per
frame rather than an SVG filter re-rendered per frame. Every animated call site
uses it — the sweep loop, the tune preview, the explore banner, onboarding, and
the launch sequence. `ui/BandField.tsx` survives for static rendering (the asset
pipeline, and anywhere a plain SVG tree is wanted).

**All four gradient modes render.** `ui/GradientCanvas.tsx`: linear and radial are
Skia gradients, conic is a `SweepGradient` closed back to its first stop so the
seam is invisible, and mesh is a four-corner bilinear SkSL shader. OKLab
interpolation is approximated by inserting three midpoints per gap computed in
OKLab, because Skia interpolates its own stops in sRGB — with that many stops the
residual sRGB blending is imperceptible, and it needs no shader.

**The scan sweep is the Skia layer the kit names** (`scan-sweep · SKIA · NATIVE`),
driven by the same shared value as the rest of the capture sequence so it stays in
step with the freeze and the swatch drop.

**The live read is real.** `hooks/useLiveRead.ts` runs a Vision Camera frame
processor that subsamples each frame to a 24×24 grid on the worklet thread and
hands ~2 KB to JS, where k-means runs on 576 pixels instead of 12 million.
Extraction is throttled to 200ms because the read only has to feel live. B1 shows
actual colours in front of the lens; G1 pins whatever the read makes dominant.

**G2 samples real pixels.** `hooks/useImageSampler.ts` decodes the imported photo
with Skia and averages a _disc_ — not a bounding square — around the tapped point,
in linear light, mapping view coordinates through the same scale-and-crop the
`cover` renderer applied.

### Install notes — three things that will bite

1. **pnpm blocks postinstall scripts**, so Skia's prebuilt binaries never download
   and `pod install` dies with "Skia prebuilt binaries not found". The fix is the
   allowlist its own podspec documents, now in the root `package.json`:
   `"pnpm": { "onlyBuiltDependencies": ["@shopify/react-native-skia"] }`. The
   download is several hundred MB across five platform archives and takes minutes
   — run `pod install` only after it finishes, or it fails on a partial `libs/`.
2. **Vision Camera 5.2.0 ships no Expo config plugin.** An entry in `plugins`
   fails config resolution and stops Metro starting _altogether_. The camera
   permission is declared directly instead — and because `expo-image-picker`'s
   plugin also writes `NSCameraUsageDescription` and wins over a bare `infoPlist`
   entry, both carry the same string. That is what keeps the kit's "name
   on-device processing explicitly" requirement true in the built `Info.plist`;
   verify with
   `plutil -extract NSCameraUsageDescription raw ios/Chroma Wave/Info.plist`.
3. **Renaming exported assets breaks `app.json` silently.** Moving to the kit's
   `{component}-{variant}-{size}` convention invalidated every icon path. There is
   a path-resolution check worth re-running after any rename — it reads `app.json`
   and stats each referenced file.

### Three latent build bugs, found by actually building

These were already in the repo and would have blocked any release. None show up in
`pnpm check` — a Debug build skips JS bundling entirely, so they only surface when
something asks for a Release bundle.

1. **`babel-preset-expo` was referenced but never declared.** `babel.config.js`
   names it as a preset, and nothing in `apps/mobile` depended on it. `expo export`
   happened to resolve it through Expo's own tree; Xcode's bundling phase, which
   runs with a different working directory, could not — failing with
   `Cannot find module 'babel-preset-expo'`.
2. **Getting the version wrong is worse than missing it.** `pnpm add` installs
   `^57.0.5`, but SDK 55 pairs with `55.0.24`. On 57 the private-class-field
   transform is not applied to React Native's own `DOMRectReadOnly.js`, and
   `hermesc` rejects it: `private properties are not supported`. That broke
   `expo export` too — a regression this document's own verification caught. It is
   pinned to `~55.0.24`.
3. **React Native was on 0.83.6, not the 0.83.10 SDK 55 expects.** Expo warns
   about this on every start. Upgraded.

Net effect: `main.jsbundle` now builds from Xcode's Release phase (5.7 MB), where
before it produced no bundle at all and the build reported success for an app with
no JavaScript in it.

### Measured gates

| Gate                             | Target  | Measured  |
| -------------------------------- | ------- | --------- |
| extraction, 12MP frame           | < 700ms | **16ms**  |
| extraction, 24×24 live-read grid | —       | 6ms       |
| `launch.json`                    | < 48 KB | 4.6 KB    |
| all loops                        | < 20 KB | ≤ 2.4 KB  |
| app size (download)              | < 40 MB | see below |

Extraction is fast because `normalizePixels` caps the sample before clustering —
a 12MP frame and a thumbnail cost nearly the same.

**App size needs a signed archive to state properly.** What can be measured: the
Release binary thins to 37 MB for arm64, strips to 20 MB, and gzips to 7.3 MB.
App Store download size is closer to the compressed thinned figure than the raw
one, so 40 MB is probably met — but Skia contributes 196 MB of static libraries
before dead-stripping, so this is the gate most worth re-checking on a real
archive.

### Still unmeasured — needs the device

Camera-dependent gates cannot be checked on a simulator, which has no camera:

- live read at 30fps on 3-year-old hardware
- memory ceiling 220 MB with camera open
- cold start to interactive < 1.8s (simulator timings are not representative)
- library scroll at 200 items

The paired iPhone 13 Pro Max is suitable hardware for the "3-year-old" gate. The
build was not run on it: `com.chromawave.app` has no provisioning profile, and
every signing team on the machine belongs to an unrelated client project, so
registering the App ID was left to the owner. To run it:

```sh
cd apps/mobile
npx expo run:ios --device        # pick the team when Xcode prompts
```

### Verified state of the native layer

`pod install` completes with 118 pods. `Podfile.lock` carries `react-native-skia
2.4.18`, `VisionCamera 5.2.0`, `NitroModules 0.36.3`, `NitroImage 0.15.1`,
`RNSVG 15.15.3` and `ExpoBlur 55.0.16`; Skia's `libskia.xcframework` and
`libskparagraph.xcframework` are referenced in `Pods.xcodeproj` with a resolved
`FRAMEWORK_SEARCH_PATHS`. The iOS bundle builds at 5.9 MB of Hermes bytecode.

**Not yet done: no on-device run.** Everything above is compile- and link-level
verification. The frame processor, the Skia canvases and the capture sequence have
not been exercised on hardware, so the fps gate is now _achievable_ rather than
_met_.

## Closed since first writing

- **Localisation.** EN + VI catalogues, 176 keys wired across every screen. The
  kit's 30% expansion rule is enforced by test, not by hope: chip and button
  budgets are derived from SYSTEM F's type scale and asserted per key, and the
  English is separately checked against a 30%-reduced budget so a control that
  would break _in any_ translation fails now. Placeholder parity between languages
  is asserted, and so is the rule that hex values, ΔE and the wordmark never
  translate — there is a test that no catalogue string contains a hex literal.
- **MMKV is the store.** `MmkvStorage` implements the same `KeyValueStorage` the
  repositories already took, so the swap was one line at the wiring site. The
  repositories were renamed off `AsyncStorage*` since they are storage-agnostic,
  and storage is now injected rather than defaulted, so the backing store is
  visible where it is chosen. A one-shot migration copies anything the previous
  AsyncStorage build wrote — non-destructively, so a failed run just retries, and
  it never overwrites a newer MMKV value. Seven tests cover it.
- **Sound ships as CAF**, the format the kit asks for.
- **The wordmark is real outlines.** Space Grotesk was already vendored by
  `@expo-google-fonts/space-grotesk` the whole time — the earlier note that it was
  not installed was simply wrong. Glyph paths come from that same TTF, so the
  outlines and the running app cannot disagree. `opentype.js`'s own
  `Path.toPathData()` could not be used: it emits `NaN` control points for glyphs
  at a non-zero offset, non-deterministically, three of ten on a typical run,
  while `path.commands` are always clean — so the commands are serialised
  directly.

## Remaining divergences

- **OGG is not produced.** CAF is, via macOS's own `afconvert` (ima4 44.1kHz
  mono, durations verified exact). OGG needs `oggenc` or `ffmpeg`, neither of
  which ships with macOS. The WAV masters stay alongside as the portable source.
- **Vision Camera 5 is very new** (the Nitro rewrite). Its API differs completely
  from v4, and `lib/index.js` uses extensionless ESM imports that Node rejects —
  harmless for Metro, but it is why the config-plugin path fails. Worth revisiting
  if the app hits camera bugs.

## Engineering gates not yet measured

Recorded so they are not mistaken for satisfied. None have been instrumented:

- cold start to interactive < 1.8s
- live read 30fps on 3-year-old hardware
- extraction < 700ms for a 12MP frame
- library scroll: no dropped frames at 200 items
- memory ceiling 220MB with camera open
- app size < 40MB download

The accessibility gates _are_ implemented: hex as accessibility label on every
swatch and strip, contrast verdicts rendered as text alongside colour, ≥44pt
targets (the 10pt slider track sits in a 44pt hit area), and band strips clamped
to a 10pt minimum. Dynamic Type reflow to one column is not done.

**Localisation is a known gap.** The kit requires EN + VI at launch with every
control surviving 30% string expansion. The new screens are hard-coded English —
the previous localisation layer covered the deleted Memory app. This is the
largest single piece of remaining work.
