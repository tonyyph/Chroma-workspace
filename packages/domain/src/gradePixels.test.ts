import { describe, expect, it } from 'vitest';
import {
  applyGradeToPixel,
  applyGradeToRgba,
  resolveGrade,
  vignetteFactor,
  type LinearRgb,
} from './gradePixels';
import { gradeForAtmosphere, NEUTRAL_GRADE, type Grade } from './grading';

/**
 * The reference the GPU shader is transcribed from. If these change, the SkSL in
 * `apps/mobile/src/lib/grade` is wrong until it changes with them.
 */

const neutral = resolveGrade(NEUTRAL_GRADE);
const grey: LinearRgb = { r: 0.5, g: 0.5, b: 0.5 };
const close = (actual: number, expected: number, tolerance = 0.002) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe('resolveGrade', () => {
  it('turns a hue into a colour once, so both renderers get the same numbers', () => {
    const resolved = resolveGrade({ ...NEUTRAL_GRADE, shadowTint: { hue: 245, strength: 0.4 } });
    // A blue tint has more blue in it than red. That is the whole claim.
    expect(resolved.shadowTintColor.b).toBeGreaterThan(resolved.shadowTintColor.r);
    expect(resolved.shadowTintStrength).toBe(0.4);
  });

  it('resolves an amber hue warm', () => {
    const resolved = resolveGrade({ ...NEUTRAL_GRADE, highlightTint: { hue: 40, strength: 0.3 } });
    expect(resolved.highlightTintColor.r).toBeGreaterThan(resolved.highlightTintColor.b);
  });

  it('keeps every resolved channel inside the unit range', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      const resolved = resolveGrade({ ...NEUTRAL_GRADE, shadowTint: { hue, strength: 1 } });
      for (const channel of [
        resolved.shadowTintColor.r,
        resolved.shadowTintColor.g,
        resolved.shadowTintColor.b,
      ]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('applyGradeToPixel', () => {
  it('leaves a pixel alone under the neutral grade', () => {
    const out = applyGradeToPixel(grey, neutral);
    close(out.r, 0.5);
    close(out.g, 0.5);
    close(out.b, 0.5);
  });

  it('never leaves the unit range, whatever the grade', () => {
    const extreme = resolveGrade({
      exposure: 1,
      contrast: 1,
      lift: 0.2,
      saturation: 1,
      temperature: 1,
      tint: 1,
      shadowTint: { hue: 245, strength: 1 },
      highlightTint: { hue: 40, strength: 1 },
      vignette: 1,
      grain: 1,
    });
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      const out = applyGradeToPixel({ r: value, g: value, b: value }, extreme);
      for (const channel of [out.r, out.g, out.b]) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('brightens with positive exposure and darkens with negative', () => {
    const up = applyGradeToPixel(grey, resolveGrade({ ...NEUTRAL_GRADE, exposure: 0.5 }));
    const down = applyGradeToPixel(grey, resolveGrade({ ...NEUTRAL_GRADE, exposure: -0.5 }));
    expect(up.r).toBeGreaterThan(0.5);
    expect(down.r).toBeLessThan(0.5);
  });

  it('applies exposure in linear light', () => {
    // +0.5 is one stop, which doubles the linear value. Mid grey 0.5 encoded is
    // 0.2140 linear; doubled is 0.4280 linear, which encodes to about 0.6866.
    const out = applyGradeToPixel(grey, resolveGrade({ ...NEUTRAL_GRADE, exposure: 0.5 }));
    close(out.r, 0.6866, 0.004);
  });

  it('lifts the black point without touching white', () => {
    const lifted = resolveGrade({ ...NEUTRAL_GRADE, lift: 0.1 });
    const black = applyGradeToPixel({ r: 0, g: 0, b: 0 }, lifted);
    const white = applyGradeToPixel({ r: 1, g: 1, b: 1 }, lifted);
    close(black.r, 0.1);
    close(white.r, 1);
  });

  it('crushes below zero when lift is negative', () => {
    const crushed = resolveGrade({ ...NEUTRAL_GRADE, lift: -0.1 });
    const shadow = applyGradeToPixel({ r: 0.05, g: 0.05, b: 0.05 }, crushed);
    expect(shadow.r).toBe(0);
  });

  it('steepens the middle without clipping either end', () => {
    const hard = resolveGrade({ ...NEUTRAL_GRADE, contrast: 1 });
    const low = applyGradeToPixel({ r: 0.25, g: 0.25, b: 0.25 }, hard);
    const high = applyGradeToPixel({ r: 0.75, g: 0.75, b: 0.75 }, hard);
    const mid = applyGradeToPixel(grey, hard);
    expect(low.r).toBeLessThan(0.25);
    expect(high.r).toBeGreaterThan(0.75);
    close(mid.r, 0.5, 0.01);
    // Never clips: an S-curve, not a slope.
    expect(applyGradeToPixel({ r: 1, g: 1, b: 1 }, hard).r).toBeLessThanOrEqual(1);
  });

  it('flattens toward mid grey with negative contrast', () => {
    const flat = resolveGrade({ ...NEUTRAL_GRADE, contrast: -1 });
    const dark = applyGradeToPixel({ r: 0, g: 0, b: 0 }, flat);
    const light = applyGradeToPixel({ r: 1, g: 1, b: 1 }, flat);
    expect(dark.r).toBeGreaterThan(0);
    expect(light.r).toBeLessThan(1);
  });

  it('warms by raising red against blue', () => {
    const warm = applyGradeToPixel(grey, resolveGrade({ ...NEUTRAL_GRADE, temperature: 0.8 }));
    expect(warm.r).toBeGreaterThan(warm.b);

    const cool = applyGradeToPixel(grey, resolveGrade({ ...NEUTRAL_GRADE, temperature: -0.8 }));
    expect(cool.b).toBeGreaterThan(cool.r);
  });

  it('leaves a grey pixel grey when only saturation moves', () => {
    // Saturation works about the pixel's own luma, so a neutral pixel has
    // nothing to push away from.
    const out = applyGradeToPixel(grey, resolveGrade({ ...NEUTRAL_GRADE, saturation: 1 }));
    close(out.r, out.g);
    close(out.g, out.b);
  });

  it('pushes a coloured pixel further from its luma, and desaturation toward it', () => {
    const red: LinearRgb = { r: 0.8, g: 0.3, b: 0.3 };
    const up = applyGradeToPixel(red, resolveGrade({ ...NEUTRAL_GRADE, saturation: 0.5 }));
    const down = applyGradeToPixel(red, resolveGrade({ ...NEUTRAL_GRADE, saturation: -1 }));
    expect(up.r - up.g).toBeGreaterThan(red.r - red.g);
    close(down.r, down.g, 0.01);
  });

  it('puts a shadow tint in the shadows and not in the highlights', () => {
    const graded = resolveGrade({ ...NEUTRAL_GRADE, shadowTint: { hue: 245, strength: 1 } });
    const shadow = applyGradeToPixel({ r: 0.1, g: 0.1, b: 0.1 }, graded);
    const highlight = applyGradeToPixel({ r: 0.95, g: 0.95, b: 0.95 }, graded);

    expect(shadow.b - shadow.r).toBeGreaterThan(0.02);
    close(highlight.b - highlight.r, 0, 0.01);
  });

  it('puts a highlight tint in the highlights and not in the shadows', () => {
    const graded = resolveGrade({ ...NEUTRAL_GRADE, highlightTint: { hue: 40, strength: 1 } });
    const shadow = applyGradeToPixel({ r: 0.05, g: 0.05, b: 0.05 }, graded);
    const highlight = applyGradeToPixel({ r: 0.9, g: 0.9, b: 0.9 }, graded);

    expect(highlight.r - highlight.b).toBeGreaterThan(0.02);
    close(shadow.r - shadow.b, 0, 0.01);
  });

  it('applies every derived grade without leaving the range', () => {
    const moods = [
      'serene',
      'tender',
      'luminous',
      'vivid',
      'nocturnal',
      'melancholy',
      'earthy',
      'stark',
    ] as const;
    for (const mood of moods) {
      const grade: Grade = gradeForAtmosphere({
        luminosity: 0.5,
        warmth: 0,
        saturation: 0.45,
        contrast: 0.5,
        spread: 0.4,
        coherence: 0.8,
        mood,
      });
      const resolved = resolveGrade(grade);
      for (const value of [0, 0.5, 1]) {
        const out = applyGradeToPixel({ r: value, g: value, b: value }, resolved);
        for (const channel of [out.r, out.g, out.b]) {
          expect(Number.isFinite(channel)).toBe(true);
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe('vignetteFactor', () => {
  it('does nothing at all when the amount is zero', () => {
    expect(vignetteFactor(0, 0, 100, 100, 0)).toBe(1);
  });

  it('leaves the centre untouched', () => {
    close(vignetteFactor(50, 50, 100, 100, 1), 1);
  });

  it('darkens toward the corner', () => {
    const corner = vignetteFactor(0, 0, 100, 100, 1);
    const middle = vignetteFactor(50, 50, 100, 100, 1);
    expect(corner).toBeLessThan(middle);
  });

  it('never blacks a corner out — a hole is not a grade', () => {
    expect(vignetteFactor(0, 0, 100, 100, 1)).toBeGreaterThan(0.3);
  });

  it('is symmetric about the centre', () => {
    close(vignetteFactor(0, 0, 100, 100, 0.5), vignetteFactor(100, 100, 100, 100, 0.5));
  });

  it('survives a degenerate frame', () => {
    expect(vignetteFactor(0, 0, 0, 0, 1)).toBe(1);
  });
});

describe('applyGradeToRgba', () => {
  const buffer = (pixels: readonly (readonly [number, number, number, number])[]) =>
    Uint8Array.from(pixels.flat());

  it('carries alpha through untouched — a grade changes colour, never coverage', () => {
    const rgba = buffer([
      [10, 20, 30, 128],
      [200, 100, 50, 255],
      [0, 0, 0, 0],
      [255, 255, 255, 64],
    ]);
    const out = applyGradeToRgba(rgba, 2, 2, resolveGrade({ ...NEUTRAL_GRADE, saturation: 1 }));
    expect([out[3], out[7], out[11], out[15]]).toEqual([128, 255, 0, 64]);
  });

  it('returns the same buffer size', () => {
    const rgba = new Uint8Array(4 * 16);
    expect(applyGradeToRgba(rgba, 4, 4, neutral).length).toBe(rgba.length);
  });

  it('leaves an image unchanged under the neutral grade', () => {
    const rgba = buffer([
      [10, 20, 30, 255],
      [200, 100, 50, 255],
    ]);
    const out = applyGradeToRgba(rgba, 2, 1, neutral);
    for (let index = 0; index < rgba.length; index += 1) {
      expect(Math.abs((out[index] ?? 0) - (rgba[index] ?? 0))).toBeLessThanOrEqual(1);
    }
  });

  it('darkens the corners when the grade carries a vignette', () => {
    const size = 9;
    const rgba = new Uint8Array(size * size * 4).fill(180);
    for (let index = 3; index < rgba.length; index += 4) rgba[index] = 255;

    const out = applyGradeToRgba(rgba, size, size, resolveGrade({ ...NEUTRAL_GRADE, vignette: 1 }));
    const centre = out[(4 * size + 4) * 4] ?? 0;
    const corner = out[0] ?? 0;
    expect(corner).toBeLessThan(centre);
  });
});

describe('the pixel-centre convention', () => {
  it('samples the vignette at pixel centres, the way a GPU does', () => {
    // Half a pixel is worth seventeen 8-bit steps at the corner of a small
    // image, which is how the shader caught this: a corner pixel of a 16-wide
    // frame sits at 0.5, not at 0, so its vignette is not the full corner value.
    const size = 16;
    const rgba = new Uint8Array(size * size * 4).fill(200);
    for (let index = 3; index < rgba.length; index += 4) rgba[index] = 255;

    const out = applyGradeToRgba(rgba, size, size, resolveGrade({ ...NEUTRAL_GRADE, vignette: 1 }));

    const atCentres = 200 * vignetteFactor(0.5, 0.5, size, size, 1);
    const atCorners = 200 * vignetteFactor(0, 0, size, size, 1);
    expect(Math.abs((out[0] ?? 0) - atCentres)).toBeLessThanOrEqual(1);
    expect(Math.abs((out[0] ?? 0) - atCorners)).toBeGreaterThan(10);
  });
});
