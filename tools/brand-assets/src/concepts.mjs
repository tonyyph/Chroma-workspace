/**
 * CHROMAWAVE icon concepts 01 (Bandwave) and 07 (Liquid Lens).
 *
 * Ported from `icon('c01')` / `icon('c07')` in `CHROMAWAVE Identity.dc.html`.
 * Every literal below appears in that document; the `production` flag applies the
 * four changes Phase 05 lists under ADJUST BEFORE PRODUCTION (see README).
 */

import { blur, element, lg, rg, sine, squircle, svg } from './primitives.mjs';

const VIEW_BOX = '0 0 1024 1024';
const INK = '#16151C';
const BONE = '#F5F2EC';

/** Phase 04, DIRECTION 01 — COLOUR VALUES. */
export const bandwavePalette = {
  bands: ['#7C5CFF', '#22D3EE', '#FF6B5A', '#FFC24A'],
  bandsMono: ['#F2EFE8', '#C9C5BC', '#9A968E', '#6E6A64'],
  bandsHighContrast: ['#B79CFF', '#5CF0FF', '#FF9683', '#FFD877'],
  fieldTop: '#0B0918',
  fieldBase: '#1B1140',
  fieldLightTop: '#F5F2EC',
  fieldLightBase: '#E8E2D6',
  fieldMonoTop: '#101014',
  fieldMonoBase: '#26262C',
};

/** Concept-by-concept board, 07 Liquid Lens — COLOUR VALUES. */
export const liquidLensPalette = {
  bands: ['#7C5CFF', '#22D3EE', '#FF7A5C'],
  bandsMono: ['#8A8A8A', '#AAAAAA', '#C8C8C8'],
  fieldTop: '#EDE8F4',
  fieldBase: '#DCD4EC',
  fieldDarkTop: '#161327',
  fieldDarkBase: '#0C0B18',
  shadow: '#2A2440',
};

/**
 * Phase 05 adjustment 2: "Lock the field gradient to a two-stop vertical only;
 * the diagonal muddies at 20px." The exploration board draws 0,0 -> 1024,1024.
 */
function fieldGradient(id, top, base, production) {
  return production ? lg(id, top, base, 0, 0, 0, 1024) : lg(id, top, base, 0, 0, 1024, 1024);
}

/**
 * 01 Bandwave — "Four chromatic bands travelling the same wave, phase-shifted so
 * they never touch."
 *
 * Geometry (Phase 04): midlines y=352/472/592/700, amplitude 126->72,
 * stroke 80, round caps, lambda = 1.08 cycle across 768px (x 128..896, the 12% safe inset).
 */
export function bandwave({
  key = '',
  light = false,
  mono = false,
  contrast = false,
  simple = false,
  transparent = false,
  production = true,
} = {}) {
  const p = `c01${key}`;
  const url = (name) => `url(#${p}${name})`;

  let cols = bandwavePalette.bands;
  if (mono) cols = bandwavePalette.bandsMono;
  if (contrast) cols = bandwavePalette.bandsHighContrast;

  // Phase 05 adjustment 1: "Increase band gaps by ~4% at the 29px cut."
  const simpleMids = production ? [395.2, 520, 644.8] : [400, 520, 640];
  const mids = simple ? simpleMids : [352, 472, 592, 700];
  const amps = simple ? [124, 104, 84] : [126, 108, 90, 72];
  const strokeWidth = simple ? 92 : 80;

  const defs = [];
  const paths = [];
  for (let i = 0; i < mids.length; i++) {
    defs.push(lg(`${p}w${i}`, cols[i], cols[(i + 1) % cols.length], 130, 0, 894, 0));
    paths.push(
      element('path', {
        d: sine(mids[i], amps[i], 1.08, i * 0.52, 128, 896),
        stroke: url(`w${i}`),
        'stroke-width': strokeWidth,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
    );
  }

  if (transparent) {
    // Phase 06: "tinted uses the mono cut on transparent" — single flat layer,
    // no field, no glow, so iOS can apply its own tint ramp.
    return svg(VIEW_BOX, defs, [element('g', {}, paths)]);
  }

  let top = bandwavePalette.fieldTop;
  let base = bandwavePalette.fieldBase;
  if (light) {
    top = bandwavePalette.fieldLightTop;
    base = bandwavePalette.fieldLightBase;
  } else if (mono) {
    top = bandwavePalette.fieldMonoTop;
    base = bandwavePalette.fieldMonoBase;
  }

  defs.unshift(fieldGradient(`${p}bg`, top, base, production), blur(`${p}bl`, 30));

  return svg(VIEW_BOX, defs, [
    element('rect', { width: 1024, height: 1024, fill: url('bg') }),
    light || mono ? null : element('g', { filter: url('bl'), opacity: 0.5 }, paths),
    element('g', {}, paths),
  ]);
}

/**
 * 07 Liquid Lens — "A soft squircle of glass with three chromatic bands bending
 * through it." Bands are blurred in place (stdDeviation 44): the diffusion *is*
 * the mark, which is also why the doc rates its small-size behaviour "Poor".
 *
 * `flat` drops the blur and the specular to produce the "separate flat
 * small-size mark" the concept sheet says this direction requires.
 */
export function liquidLens({
  key = '',
  dark = false,
  mono = false,
  simple = false,
  flat = false,
  transparent = false,
  production = true,
} = {}) {
  const p = `c07${key}`;
  const url = (name) => `url(#${p}${name})`;
  const cols = mono ? liquidLensPalette.bandsMono : liquidLensPalette.bands;

  const body = squircle(512, 512, 360, 4);
  const bandSpecs = [
    { d: sine(430, 74, 0.85, 0, 150, 874), stroke: cols[0], width: 96, opacity: 0.8 },
    { d: sine(536, 74, 0.85, 1.1, 150, 874), stroke: cols[1], width: 96, opacity: 0.8 },
    { d: sine(626, 66, 0.85, 2.2, 150, 874), stroke: cols[2], width: 88, opacity: 0.78 },
  ];
  const bandPaths = bandSpecs.map((band) =>
    element('path', {
      d: band.d,
      stroke: band.stroke,
      'stroke-width': band.width,
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: flat ? 1 : band.opacity,
    }),
  );

  if (transparent) {
    return svg(
      VIEW_BOX,
      [element('clipPath', { id: `${p}cl` }, [element('path', { d: body })])],
      [
        element('g', { 'clip-path': `url(#${p}cl)` }, [
          element('path', { d: body, fill: '#FFFFFF', opacity: 0.28 }),
          ...bandPaths,
        ]),
        element('path', {
          d: body,
          stroke: '#FFFFFF',
          'stroke-width': 26,
          fill: 'none',
        }),
      ],
    );
  }

  const top = dark ? liquidLensPalette.fieldDarkTop : liquidLensPalette.fieldTop;
  const base = dark ? liquidLensPalette.fieldDarkBase : liquidLensPalette.fieldBase;

  // "LIGHT / DARK — Native light; the dark variant needs a full re-render, not a
  // recolour." Swapping the field alone leaves a white slab: on the dark ground the
  // glass body itself has to become dark glass, so the dispersion reads as emitted
  // light rather than as a hole punched in the wallpaper.
  const glassStops = dark
    ? [
        [0, '#FFFFFF', 0.3],
        [0.62, '#B9A9FF', 0.16],
        [1, '#2A2440', 0.34],
      ]
    : [
        [0, '#FFFFFF', 0.96],
        [0.62, '#FFFFFF', 0.74],
        [1, '#D9D2EA', 0.5],
      ];

  const defs = [
    fieldGradient(`${p}bg`, top, base, production),
    rg(`${p}gl`, glassStops, 430, 400, 520),
    blur(`${p}bl`, 44),
    blur(`${p}sh`, 26),
    element('clipPath', { id: `${p}cl` }, [element('path', { d: body })]),
  ];

  const bands = element(
    'g',
    flat
      ? { opacity: mono ? 0.72 : 1 }
      : { filter: url('bl'), opacity: mono ? 0.2 : dark ? 1 : 0.95 },
    bandPaths,
  );

  return svg(VIEW_BOX, defs, [
    element('rect', { width: 1024, height: 1024, fill: url('bg') }),
    element('g', { filter: url('sh'), opacity: 0.28 }, [
      element('path', { d: squircle(512, 552, 356, 4), fill: liquidLensPalette.shadow }),
    ]),
    element('g', { 'clip-path': `url(#${p}cl)` }, [
      dark ? element('path', { d: body, fill: '#141026' }) : null,
      element('path', { d: body, fill: url('gl') }),
      bands,
    ]),
    element('path', {
      d: body,
      stroke: '#FFFFFF',
      'stroke-width': flat ? 18 : 14,
      fill: 'none',
      opacity: 0.85,
    }),
    simple
      ? null
      : element('path', {
          d: 'M300 300 Q396 236 512 236',
          stroke: '#FFFFFF',
          'stroke-width': 22,
          'stroke-linecap': 'round',
          fill: 'none',
          opacity: 0.9,
        }),
  ]);
}

/**
 * ASSET SYSTEM · B — the eight-frame launch storyboard, 390x844.
 * Ported from `frame(i)`; frame 05 is the dark static splash, frame 08 the hand-off target.
 */
export function splashFrame(i) {
  const p = `f${i}`;
  const url = (name) => `url(#${p}${name})`;
  const cols = bandwavePalette.bands;
  const defs = [
    rg(
      `${p}bg`,
      [
        [0, '#1B1140'],
        [1, '#07060D'],
      ],
      195,
      400,
      460,
    ),
    blur(`${p}bl`, 12),
  ];
  const kids = [element('rect', { width: 390, height: 844, fill: url('bg') })];

  if (i === 1) kids.push(element('circle', { cx: 195, cy: 422, r: 5, fill: '#FFFFFF' }));
  if (i === 2)
    kids.push(
      element('circle', {
        cx: 195,
        cy: 422,
        r: 34,
        fill: 'none',
        stroke: '#7C5CFF',
        'stroke-width': 3,
        opacity: 0.5,
      }),
      element('circle', { cx: 195, cy: 422, r: 10, fill: '#FFFFFF' }),
    );
  if (i === 3)
    kids.push(
      element('circle', {
        cx: 195,
        cy: 422,
        r: 60,
        fill: 'none',
        stroke: '#22D3EE',
        'stroke-width': 5,
        opacity: 0.55,
      }),
      element('circle', {
        cx: 195,
        cy: 422,
        r: 34,
        fill: 'none',
        stroke: '#7C5CFF',
        'stroke-width': 7,
      }),
      element('circle', { cx: 195, cy: 422, r: 12, fill: '#FFFFFF' }),
    );
  if (i === 4)
    kids.push(
      element('path', {
        d: sine(422, 26, 1.1, 0, 90, 300),
        stroke: '#7C5CFF',
        'stroke-width': 16,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
    );
  if (i === 5)
    for (let j = 0; j < 4; j++)
      kids.push(
        element('path', {
          d: sine(392 + j * 22, 30 - j * 4, 1.1, j * 0.52, 60, 330),
          stroke: cols[j],
          'stroke-width': 18,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
      );
  if (i === 6)
    for (let j = 0; j < 4; j++)
      kids.push(
        element('path', {
          d: sine(360 + j * 40, 46 - j * 6, 0.8, j * 0.52, 0, 390),
          stroke: cols[j],
          'stroke-width': 44,
          'stroke-linecap': 'butt',
          fill: 'none',
          opacity: 0.95,
        }),
      );
  if (i === 7) {
    for (let j = 0; j < 4; j++)
      kids.push(
        element('rect', {
          x: 0,
          y: 240 + j * 92,
          width: 390,
          height: 92,
          fill: cols[j],
          opacity: 0.92,
        }),
      );
    kids.push(
      element('rect', {
        x: 28,
        y: 300,
        width: 334,
        height: 300,
        rx: 26,
        fill: '#0B0A12',
        opacity: 0.55,
      }),
    );
  }
  if (i === 8) {
    kids.push(
      element('rect', {
        x: 24,
        y: 74,
        width: 120,
        height: 14,
        rx: 7,
        fill: '#F2EFE8',
        opacity: 0.9,
      }),
      element('rect', { x: 24, y: 116, width: 342, height: 300, rx: 24, fill: '#1B1436' }),
    );
    for (let j = 0; j < 4; j++)
      kids.push(
        element('rect', {
          x: 44 + j * 82,
          y: 320,
          width: 66,
          height: 66,
          rx: 16,
          fill: cols[j],
        }),
      );
    for (let j = 0; j < 4; j++)
      kids.push(
        element('path', {
          d: sine(210 + j * 34, 26 - j * 4, 1.05, j * 0.52, 50, 340),
          stroke: cols[j],
          'stroke-width': 14,
          'stroke-linecap': 'round',
          fill: 'none',
        }),
      );
    kids.push(
      element('rect', {
        x: 24,
        y: 448,
        width: 200,
        height: 12,
        rx: 6,
        fill: '#F2EFE8',
        opacity: 0.7,
      }),
      element('rect', {
        x: 24,
        y: 476,
        width: 130,
        height: 10,
        rx: 5,
        fill: '#F2EFE8',
        opacity: 0.35,
      }),
      element('rect', { x: 24, y: 744, width: 342, height: 64, rx: 32, fill: '#171233' }),
    );
  }

  return svg('0 0 390 844', defs, kids);
}

/**
 * Bandwave static splash, 390x844. Frame 05 of the storyboard is the dark bake
 * ("Wave splits into four bands — the icon, at screen scale"); the light bake follows
 * the concept sheet: "light variant inverts to warm bone #F5F2EC with bands at 92%
 * chroma."
 */
export function bandwaveSplash({ dark = true } = {}) {
  if (dark) return splashFrame(5);

  const p = 'f05L';
  const defs = [
    lg(`${p}bg`, bandwavePalette.fieldLightTop, bandwavePalette.fieldLightBase, 0, 0, 0, 844),
  ];
  const kids = [element('rect', { width: 390, height: 844, fill: `url(#${p}bg)` })];
  for (let j = 0; j < 4; j++) {
    kids.push(
      element('path', {
        d: sine(392 + j * 22, 30 - j * 4, 1.1, j * 0.52, 60, 330),
        stroke: bandwavePalette.bands[j],
        'stroke-width': 18,
        'stroke-linecap': 'round',
        fill: 'none',
        opacity: 0.92,
      }),
    );
  }
  return svg('0 0 390 844', defs, kids);
}

/**
 * Liquid Lens launch field — the concept-07 counterpart to `splashFrame`.
 * ASSET SYSTEM · B is written for Bandwave (dark field, unrolling bands); concept 07
 * is a native-light, refractive direction, so its static splash is the lens body on
 * the #EDE8F4 field with the same 12% inset rhythm.
 */
export function liquidLensSplash({ dark = false } = {}) {
  const p = 'f07';
  const url = (name) => `url(#${p}${name})`;
  const top = dark ? liquidLensPalette.fieldDarkTop : liquidLensPalette.fieldTop;
  const base = dark ? liquidLensPalette.fieldDarkBase : liquidLensPalette.fieldBase;
  const body = squircle(195, 422, 88, 4);
  const defs = [
    lg(`${p}bg`, top, base, 0, 0, 0, 844),
    rg(
      `${p}gl`,
      [
        [0, '#FFFFFF', 0.96],
        [0.62, '#FFFFFF', 0.74],
        [1, '#D9D2EA', 0.5],
      ],
      175,
      400,
      128,
    ),
    blur(`${p}bl`, 11),
    blur(`${p}sh`, 7),
    element('clipPath', { id: `${p}cl` }, [element('path', { d: body })]),
  ];
  const bands = element('g', { filter: url('bl'), opacity: 0.95 }, [
    element('path', {
      d: sine(402, 18, 0.85, 0, 116, 274),
      stroke: liquidLensPalette.bands[0],
      'stroke-width': 24,
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: 0.8,
    }),
    element('path', {
      d: sine(428, 18, 0.85, 1.1, 116, 274),
      stroke: liquidLensPalette.bands[1],
      'stroke-width': 24,
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: 0.8,
    }),
    element('path', {
      d: sine(450, 16, 0.85, 2.2, 116, 274),
      stroke: liquidLensPalette.bands[2],
      'stroke-width': 22,
      'stroke-linecap': 'round',
      fill: 'none',
      opacity: 0.78,
    }),
  ]);

  return svg('0 0 390 844', defs, [
    element('rect', { width: 390, height: 844, fill: url('bg') }),
    element('g', { filter: url('sh'), opacity: 0.28 }, [
      element('path', { d: squircle(195, 432, 87, 4), fill: liquidLensPalette.shadow }),
    ]),
    element('g', { 'clip-path': `url(#${p}cl)` }, [
      element('path', { d: body, fill: url('gl') }),
      bands,
    ]),
    element('path', {
      d: body,
      stroke: '#FFFFFF',
      'stroke-width': 3.5,
      fill: 'none',
      opacity: 0.85,
    }),
  ]);
}

export { BONE, INK };
