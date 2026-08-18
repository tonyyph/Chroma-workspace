/**
 * The arithmetic inside a draw call, lifted out of it.
 *
 * `drawScene` cannot be unit-tested — it needs a GPU surface, a font and a
 * decoded image, which is why `bakeGrade.test.ts` tests `targetSize` and leaves
 * the drawing to a device. But the parts that are *wrong* in ways a device shows
 * only subtly — right-aligned text landing a pixel outside its frame — are pure
 * arithmetic, and they belong somewhere they can be asserted.
 *
 * **`paletteBands` moved to the domain.** The width of each band is how much of
 * the photograph that colour actually was — the product's central claim, not a
 * rendering detail — so it lives with the invariant that guards it. It is
 * re-exported here so this module stays the one place the renderer imports from.
 */

export { paletteBands, type Band } from '@cw/domain';

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
