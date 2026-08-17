import type { Rect } from '@cw/domain';
import { committedFrame } from './useElementGesture';

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
