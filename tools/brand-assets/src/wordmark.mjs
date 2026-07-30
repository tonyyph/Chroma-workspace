/**
 * The wordmark, as real outlines.
 *
 * BUILD KIT · 06 · FONT LICENCE: "the wordmark ships as outlines, never live
 * text." Live `<text>` renders differently wherever the font is missing and can
 * be re-flowed by a viewer, so a wordmark that ships as text is not a wordmark.
 *
 * Space Grotesk is already vendored by `@expo-google-fonts/space-grotesk` (OFL),
 * so the glyph paths come from the same file the app renders with — the outlines
 * and the running app cannot disagree.
 */

import opentype from 'opentype.js';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

import { element, svg } from './primitives.mjs';
import { palette, symbol } from './mark.mjs';

const require = createRequire(import.meta.url);

/** Section 05: "Medium for wordmark (+0.06em)". */
const WEIGHT = 'SpaceGrotesk_500Medium';
const TRACKING_EM = 0.06;
const WORD = 'CHROMAWAVE';

/** The three letters the design tints — the W, A and V of "CHROMAWAVE". */
const TINTED = { 6: 0, 7: 1, 8: 2 };

function loadFont() {
  const path = require.resolve(`@expo-google-fonts/space-grotesk/500Medium/${WEIGHT}.ttf`);
  return opentype.parse(toArrayBuffer(readFileSync(path)));
}

const toArrayBuffer = (buffer) =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

/**
 * Serialises opentype's command list to SVG path data.
 *
 * Deliberately not `Path.toPathData()`: that emits `NaN` control points for some
 * glyphs at a non-zero offset — non-deterministically, three of ten on a typical
 * run — while `path.commands` themselves are always clean. Writing the commands
 * out directly is both correct and one fewer thing to trust.
 */
function serialise(commands) {
  const n = (value) => {
    const rounded = Math.round(value * 1000) / 1000;
    if (!Number.isFinite(rounded)) throw new Error(`Non-finite glyph coordinate: ${value}`);
    // Trailing zeroes are noise in a file this repetitive.
    return String(rounded);
  };

  return commands
    .map((c) => {
      switch (c.type) {
        case 'M':
          return `M${n(c.x)} ${n(c.y)}`;
        case 'L':
          return `L${n(c.x)} ${n(c.y)}`;
        case 'C':
          return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
        case 'Q':
          return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
        case 'Z':
          return 'Z';
        default:
          throw new Error(`Unhandled glyph command: ${c.type}`);
      }
    })
    .join('');
}

/**
 * Lays out `WORD` at `fontSize` and returns one path per glyph, so each letter
 * can carry its own fill. Tracking is applied between glyphs, not after the last.
 */
function layout(font, fontSize) {
  const scale = fontSize / font.unitsPerEm;
  const tracking = fontSize * TRACKING_EM;
  const glyphs = font.stringToGlyphs(WORD);

  let x = 0;
  const laid = glyphs.map((glyph, index) => {
    const path = glyph.getPath(x, 0, fontSize);
    x += glyph.advanceWidth * scale;
    if (index < glyphs.length - 1) x += tracking;
    return { d: serialise(path.commands), index };
  });

  // Cap height, not ascender: the wordmark is all caps, so the visual box is the
  // capital H. Using the ascender would leave a band of empty space above.
  const capHeight = (font.tables.os2?.sCapHeight ?? font.unitsPerEm * 0.7) * scale;
  return { glyphs: laid, width: x, height: capHeight };
}

function glyphPaths(laid, colour) {
  return laid.glyphs.map(({ d, index }) =>
    element('path', {
      d,
      fill: colour ?? (TINTED[index] === undefined ? '#EDEAE3' : palette.bands[TINTED[index]]),
    }),
  );
}

/**
 * @param variant  'horizontal' · mark beside the word
 *                 'stacked'    · mark above the word
 *                 'ink-1c'     · one-colour, for light surfaces
 */
export function wordmark(variant) {
  const font = loadFont();
  const fontSize = 100;
  const laid = layout(font, fontSize);

  // Section 05: "clear space = 0.5× mark height on all sides".
  const clear = laid.height * 0.5;
  const colour = variant === 'ink-1c' ? palette.ink : null;

  if (variant === 'stacked') {
    const markSize = laid.width * 0.28;
    const width = laid.width + clear * 2;
    const height = markSize + clear + laid.height + clear * 2;
    const inner = symbol({ k: 'WM' })
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '');

    return svg(
      `0 0 ${round(width)} ${round(height)}`,
      [],
      [
        element(
          'g',
          {
            transform: `translate(${round((width - markSize) / 2)} ${round(clear)}) scale(${(markSize / 1024).toFixed(5)})`,
          },
          inner,
        ),
        // Glyph paths sit on their own baseline, so the group is translated to it.
        element(
          'g',
          {
            transform: `translate(${round(clear)} ${round(clear + markSize + clear + laid.height)})`,
          },
          glyphPaths(laid, colour),
        ),
      ],
    );
  }

  if (variant === 'horizontal') {
    const markSize = laid.height * 1.6;
    const gap = laid.height * 0.45;
    const width = markSize + gap + laid.width + clear * 2;
    const height = Math.max(markSize, laid.height) + clear * 2;
    const inner = symbol({ k: 'WM' })
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '');

    return svg(
      `0 0 ${round(width)} ${round(height)}`,
      [],
      [
        element(
          'g',
          {
            transform: `translate(${round(clear)} ${round((height - markSize) / 2)}) scale(${(markSize / 1024).toFixed(5)})`,
          },
          inner,
        ),
        element(
          'g',
          {
            transform: `translate(${round(clear + markSize + gap)} ${round(height / 2 + laid.height / 2)})`,
          },
          glyphPaths(laid, colour),
        ),
      ],
    );
  }

  // ink-1c: the word alone, one colour.
  const width = laid.width + clear * 2;
  const height = laid.height + clear * 2;
  return svg(
    `0 0 ${round(width)} ${round(height)}`,
    [],
    [
      element(
        'g',
        { transform: `translate(${round(clear)} ${round(clear + laid.height)})` },
        glyphPaths(laid, colour),
      ),
    ],
  );
}

const round = (value) => Math.round(value * 10) / 10;

export const wordmarkVariants = ['horizontal', 'stacked', 'ink-1c'];
