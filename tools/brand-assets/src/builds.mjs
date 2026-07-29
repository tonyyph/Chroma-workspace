/**
 * Section 02 · Variant set — "nine exports off one master".
 *
 * Each entry is a thunk so a build is only drawn when something asks for it,
 * and `background` records the colour the store build must be flattened onto
 * (section 09: "iOS rejects icons with transparency").
 */

import { icon, palette } from './mark.mjs';

export const builds = {
  /** PRIMARY · LIGHT GLASS — the master, and what ships as the app icon. */
  primary: { draw: () => icon({ k: 'L', theme: 'light' }), background: palette.fieldLight },
  /** DARK SURFACE — a full re-render, not a background swap. */
  dark: { draw: () => icon({ k: 'D', theme: 'dark' }), background: palette.fieldDark },
  /** MONOCHROME — also the Android themed-icon layer. */
  mono: { draw: () => icon({ k: 'MO', mono: true }), background: palette.fieldLight },
  /** HIGH CONTRAST · A11Y — for increase-contrast. */
  'high-contrast': { draw: () => icon({ k: 'H', contrast: true }), background: palette.fieldLight },
  /** SMALL SIZE ≤40px — two bands, tighter blur, no specular. */
  small: { draw: () => icon({ k: 'S', simple: true }), background: palette.fieldLight },
  /** FLAT · PRINT / 1-COLOUR. */
  flat: {
    draw: () => icon({ k: 'F', flat: true, bandColors: ['#EDEAE3', '#EDEAE3', '#EDEAE3'] }),
    background: palette.ink,
  },
};

/** Channel builds. Not user-switchable — one per distribution channel. */
export const channels = {
  dev: {
    draw: () => icon({ k: 'DV', theme: 'dark', badge: 'DEV', badgeFill: '#0C0B18' }),
    background: palette.fieldDark,
  },
  beta: {
    draw: () => icon({ k: 'BT', badge: 'β', badgeFill: '#22D3EE', badgeColor: '#08070E' }),
    background: palette.fieldLight,
  },
  premium: {
    draw: () => icon({ k: 'PR', theme: 'dark', badge: '★', badgeFill: '#7C5CFF' }),
    background: palette.fieldDark,
  },
};

/**
 * Section 08 · "Free users see two bands; Pro unlocks the third and the
 * specular highlight." The paywall shows these two side by side.
 */
export const tiers = {
  free: { draw: () => icon({ k: 'FR', theme: 'dark', bands: 2 }), background: palette.fieldDark },
  pro: { draw: () => icon({ k: 'PT', theme: 'dark' }), background: palette.fieldDark },
};

/** iOS ladder from the section 09 checklist: "1024 + 180/120/87/80/60/58/40/29". */
export const appIconSizes = [1024, 180, 120, 87, 80, 60, 58, 40, 29];

/** Channel icons only need the store master and the two home-screen cuts. */
export const channelSizes = [1024, 180, 120];

/**
 * Section 03 adaptive rule: "≤40px → SMALL". The submission-risk note makes it
 * mandatory rather than advisory — "Blur at 29px muddies".
 *
 * The greyscale and dark cuts keep their own palettes at small size; only the
 * blur-heavy geometry is swapped out, so the ladder never changes colour
 * partway down.
 */
const smallCuts = {
  primary: { draw: () => icon({ k: 'S', simple: true }), background: palette.fieldLight },
  dark: { draw: () => icon({ k: 'SD', simple: true, theme: 'dark' }), background: palette.fieldDark },
  mono: { draw: () => icon({ k: 'SM', simple: true, mono: true }), background: palette.fieldLight },
  'high-contrast': {
    draw: () => icon({ k: 'SH', simple: true, contrast: true }),
    background: palette.fieldLight,
  },
};

export function buildForSize(variant, size) {
  if (size > 40) return builds[variant];
  return smallCuts[variant] ?? builds.small;
}
