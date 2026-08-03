import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  deltaE00,
  extractPaletteFromRgba,
  hexDeltaE00,
  hexToRgb,
  rgbToDisplayP3,
  rgbToHex,
  rgbToLab,
  rgbToOklch,
  safeForegroundFor,
  simulateVisionHex,
  type Lab,
} from './color';
import { paletteSchema } from './palette';

const image = (colors: readonly [number, number, number][]): Uint8Array =>
  Uint8Array.from(colors.flatMap(([red, green, blue]) => [red, green, blue, 255]));

describe('color science', () => {
  it('formats RGB as canonical uppercase hex', () => {
    expect(rgbToHex({ red: 255, green: 128, blue: 0 })).toBe('#FF8000');
  });

  it('extracts deterministic weighted swatches', () => {
    const pixels = image([
      [240, 100, 20],
      [240, 100, 20],
      [20, 80, 220],
      [20, 80, 220],
    ]);
    const first = extractPaletteFromRgba(pixels, 2, 2, 2);
    const second = extractPaletteFromRgba(pixels, 2, 2, 2);

    expect(first).toEqual(second);
    expect(first.colors).toHaveLength(2);
    expect(first.colors.reduce((sum, color) => sum + color.weight, 0)).toBeCloseTo(1);
  });

  it('assigns the roles the app talks in, in share order', () => {
    const pixels = image([
      [240, 100, 20],
      [240, 100, 20],
      [240, 100, 20],
      [20, 80, 220],
      [20, 80, 220],
      [10, 200, 190],
    ]);
    const result = extractPaletteFromRgba(pixels, 3, 2, 3);
    expect(result.colors.map((color) => color.role)).toEqual(['dominant', 'support', 'signal']);
  });

  it('produces weights a Palette will accept, with no rounding drift', () => {
    const pixels = image([
      [240, 100, 20],
      [30, 30, 40],
      [10, 200, 190],
      [200, 190, 180],
      [90, 60, 200],
    ]);
    const result = extractPaletteFromRgba(pixels, 5, 1, 5);

    const parsed = paletteSchema.safeParse({
      schemaVersion: 1,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Extraction',
      createdAt: '2026-07-29T00:00:00.000Z',
      capturedAt: '2026-07-29T00:00:00.000Z',
      source: 'photo',
      colors: result.colors,
      tags: [],
      location: null,
      photoUri: null,
      deltaE: result.deltaE,
      confidence: result.confidence,
      space: 'srgb',
      tuned: false,
      setIds: [],
      isPinned: false,
    });
    expect(parsed.success).toBe(true);
  });

  it('reports a flat image as a confident, near-zero read', () => {
    const flat = image([
      [120, 90, 200],
      [120, 90, 200],
      [120, 90, 200],
      [120, 90, 200],
    ]);
    const result = extractPaletteFromRgba(flat, 2, 2, 1);
    expect(result.deltaE).toBeCloseTo(0, 1);
    expect(result.confidence).toBeGreaterThan(0.95);
  });

  it('chooses a foreground with strong contrast', () => {
    expect(safeForegroundFor('#FFE06A')).toBe('#09090B');
    expect(safeForegroundFor('#15111F')).toBe('#FFFFFF');
    expect(contrastRatio(safeForegroundFor('#6E44FF'), '#6E44FF')).toBeGreaterThan(4.5);
  });
});

describe('CIEDE2000', () => {
  // Sharma, Wu & Dalal (2005) supplied the canonical test pairs for verifying a
  // CIEDE2000 implementation; these are rows from that table.
  const cases: readonly [Lab, Lab, number][] = [
    [{ lightness: 50, a: 2.6772, b: -79.7751 }, { lightness: 50, a: 0, b: -82.7485 }, 2.0425],
    [{ lightness: 50, a: 3.1571, b: -77.2803 }, { lightness: 50, a: 0, b: -82.7485 }, 2.8615],
    [{ lightness: 50, a: -1.3802, b: -84.2814 }, { lightness: 50, a: 0, b: -82.7485 }, 1.0],
    [{ lightness: 50, a: 2.5, b: 0 }, { lightness: 50, a: 0, b: -2.5 }, 4.3065],
    [
      { lightness: 60.2574, a: -34.0099, b: 36.2677 },
      { lightness: 60.4626, a: -34.1751, b: 39.4387 },
      1.2644,
    ],
    [
      { lightness: 22.7233, a: 20.0904, b: -46.694 },
      { lightness: 23.0331, a: 14.973, b: -42.5619 },
      2.0373,
    ],
    [
      { lightness: 2.0776, a: 0.0795, b: -1.135 },
      { lightness: 0.9033, a: -0.0636, b: -0.5514 },
      0.9082,
    ],
  ];

  it.each(cases)('matches the reference table for %j vs %j', (first, second, expected) => {
    expect(deltaE00(first, second)).toBeCloseTo(expected, 3);
  });

  it('is symmetric and zero for identical colours', () => {
    const a = { lightness: 50, a: 2.5, b: 0 };
    const b = { lightness: 61, a: -12, b: 33 };
    expect(deltaE00(a, a)).toBeCloseTo(0, 6);
    expect(deltaE00(a, b)).toBeCloseTo(deltaE00(b, a), 9);
  });

  it('separates the reference palette’s violet and cyan by an obvious distance', () => {
    expect(hexDeltaE00('#7C5CFF', '#22D3EE')).toBeGreaterThan(30);
    expect(hexDeltaE00('#7C5CFF', '#7C5CFF')).toBe(0);
  });
});

describe('linear-light extraction', () => {
  // BUILD KIT: "averaging gamma-encoded pixels shifts every result muddy."
  // Black and white average to mid-grey in linear light, which encodes to ~188 —
  // averaging the sRGB values instead gives 128, a visibly darker, muddier result.
  it('averages in linear light, not in sRGB', () => {
    const pixels = image([
      [0, 0, 0],
      [255, 255, 255],
    ]);
    const result = extractPaletteFromRgba(pixels, 2, 1, 1);
    const color = result.colors[0]!;
    const channel = Number.parseInt(color.hex.slice(1, 3), 16);

    expect(channel).toBeGreaterThan(180);
    expect(channel).toBeLessThan(195);
  });
});

describe('colour space conversions', () => {
  it('round-trips hex through RGB', () => {
    expect(rgbToHex(hexToRgb('#7C5CFF'))).toBe('#7C5CFF');
  });

  it('expresses violet in OKLCh with a sensible hue and chroma', () => {
    const oklch = rgbToOklch(hexToRgb('#7C5CFF'));
    expect(oklch.lightness).toBeGreaterThan(0.5);
    expect(oklch.chroma).toBeGreaterThan(0.15);
    expect(oklch.hue).toBeGreaterThan(270);
    expect(oklch.hue).toBeLessThan(310);
  });

  it('keeps an sRGB colour in range when expressed in the wider P3 gamut', () => {
    const p3 = rgbToDisplayP3(hexToRgb('#FF7A5C'));
    for (const channel of [p3.red, p3.green, p3.blue]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(255);
    }
    // A saturated sRGB colour sits inside P3, so its P3 coordinates are less extreme.
    expect(p3.red).toBeLessThan(255);
  });

  it('gives CIELAB white a lightness of 100', () => {
    expect(rgbToLab({ red: 255, green: 255, blue: 255 }).lightness).toBeCloseTo(100, 2);
    expect(rgbToLab({ red: 0, green: 0, blue: 0 }).lightness).toBeCloseTo(0, 6);
  });
});

describe('colour vision simulation', () => {
  it('collapses red and green towards each other for a deuteranope', () => {
    // The point of the simulation: a pair a trichromat reads as two colours
    // becomes one. If ΔE00 did not shrink, the chip would be decoration.
    const before = hexDeltaE00('#D62828', '#2A9D3F');
    const after = hexDeltaE00(
      simulateVisionHex('#D62828', 'deuter'),
      simulateVisionHex('#2A9D3F', 'deuter'),
    );
    expect(after).toBeLessThan(before / 2);
  });

  it('leaves a blue-yellow pair largely intact for a deuteranope but not a tritanope', () => {
    const before = hexDeltaE00('#1D4ED8', '#FFC24A');
    const deuter = hexDeltaE00(
      simulateVisionHex('#1D4ED8', 'deuter'),
      simulateVisionHex('#FFC24A', 'deuter'),
    );
    const tritan = hexDeltaE00(
      simulateVisionHex('#1D4ED8', 'tritan'),
      simulateVisionHex('#FFC24A', 'tritan'),
    );
    expect(deuter).toBeGreaterThan(before * 0.7);
    expect(tritan).toBeLessThan(deuter);
  });

  it('leaves greys untouched under every dichromat matrix', () => {
    for (const simulation of ['deuter', 'protan', 'tritan', 'grey'] as const) {
      // A neutral has no chromatic content to project, so it must survive
      // unchanged — a matrix that tints grey has a normalisation error.
      expect(hexDeltaE00(simulateVisionHex('#808080', simulation), '#808080')).toBeLessThan(1);
    }
  });

  it('makes greyscale drop chroma to nothing while holding lightness', () => {
    const grey = simulateVisionHex('#7C5CFF', 'grey');
    const { red, green, blue } = hexToRgb(grey);
    expect(red).toBe(green);
    expect(green).toBe(blue);
  });
});
