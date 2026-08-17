import type { Color } from '@cw/domain';

/**
 * The arithmetic inside a draw call, lifted out of it.
 *
 * `drawScene` cannot be unit-tested — it needs a GPU surface, a font and a
 * decoded image, which is why `bakeGrade.test.ts` tests `targetSize` and leaves
 * the drawing to a device. But the parts that are *wrong* in ways a device shows
 * only subtly — a hairline gap between two colour bands, right-aligned text
 * landing a pixel outside its frame — are pure arithmetic, and they belong
 * somewhere they can be asserted.
 */

export type Band = Readonly<{
  hex: string;
  /** Distance from the strip's start, along its axis. */
  offset: number;
  length: number;
}>;

/**
 * The palette strip's bands, laid end to end with no gap and no overlap.
 *
 * **The last band takes the remainder.** Weights sum to one within a tolerance
 * (`paletteStripElementSchema` allows ±0.02, inherited from the memory palette),
 * and floating-point multiplication of five fractions by a span will not land
 * exactly on that span. Computing each band from its own weight leaves a
 * sub-pixel gap at the end — which at export resolution is a visible seam of
 * background colour down the edge of the strip. Accumulating and giving the last
 * band whatever is left makes the strip end exactly where its frame does,
 * whatever the weights did.
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
    bands.push({ hex: color.hex, offset, length });
    offset += length;
  }

  return bands;
}

export type TextAlignment = 'left' | 'center' | 'right';

/**
 * Where a line of text starts, given how wide it turned out.
 *
 * Separated because the right-aligned case is the one that is easy to get wrong
 * by a whole text width, and because it is identical for the editor's canvas and
 * the exporter — which must agree, or the preview lies.
 */
export function alignX(
  align: TextAlignment,
  frameX: number,
  frameWidth: number,
  textWidth: number,
): number {
  switch (align) {
    case 'left':
      return frameX;
    case 'right':
      return frameX + frameWidth - textWidth;
    case 'center':
      return frameX + (frameWidth - textWidth) / 2;
  }
}

/**
 * Where a block of text sits vertically inside its frame.
 *
 * Centred, because a text box someone dragged into position is one whose middle
 * they placed. A block taller than its frame is pinned to the top rather than
 * centred into negative space, so the first line stays readable instead of the
 * overflow being split evenly above and below.
 */
export const textBlockTop = (frameY: number, frameHeight: number, blockHeight: number): number =>
  frameY + Math.max(0, (frameHeight - blockHeight) / 2);
