/**
 * The rule that a palette's weights sum to exactly one.
 *
 * Weights are stored rounded to three decimal places, and rounding five numbers
 * independently does not leave them summing to one. The schema requires that it
 * does, so the remainder has to land somewhere: it rides on the dominant swatch,
 * the largest of them, where a thousandth is invisible.
 *
 * This lives in its own module, depending on nothing, because both sides of the
 * domain need it. `color` cannot import from `palette` — `palette` needs
 * `color`'s conversions, and the two would form a require cycle.
 */

/** Weights are stored to three decimal places. */
const PLACES = 1000;

const round = (value: number) => Math.round(value * PLACES) / PLACES;

/**
 * Rounds every weight for storage and puts the rounding remainder on the first
 * item, so the set still sums to one.
 *
 * Generic over anything carrying a `weight`: the extractor applies it to swatches
 * it builds by hand, and the palette builders apply it to `Color`s.
 */
export function withExactWeights<T extends { weight: number }>(items: readonly T[]): T[] {
  const rounded = items.map((item) => ({ ...item, weight: round(item.weight) }));
  const first = rounded[0];
  if (!first) return rounded;

  const drift = 1 - rounded.reduce((sum, item) => sum + item.weight, 0);
  rounded[0] = { ...first, weight: round(first.weight + drift) };
  return rounded;
}

/** Turns a set of proportions into weights that sum to one. */
export const asProportions = (ratios: readonly number[]): number[] => {
  const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
  // A zero total would divide every weight into NaN, which the schema rejects
  // far away from here with a message about the palette rather than the input.
  if (total === 0) return ratios.map(() => 0);
  return ratios.map((ratio) => round(ratio / total));
};
