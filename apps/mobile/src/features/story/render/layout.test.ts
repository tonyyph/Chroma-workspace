import { makeColor, type Color } from '@cw/domain';
import { alignX, paletteBands, textBlockTop } from './layout';

const colors = (...weights: readonly number[]): readonly Color[] =>
  weights.map((weight, index) =>
    makeColor(index % 2 === 0 ? '#7C5CFF' : '#22D3EE', weight, index === 0 ? 'dominant' : 'extra'),
  );

describe('paletteBands', () => {
  it('lays bands end to end with no gap and no overlap', () => {
    const bands = paletteBands(colors(0.5, 0.3, 0.2), 1000, true);

    expect(bands).toHaveLength(3);
    for (let index = 0; index < bands.length - 1; index += 1) {
      const current = bands[index];
      const next = bands[index + 1];
      expect(next?.offset).toBe((current?.offset ?? 0) + (current?.length ?? 0));
    }
  });

  it('ends exactly at the span, whatever the weights rounded to', () => {
    // Weights that cannot be represented exactly: 1/3 three times.
    const third = 1 / 3;
    const bands = paletteBands(colors(third, third, third), 1080, true);
    const last = bands[bands.length - 1];

    // The seam this prevents is a sub-pixel strip of background down the edge of
    // the palette, which at export resolution is visible.
    expect((last?.offset ?? 0) + (last?.length ?? 0)).toBe(1080);
  });

  it('ends exactly at the span even when weights sum slightly under one', () => {
    // The schema tolerates ±0.02; the last band must still close the strip.
    const bands = paletteBands(colors(0.5, 0.29), 1000, true);
    const last = bands[bands.length - 1];
    expect((last?.offset ?? 0) + (last?.length ?? 0)).toBe(1000);
  });

  it('divides evenly when weighting is turned off', () => {
    const bands = paletteBands(colors(0.7, 0.2, 0.1), 900, false);
    expect(bands[0]?.length).toBeCloseTo(300);
    expect(bands[1]?.length).toBeCloseTo(300);
    expect(bands[2]?.length).toBeCloseTo(300);
  });

  it('uses true proportions when weighting is on', () => {
    const bands = paletteBands(colors(0.7, 0.2, 0.1), 1000, true);
    expect(bands[0]?.length).toBeCloseTo(700);
    expect(bands[1]?.length).toBeCloseTo(200);
  });

  it('carries each colour through unchanged', () => {
    expect(paletteBands(colors(0.6, 0.4), 100, true).map((band) => band.hex)).toEqual([
      '#7C5CFF',
      '#22D3EE',
    ]);
  });

  it('returns nothing for an empty palette or a zero span', () => {
    expect(paletteBands([], 100, true)).toEqual([]);
    expect(paletteBands(colors(0.5, 0.5), 0, true)).toEqual([]);
    expect(paletteBands(colors(0.5, 0.5), -10, true)).toEqual([]);
  });

  it('gives a single colour the whole span', () => {
    const bands = paletteBands(colors(1), 500, true);
    expect(bands).toEqual([{ hex: '#7C5CFF', offset: 0, length: 500 }]);
  });
});

describe('alignX', () => {
  it('places left-aligned text at the frame edge', () => {
    expect(alignX('left', 100, 400, 120)).toBe(100);
  });

  it('places right-aligned text so it ends at the frame edge', () => {
    // The case that is easy to get wrong by a whole text width.
    expect(alignX('right', 100, 400, 120)).toBe(380);
    expect(alignX('right', 100, 400, 120) + 120).toBe(500);
  });

  it('centres text within the frame', () => {
    expect(alignX('center', 100, 400, 120)).toBe(240);
  });

  it('lets text wider than its frame overflow symmetrically when centred', () => {
    expect(alignX('center', 0, 100, 200)).toBe(-50);
  });
});

describe('textBlockTop', () => {
  it('centres a block that fits', () => {
    expect(textBlockTop(100, 400, 200)).toBe(200);
  });

  it('pins a block taller than its frame to the top rather than centring it', () => {
    // Centring would push the first line above the frame, where it is the part
    // that gets cut off — and the first line is the one that must stay readable.
    expect(textBlockTop(100, 100, 400)).toBe(100);
  });

  it('handles a block exactly as tall as its frame', () => {
    expect(textBlockTop(50, 300, 300)).toBe(50);
  });
});
