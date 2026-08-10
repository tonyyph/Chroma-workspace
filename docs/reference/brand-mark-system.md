# Brand mark system

Source of truth: `Chroma Wave Final Concept.dc.html` — **CONCEPT 07 · CHROMA SIGNAL · V1 · JUL 2026**,
marked FINAL · LOCKED.

One mark: a soft glass squircle carrying three refracted chroma bands. The document is
explicit that this supersedes the exploration — "Everything below is drawn from this one
mark — no alternates, no fallback concepts." The two-identity switcher that shipped
against the earlier exploration document has been removed accordingly; see
[What was removed](#what-was-removed).

## The mark

| Property     | Value                                                       |
| ------------ | ----------------------------------------------------------- |
| Silhouette   | Superellipse n=4, r=360 on a 1024 master                    |
| Safe inset   | 123px (12%), so iOS corner clipping never touches the bands |
| Band mids    | y = 430 / 536 / 626 — a 106px vertical rhythm               |
| Band phase   | 1.1 rad apart, 0.85 cycles across x 150→874                 |
| Band strokes | 96 / 96 / 88, round cap, blur σ 44 at 1024                  |
| Bands        | violet `#7C5CFF` · cyan `#22D3EE` · coral `#FF7A5C`         |

Guardrails from section 01, carried into the generator: glass is a material, never the
idea — no thick bevels, no rainbow ring, no drop-shadowed 3D blob; bands stay ≥88px on
master (≥2.5px at 29px).

## Generating the assets

```sh
corepack pnpm brand:assets
```

`tools/brand-assets` is a line-by-line port of the SVG generator embedded in the final
concept document, so every mark is drawn from published geometry rather than traced.
Output follows the section 09 export checklist; see `tools/brand-assets/README.md` for
the flags, the derivations the document forces, and what is deliberately not baked.

## The size ladder

Section 03's adaptive rule is a hard requirement, not a preference:

- **≤40px → SMALL.** Two bands, blur σ 20, no specular. The submission-risk note is
  explicit: "Blur at 29px muddies — SMALL variant is mandatory, not optional."
- **Greyscale UI → MONO.** Blur drops to σ 18 and the bands run at full opacity, which
  is why this concept holds its structure in greyscale where the earlier glass
  direction did not.
- **Increase-contrast on → A11Y.** `#4B23E8` / `#0091B3` / `#E8380D`.

`smallMarkAtOrBelow` in `@chromawave/design-tokens` carries the 40px threshold so runtime
surfaces pick the same cut the export tree does.

## Platform layers

- **iOS.** `ios.icon` supplies light, dark and tinted. Tinted is the mono cut on
  transparent so the system applies its own ramp rather than tinting an already-grey
  field. Every store-bound icon is flattened opaque — "iOS rejects icons with
  transparency".
- **Android.** The adaptive foreground is the mark scaled into the 66/108 safe fraction.
  The themed-icon layer is **not** the MONO build: Android tints that drawable by its
  alpha and discards colour, and MONO's alpha is a filled squircle, so the launcher would
  render a solid blob. The layer is taken from the FLAT cut in white instead, so the
  structure lives in the alpha channel where Android reads it.
- **Web.** `favicon.svg` is the small cut; apple-touch 180 and maskable 512 come from the
  master.

## Splash

Section 06 specifies 1480ms with **no logo hold**: seed dot → first band → three bands →
glass clips in → mark and wordmark → handoff. `launchSequence` in
`@chromawave/design-tokens` carries every keyframe and easing verbatim.

That sequence is not implemented yet, and the reason is a missing dependency rather than a
decision: the document assigns the band blur to Skia ("Bands: Skia _Path_ + _BlurMask_")
and `react-native-skia` is not in this app. Reanimated is. Until the sequence lands the
native splash holds the mark on `#0C0B18` rather than the bare field — a still dark screen
with nothing running behind it would be worse than a logo. `splash/seed-dot*.png` and
`splash/launch-field.png` are generated and waiting for it.

## What was removed

The previous build let the user switch between two icon concepts in Settings. The final
document rules that out, so the following are gone rather than deprecated:

- `UserPreferences.brandIdentity` and `brandIdentitySchema`
- The `AppIconService` port and its `ExpoAppIconService` adapter
- The `expo-alternate-app-icons` dependency and its `app.json` plugin entry
- The Settings "App icon & identity" section, its localisation keys, and the
  `settings_brand_identity_changed` analytics event

Preferences persisted by the old build still carry a `brandIdentity` key. The schema
strips it on parse, so no migration and no `schemaVersion` bump is needed;
`packages/domain/src/preferences.test.ts` pins that behaviour.

**A clean prebuild is required.** `apps/mobile/ios/` still holds the alternate-icons pod
and an `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` build setting from the old config.
Run `npx expo prebuild --platform ios --clean` before the next native build.

## Not covered yet

Per the document's own handoff these are runtime or supplied, not baked here:

- **Onboarding photography.** The five panels are generated as layout references with
  dashed `PHOTO` slots — "Photos are placeholders — supply real assets before build."
- **Share cards.** Generated in all four ratios, but as templates; the shipped card is
  data-driven at runtime.
- **`splash/launch.json`.** The checklist lists a 1480ms Lottie as the cold-start
  fallback. It is not generated — authoring Lottie keyframes with layer blurs is not
  something this pipeline can produce or verify, and the primary path is Reanimated
  anyway. The storyboard PNGs under `splash/frames/` document the sequence.
- **Empty states in the app.** The four glyphs are generated as `currentColor` SVG, but
  `StateView` still draws its own states.

## Open risks

- Trademark: the document's note is to protect the silhouette + three-band arrangement as
  one composite ("the gradient itself is not defensible"). Not filed.
- The 29px and 40px cuts are verified in rendered contact sheets, not on a physical device
  across Settings, Spotlight and both appearance modes.
- Space Grotesk is not installed locally, so the `DEV`/`β`/`★` channel badges and the
  wordmark in the splash and share renders fall back to Helvetica Neue. Every other asset
  is pure geometry and renders identically anywhere.
