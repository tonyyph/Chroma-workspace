import { describe, expect, it } from 'vitest';
import { readAtmosphere, type AtmosphereMood, type AtmosphereReading } from './atmosphere';
import { makeColor } from './palette';
import {
  describeGrade,
  gradeForAtmosphere,
  gradeSchema,
  NEUTRAL_GRADE,
  type Grade,
  FILM_STOCKS,
  filmStock,
  filmStockIds,
  type FilmStockId,
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

describe('FILM_STOCKS', () => {
  it('are grades, not a separate kind of thing', () => {
    for (const stock of FILM_STOCKS) {
      expect(() => gradeSchema.parse(stock.grade)).not.toThrow();
    }
  });

  it('name every id exactly once', () => {
    expect(FILM_STOCKS.map((stock) => stock.id)).toEqual([...filmStockIds]);
    expect(new Set(FILM_STOCKS.map((stock) => stock.id)).size).toBe(filmStockIds.length);
  });

  it('are each distinguishable from neutral', () => {
    for (const stock of FILM_STOCKS) {
      expect(describeGrade(stock.grade)).not.toEqual(['untouched']);
    }
  });

  it('look up by id, and refuse an unknown one', () => {
    expect(filmStock('portra')?.name).toBe('Warm skin');
    expect(filmStock('nope' as FilmStockId)).toBeNull();
  });

  it('offer looks that actually differ from each other', () => {
    const described = FILM_STOCKS.map((stock) => describeGrade(stock.grade).join(', '));
    expect(new Set(described).size).toBe(FILM_STOCKS.length);
  });
});
