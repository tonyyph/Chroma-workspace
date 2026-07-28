import { describe, expect, it } from 'vitest';

import {
  classifyPaletteMood,
  contrastRatio,
  extractPaletteFromRgba,
  rgbToHex,
  safeForegroundFor,
} from './color';

const image = (colors: readonly [number, number, number][]): Uint8Array =>
  Uint8Array.from(colors.flatMap(([red, green, blue]) => [red, green, blue, 255]));

describe('color science', () => {
  it('formats RGB as canonical uppercase hex', () => {
    expect(rgbToHex({ red: 255, green: 128, blue: 0 })).toBe('#FF8000');
  });

  it('extracts deterministic weighted colors', () => {
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

  it('classifies expressive and quiet metrics', () => {
    expect(
      classifyPaletteMood({
        brightness: 55,
        saturation: 0.8,
        temperature: 0,
        contrast: 70,
      }),
    ).toBe('energetic');
    expect(
      classifyPaletteMood({
        brightness: 68,
        saturation: 0.08,
        temperature: 0,
        contrast: 12,
      }),
    ).toBe('calm');
  });

  it('chooses a foreground with strong contrast', () => {
    expect(safeForegroundFor('#FFE06A')).toBe('#09090B');
    expect(safeForegroundFor('#15111F')).toBe('#FFFFFF');
    expect(contrastRatio(safeForegroundFor('#6E44FF'), '#6E44FF')).toBeGreaterThan(4.5);
  });
});
