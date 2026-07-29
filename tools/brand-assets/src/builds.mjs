/**
 * The nine icon builds the identity document specifies per direction
 * ("ICON VARIANT SET · 9 BUILDS"), expressed for both shortlisted concepts.
 */

import { bandwave, bandwavePalette, liquidLens, liquidLensPalette } from './concepts.mjs';
import { element, sine, squircle, svg } from './primitives.mjs';

const VIEW_BOX = '0 0 1024 1024';

/**
 * Channel badge baked into the DEV / BETA builds. The variant board shows the
 * master overlaid with a label; alternate icons ship at 60@2x/60@3x only, so the
 * badge only ever renders at 120/180px and is sized for that.
 */
function withChannelBadge(iconSvg, label, tint) {
  const badge = [
    element('rect', {
      x: 0,
      y: 812,
      width: 1024,
      height: 212,
      fill: '#0B0918',
      opacity: 0.86,
    }),
    element('rect', { x: 0, y: 812, width: 1024, height: 8, fill: tint }),
    element(
      'text',
      {
        x: 512,
        y: 962,
        'font-family': 'Space Grotesk, Helvetica Neue, Arial, DejaVu Sans, sans-serif',
        'font-size': 132,
        'font-weight': 700,
        'letter-spacing': 8,
        fill: '#F2EFE8',
        'text-anchor': 'middle',
      },
      [label],
    ),
  ].join('');
  return iconSvg.replace('</svg>', `${badge}</svg>`);
}

/**
 * PREMIUM build. ASSET SYSTEM · E: "Premium is expressed as the complete wave —
 * free users see three bands, Pro adds the amber fourth. Every premium asset uses
 * amber as the one signalling colour." Motion spec: "amber band gains a slow sheen
 * sweep" — baked here as a static sheen plus an amber hairline.
 */
function bandwavePremium() {
  const base = bandwave({ key: 'P' });
  const sheen = [
    element('path', {
      d: sine(700, 72, 1.08, 3 * 0.52, 128, 896),
      stroke: '#FFF0C8',
      'stroke-width': 26,
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: 0.72,
    }),
    element('path', {
      d: squircle(512, 512, 486, 5),
      stroke: bandwavePalette.bands[3],
      'stroke-width': 12,
      fill: 'none',
      opacity: 0.9,
    }),
  ].join('');
  return base.replace('</svg>', `${sheen}</svg>`);
}

function liquidLensPremium() {
  const base = liquidLens({ key: 'P' });
  const sheen = [
    element('path', {
      d: squircle(512, 512, 360, 4),
      stroke: '#FFC24A',
      'stroke-width': 16,
      fill: 'none',
      opacity: 0.92,
    }),
    element('path', {
      d: sine(626, 66, 0.85, 2.2, 150, 874),
      stroke: '#FFC24A',
      'stroke-width': 22,
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: 0.5,
    }),
  ].join('');
  return base.replace('</svg>', `${sheen}</svg>`);
}

/** Android adaptive foreground: mark only, transparent, inset for the 66% safe circle. */
function adaptiveForeground(markSvg) {
  const inner = markSvg.replace(/^<svg[^>]*>/, '').replace('</svg>', '');
  return svg(VIEW_BOX, [], [element('g', { transform: 'translate(154 154) scale(0.7)' }, [inner])]);
}

export const concepts = {
  bandwave: {
    id: 'bandwave',
    conceptNumber: '01',
    name: 'Bandwave',
    designation: 'FLAT GEOMETRIC · DIR. A',
    /** Sizes at or below this use the simplified cut (Phase 06 export rules). */
    simplifiedAtOrBelow: 87,
    field: { dark: bandwavePalette.fieldTop, light: bandwavePalette.fieldLightTop },
    builds: {
      primary: () => bandwave({ key: 'p' }),
      // The variant board renders PRIMARY and DARK from the same master: the
      // indigo field is already the dark build. Emitted separately because iOS 18+
      // wants a discrete `icon-dark` layer file.
      dark: () => bandwave({ key: 'd' }),
      light: () => bandwave({ key: 'l', light: true }),
      mono: () => bandwave({ key: 'm', mono: true }),
      'high-contrast': () => bandwave({ key: 'h', contrast: true }),
      small: () => bandwave({ key: 's', simple: true }),
      'small-light': () => bandwave({ key: 'sl', simple: true, light: true }),
      'small-mono': () => bandwave({ key: 'sm', simple: true, mono: true }),
      'small-high-contrast': () => bandwave({ key: 'sh', simple: true, contrast: true }),
      tinted: () => bandwave({ key: 't', mono: true, transparent: true }),
      dev: () => withChannelBadge(bandwave({ key: 'dv' }), 'DEV', bandwavePalette.bands[1]),
      beta: () => withChannelBadge(bandwave({ key: 'bt' }), 'BETA', bandwavePalette.bands[0]),
      premium: bandwavePremium,
    },
    symbol: () => bandwave({ key: 'sym', transparent: true }),
    adaptiveForeground: () => adaptiveForeground(bandwave({ key: 'af', transparent: true })),
  },

  'liquid-lens': {
    id: 'liquid-lens',
    conceptNumber: '07',
    name: 'Liquid Lens',
    designation: 'GLASS REFRACTION · DIR. H',
    simplifiedAtOrBelow: 87,
    field: { dark: liquidLensPalette.fieldDarkTop, light: liquidLensPalette.fieldTop },
    builds: {
      // Concept 07 is a native-light direction ("LIGHT / DARK — Native light").
      primary: () => liquidLens({ key: 'p' }),
      // "the dark variant needs a full re-render, not a recolour" — dark field plus
      // the shadow pass reweighted by the darker ground.
      dark: () => liquidLens({ key: 'd', dark: true }),
      light: () => liquidLens({ key: 'l' }),
      // Concept sheet: "loses all internal structure in greyscale". The blurred
      // build genuinely renders as a blank slab in mono, so the greyscale deliverable
      // is taken from the flat cut — the same escape hatch the sheet prescribes for
      // small sizes. This is a known cost of choosing 07, not a rendering bug.
      mono: () => liquidLens({ key: 'm', mono: true, flat: true }),
      // No contrast build exists on the board for 07; the risk list requires bands
      // at >= 3:1 against the field, which the flat (unblurred) cut delivers.
      'high-contrast': () => liquidLens({ key: 'h', flat: true }),
      // "SMALL SIZE Poor ... Would require a separate flat small-size mark."
      small: () => liquidLens({ key: 's', flat: true, simple: true }),
      'small-light': () => liquidLens({ key: 'sl', flat: true, simple: true }),
      'small-mono': () => liquidLens({ key: 'sm', flat: true, simple: true, mono: true }),
      'small-high-contrast': () => liquidLens({ key: 'shc', flat: true, simple: true }),
      tinted: () => liquidLens({ key: 't', transparent: true }),
      dev: () => withChannelBadge(liquidLens({ key: 'dv' }), 'DEV', liquidLensPalette.bands[1]),
      beta: () => withChannelBadge(liquidLens({ key: 'bt' }), 'BETA', liquidLensPalette.bands[0]),
      premium: liquidLensPremium,
    },
    symbol: () => liquidLens({ key: 'sym', transparent: true }),
    adaptiveForeground: () => adaptiveForeground(liquidLens({ key: 'af', transparent: true })),
  },
};

/** Phase 06 — APP ICON EXPORT · AppIcon.appiconset. */
export const appIconSizes = [1024, 180, 167, 152, 120, 87, 80, 76, 60, 40, 29, 20];

/** Alternate icons ship 60@2x/60@3x only (CFBundleAlternateIcons). */
export const alternateIconSizes = [120, 180];
