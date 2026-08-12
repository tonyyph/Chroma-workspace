import { describe, expect, it } from 'vitest';

import {
  atmosphereMoods,
  atmosphereReadingSchema,
  describeAtmosphere,
  moodFor,
  moodTable,
  readAtmosphere,
  type AtmosphereReading,
} from './atmosphere';
import { makeColor, type Color } from './palette';

/** Weights sum to one, as every real palette's do. */
const palette = (...entries: [string, number][]): Color[] =>
  entries.map(([hex, weight], index) =>
    makeColor(hex, weight, index === 0 ? 'dominant' : index === 1 ? 'support' : 'signal'),
  );

describe('readAtmosphere', () => {
  it('is total: any two-colour palette produces a valid reading', () => {
    const cases = [
      palette(['#000000', 0.5], ['#FFFFFF', 0.5]),
      palette(['#FFFFFF', 0.5], ['#FFFFFF', 0.5]),
      palette(['#FF0000', 0.9], ['#00FF00', 0.1]),
      palette(['#808080', 0.34], ['#7F7F7F', 0.33], ['#818181', 0.33]),
    ];
    for (const colors of cases) {
      expect(atmosphereReadingSchema.safeParse(readAtmosphere(colors)).success).toBe(true);
    }
  });

  it('reads a bright warm palette as luminous and warm', () => {
    const reading = readAtmosphere(palette(['#FFE8C8', 0.6], ['#FFD9A0', 0.4]));
    expect(reading.luminosity).toBeGreaterThan(0.8);
    expect(reading.warmth).toBeGreaterThan(0.3);
  });

  it('reads a dark cool palette as low luminosity and cool', () => {
    const reading = readAtmosphere(palette(['#0B1230', 0.7], ['#131A3A', 0.3]));
    expect(reading.luminosity).toBeLessThan(0.3);
    expect(reading.warmth).toBeLessThan(0);
  });

  it('weights warmth by area, not by colour count', () => {
    // One cool colour covering almost everything, two warm accents covering
    // almost nothing. Counting colours would call this warm; area says cool.
    const reading = readAtmosphere(
      palette(['#123A8A', 0.92], ['#FF7A2F', 0.04], ['#FFB03A', 0.04]),
    );
    expect(reading.warmth).toBeLessThan(0);
  });

  it('takes contrast from the strongest pair, not the average', () => {
    const withSignal = readAtmosphere(
      palette(['#3A3A3A', 0.48], ['#454545', 0.48], ['#FFFFFF', 0.04]),
    );
    const withoutSignal = readAtmosphere(palette(['#3A3A3A', 0.5], ['#454545', 0.5]));
    expect(withSignal.contrast).toBeGreaterThan(withoutSignal.contrast);
  });

  it('turns the extraction delta into coherence', () => {
    const colors = palette(['#7C5CFF', 0.6], ['#22D3EE', 0.4]);
    expect(readAtmosphere(colors, 0).coherence).toBe(1);
    expect(readAtmosphere(colors, 5).coherence).toBeCloseTo(0.5, 5);
    // Beyond the ceiling coherence floors rather than going negative.
    expect(readAtmosphere(colors, 40).coherence).toBe(0);
  });

  it('is deterministic', () => {
    const colors = palette(['#7C5CFF', 0.38], ['#4A3AA8', 0.34], ['#22D3EE', 0.28]);
    expect(readAtmosphere(colors, 2.4)).toEqual(readAtmosphere(colors, 2.4));
  });

  it('survives an empty colour list rather than dividing by zero', () => {
    const reading = readAtmosphere([]);
    expect(atmosphereReadingSchema.safeParse(reading).success).toBe(true);
    expect(reading.mood).toBe('stark');
  });
});

describe('the mood table', () => {
  it('ends with an unconditional row, so every palette gets a mood', () => {
    const last = moodTable[moodTable.length - 1]!;
    expect(last.mood).toBe('stark');
    expect(
      last.when({
        luminosity: 0.5,
        warmth: 0,
        saturation: 0.5,
        contrast: 0.5,
        spread: 0.5,
        coherence: 0.5,
      }),
    ).toBe(true);
  });

  it('keeps the order the thresholds were written against', () => {
    // A reshuffle would silently re-label every memory already saved, so the
    // order is pinned rather than merely documented.
    expect(moodTable.map((row) => row.mood)).toEqual([
      'nocturnal',
      'melancholy',
      'serene',
      'tender',
      'earthy',
      'luminous',
      'vivid',
      'stark',
    ]);
  });

  it('names every mood in the enum exactly once', () => {
    expect([...moodTable.map((row) => row.mood)].sort()).toEqual([...atmosphereMoods].sort());
  });

  it('resolves each mood at its own thresholds', () => {
    const base = {
      luminosity: 0.5,
      warmth: 0,
      saturation: 0.5,
      contrast: 0.5,
      spread: 0.5,
      coherence: 0.5,
    };
    expect(moodFor({ ...base, luminosity: 0.1 })).toBe('nocturnal');
    expect(moodFor({ ...base, luminosity: 0.3, saturation: 0.2, warmth: -0.4 })).toBe('melancholy');
    expect(moodFor({ ...base, saturation: 0.2, contrast: 0.2 })).toBe('serene');
    expect(moodFor({ ...base, warmth: 0.4, saturation: 0.4, luminosity: 0.7, contrast: 0.6 })).toBe(
      'tender',
    );
    expect(moodFor({ ...base, warmth: 0.3, saturation: 0.4, luminosity: 0.5, contrast: 0.6 })).toBe(
      'earthy',
    );
    // Bright and low-contrast, but too saturated for serene's `< 0.35` gate.
    expect(moodFor({ ...base, luminosity: 0.85, contrast: 0.3, saturation: 0.4 })).toBe('luminous');
    expect(moodFor({ ...base, saturation: 0.8, contrast: 0.6 })).toBe('vivid');
    expect(moodFor({ ...base, contrast: 0.9, saturation: 0.55 })).toBe('stark');
  });

  it('gives nocturnal precedence over melancholy at low light', () => {
    // Both rows match a dark, desaturated, cool palette; the first one wins and
    // that is the intended reading — darkness dominates.
    const dark = {
      luminosity: 0.15,
      warmth: -0.5,
      saturation: 0.1,
      contrast: 0.3,
      spread: 0.2,
      coherence: 0.9,
    };
    expect(moodFor(dark)).toBe('nocturnal');
  });
});

describe('describeAtmosphere', () => {
  const reading = (overrides: Partial<AtmosphereReading> = {}): AtmosphereReading => ({
    luminosity: 0.5,
    warmth: 0,
    saturation: 0.5,
    contrast: 0.5,
    spread: 0.5,
    coherence: 0.8,
    mood: 'serene',
    ...overrides,
  });

  it('is deterministic', () => {
    expect(describeAtmosphere(reading({ mood: 'vivid' }))).toBe(
      describeAtmosphere(reading({ mood: 'vivid' })),
    );
  });

  it('names every mood in the reading', () => {
    for (const mood of atmosphereMoods) {
      expect(describeAtmosphere(reading({ mood }))).toContain(mood);
    }
  });

  it('reports the visible direction of the atmosphere', () => {
    const described = describeAtmosphere(
      reading({
        luminosity: 0.8,
        warmth: 0.4,
        saturation: 0.7,
        contrast: 0.7,
        coherence: 0.2,
        mood: 'luminous',
      }),
    );

    expect(described).toContain('bright');
    expect(described).toContain('warm');
    expect(described).toContain('saturated');
    expect(described).toContain('high contrast');
    expect(described).toContain('restless');
  });
});
