import { describe, expect, it } from 'vitest';

import { storyElementSchema, type StoryElement } from './elements';
import { type Rect } from './geometry';
import { elementAt } from './slicing';

/**
 * Selecting by tapping.
 *
 * The scene is one recorded Skia picture, so there are no per-element views to
 * receive a press and this arithmetic *is* the selection behaviour. Getting the
 * z-order backwards produces an editor where tapping a photograph selects the
 * background behind it — which reads as the tap not working at all.
 */

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

describe('elementAt', () => {
  it('finds the element under the point', () => {
    const layers = [photo('a', { x: 0, y: 0, width: 100, height: 100 })];
    expect(elementAt(layers, { x: 50, y: 50 })?.id).toBe('a');
  });

  it('returns null for empty space, so a tap can deselect', () => {
    const layers = [photo('a', { x: 0, y: 0, width: 100, height: 100 })];
    expect(elementAt(layers, { x: 500, y: 500 })).toBeNull();
  });

  it('returns the topmost of overlapping elements, not the first', () => {
    const layers = [
      photo('back', { x: 0, y: 0, width: 200, height: 200 }),
      photo('front', { x: 0, y: 0, width: 200, height: 200 }),
    ];
    // The array is the z-order, so the last drawn is the one on top and the one
    // a finger actually lands on.
    expect(elementAt(layers, { x: 100, y: 100 })?.id).toBe('front');
  });

  it('falls through a hidden element to what is underneath', () => {
    const layers = [
      photo('back', { x: 0, y: 0, width: 200, height: 200 }),
      photo('front', { x: 0, y: 0, width: 200, height: 200 }, { hidden: true }),
    ];
    expect(elementAt(layers, { x: 100, y: 100 })?.id).toBe('back');
  });

  it('falls through a fully transparent element', () => {
    const layers = [
      photo('back', { x: 0, y: 0, width: 200, height: 200 }),
      photo('front', { x: 0, y: 0, width: 200, height: 200 }, { opacity: 0 }),
    ];
    expect(elementAt(layers, { x: 100, y: 100 })?.id).toBe('back');
  });

  it('still selects a locked element, because otherwise it cannot be unlocked', () => {
    const layers = [photo('a', { x: 0, y: 0, width: 100, height: 100 }, { locked: true })];
    expect(elementAt(layers, { x: 50, y: 50 })?.id).toBe('a');
  });

  it('treats the frame edge as inside', () => {
    const layers = [photo('a', { x: 0, y: 0, width: 100, height: 100 })];
    expect(elementAt(layers, { x: 100, y: 100 })?.id).toBe('a');
    expect(elementAt(layers, { x: 101, y: 100 })).toBeNull();
  });

  it('works in logical canvas coordinates, so a later slide selects correctly', () => {
    // Slide 2's element lives at x = 2160, not at zero.
    const layers = [photo('third', { x: 2160, y: 0, width: 1080, height: 1350 })];
    expect(elementAt(layers, { x: 2200, y: 100 })?.id).toBe('third');
    expect(elementAt(layers, { x: 100, y: 100 })).toBeNull();
  });

  it('returns null for an empty document', () => {
    expect(elementAt([], { x: 0, y: 0 })).toBeNull();
  });
});
