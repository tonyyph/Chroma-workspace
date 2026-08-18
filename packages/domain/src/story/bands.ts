import type { Color } from '../palette';

/**
 * A palette strip, as the geometry that draws it.
 *
 * Lives in the domain rather than in the renderer because it is the *proportions
 * claim* made concrete: the width of each band is how much of the photograph
 * that colour actually was. That is a domain fact, it is the product's central
 * assertion, and it belongs where the invariant that guards it lives.
 */
export type Band = Readonly<{
  hex: string;
  /** Distance from the strip's start, along its axis. */
  offset: number;
  length: number;
  /** 0–1. Motion may change this; it may never change `length`. */
  opacity: number;
}>;

/**
 * The bands, laid end to end with no gap and no overlap.
 *
 * **The last band takes the remainder.** Weights sum to one within a tolerance
 * (`paletteStripElementSchema` allows ±0.02, inherited from the memory palette),
 * and multiplying five fractions by a span will not land exactly on that span.
 * Computing each band from its own weight leaves a sub-pixel gap at the end —
 * which at export resolution is a visible seam of background down the edge of
 * the strip. Accumulating and giving the last band whatever is left makes the
 * strip end exactly where its frame does, whatever the weights did.
 */
export function paletteBands(
  colors: readonly Color[],
  span: number,
  weighted: boolean,
): readonly Band[] {
  const count = colors.length;
  if (count === 0 || span <= 0) return [];

  const bands: Band[] = [];
  let offset = 0;

  for (const [index, color] of colors.entries()) {
    const share = weighted ? color.weight : 1 / count;
    const length = index === count - 1 ? span - offset : span * share;
    bands.push({ hex: color.hex, offset, length, opacity: 1 });
    offset += length;
  }

  return bands;
}
