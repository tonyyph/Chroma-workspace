import { describe, expect, it } from 'vitest';
import { asProportions, withExactWeights } from './weights';

/**
 * The invariant these guard is the schema's: a palette's weights sum to one.
 * Four call sites used to carry their own copy of this arithmetic, which is how
 * two of them ended up rounding the remainder onto a different swatch.
 */

const sum = (items: readonly { weight: number }[]) =>
  items.reduce((total, item) => total + item.weight, 0);

describe('withExactWeights', () => {
  it('leaves a set that already sums to one alone', () => {
    const items = [{ weight: 0.5 }, { weight: 0.3 }, { weight: 0.2 }];
    expect(withExactWeights(items)).toEqual(items);
  });

  it('rounds to three places and lands the remainder on the first', () => {
    // Three equal thirds round to 0.333 each and sum to 0.999.
    const third = 1 / 3;
    const result = withExactWeights([{ weight: third }, { weight: third }, { weight: third }]);

    expect(result.map((item) => item.weight)).toEqual([0.334, 0.333, 0.333]);
    expect(sum(result)).toBe(1);
  });

  it('sums to one across every count a palette can hold', () => {
    for (let count = 1; count <= 8; count += 1) {
      const even = Array.from({ length: count }, () => ({ weight: 1 / count }));
      expect(sum(withExactWeights(even))).toBe(1);
    }
  });

  it('preserves the other fields', () => {
    const result = withExactWeights([{ weight: 1, hex: '#7C5CFF' }]);
    expect(result[0]?.hex).toBe('#7C5CFF');
  });

  it('does not mutate its input', () => {
    const items = [{ weight: 1 / 3 }, { weight: 1 / 3 }, { weight: 1 / 3 }];
    withExactWeights(items);
    expect(items[0]?.weight).toBe(1 / 3);
  });

  it('returns nothing for nothing', () => {
    expect(withExactWeights([])).toEqual([]);
  });
});

describe('asProportions', () => {
  it('turns flex ratios into weights', () => {
    expect(asProportions([2, 1, 1])).toEqual([0.5, 0.25, 0.25]);
  });

  it('is scale-free', () => {
    expect(asProportions([40, 20, 20])).toEqual(asProportions([2, 1, 1]));
  });

  it('yields zeroes rather than NaN when there is nothing to divide', () => {
    expect(asProportions([0, 0])).toEqual([0, 0]);
  });
});
