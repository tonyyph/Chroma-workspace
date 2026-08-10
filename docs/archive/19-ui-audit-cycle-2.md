# UI audit - cycle two

Audit date: 2026-07-28. Target: native iOS development build on iPhone 16 Plus
Simulator. Runtime evidence:

- [Today](./evidence/ios-today-premium.png)
- [Capture](./evidence/ios-capture-premium.png)
- [Archive](./evidence/ios-archive-premium.png)
- [Memory detail](./evidence/ios-memory-detail-premium.png)
- [Accessibility XXL](./evidence/ios-today-accessibility-xxl.png)

## Blocker - resolved

1. **Reanimated routes failed at runtime despite passing typecheck.** Reanimated 4
   could not create a worklet, causing every route importing animated palette
   components to be rejected. The missing compile step is now explicit in
   `apps/mobile/babel.config.js:1-8` via `react-native-worklets/plugin`. A cold Metro
   rebuild loaded all routes without an error overlay or runtime warning.

## High - resolved

1. **The prior visual system read as an early dark-mode prototype.** Heavy sans
   typography, an acid CTA, large pill navigation, and generic circular art did not
   communicate the intended investment level. The source of truth is now the
   obsidian/bone/champagne palette and Playfair Display + Source Serif 4 typography
   in `packages/design-tokens/src/index.ts:1-81`. The result is visible across all
   four native screenshots.
2. **The product surface was too narrow.** The redesigned build adds data-derived
   Today insights and spotlight content in
   `apps/mobile/src/app/(tabs)/index.tsx:19-125`, real search/mood/favorite filtering
   in `apps/mobile/src/app/(tabs)/archive.tsx:18-163`, camera and library capture in
   `apps/mobile/src/app/(tabs)/capture.tsx:21-128`, and an immersive palette,
   metrics, sound, and custody detail in
   `apps/mobile/src/app/memory/[id].tsx:107-188`.
3. **Favorites existed in the schema but were not a user feature.** Favorite
   changes now persist through the repository, update Today/Archive/detail state,
   expose selected accessibility state, and emit typed analytics without notes,
   photos, or search text.

## Medium - open verification

1. **Compact phone and tablet runtime captures remain pending.** Source adapts
   gutters at 768 points and caps readable width at 880 points in
   `apps/mobile/src/components/Screen.tsx:20-45`, but this cycle's production
   screenshots are from iPhone 16 Plus only.
2. **Extreme hostile palettes remain a device QA item.** Two real, materially
   different palettes (grounded green and energetic wine) were exercised. User
   colors remain confined to art, swatches, images, and a decorative sound ring;
   navigation and body text keep semantic colors. Near-white, near-black, and
   monochrome input should still be captured on a physical device before beta.
3. **Camera behavior needs a physical-device pass.** Permission-denied and retry
   states are implemented, and the simulator build exposes the real camera action,
   but optical capture cannot be treated as hardware proof from this simulator.

## Accessibility and performance evidence

- Accessibility Extra Extra Large rendered as scrollable content with no fixed text
  height or blocked primary action; see the XXL screenshot.
- Primary controls expose roles, labels, selected/busy/disabled state, and at least
  44-point touch targets.
- Palette and artwork motion uses bounded opacity/transform entry only, stops after
  reveal, and is omitted when Reduce Motion is enabled.
- Bottom navigation remains fixed while scroll content reserves 120 points, so the
  final action is not hidden behind the tab bar or home indicator.
- No full-screen blur, continuously animated gradient, or looping decoration is
  present.

## Prioritized checklist

- [x] Replace prototype typography and acid accent with the editorial luxury system.
- [x] Add Today, Archive search/filter, durable favorites, and camera capture.
- [x] Redesign Memory detail around image, palette metrics, pairing, and custody.
- [x] Resolve the Reanimated 4 runtime blocker and cover its Jest environment.
- [x] Capture large-phone and Accessibility XXL evidence.
- [ ] Capture compact-phone and iPad portrait evidence.
- [ ] Exercise near-white, near-black, and monochrome photographs on device.
- [ ] Measure palette reveal and image decode frame time on a mid-range physical device.
