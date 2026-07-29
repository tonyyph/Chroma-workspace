# Brand identity system

Source of truth: `CHROMAWAVE Identity.dc.html` — BRAND & ICON SYSTEM · V1 · JUL 2026.
Eight icon territories were explored, scored against eight criteria, and narrowed to
three. Two of them ship, and the user chooses between them in Settings.

| Concept          | Score | Role in this app                                       |
| ---------------- | ----- | ------------------------------------------------------ |
| 01 Bandwave      | 73/80 | Default identity — recommended by the document         |
| 07 Liquid Lens   | 55/80 | Optional identity — premium material direction         |
| 04 Pulse Grid    | 69/80 | Not shipped (runner-up, system direction)              |
| 08 Chroma Signal | 68/80 | Not shipped (reserved as the secondary corporate mark) |

Bandwave is the default because the document's own reasoning holds for this product:
it is the only concept that draws the atomic unit — a palette bound to a sound — as one
continuous object, and its recognition lives in band rhythm rather than in colour or
material, so it survives greyscale, 16px, and embossing.

Liquid Lens is the deliberate counterweight. It scores lowest of the shortlist on small
size and longevity but highest on premium material, and the document keeps it as an
in-app surface treatment. Offering it as a user choice is how it earns a place without
betting the store icon on a trend material.

## Generating the assets

```sh
corepack pnpm brand:assets
```

`tools/brand-assets` is a line-by-line port of the SVG generator embedded in the identity
document, so every mark is drawn from the published geometry rather than traced from a
screenshot. See `tools/brand-assets/README.md` for the Phase 05 production adjustments it
applies and the two derivations concept 07 forces (a flat small-size cut and a flat
greyscale cut — both mandated by that concept's own weaknesses).

Output lands in `apps/mobile/assets/brand/<concept>/` following the document's naming
convention, plus a small `runtime/` bundle holding only the rasters the app imports.

## How the switch works

`UserPreferences.brandIdentity` is the single source of truth. It defaults to `bandwave`
and is defaulted rather than required in the schema, so preferences persisted before this
system landed still parse — `schemaVersion` stays at 1.

Changing it does three things:

1. **In-app brand surfaces** re-render immediately. `BrandMark` reads
   `identity` from `PreferencesProvider` and draws the same raster used for the app icon,
   so the in-app mark and the home screen icon cannot drift apart.
2. **The home screen icon** swaps via `expo-alternate-app-icons`. Bandwave is the build's
   default icon, so selecting it clears the alternate; Liquid Lens sets the `LiquidLens`
   entry declared by the config plugin in `app.json`.
3. **Analytics** records `settings_brand_identity_changed` with whether the icon swap
   actually landed.

The icon swap is treated as a side effect that is allowed to fail. It is a native call
that returns an error on an unsupported platform, and on iOS the user can dismiss the
system confirmation alert. When it fails the preference is kept — the app still wears the
identity the user chose — and Settings shows a warning rather than reverting the choice.

After changing `app.json`, run `npx expo prebuild --clean` before building. The plugin
writes an `AppIcon.appiconset` and a `LiquidLens.appiconset` into the asset catalog and
sets `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`; a non-clean prebuild can leave a
stale `ASSETCATALOG_COMPILER_APPICON_NAME` behind.

## Splash

The native pre-JS splash is build-time configuration and therefore does not follow the
runtime switch. It holds the Bandwave symbol on `#0B0918`.

The document's own integration note is stricter than this: "expo-splash-screen holds
frame 01; hide on first paint, then run the sequence in-app so there is no visible seam."
Frame 01 is a bare 4px signal dot, and it only works if the 1560ms launch sequence
(ASSET SYSTEM · B) actually runs afterwards. That sequence is specified for Reanimated
frames 1–3 and Skia frames 4–7, and `react-native-skia` is not a dependency of this app
yet. Holding a near-empty dark screen without the sequence behind it would be worse than
a logo, so the shipped splash uses the logo and `chromawave-splash-signal.png` is
generated and waiting for when the sequence lands. `launchSequence` in
`@chromawave/design-tokens` already carries the storyboard's keyframes and easings.

Both concepts have full static splash bakes (dark and light, `@1x/@2x/@3x`, WebP and PNG)
so a build can be configured for either identity as its default.

## What the identity system does not cover yet

Per the document's own FORMAT MATRIX these are runtime or photographic rather than baked
assets, and none of them are generated:

- Onboarding artwork — photographic drop-in slots.
- Share cards — `runtime → PNG`, data-driven via `makeImageSnapshot`.
- Gradient blobs, colour particles, waveform fragments — runtime, palette-driven.

The empty states and premium badges _are_ generated as flat SVG in `currentColor`, but the
app does not consume them yet; `StateView` still draws its own states.

## Open risks carried from the document

- Trademark clearance on banded-wave marks in classes 9 and 42 (US/EU/UK) is not done.
- The 20px and 29px cuts have been verified only in rendered contact sheets, not on a
  physical device in Settings and Spotlight across both appearance modes.
- Space Grotesk is not installed locally, so the `DEV`/`BETA`/`PRO` badges currently
  render in the Helvetica Neue fallback. Every other asset is pure geometry.
