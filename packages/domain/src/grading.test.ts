import { describe, expect, it } from 'vitest';
import { readAtmosphere, type AtmosphereMood, type AtmosphereReading } from './atmosphere';
import { makeColor } from './palette';
import {
  describeGrade,
  gradesEqual,
  gradeForAtmosphere,
  gradeSchema,
  NEUTRAL_GRADE,
  type Grade,
  scaleGrade,
} from './grading';

/**
 * A grade is judged by eye in the end, which is exactly why the arithmetic
 * behind it has to be pinned down here: everything below is a claim that can be
 * wrong, stated as a threshold rather than as a screenshot.
 */

const reading = (overrides: Partial<AtmosphereReading> = {}): AtmosphereReading => ({
  luminosity: 0.5,
  warmth: 0,
  saturation: 0.45,
  contrast: 0.5,
  spread: 0.4,
  coherence: 0.8,
  mood: 'serene',
  ...overrides,
});

const MOODS: readonly AtmosphereMood[] = [
  'serene',
  'tender',
  'luminous',
  'vivid',
  'nocturnal',
  'melancholy',
  'earthy',
  'stark',
];

describe('gradeForAtmosphere', () => {
  it('produces a schema-valid grade for every mood', () => {
    for (const mood of MOODS) {
      expect(() => gradeSchema.parse(gradeForAtmosphere(reading({ mood })))).not.toThrow();
    }
  });

  it('is deterministic', () => {
    expect(gradeForAtmosphere(reading({ mood: 'vivid' }))).toEqual(
      gradeForAtmosphere(reading({ mood: 'vivid' })),
    );
  });

  it('stays valid at every extreme of the reading', () => {
    const extremes: AtmosphereReading[] = [];
    for (const mood of MOODS) {
      for (const luminosity of [0, 1]) {
        for (const warmth of [-1, 1]) {
          for (const saturation of [0, 1]) {
            for (const contrast of [0, 1]) {
              extremes.push(
                reading({
                  mood,
                  luminosity,
                  warmth,
                  saturation,
                  contrast,
                  spread: 1,
                  coherence: 0,
                }),
              );
            }
          }
        }
      }
    }
    for (const extreme of extremes) {
      expect(() => gradeSchema.parse(gradeForAtmosphere(extreme))).not.toThrow();
    }
  });

  it('gives exposure back to a dark scene and takes it from a bright one', () => {
    const dark = gradeForAtmosphere(reading({ luminosity: 0 }));
    const bright = gradeForAtmosphere(reading({ luminosity: 1 }));
    expect(dark.exposure).toBeGreaterThan(bright.exposure);
  });

  it('adds less contrast to a scene that already carries its own', () => {
    const flat = gradeForAtmosphere(reading({ contrast: 0 }));
    const punchy = gradeForAtmosphere(reading({ contrast: 1 }));
    expect(flat.contrast).toBeGreaterThan(punchy.contrast);
  });

  it('pulls saturation back on a loud scene and lifts a muted one', () => {
    const loud = gradeForAtmosphere(reading({ saturation: 1 }));
    const muted = gradeForAtmosphere(reading({ saturation: 0 }));
    expect(muted.saturation).toBeGreaterThan(loud.saturation);
  });

  it('leans with the scene rather than correcting it', () => {
    // A warm room graded cool stops being that room.
    const warm = gradeForAtmosphere(reading({ warmth: 1 }));
    const cool = gradeForAtmosphere(reading({ warmth: -1 }));
    expect(warm.temperature).toBeGreaterThan(cool.temperature);
  });

  it('holds grain back on a scene that did not cluster tightly', () => {
    // Grain on top of noise is mud.
    const noisy = gradeForAtmosphere(reading({ mood: 'nocturnal', coherence: 0 }));
    const clean = gradeForAtmosphere(reading({ mood: 'nocturnal', coherence: 1 }));
    expect(noisy.grain).toBeLessThan(clean.grain);
  });

  it('eases the vignette on a palette that spans a wide range', () => {
    const wide = gradeForAtmosphere(reading({ mood: 'nocturnal', spread: 1 }));
    const narrow = gradeForAtmosphere(reading({ mood: 'nocturnal', spread: 0 }));
    expect(wide.vignette).toBeLessThan(narrow.vignette);
  });

  it('grades the dark moods darker than the bright ones', () => {
    const nocturnal = gradeForAtmosphere(reading({ mood: 'nocturnal' }));
    const luminous = gradeForAtmosphere(reading({ mood: 'luminous' }));
    expect(nocturnal.exposure).toBeLessThan(luminous.exposure);
    expect(nocturnal.temperature).toBeLessThan(luminous.temperature);
  });

  it('takes colour out of a stark scene and leaves it in a vivid one', () => {
    const stark = gradeForAtmosphere(reading({ mood: 'stark' }));
    const vivid = gradeForAtmosphere(reading({ mood: 'vivid' }));
    expect(stark.saturation).toBeLessThan(vivid.saturation);
  });

  it('rounds every parameter so a grade round-trips through storage', () => {
    const grade = gradeForAtmosphere(reading({ mood: 'tender', luminosity: 0.37 }));
    for (const value of [grade.exposure, grade.contrast, grade.saturation, grade.temperature]) {
      expect(value).toBe(Math.round(value * 1000) / 1000);
    }
  });

  it('works end to end from a real palette', () => {
    const palette = [
      makeColor('#0B0A16', 0.5, 'dominant'),
      makeColor('#7C5CFF', 0.3, 'support'),
      makeColor('#22D3EE', 0.2, 'signal'),
    ];
    const grade = gradeForAtmosphere(readAtmosphere(palette, 2.4));
    expect(() => gradeSchema.parse(grade)).not.toThrow();
  });
});

describe('describeGrade', () => {
  it('says "untouched" rather than inventing a term for nothing', () => {
    expect(describeGrade(NEUTRAL_GRADE)).toEqual(['untouched']);
  });

  it('names the direction of each term it reports', () => {
    const warm: Grade = { ...NEUTRAL_GRADE, temperature: 0.4, exposure: 0.3 };
    expect(describeGrade(warm)).toContain('warmer');
    expect(describeGrade(warm)).toContain('brighter');

    const cool: Grade = { ...NEUTRAL_GRADE, temperature: -0.4, exposure: -0.3 };
    expect(describeGrade(cool)).toContain('cooler');
    expect(describeGrade(cool)).toContain('darker');
  });

  it('names a split tone by its hue', () => {
    const graded: Grade = {
      ...NEUTRAL_GRADE,
      shadowTint: { hue: 245, strength: 0.3 },
      highlightTint: { hue: 40, strength: 0.25 },
    };
    expect(describeGrade(graded)).toContain('blue shadows');
    expect(describeGrade(graded)).toContain('amber highlights');
  });

  it('stays quiet about a tint too weak to see', () => {
    const graded: Grade = { ...NEUTRAL_GRADE, shadowTint: { hue: 245, strength: 0.05 } };
    expect(describeGrade(graded)).toEqual(['untouched']);
  });

  it('describes every derived grade in words', () => {
    for (const mood of MOODS) {
      const terms = describeGrade(gradeForAtmosphere(reading({ mood })));
      expect(terms.length).toBeGreaterThan(0);
      for (const term of terms) expect(term).not.toBe('');
    }
  });
});

/**
 * A grade with every kind of parameter switched on, written out here rather
 * than taken from the look library.
 *
 * The catalogue is data that will keep changing; what this file tests is the
 * arithmetic. Reaching into `LOOKS` for a fixture would make an editorial edit
 * able to break a test about `scaleGrade`, which is a coupling nobody wants to
 * debug at the moment they are adding a look.
 */
const LOADED: Grade = {
  ...NEUTRAL_GRADE,
  exposure: -0.08,
  contrast: 0.16,
  lift: 0.1,
  temperature: -0.24,
  saturation: 0.06,
  shadowTint: { hue: 250, strength: 0.28 },
  highlightTint: { hue: 15, strength: 0.22 },
  vignette: 0.24,
  grain: 0.26,
};

describe('gradesEqual', () => {
  it('matches a grade against a copy of itself', () => {
    // A stored grade is a different object holding the same numbers; a picker
    // comparing references would show nothing selected after a reload.
    expect(gradesEqual(LOADED, JSON.parse(JSON.stringify(LOADED)) as Grade)).toBe(true);
  });

  it('separates two different looks', () => {
    expect(gradesEqual(LOADED, { ...LOADED, contrast: 0.32 })).toBe(false);
  });

  it('notices a change in any single parameter', () => {
    for (const change of [
      { exposure: 0.5 },
      { contrast: 0.5 },
      { lift: 0.1 },
      { saturation: 0.5 },
      { temperature: 0.5 },
      { tint: 0.5 },
      { vignette: 0.5 },
      { grain: 0.5 },
      { shadowTint: { hue: 200, strength: 0.5 } },
      { highlightTint: { hue: 40, strength: 0.5 } },
    ]) {
      expect(gradesEqual(NEUTRAL_GRADE, { ...NEUTRAL_GRADE, ...change })).toBe(false);
    }
  });
});

describe('scaleGrade', () => {
  const look = LOADED;

  it('returns the grade unchanged at full strength', () => {
    expect(scaleGrade(look, 1)).toEqual(look);
  });

  it('returns the neutral grade at zero', () => {
    expect(scaleGrade(look, 0)).toEqual(NEUTRAL_GRADE);
  });

  it('lands halfway between at a half', () => {
    const half = scaleGrade(look, 0.5);
    expect(half.temperature).toBeCloseTo(look.temperature / 2, 3);
    expect(half.contrast).toBeCloseTo(look.contrast / 2, 3);
    expect(half.grain).toBeCloseTo(look.grain / 2, 3);
  });

  /**
   * The one rule that is not "multiply everything".
   *
   * A hue is a position on a circle, and interpolating one towards zero takes
   * the wrong way round: a blue shadow at 250° would pass through green, amber
   * and red on its way to nothing. The hue is already correct at every strength;
   * it is the strength that means "how much of it".
   */
  it('weakens a tint without moving its hue', () => {
    const half = scaleGrade(look, 0.5);
    expect(half.shadowTint.hue).toBe(look.shadowTint.hue);
    expect(half.highlightTint.hue).toBe(look.highlightTint.hue);
    expect(half.shadowTint.strength).toBeCloseTo(look.shadowTint.strength / 2, 3);
  });

  it('clamps an amount outside the range rather than producing an invalid grade', () => {
    expect(scaleGrade(look, 2)).toEqual(look);
    expect(scaleGrade(look, -1)).toEqual(NEUTRAL_GRADE);
  });

  // Scaling every look in the catalogue is asserted in `looks.test.ts`, where
  // the catalogue lives. This file owns the arithmetic, not the contents.
  it('produces a schema-valid grade at every point across the range', () => {
    for (const amount of [0, 0.13, 0.5, 0.87, 1]) {
      expect(() => gradeSchema.parse(scaleGrade(LOADED, amount))).not.toThrow();
    }
  });

  it('is describable at full strength and untouched at zero', () => {
    expect(describeGrade(scaleGrade(look, 0))).toEqual(['untouched']);
    expect(describeGrade(scaleGrade(look, 1))).not.toEqual(['untouched']);
  });
});
