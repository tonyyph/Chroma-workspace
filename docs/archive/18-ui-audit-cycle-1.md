# UI audit - cycle one

Audit date: 2026-07-27. Target: native iOS debug build on iPhone 16 Plus
Simulator. Runtime evidence: [Capture screen](./evidence/ios-capture-screen.png).

## Findings

### Blocker

No blocker was visible on the inspected Capture screen. The native app rendered
without a React or Metro error after an Xcode build with zero errors.

### High - resolved

1. **Generated Expo icon weakened brand recognition.** The first native install
   showed the default Expo chevron on the simulator home screen. Remediation:
   replace it with the same three-wave mark used in the app and configure it for
   app, iOS, Android, and splash usage in `apps/mobile/app.json:7-18` and
   `apps/mobile/assets/images/chromawave-icon.png`.
2. **Flow footers could sit below the safe bottom inset.** `Screen` originally
   excluded the bottom edge while review, palette, pairing, and composer actions
   use a fixed footer. Remediation: include all safe-area edges in
   `apps/mobile/src/components/Screen.tsx:33-41`.

### Medium - open verification

1. **Small-screen and tablet layout are not runtime-proven.** The 1290 x 2796
   simulator capture shows clear hierarchy and a visible primary action, but no
   iPhone SE or iPad screenshot was captured. The scroll container prevents a hard
   block, and the privacy disclosure now shrinks at
   `apps/mobile/src/components/LocalOnlyBanner.tsx:8-12,36-38`. Still verify the
   full capture sequence on one compact phone and one tablet before beta.
2. **Hostile palettes are source-safe but not runtime-proven.** Dynamic colors are
   confined to swatches in `apps/mobile/src/components/PaletteStrip.tsx:16-39`; no
   text is placed on them, and mood has a text label. Exercise very light, dark,
   low-saturation, and monochrome photographs on device before beta.
3. **Dynamic Type beyond the default simulator size is not visually proven.**
   Text scaling is enabled and content scrolls, but Accessibility XXL screenshots
   remain a manual QA task.

### Polish

The Capture screen is recognizable from the runtime screenshot through the
three-wave mark, asymmetric color field, ink surface, and acid primary action. The
next polish pass should preserve this composition while adding measured photo-to-
palette transition continuity; it should not introduce a generic card dashboard.

## Implementation checklist

- [x] Replace template icon with deterministic Chroma Wave brand asset.
- [x] Protect footer actions from the home indicator.
- [x] Allow local/offline disclosure to shrink on narrow widths.
- [x] Use semantic brand colors instead of screen-local raw values.
- [x] Respect Reduce Motion in palette reveal.
- [ ] Capture compact-phone, tablet, Accessibility XXL, and hostile-palette evidence.
- [ ] Measure photo-to-palette transition frame time on a physical mid-range device.
