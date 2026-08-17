import { describe, expect, it } from 'vitest';

import { formatOf, canvasSize } from './formats';
import {
  centerOf,
  containsPoint,
  coverCrop,
  cropToSourceRect,
  fitWithin,
  fullCrop,
  MAX_OVERFLOW,
  rectFromCenter,
  rectsIntersect,
  sliceBounds,
  slideAt,
  slidesSpannedBy,
  toSlideSpace,
  withinAllowedBounds,
  type Rect,
} from './geometry';

const portrait = formatOf('portrait');

describe('slice bounds', () => {
  it('tiles the canvas with integer edges', () => {
    for (let index = 0; index < 20; index += 1) {
      const bounds = sliceBounds(portrait, index);
      expect(Number.isInteger(bounds.x)).toBe(true);
      expect(Number.isInteger(bounds.width)).toBe(true);
      expect(bounds.width).toBe(portrait.slideWidth);
      expect(bounds.height).toBe(portrait.slideHeight);
    }
  });

  it('places each slide immediately after the previous one, with no gap', () => {
    for (let index = 0; index < 19; index += 1) {
      const current = sliceBounds(portrait, index);
      const next = sliceBounds(portrait, index + 1);
      expect(next.x).toBe(current.x + current.width);
    }
  });
});

describe('slides spanned by an element', () => {
  const spanning = (x: number, width: number): Rect => ({ x, y: 100, width, height: 200 });

  it('reports one slide for an element wholly inside it', () => {
    expect(slidesSpannedBy(spanning(100, 200), portrait, 3)).toEqual([0]);
  });

  it('reports both slides for an element crossing a boundary', () => {
    // Slide 0 ends at 1080; this element runs 1000→1200.
    expect(slidesSpannedBy(spanning(1000, 200), portrait, 3)).toEqual([0, 1]);
  });

  it('reports every slide an element runs the whole length of', () => {
    expect(slidesSpannedBy(spanning(0, 1080 * 3), portrait, 3)).toEqual([0, 1, 2]);
  });

  it('reports nothing for an element entirely off the canvas', () => {
    expect(slidesSpannedBy(spanning(-5000, 100), portrait, 3)).toEqual([]);
  });

  it('treats an element touching only the shared edge as being on the later slide', () => {
    // Starting exactly at 1080 is slide 1, not slide 0: the boundary belongs to
    // the slide that begins there, which is what keeps the tiling half-open.
    expect(slidesSpannedBy(spanning(1080, 100), portrait, 3)).toEqual([1]);
  });
});

describe('slide-space transform', () => {
  it('is the identity on the first slide', () => {
    const rect: Rect = { x: 40, y: 60, width: 200, height: 300 };
    expect(toSlideSpace(rect, portrait, 0)).toEqual(rect);
  });

  it('subtracts exactly one slide width per slide', () => {
    const rect: Rect = { x: 2200, y: 0, width: 100, height: 100 };
    expect(toSlideSpace(rect, portrait, 2).x).toBe(2200 - 2160);
  });

  it('never changes the vertical position, because slides only advance in x', () => {
    const rect: Rect = { x: 3000, y: 777, width: 10, height: 10 };
    expect(toSlideSpace(rect, portrait, 2).y).toBe(777);
  });
});

describe('slideAt', () => {
  it('finds the slide a point falls on', () => {
    expect(slideAt({ x: 10, y: 10 }, portrait, 3)).toBe(0);
    expect(slideAt({ x: 1080, y: 10 }, portrait, 3)).toBe(1);
    expect(slideAt({ x: 2159, y: 10 }, portrait, 3)).toBe(1);
    expect(slideAt({ x: 2160, y: 10 }, portrait, 3)).toBe(2);
  });

  it('returns null off the canvas rather than a clamped index', () => {
    expect(slideAt({ x: -1, y: 10 }, portrait, 3)).toBeNull();
    expect(slideAt({ x: 10, y: -1 }, portrait, 3)).toBeNull();
    expect(slideAt({ x: 10, y: 99_999 }, portrait, 3)).toBeNull();
    expect(slideAt({ x: 1080 * 3, y: 10 }, portrait, 3)).toBeNull();
  });
});

describe('bleed bounds', () => {
  it('allows an element to hang off the canvas edge', () => {
    const bleeding: Rect = { x: -200, y: -200, width: 600, height: 600 };
    expect(withinAllowedBounds(bleeding, portrait, 3)).toBe(true);
  });

  it('refuses an element parked beyond any reachable position', () => {
    const canvas = canvasSize(portrait, 3);
    const lost: Rect = {
      x: -canvas.width * (MAX_OVERFLOW + 1) - 10,
      y: 0,
      width: 10,
      height: 10,
    };
    expect(withinAllowedBounds(lost, portrait, 3)).toBe(false);
  });
});

describe('rect helpers', () => {
  it('round-trips a rect through its centre', () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 200 };
    expect(rectFromCenter(centerOf(rect), { width: 100, height: 200 })).toEqual(rect);
  });

  it('does not count edge-only contact as an intersection', () => {
    const a: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const b: Rect = { x: 100, y: 0, width: 100, height: 100 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('counts the boundary as inside for point hit-testing', () => {
    const rect: Rect = { x: 0, y: 0, width: 100, height: 100 };
    expect(containsPoint(rect, { x: 100, y: 100 })).toBe(true);
    expect(containsPoint(rect, { x: 101, y: 100 })).toBe(false);
  });
});

describe('crops', () => {
  it('leaves a matching aspect uncropped', () => {
    const crop = coverCrop({ width: 800, height: 1000 }, { width: 400, height: 500 });
    expect(crop.width).toBeCloseTo(1);
    expect(crop.height).toBeCloseTo(1);
  });

  it('takes a centred horizontal slice from an over-wide source', () => {
    const crop = coverCrop({ width: 2000, height: 1000 }, { width: 1000, height: 1000 });
    expect(crop.height).toBe(1);
    expect(crop.width).toBeCloseTo(0.5);
    // Centred: equal amounts removed from each side.
    expect(crop.x).toBeCloseTo(0.25);
  });

  it('takes a centred vertical slice from an over-tall source', () => {
    const crop = coverCrop({ width: 1000, height: 2000 }, { width: 1000, height: 1000 });
    expect(crop.width).toBe(1);
    expect(crop.height).toBeCloseTo(0.5);
    expect(crop.y).toBeCloseTo(0.25);
  });

  it('always produces a crop that stays inside the source', () => {
    const sources = [
      { width: 4032, height: 3024 },
      { width: 3024, height: 4032 },
      { width: 1000, height: 1000 },
      { width: 5000, height: 1000 },
    ];
    const frames = [
      { width: 1080, height: 1350 },
      { width: 1080, height: 1080 },
      { width: 1080, height: 1920 },
    ];
    for (const source of sources) {
      for (const frame of frames) {
        const crop = coverCrop(source, frame);
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.width).toBeLessThanOrEqual(1 + 1e-9);
        expect(crop.y + crop.height).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('scales a normalised crop into source pixels', () => {
    const rect = cropToSourceRect(
      { x: 0.25, y: 0.5, width: 0.5, height: 0.5 },
      { width: 4000, height: 2000 },
    );
    expect(rect).toEqual({ x: 1000, y: 1000, width: 2000, height: 1000 });
  });

  it('treats the full crop as the whole source', () => {
    expect(cropToSourceRect(fullCrop, { width: 640, height: 480 })).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 480,
    });
  });
});

describe('fitWithin', () => {
  it('places an image whole and undistorted, centred in the bounds', () => {
    const bounds: Rect = { x: 0, y: 0, width: 1080, height: 1350 };
    const fitted = fitWithin({ width: 2000, height: 1000 }, bounds);

    expect(fitted.width / fitted.height).toBeCloseTo(2);
    expect(fitted.width).toBeLessThanOrEqual(bounds.width + 1e-9);
    expect(fitted.height).toBeLessThanOrEqual(bounds.height + 1e-9);
    expect(centerOf(fitted)).toEqual(centerOf(bounds));
  });
});
