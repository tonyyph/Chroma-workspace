import { EXPORT_LONG_EDGE, THUMBNAIL_LONG_EDGE, targetSize } from './bakeGrade';

/**
 * What size a graded copy comes out at.
 *
 * Two rules, and both are about not doing damage: a frame is never enlarged,
 * because inventing pixels is not exporting, and it is never rendered above the
 * ceiling, because a 48MP surface is the shortest path to an out-of-memory crash
 * on an older phone — and a crash while saving is worse than a long edge someone
 * has to be told about.
 */

describe('targetSize', () => {
  it('caps the long edge of a landscape frame', () => {
    expect(targetSize(8000, 6000, EXPORT_LONG_EDGE)).toEqual({
      width: 4096,
      height: 3072,
      scale: 0.512,
    });
  });

  it('caps the long edge of a portrait frame, which is its height', () => {
    const size = targetSize(3000, 6000, EXPORT_LONG_EDGE);
    expect(size?.height).toBe(4096);
    expect(size?.width).toBe(2048);
  });

  it('never upscales a frame smaller than the ceiling', () => {
    expect(targetSize(800, 600, EXPORT_LONG_EDGE)).toEqual({
      width: 800,
      height: 600,
      scale: 1,
    });
  });

  it('keeps the thumbnail size the bake has always produced', () => {
    expect(THUMBNAIL_LONG_EDGE).toBe(1024);
    expect(targetSize(4000, 3000, THUMBNAIL_LONG_EDGE)).toEqual({
      width: 1024,
      height: 768,
      scale: 0.256,
    });
  });

  it('rounds to whole pixels rather than producing a fractional surface', () => {
    const size = targetSize(1000, 333, 100);
    expect(Number.isInteger(size?.width)).toBe(true);
    expect(Number.isInteger(size?.height)).toBe(true);
    expect(size?.height).toBeGreaterThanOrEqual(1);
  });

  it('refuses a frame with no area rather than returning a zero surface', () => {
    expect(targetSize(0, 1000, EXPORT_LONG_EDGE)).toBeNull();
    expect(targetSize(1000, -1, EXPORT_LONG_EDGE)).toBeNull();
  });
});
