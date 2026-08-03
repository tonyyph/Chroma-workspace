/**
 * Concept 07 · Chroma Signal — the only mark in the system.
 *
 * Ported 1:1 from the generator embedded in `Chroma Wave Final Concept.dc.html`
 * (`class Component extends DCLogic`, method `icon(o)`). Option names, colour
 * literals, midlines, amplitudes, stroke widths and blur deviations are kept
 * identical so a future revision of the document can be diffed against this file
 * line by line.
 */

import { blur, element, lg, rg, sine, squircle, svg } from './primitives.mjs';

export const VIEWBOX = '0 0 1024 1024';

/** Section 04 · Colour. Band order is violet → cyan → coral and is not reorderable. */
export const palette = {
  bands: ['#7C5CFF', '#22D3EE', '#FF7A5C'],
  bandsMono: ['#33323C', '#5C5B68', '#8B8A96'],
  bandsHighContrast: ['#4B23E8', '#0091B3', '#E8380D'],
  glass: '#EDE8F4',
  glassDeep: '#DCD4EC',
  surface: '#161327',
  ink: '#0C0B18',
  /** The field the light and dark builds are flattened onto. */
  fieldLight: '#EDE8F4',
  fieldDark: '#1B1730',
};

/** Section 01: superellipse n=4, r=360 on a 1024 master, safe inset 123px. */
export const geometry = {
  size: 1024,
  centre: 512,
  radius: 360,
  exponent: 4,
  safeInset: 123,
  midlines: [430, 536, 626],
  amplitudes: [74, 74, 66],
  widths: [96, 96, 88],
  cycles: 0.85,
  phaseStep: 1.1,
  /** Section 03: "swap to SMALL variant at 40px". */
  smallAtOrBelow: 40,
};

/**
 * The mark.
 *
 * @param {object} [o]
 * @param {string} [o.k]            id namespace, so several marks can share one document
 * @param {'light'|'dark'} [o.theme]
 * @param {boolean} [o.mono]        greyscale / Android themed-icon layer
 * @param {boolean} [o.contrast]    increase-contrast accessibility build
 * @param {boolean} [o.simple]      small-size cut: two bands, no specular
 * @param {boolean} [o.flat]        one-colour print cut: no glass, no blur
 * @param {number}  [o.spread]      band spread multiplier about the centre
 * @param {number}  [o.bands]       cap on band count — free tier draws two
 * @param {string[]} [o.bandColors]
 * @param {string} [o.badge]        channel badge glyph
 */
export function icon(o = {}) {
  const p = `i7${o.k || ''}`;
  const g = (n) => `url(#${p}${n})`;
  const dark = o.theme === 'dark';
  const { mono, contrast: hc, simple, flat } = o;
  const spread = o.spread || 1;

  let cols = mono ? palette.bandsMono : hc ? palette.bandsHighContrast : palette.bands;
  if (o.bandColors) cols = o.bandColors;

  let bg1 = dark ? '#1B1730' : '#EDE8F4';
  let bg2 = dark ? '#0C0B18' : '#DCD4EC';
  if (flat) {
    bg1 = '#0C0B18';
    bg2 = '#0C0B18';
  }

  const glassStops = dark
    ? [
      [0, '#FFFFFF', 0.3],
      [0.62, '#FFFFFF', 0.15],
      [1, '#8E86B8', 0.1],
    ]
    : [
      [0, '#FFFFFF', 0.96],
      [0.62, '#FFFFFF', 0.74],
      [1, '#D9D2EA', 0.5],
    ];

  const sd = mono ? 18 : simple ? 20 : 44;
  const defs = [
    lg(`${p}bg`, bg1, bg2, 0, 0, 1024, 1024),
    rg(`${p}gl`, glassStops, 430, 400, 520),
    blur(`${p}bl`, sd),
    blur(`${p}sh`, 26),
  ];

  const sq = squircle(512, 512, 360, 4);
  const mids = flat ? [412, 522, 632] : simple ? [462, 588] : [430, 536, 626];
  const amps = flat ? [46, 46, 42] : simple ? [70, 70] : [74, 74, 66];
  const widths = flat ? [52, 52, 46] : simple ? [124, 116] : [96, 96, 88];
  const maxBands = o.bands == null ? mids.length : o.bands;

  const bandPaths = [];
  for (let i = 0; i < mids.length && i < maxBands; i++) {
    const mid = 512 + (mids[i] - 512) * spread;
    bandPaths.push(
      element('path', {
        d: sine(mid, amps[i], 0.85, i * 1.1, 150, 874),
        stroke: cols[i % cols.length],
        'stroke-width': widths[i],
        'stroke-linecap': 'round',
        fill: 'none',
        opacity: flat ? 1 : 0.8,
      }),
    );
  }
  const bands = element(
    'g',
    { filter: flat ? null : g('bl'), opacity: mono ? 1 : 0.95 },
    bandPaths,
  );

  // `field: false` is the one option not on the document's board — see `symbol()`.
  const bare = o.field === false;

  const kids = [
    bare ? null : element('rect', { width: 1024, height: 1024, fill: g('bg') }),
    flat || bare
      ? null
      : element(
        'g',
        { filter: g('sh'), opacity: dark ? 0.4 : 0.28 },
        element('path', { d: squircle(512, 552, 356, 4), fill: dark ? '#000000' : '#2A2440' }),
      ),
    element('clipPath', { id: `${p}cl` }, element('path', { d: sq })),
    element('g', { 'clip-path': `url(#${p}cl)` }, [
      flat ? null : element('path', { d: sq, fill: g('gl') }),
      bands,
    ]),
    element('path', {
      d: sq,
      stroke: '#FFFFFF',
      'stroke-width': flat ? 20 : 14,
      fill: 'none',
      opacity: flat ? 1 : dark ? 0.55 : 0.85,
    }),
    simple || flat
      ? null
      : element('path', {
        d: 'M300 300 Q396 236 512 236',
        stroke: '#FFFFFF',
        'stroke-width': 22,
        'stroke-linecap': 'round',
        fill: 'none',
        opacity: 0.9,
      }),
  ];

  if (o.badge) {
    kids.push(
      element('circle', {
        cx: 716,
        cy: 736,
        r: 140,
        fill: o.badgeFill || '#0C0B18',
        stroke: '#FFFFFF',
        'stroke-width': 14,
      }),
      element(
        'text',
        {
          x: 716,
          y: 736,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          fill: o.badgeColor || '#FFFFFF',
          'font-family': "'IBM Plex Mono', monospace",
          'font-weight': 600,
          'font-size': o.badge.length > 2 ? 92 : 140,
          'letter-spacing': 3,
        },
        o.badge,
      ),
    );
  }

  return svg(VIEWBOX, defs, kids);
}

/**
 * The mark with the field and its cast shadow removed — glass body, bands and
 * edge on transparent.
 *
 * The only build not on the document's board, which always shows the mark
 * flattened onto its field. It exists because the Android adaptive foreground
 * and every in-app lockup need the silhouette without a background; the
 * document's "iOS rejects icons with transparency — always flatten onto the
 * glass gradient" guardrail governs the app icon, which is emitted opaque.
 */
export function symbol({ theme = 'dark', mono = false, k = 'SY' } = {}) {
  return icon({ k, theme, mono, field: false });
}

/**
 * Android 13+ themed-icon layer.
 *
 * Android tints this drawable by its *alpha*, discarding colour entirely, so the
 * greyscale MONO build cannot be used directly: its alpha is a filled squircle
 * and the launcher would render a solid blob — the exact failure the submission
 * note warns about ("Android themed icons force single-colour: ship MONO or the
 * launcher looks broken"). The structure therefore has to live in the alpha
 * channel, which is what the FLAT cut already draws: solid strokes, no glass,
 * no blur. It is emitted in white so any tint the system picks reads cleanly.
 */
export function monochromeLayer() {
  return icon({
    k: 'MN',
    flat: true,
    field: false,
    bandColors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'],
  });
}

/**
 * Android adaptive foreground: "foreground 432 in 108dp, adaptive safe 66dp".
 * The mark's own diameter is 720/1024 of the master; scaling it to the 66/108
 * safe fraction keeps the silhouette clear of every launcher shape mask.
 */
export function adaptiveForeground({ mono = false } = {}) {
  const scale = 66 / 108 / (720 / 1024);
  const offset = 512 * (1 - scale);
  const inner = (mono ? monochromeLayer() : symbol({ k: 'AF' }))
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}"><g transform="translate(${offset.toFixed(1)} ${offset.toFixed(1)}) scale(${scale.toFixed(4)})">${inner}</g></svg>`;
}

/** Section 01's geometry plate — construction lines, for the spec sheet only. */
export function geometryPlate() {
  const line = 'rgba(183,156,255,.45)';
  const faint = 'rgba(237,234,227,.14)';
  const kids = [element('rect', { width: 1024, height: 1024, fill: '#0F0E15' })];
  for (let i = 1; i < 8; i++) {
    kids.push(
      element('line', {
        x1: i * 128,
        y1: 0,
        x2: i * 128,
        y2: 1024,
        stroke: faint,
        'stroke-width': 2,
      }),
      element('line', {
        x1: 0,
        y1: i * 128,
        x2: 1024,
        y2: i * 128,
        stroke: faint,
        'stroke-width': 2,
      }),
    );
  }
  kids.push(
    element('rect', {
      x: 123,
      y: 123,
      width: 778,
      height: 778,
      rx: 40,
      fill: 'none',
      stroke: 'rgba(34,211,238,.4)',
      'stroke-width': 3,
      'stroke-dasharray': '14 12',
    }),
    element('path', {
      d: squircle(512, 512, 360, 4),
      fill: 'none',
      stroke: line,
      'stroke-width': 6,
    }),
    element('circle', {
      cx: 512,
      cy: 512,
      r: 360,
      fill: 'none',
      stroke: faint,
      'stroke-width': 3,
    }),
  );
  const mids = [430, 536, 626];
  for (let j = 0; j < 3; j++) {
    kids.push(
      element('path', {
        d: sine(mids[j], [74, 74, 66][j], 0.85, j * 1.1, 150, 874),
        stroke: palette.bands[j],
        'stroke-width': 4,
        fill: 'none',
        opacity: 0.9,
      }),
    );
  }
  for (let j = 0; j < 3; j++) {
    kids.push(
      element('line', {
        x1: 60,
        y1: mids[j],
        x2: 964,
        y2: mids[j],
        stroke: palette.bands[j],
        'stroke-width': 2,
        opacity: 0.35,
        'stroke-dasharray': '10 10',
      }),
    );
  }
  return svg(VIEWBOX, [], kids);
}
