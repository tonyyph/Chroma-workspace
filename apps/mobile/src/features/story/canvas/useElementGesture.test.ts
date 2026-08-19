import type { Rect } from '@cw/domain';
import { committedFrame, committedRotation, ROTATION_STEP } from './useElementGesture';

/**
 * The one piece of the gesture layer that can be asserted off-device.
 *
 * The arbitration rules need real touches and are verified on hardware. The
 * *arithmetic* does not, and it is where the bug that looks like a broken
 * gesture actually lives: a resize anchored to the top-left walks the element
 * across the canvas as it grows, and reads as "pinch also drags".
 */

const frame: Rect = { x: 100, y: 200, width: 400, height: 300 };

describe('committedFrame', () => {
  it('translates without resizing at factor one', () => {
    expect(committedFrame(frame, { x: 50, y: -25 }, 1)).toEqual({
      x: 150,
      y: 175,
      width: 400,
      height: 300,
    });
  });

  it('returns the frame unchanged for no movement and no scale', () => {
    expect(committedFrame(frame, { x: 0, y: 0 }, 1)).toEqual(frame);
  });

  it('grows about the centre rather than the top-left', () => {
    const grown = committedFrame(frame, { x: 0, y: 0 }, 2);

    expect(grown.width).toBe(800);
    expect(grown.height).toBe(600);
    // The centre is the fixed point. Anchoring to the top-left would leave the
    // centre at (500, 500) instead of where it started.
    expect(grown.x + grown.width / 2).toBe(frame.x + frame.width / 2);
    expect(grown.y + grown.height / 2).toBe(frame.y + frame.height / 2);
  });

  it('shrinks about the centre too', () => {
    const shrunk = committedFrame(frame, { x: 0, y: 0 }, 0.5);

    expect(shrunk.width).toBe(200);
    expect(shrunk.x + shrunk.width / 2).toBe(frame.x + frame.width / 2);
  });

  it('applies the translation and the scale together', () => {
    const both = committedFrame(frame, { x: 100, y: 100 }, 2);

    // Moved by the drag, then grown about the moved centre.
    expect(both.x + both.width / 2).toBe(frame.x + frame.width / 2 + 100);
    expect(both.y + both.height / 2).toBe(frame.y + frame.height / 2 + 100);
  });

  it('never produces a zero or negative size from a positive factor', () => {
    const tiny = committedFrame(frame, { x: 0, y: 0 }, 0.1);
    expect(tiny.width).toBeGreaterThan(0);
    expect(tiny.height).toBeGreaterThan(0);
  });
});

describe('committedRotation', () => {
  it('snaps to the step, so level is always reachable', () => {
    // A finger cannot hold an angle steady. Unsnapped, every element ends at
    // 2.7 degrees and nothing is ever square to its neighbour.
    expect(committedRotation(0, 2)).toBe(0);
    expect(committedRotation(0, ROTATION_STEP * 2 + 1)).toBe(ROTATION_STEP * 2);
  });

  it('keeps zero as a multiple of the step', () => {
    // The property that matters more than the step's size: putting something
    // back straight has to be possible.
    expect(0 % ROTATION_STEP).toBe(0);
    expect(committedRotation(0, 0)).toBe(0);
  });

  it('accumulates from the element’s current angle', () => {
    expect(committedRotation(90, 10)).toBe(100);
  });

  it('wraps rather than storing an unbounded angle', () => {
    expect(committedRotation(350, 20)).toBe(10);
    expect(committedRotation(0, -10)).toBe(350);
    expect(committedRotation(0, -730)).toBeGreaterThanOrEqual(0);
  });

  it('always returns something the schema accepts', () => {
    for (const current of [0, 90, 180, 359]) {
      for (const delta of [-400, -37, 0, 12, 400]) {
        const result = committedRotation(current, delta);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(360);
      }
    }
  });
});
