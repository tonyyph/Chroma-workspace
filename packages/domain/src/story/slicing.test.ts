import { describe, expect, it } from 'vitest';

import { makeColor } from '../palette';
import { storyElementSchema, type StoryElement } from './elements';
import { canvasSize, formatOf, MAX_SLIDES, storyFormatIds } from './formats';
import { type Rect } from './geometry';
import {
  crossingElements,
  elementsForSlice,
  planSlices,
  verifyTiling,
  type SlicePlan,
} from './slicing';

const photo = (id: string, frame: Rect, overrides: Partial<StoryElement> = {}): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: `asset-${id}`,
    sourceWidth: 3000,
    sourceHeight: 4000,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    ...overrides,
  });

const strip = (id: string, frame: Rect): StoryElement =>
  storyElementSchema.parse({
    kind: 'paletteStrip',
    id,
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
    sourceMemoryId: null,
    orientation: 'horizontal',
    weighted: true,
  });

/* ------------------------------------------------------- the tiling proof */

describe('slice plans tile the canvas exactly', () => {
  it.each(storyFormatIds)('holds for every slide count in %s', (formatId) => {
    const format = formatOf(formatId);
    for (let slideCount = 1; slideCount <= MAX_SLIDES; slideCount += 1) {
      const plans = planSlices(format, slideCount);
      const canvas = canvasSize(format, slideCount);

      expect(plans).toHaveLength(slideCount);
      // The whole claim, asserted rather than described: no gap, no overlap,
      // no fractional edge, and the widths sum to the canvas exactly.
      expect(verifyTiling(plans, canvas)).toEqual([]);
    }
  });

  it('gives every slice identical output dimensions, so exports are uniform', () => {
    const format = formatOf('portrait');
    const plans = planSlices(format, 7);
    for (const plan of plans) {
      expect(plan.width).toBe(format.slideWidth);
      expect(plan.height).toBe(format.slideHeight);
    }
  });

  it('translates each slice by exactly one slide width more than the last', () => {
    const format = formatOf('story');
    const plans = planSlices(format, 5);
    for (const [position, plan] of plans.entries()) {
      // `|| 0` normalises the *expectation*, which is `-0` at position 0 for
      // exactly the reason the implementation guards against. Writing this
      // assertion the obvious way is how the bug gets reintroduced.
      expect(plan.translateX).toBe(-format.slideWidth * position || 0);
    }
  });

  it('uses positive zero for the first slice, not negative zero', () => {
    // `-0` serialises as `0` but fails `Object.is`, and both vitest and jest
    // compare with `Object.is` — so this is the difference between a stable
    // export-fidelity assertion and one that flickers.
    const plan = planSlices(formatOf('square'), 3)[0];
    expect(plan).toBeDefined();
    expect(Object.is(plan?.translateX, 0)).toBe(true);
  });

  it('produces nothing for a story with no slides', () => {
    expect(planSlices(formatOf('portrait'), 0)).toEqual([]);
  });
});

/* -------------------------------------------------- recomposition fidelity */

describe('a sliced canvas recomposes to the original', () => {
  /**
   * The geometric half of "pixel-perfect export slicing".
   *
   * A renderer draws the same scene into each slice, translated. So if an
   * element's position in slice *i* plus that slice's origin returns the
   * element's original logical position — for every slice it touches — then
   * laying the slices edge to edge reproduces the element unbroken. No pixel is
   * duplicated because the intervals are half-open; none is lost because they
   * are contiguous.
   */
  it('returns every crossing element to its exact original position', () => {
    const format = formatOf('portrait');
    const slideCount = 4;
    const plans = planSlices(format, slideCount);

    const elements = [
      photo('a', { x: 900, y: 100, width: 600, height: 800 }), // crosses 0→1
      photo('b', { x: 2000, y: 0, width: 1400, height: 1350 }), // crosses 1→2→3
      strip('c', { x: 0, y: 1200, width: 1080 * 4, height: 80 }), // spans all
    ];

    for (const element of elements) {
      for (const plan of plans) {
        const inSliceX = element.frame.x + plan.translateX;
        // Recomposition: undo the translation by adding the slice's own origin.
        expect(inSliceX + plan.bounds.x).toBe(element.frame.x);
      }
    }
  });

  it('covers a crossing element with no column drawn twice and none missed', () => {
    const format = formatOf('portrait');
    const plans = planSlices(format, 3);
    const element = photo('wide', { x: 500, y: 0, width: 2000, height: 1350 });

    // The x-range of the element that each slice is responsible for.
    const covered: Array<{ from: number; to: number }> = [];
    for (const plan of plans) {
      const from = Math.max(element.frame.x, plan.bounds.x);
      const to = Math.min(element.frame.x + element.frame.width, plan.bounds.x + plan.width);
      if (to > from) covered.push({ from, to });
    }

    expect(covered.length).toBeGreaterThan(1);
    // Contiguous: each responsibility begins exactly where the previous ended.
    for (let index = 0; index < covered.length - 1; index += 1) {
      expect(covered[index + 1]?.from).toBe(covered[index]?.to);
    }
    // Complete: together they account for the element's full width.
    const total = covered.reduce((sum, span) => sum + (span.to - span.from), 0);
    expect(total).toBe(element.frame.width);
  });
});

/* ---------------------------------------------------------- what to draw */

describe('elementsForSlice', () => {
  const format = formatOf('portrait');
  const plans = planSlices(format, 3);
  const first = plans[0];
  const second = plans[1];

  it('includes an element that only reaches into the slice', () => {
    expect(first).toBeDefined();
    if (first === undefined) return;
    const crossing = photo('x', { x: 1000, y: 0, width: 200, height: 200 });
    expect(elementsForSlice([crossing], first).map((element) => element.id)).toEqual(['x']);
  });

  it('excludes an element on another slide entirely', () => {
    expect(first).toBeDefined();
    if (first === undefined) return;
    const elsewhere = photo('y', { x: 1200, y: 0, width: 200, height: 200 });
    expect(elementsForSlice([elsewhere], first)).toEqual([]);
  });

  it('excludes hidden and fully transparent elements from every slice', () => {
    expect(second).toBeDefined();
    if (second === undefined) return;
    const hidden = photo('h', { x: 1100, y: 0, width: 200, height: 200 }, { hidden: true });
    const clear = photo('t', { x: 1100, y: 0, width: 200, height: 200 }, { opacity: 0 });
    expect(elementsForSlice([hidden, clear], second)).toEqual([]);
  });

  it('preserves z-order, because the array is the z-order', () => {
    expect(first).toBeDefined();
    if (first === undefined) return;
    const back = photo('back', { x: 0, y: 0, width: 500, height: 500 });
    const front = photo('front', { x: 0, y: 0, width: 500, height: 500 });
    expect(elementsForSlice([back, front], first).map((element) => element.id)).toEqual([
      'back',
      'front',
    ]);
  });
});

describe('crossingElements', () => {
  const format = formatOf('portrait');
  const plans: readonly SlicePlan[] = planSlices(format, 3);

  it('reports only elements that touch more than one slide', () => {
    const inside = photo('inside', { x: 100, y: 0, width: 200, height: 200 });
    const crossing = photo('crossing', { x: 1000, y: 0, width: 200, height: 200 });
    expect(crossingElements([inside, crossing], plans).map((element) => element.id)).toEqual([
      'crossing',
    ]);
  });

  it('ignores hidden elements, which are not in the output to cross anything', () => {
    const hidden = photo('h', { x: 1000, y: 0, width: 200, height: 200 }, { hidden: true });
    expect(crossingElements([hidden], plans)).toEqual([]);
  });
});

/* ------------------------------------------------------------ the detector */

describe('verifyTiling catches a broken plan', () => {
  const canvas = { width: 3240, height: 1350 };
  const good = planSlices(formatOf('portrait'), 3);

  it('detects a gap between slices', () => {
    const broken = good.map((plan, index) =>
      index === 1 ? { ...plan, bounds: { ...plan.bounds, x: plan.bounds.x + 10 } } : plan,
    );
    expect(verifyTiling(broken, canvas)).toContainEqual({ kind: 'gap', from: 0, to: 1 });
  });

  it('detects an overlap between slices', () => {
    const broken = good.map((plan, index) =>
      index === 1 ? { ...plan, bounds: { ...plan.bounds, x: plan.bounds.x - 10 } } : plan,
    );
    expect(verifyTiling(broken, canvas)).toContainEqual({ kind: 'overlap', from: 0, to: 1 });
  });

  it('detects a fractional slice edge', () => {
    const broken = good.map((plan, index) => (index === 0 ? { ...plan, width: 1080.5 } : plan));
    expect(verifyTiling(broken, canvas).some((problem) => problem.kind === 'non-integer')).toBe(
      true,
    );
  });

  it('detects a slice of the wrong height', () => {
    const broken = good.map((plan, index) => (index === 2 ? { ...plan, height: 1000 } : plan));
    expect(verifyTiling(broken, canvas)).toContainEqual({ kind: 'height-mismatch', index: 2 });
  });

  it('detects widths that do not add up to the canvas', () => {
    expect(verifyTiling(good.slice(0, 2), canvas)).toContainEqual({
      kind: 'coverage',
      expected: 3240,
      actual: 2160,
    });
  });

  it('reports nothing for an empty plan rather than inventing a problem', () => {
    expect(verifyTiling([], canvas)).toEqual([]);
  });
});
