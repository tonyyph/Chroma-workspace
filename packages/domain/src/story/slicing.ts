import { formatOf, type StoryFormat } from './formats';
import { isVisible, type StoryElement } from './elements';
import { containsPoint, rectsIntersect, sliceBounds, type Rect } from './geometry';
import type { StoryProject } from './project';

/**
 * Cutting one logical canvas into the slides that get exported.
 *
 * This is the file the whole "seamless carousel" claim rests on, so it is worth
 * stating the argument rather than only the code.
 *
 * **The claim.** For a story of N slides, the N exported images, laid edge to
 * edge in order, reproduce the logical canvas exactly: every pixel appears once,
 * no pixel appears twice, and no pixel is missing.
 *
 * **Why it holds.** A slice is not a re-layout. It is the same scene, drawn
 * once, translated by `-index × slideWidth` into a surface exactly `slideWidth`
 * wide. Three properties make that exact:
 *
 *   1. `slideWidth` is an integer (`formats.ts`) and `index` is an integer, so
 *      every translation is an integer. No sub-pixel offset is ever introduced.
 *   2. Slice *i* covers `[i·w, (i+1)·w)` and slice *i+1* covers `[(i+1)·w, …)`.
 *      They share a boundary and no interior, by arithmetic — there is no gap to
 *      round into and no overlap to round out of.
 *   3. Nothing is computed per slide. An element's position is a property of the
 *      element, not of the slide it happens to land on, so two adjacent slices
 *      cannot disagree about where it is. There is no second opinion available.
 *
 * The failure mode this avoids is the common one: laying out each slide
 * separately, then trying to make the edges match. That builds the seam into the
 * data and leaves rendering to apologise for it.
 *
 * `verifyTiling` turns the claim into something a test can assert rather than
 * something a comment can promise.
 */

export type SlicePlan = Readonly<{
  index: number;
  /** The window this slice opens onto the logical canvas. */
  bounds: Rect;
  /**
   * What to translate the scene by before drawing. Always `-bounds.x`, always an
   * integer, and the only difference between one slice and the next.
   */
  translateX: number;
  /** Output pixel dimensions. Identical for every slice of a story. */
  width: number;
  height: number;
}>;

/** Every slice of a story, in order. Pure; depends only on format and count. */
export function planSlices(format: StoryFormat, slideCount: number): readonly SlicePlan[] {
  const plans: SlicePlan[] = [];
  for (let index = 0; index < slideCount; index += 1) {
    const bounds = sliceBounds(format, index);
    plans.push({
      index,
      bounds,
      /**
       * `bounds.x === 0 ? 0 : -bounds.x`, and the ternary is load-bearing.
       *
       * Plain `-bounds.x` yields `-0` for the first slide. `-0` renders and
       * serialises as `0` but `Object.is(-0, 0)` is false, and both vitest's and
       * jest's `toEqual` follow `Object.is` — so an export-fidelity assertion
       * comparing slice plans passes or fails depending on which slide it looked
       * at first. Found by the session that wrote the first version of this
       * module; kept because this implementation had the identical shape.
       */
      translateX: bounds.x === 0 ? 0 : -bounds.x,
      width: format.slideWidth,
      height: format.slideHeight,
    });
  }
  return plans;
}

export const planSlicesFor = (project: StoryProject): readonly SlicePlan[] =>
  planSlices(formatOf(project.format), project.slideCount);

/**
 * The elements a slice has to draw, in z-order.
 *
 * An element that only touches this slice at its edge is still included — it is
 * the half of a crossing element that makes the crossing work. Hidden and fully
 * transparent elements are excluded here rather than skipped by the renderer, so
 * "what gets exported" has one definition.
 */
export function elementsForSlice(
  layers: readonly StoryElement[],
  plan: SlicePlan,
): readonly StoryElement[] {
  return layers.filter((layer) => isVisible(layer) && rectsIntersect(layer.frame, plan.bounds));
}

/** Elements that cross a boundary, so the editor can say so before export. */
export function crossingElements(
  layers: readonly StoryElement[],
  plans: readonly SlicePlan[],
): readonly StoryElement[] {
  return layers.filter(
    (layer) =>
      isVisible(layer) &&
      plans.filter((plan) => rectsIntersect(layer.frame, plan.bounds)).length > 1,
  );
}

/**
 * The topmost element under a point, or null.
 *
 * **Topmost, because the array is the z-order** — the search runs backwards, so
 * a tap on overlapping elements selects the one actually visible rather than the
 * one that happens to be first. Getting this backwards produces an editor where
 * tapping a photograph selects the background behind it, which reads as the tap
 * not working at all.
 *
 * Hidden and fully transparent elements are skipped: they are not on screen, and
 * selecting something invisible by tapping where it used to be is worse than the
 * tap doing nothing. Locked elements *are* returned — locking prevents moving,
 * not selecting, and being unable to select a locked element means being unable
 * to unlock it.
 *
 * Takes a point in logical canvas coordinates. The caller converts from screen
 * points, which is the one place a scale factor is involved.
 */
export function elementAt(
  layers: readonly StoryElement[],
  point: { x: number; y: number },
): StoryElement | null {
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (layer === undefined || !isVisible(layer)) continue;
    if (containsPoint(layer.frame, point)) return layer;
  }
  return null;
}

export type TilingProblem =
  | { kind: 'gap'; from: number; to: number }
  | { kind: 'overlap'; from: number; to: number }
  | { kind: 'height-mismatch'; index: number }
  | { kind: 'non-integer'; index: number }
  | { kind: 'coverage'; expected: number; actual: number };

/**
 * Proves the tiling claim for a concrete plan, or says exactly how it fails.
 *
 * This exists so the seamlessness property is checked by a test on every build
 * rather than inspected by eye on a device once. It is cheap enough that the
 * exporter runs it too: a story that would export with a seam refuses to export
 * at all, which is a far better failure than a carousel a person posts and only
 * then notices.
 */
export function verifyTiling(
  plans: readonly SlicePlan[],
  canvas: { width: number; height: number },
): readonly TilingProblem[] {
  const problems: TilingProblem[] = [];
  if (plans.length === 0) return problems;

  let covered = 0;
  for (const [position, plan] of plans.entries()) {
    if (!Number.isInteger(plan.bounds.x) || !Number.isInteger(plan.width)) {
      problems.push({ kind: 'non-integer', index: plan.index });
    }
    if (plan.height !== canvas.height) {
      problems.push({ kind: 'height-mismatch', index: plan.index });
    }
    covered += plan.width;

    const next = plans[position + 1];
    if (next === undefined) continue;

    const end = plan.bounds.x + plan.width;
    if (next.bounds.x > end) {
      problems.push({ kind: 'gap', from: plan.index, to: next.index });
    } else if (next.bounds.x < end) {
      problems.push({ kind: 'overlap', from: plan.index, to: next.index });
    }
  }

  if (covered !== canvas.width) {
    problems.push({ kind: 'coverage', expected: canvas.width, actual: covered });
  }
  return problems;
}
