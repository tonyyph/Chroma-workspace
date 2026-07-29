/**
 * ASSET SYSTEM · D (empty states) and · E (premium) for both shortlisted concepts.
 *
 * Rules taken verbatim from the identity document:
 *  D — "an empty state is the mark with something missing. Flat, single-colour,
 *       <=2KB SVG each, no gradients — they must recolour with theme."
 *  E — "No crown. Premium is expressed as the complete wave — free users see three
 *       bands, Pro adds the amber fourth. Every premium asset uses amber as the one
 *       signalling colour."
 *
 * Everything below draws in `currentColor` so the host surface controls the hue,
 * which is what "recolour with theme" requires.
 */

import { element, sine, squircle, svg } from './primitives.mjs';

const BOX = '0 0 240 240';
const AMBER = '#FFC24A';

const stroke = (d, extra = {}) =>
  element('path', {
    d,
    stroke: 'currentColor',
    'stroke-width': 14,
    'stroke-linecap': 'round',
    fill: 'none',
    ...extra,
  });

/** Bandwave at empty-state scale: the same sine primitive, 240-box, 4 bands. */
const band = (index, extra = {}) =>
  stroke(sine(84 + index * 26, 26 - index * 4, 1.08, index * 0.52, 30, 210), extra);

const lens = (extra = {}) =>
  element('path', {
    d: squircle(120, 120, 84, 4),
    stroke: 'currentColor',
    'stroke-width': 14,
    fill: 'none',
    ...extra,
  });

const lensBand = (index, extra = {}) =>
  stroke(sine(96 + index * 26, 18, 0.85, index * 1.1, 46, 194), { 'stroke-width': 16, ...extra });

function emptyStates(mark) {
  const bands = mark === 'bandwave' ? band : lensBand;
  const frame = mark === 'bandwave' ? () => null : lens;
  const shell = (kids) => svg(BOX, [], [frame({ opacity: 0.35 }), ...kids].filter(Boolean));

  return {
    // "No memories yet — Your first capture starts the wave."
    'no-memories': shell([bands(0), bands(1, { opacity: 0.18 }), bands(2, { opacity: 0.18 })]),

    // "Nothing paired — Flat bars: silence."
    'no-music': shell([0, 1, 2, 3].map((i) => stroke(`M30 ${84 + i * 26} L210 ${84 + i * 26}`))),

    // "No saved palettes — Empty swatch cells, dashed."
    'no-palettes': svg(
      BOX,
      [],
      [0, 1, 2, 3].map((i) =>
        element('rect', {
          x: 30 + i * 46,
          y: 76,
          width: 34,
          height: 88,
          rx: 11,
          stroke: 'currentColor',
          'stroke-width': 10,
          'stroke-dasharray': '18 14',
          fill: 'none',
        }),
      ),
    ),

    // "No results — Try a warmer hue or a wider radius."
    'no-discovery': shell([
      element('circle', {
        cx: 120,
        cy: 120,
        r: 92,
        stroke: 'currentColor',
        'stroke-width': 10,
        'stroke-dasharray': '20 16',
        fill: 'none',
        opacity: 0.55,
      }),
      bands(1),
    ]),

    // "Offline — Broken wave. Captures are saved locally."
    offline: shell([
      stroke(sine(110, 26, 1.08, 0, 30, 100)),
      stroke(sine(110, 26, 1.08, 0, 140, 210)),
    ]),

    // "Music not connected — Link a streaming account to pair."
    'no-service': shell([
      bands(0, { 'stroke-dasharray': '0 0' }),
      stroke('M104 152 L136 88', { 'stroke-width': 12, opacity: 0.5 }),
      bands(2, { opacity: 0.22 }),
    ]),

    // "Camera access off — Closed frame. Open Settings to capture."
    'camera-permission': svg(
      BOX,
      [],
      [
        element('rect', {
          x: 44,
          y: 60,
          width: 152,
          height: 120,
          rx: 26,
          stroke: 'currentColor',
          'stroke-width': 14,
          fill: 'none',
        }),
        stroke('M64 120 L176 120'),
      ],
    ),

    // "Locked — The amber band completes with Pro."
    'premium-locked': shell([
      bands(0),
      bands(1),
      bands(2),
      bands(3, { 'stroke-dasharray': '16 16', opacity: 0.5 }),
    ]),
  };
}

function premiumAssets(mark) {
  const bands = mark === 'bandwave' ? band : lensBand;
  const amber = { stroke: AMBER, opacity: 1 };

  return {
    // "PRO" pill, amber-only.
    'badge-pro': svg(
      '0 0 160 72',
      [],
      [
        element('rect', {
          x: 3,
          y: 3,
          width: 154,
          height: 66,
          rx: 33,
          fill: AMBER,
        }),
        element(
          'text',
          {
            x: 80,
            y: 49,
            'font-family': 'Space Grotesk, Helvetica Neue, Arial, DejaVu Sans, sans-serif',
            'font-size': 30,
            'font-weight': 700,
            'letter-spacing': 3,
            fill: '#1B1140',
            'text-anchor': 'middle',
          },
          ['PRO'],
        ),
      ],
    ),

    'badge-outline': svg(
      '0 0 240 72',
      [],
      [
        element('rect', {
          x: 4,
          y: 4,
          width: 232,
          height: 64,
          rx: 32,
          stroke: AMBER,
          'stroke-width': 6,
          fill: 'none',
        }),
        element(
          'text',
          {
            x: 120,
            y: 48,
            'font-family': 'Space Grotesk, Helvetica Neue, Arial, DejaVu Sans, sans-serif',
            'font-size': 26,
            'font-weight': 600,
            'letter-spacing': 5,
            fill: AMBER,
            'text-anchor': 'middle',
          },
          ['PREMIUM'],
        ),
      ],
    ),

    // "the complete wave" — three neutral bands plus the amber fourth.
    'fourth-band': svg(
      BOX,
      [],
      [
        bands(0, { opacity: 0.4 }),
        bands(1, { opacity: 0.4 }),
        bands(2, { opacity: 0.4 }),
        bands(3, amber),
      ],
    ),

    unlimited: svg(
      BOX,
      [],
      [
        bands(0, { opacity: 0.4 }),
        bands(1, { opacity: 0.4 }),
        bands(2, { opacity: 0.4 }),
        bands(3, amber),
        element('path', {
          d: squircle(120, 120, 108, 5),
          stroke: AMBER,
          'stroke-width': 6,
          fill: 'none',
          opacity: 0.8,
        }),
      ],
    ),

    'ai-pairing': svg(
      BOX,
      [],
      [
        bands(1, { opacity: 0.4 }),
        bands(2, amber),
        element('circle', { cx: 120, cy: 120, r: 16, fill: AMBER }),
      ],
    ),

    'export-stream': svg(
      BOX,
      [],
      [
        bands(0, { opacity: 0.4 }),
        bands(1, amber),
        stroke('M120 168 L120 214 M96 192 L120 216 L144 192', {
          stroke: AMBER,
          'stroke-width': 12,
        }),
      ],
    ),

    'color-card': svg(
      BOX,
      [],
      [
        element('rect', {
          x: 44,
          y: 52,
          width: 152,
          height: 136,
          rx: 20,
          stroke: AMBER,
          'stroke-width': 10,
          fill: 'none',
        }),
        ...[0, 1, 2, 3].map((i) =>
          element('rect', {
            x: 62 + i * 30,
            y: 96,
            width: 20,
            height: 48,
            rx: 7,
            fill: i === 3 ? AMBER : 'currentColor',
            opacity: i === 3 ? 1 : 0.45,
          }),
        ),
      ],
    ),
  };
}

export { emptyStates, premiumAssets };
