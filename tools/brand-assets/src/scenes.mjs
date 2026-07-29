/**
 * Splash storyboard, onboarding panels, empty-state glyphs and share cards.
 *
 * Ported from `CHROMAWAVE Final Concept.dc.html` — methods `splash(i)`,
 * `onboard(i)`, `emptyGlyph(i)` and `shareCard()`. The only addition is
 * `shareCard(ratio)`: the document draws the 1.91:1 card and then states the
 * rule for the rest ("Same three-zone grid across 1:1, 4:5, 9:16, 1.91:1 —
 * photo slot, band strip, metadata block"), so the other three are reflowed
 * from that grid rather than invented.
 */

import { blur, element, rg, sine, squircle, svg } from './primitives.mjs';
import { palette } from './mark.mjs';

const COLS = palette.bands;
const SCREEN = '0 0 390 844';

/* ------------------------------------------------------------------ splash */

/** Storyboard frame, 390×844. Frames 1–6 of the 1480ms launch sequence. */
export function splashFrame(i) {
  const p = `s${i}`;
  const g = (n) => `url(#${p}${n})`;
  const defs = [
    rg(
      `${p}bg`,
      [
        [0, '#1B1730'],
        [1, '#07060D'],
      ],
      195,
      400,
      470,
    ),
    rg(
      `${p}gl`,
      [
        [0, '#FFFFFF', 0.3],
        [0.62, '#FFFFFF', 0.15],
        [1, '#8E86B8', 0.1],
      ],
      160,
      380,
      200,
    ),
    blur(`${p}bl`, 9),
  ];
  const kids = [element('rect', { width: 390, height: 844, fill: g('bg') })];
  const sq = squircle(195, 402, 78, 4);

  if (i === 1) kids.push(element('circle', { cx: 195, cy: 402, r: 5, fill: '#FFFFFF' }));
  if (i === 2) {
    kids.push(
      element('path', {
        d: sine(402, 10, 0.85, 0, 130, 260),
        stroke: COLS[0],
        'stroke-width': 20,
        'stroke-linecap': 'round',
        fill: 'none',
        filter: g('bl'),
      }),
    );
  }
  if (i === 3) {
    for (let j = 0; j < 3; j++) {
      kids.push(
        element('path', {
          d: sine(378 + j * 24, 15, 0.85, j * 1.1, 96, 294),
          stroke: COLS[j],
          'stroke-width': 22,
          'stroke-linecap': 'round',
          fill: 'none',
          filter: g('bl'),
          opacity: 0.85,
        }),
      );
    }
  }
  if (i >= 4) {
    const inner = [element('path', { d: sq, fill: g('gl') })];
    for (let j = 0; j < 3; j++) {
      inner.push(
        element('path', {
          d: sine(378 + j * 22, 15, 0.85, j * 1.1, 108, 282),
          stroke: COLS[j],
          'stroke-width': 21,
          'stroke-linecap': 'round',
          fill: 'none',
          filter: g('bl'),
          opacity: 0.85,
        }),
      );
    }
    kids.push(
      element('clipPath', { id: `${p}cl` }, element('path', { d: sq })),
      element('g', { 'clip-path': `url(#${p}cl)` }, inner),
      element('path', { d: sq, stroke: '#FFFFFF', 'stroke-width': 3, fill: 'none', opacity: 0.55 }),
    );
  }
  if (i >= 5) {
    kids.push(
      element(
        'text',
        {
          x: 195,
          y: 528,
          'text-anchor': 'middle',
          fill: '#EDEAE3',
          'font-family': "'Space Grotesk', sans-serif",
          'font-weight': 500,
          'font-size': 21,
          'letter-spacing': 3.4,
        },
        'CHROMAWAVE',
      ),
    );
  }
  if (i === 6) {
    kids.push(
      element('rect', {
        x: 24,
        y: 596,
        width: 342,
        height: 150,
        rx: 22,
        fill: '#171233',
        opacity: 0.96,
      }),
    );
    for (let j = 0; j < 3; j++) {
      kids.push(
        element('rect', { x: 44 + j * 82, y: 620, width: 62, height: 62, rx: 15, fill: COLS[j] }),
      );
    }
    kids.push(
      element('rect', {
        x: 44,
        y: 700,
        width: 180,
        height: 11,
        rx: 6,
        fill: '#EDEAE3',
        opacity: 0.6,
      }),
      element('rect', { x: 24, y: 764, width: 342, height: 56, rx: 28, fill: '#171233' }),
    );
  }
  return svg(SCREEN, defs, kids);
}

/**
 * The native pre-JS splash: frame 01's field with nothing on it.
 *
 * Section 06 opens with "1480ms total, no logo hold" and frame 01 is a 5px seed
 * dot, so the static asset is the ground the Reanimated sequence starts from.
 * The dot itself is emitted separately and drawn by the runtime, otherwise the
 * handoff shows two dots at slightly different scales.
 */
export function splashField() {
  const defs = [
    rg(
      'sfbg',
      [
        [0, '#1B1730'],
        [1, '#07060D'],
      ],
      195,
      400,
      470,
    ),
  ];
  return svg(SCREEN, defs, [element('rect', { width: 390, height: 844, fill: 'url(#sfbg)' })]);
}

/** Frame 01's seed dot on transparent, for the runtime to place and scale. */
export function seedDot() {
  return svg('0 0 24 24', [], [element('circle', { cx: 12, cy: 12, r: 5, fill: '#FFFFFF' })]);
}

/* -------------------------------------------------------------- onboarding */

/** Onboarding panel, 390×844. Screens 01–05; the photo slot stays a placeholder. */
export function onboardingPanel(i) {
  const p = `o${i}`;
  const g = (n) => `url(#${p}${n})`;
  const defs = [
    rg(
      `${p}bg`,
      [
        [0, '#161327'],
        [1, '#08070E'],
      ],
      195,
      300,
      480,
    ),
    blur(`${p}bl`, 10),
  ];
  const kids = [
    element('rect', { width: 390, height: 844, fill: g('bg') }),
    element('rect', {
      x: 24,
      y: 84,
      width: 342,
      height: 372,
      rx: 24,
      fill: '#241F3D',
      stroke: 'rgba(237,234,227,.16)',
      'stroke-dasharray': '8 8',
      'stroke-width': 2,
    }),
    element(
      'text',
      {
        x: 195,
        y: 270,
        'text-anchor': 'middle',
        fill: 'rgba(237,234,227,.4)',
        'font-family': "'IBM Plex Mono', monospace",
        'font-size': 13,
        'letter-spacing': 2,
      },
      'PHOTO',
    ),
  ];

  for (let j = 0; j < 3; j++) {
    kids.push(
      element('path', {
        d: sine(504 + j * 26, 13, 0.85, j * 1.1 + i * 0.4, 24, 366),
        stroke: COLS[j],
        'stroke-width': 22,
        'stroke-linecap': 'round',
        fill: 'none',
        filter: g('bl'),
        opacity: i === 5 ? 0.35 : 0.85,
      }),
    );
  }

  kids.push(
    element('rect', {
      x: 24,
      y: 596,
      width: i === 1 ? 250 : 200,
      height: 18,
      rx: 9,
      fill: '#EDEAE3',
      opacity: 0.85,
    }),
    element('rect', {
      x: 24,
      y: 626,
      width: 300,
      height: 12,
      rx: 6,
      fill: '#EDEAE3',
      opacity: 0.34,
    }),
    element('rect', {
      x: 24,
      y: 650,
      width: 230,
      height: 12,
      rx: 6,
      fill: '#EDEAE3',
      opacity: 0.34,
    }),
  );

  if (i === 5) {
    kids.push(
      element('rect', { x: 44, y: 300, width: 302, height: 200, rx: 22, fill: '#EDE8F4' }),
      element('rect', {
        x: 70,
        y: 340,
        width: 180,
        height: 14,
        rx: 7,
        fill: '#0C0B18',
        opacity: 0.8,
      }),
      element('rect', {
        x: 70,
        y: 368,
        width: 240,
        height: 10,
        rx: 5,
        fill: '#0C0B18',
        opacity: 0.4,
      }),
      element('rect', { x: 70, y: 420, width: 250, height: 44, rx: 22, fill: '#7C5CFF' }),
    );
  }

  kids.push(
    element(
      'g',
      { transform: 'translate(300,742) scale(.055)' },
      element('path', {
        d: squircle(512, 512, 360, 4),
        fill: 'rgba(237,234,227,.14)',
        stroke: '#EDEAE3',
        'stroke-width': 26,
      }),
    ),
    element('rect', { x: 24, y: 720, width: 250, height: 52, rx: 26, fill: COLS[i % 3] }),
  );
  return svg(SCREEN, defs, kids);
}

/* ------------------------------------------------------------ empty states */

/**
 * Flat empty-state glyphs, 400×260, stroke only.
 * Section 08: "an empty state is the mark with something missing".
 */
export function emptyGlyph(i) {
  const sq = squircle(200, 130, 96, 4);
  const stroke = 'currentColor';
  const kids = [
    element('path', {
      d: sq,
      fill: 'none',
      stroke,
      'stroke-width': 8,
      opacity: 0.55,
      'stroke-dasharray': i === 3 ? '46 26' : null,
    }),
  ];
  if (i === 1) {
    kids.push(
      element('path', {
        d: sine(130, 0, 1, 0, 130, 270),
        stroke,
        'stroke-width': 8,
        'stroke-dasharray': '4 18',
        'stroke-linecap': 'round',
        fill: 'none',
        opacity: 0.55,
      }),
    );
  }
  if (i === 2) {
    kids.push(
      element('path', {
        d: sine(130, 16, 0.85, 0, 128, 272),
        stroke: COLS[0],
        'stroke-width': 12,
        'stroke-linecap': 'round',
        fill: 'none',
      }),
    );
  }
  if (i === 3) {
    kids.push(
      element('path', {
        d: 'M158 88 L242 172',
        stroke,
        'stroke-width': 8,
        'stroke-linecap': 'round',
        opacity: 0.55,
      }),
    );
  }
  if (i === 4) {
    for (let j = 0; j < 3; j++) {
      kids.push(
        element('path', {
          d: sine(106 + j * 24, 12, 0.85, j * 1.1, 128, 272),
          stroke: COLS[j],
          'stroke-width': 11,
          'stroke-linecap': 'round',
          fill: 'none',
          opacity: 0.9 - j * 0.22,
        }),
      );
    }
  }
  return svg('0 0 400 260', [], kids);
}

export const emptyGlyphNames = {
  1: 'no-library',
  2: 'no-results',
  3: 'offline',
  4: 'loading',
};

/* ------------------------------------------------------------- share cards */

/**
 * Three-zone share card. The 1.91:1 build is the document's `shareCard()`
 * verbatim; the others reflow the same zones — photo slot, band strip,
 * metadata block — into a portrait stack, which is what the caption under the
 * card prescribes for 1:1, 4:5 and 9:16.
 */
export const shareRatios = {
  '1x1': { width: 1080, height: 1080 },
  '4x5': { width: 1080, height: 1350 },
  '9x16': { width: 1080, height: 1920 },
  '1.91x1': { width: 1200, height: 630 },
};

export function shareCard(ratio = '1.91x1') {
  const { width, height } = shareRatios[ratio];
  const p = `sc${ratio.replace(/[^a-z0-9]/gi, '')}`;
  const g = (n) => `url(#${p}${n})`;
  const landscape = ratio === '1.91x1';
  const defs = [
    rg(
      `${p}bg`,
      [
        [0, '#1B1730'],
        [1, '#08070E'],
      ],
      width / 2,
      height / 2,
      Math.max(width, height) * 0.6,
    ),
    blur(`${p}bl`, landscape ? 14 : 18),
  ];
  const kids = [element('rect', { width, height, fill: g('bg') })];

  // Zone 1 · photo slot, Zone 2 · band strip, Zone 3 · metadata block.
  const pad = Math.round(width * 0.047);
  const photo = landscape
    ? { x: 56, y: 56, w: 520, h: 518 }
    : { x: pad, y: pad, w: width - pad * 2, h: Math.round(height * 0.52) };
  const strip = landscape
    ? { x0: 640, x1: 1144, y: 180, gap: 46, amp: 26, w: 38 }
    : {
        x0: pad,
        x1: width - pad,
        y: photo.y + photo.h + Math.round(height * 0.075),
        gap: Math.round(height * 0.032),
        amp: Math.round(height * 0.018),
        w: Math.round(height * 0.026),
      };
  const meta = landscape
    ? { x: 640, y: 380, wide: 380, narrow: 280, mark: 540 }
    : {
        x: pad,
        y: strip.y + strip.gap * 3 + Math.round(height * 0.05),
        wide: Math.round(width * 0.42),
        narrow: Math.round(width * 0.3),
        mark: height - pad * 2,
      };

  kids.push(
    element('rect', {
      x: photo.x,
      y: photo.y,
      width: photo.w,
      height: photo.h,
      rx: 26,
      fill: '#241F3D',
      stroke: 'rgba(237,234,227,.16)',
      'stroke-dasharray': '10 10',
      'stroke-width': 2,
    }),
    element(
      'text',
      {
        x: photo.x + photo.w / 2,
        y: photo.y + photo.h / 2,
        'text-anchor': 'middle',
        fill: 'rgba(237,234,227,.4)',
        'font-family': "'IBM Plex Mono', monospace",
        'font-size': 22,
        'letter-spacing': 3,
      },
      'PHOTO',
    ),
  );

  for (let j = 0; j < 3; j++) {
    kids.push(
      element('path', {
        d: sine(strip.y + j * strip.gap, strip.amp, 0.85, j * 1.1, strip.x0, strip.x1),
        stroke: COLS[j],
        'stroke-width': strip.w,
        'stroke-linecap': 'round',
        fill: 'none',
        filter: g('bl'),
        opacity: 0.85,
      }),
    );
  }

  kids.push(
    element('rect', {
      x: meta.x,
      y: meta.y,
      width: meta.wide,
      height: 26,
      rx: 13,
      fill: '#EDEAE3',
      opacity: 0.85,
    }),
    element('rect', {
      x: meta.x,
      y: meta.y + 46,
      width: meta.narrow,
      height: 18,
      rx: 9,
      fill: '#EDEAE3',
      opacity: 0.35,
    }),
    element(
      'text',
      {
        x: meta.x,
        y: meta.mark,
        fill: '#EDEAE3',
        'font-family': "'Space Grotesk', sans-serif",
        'font-weight': 500,
        'font-size': 26,
        'letter-spacing': 4,
      },
      'CHROMAWAVE',
    ),
  );
  return svg(`0 0 ${width} ${height}`, defs, kids);
}
