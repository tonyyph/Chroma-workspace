import { canvasSize, formatOf, sliceBounds, storyElementSchema } from '@cw/domain';
import { placePhotoOnSlide } from './placePhoto';

const place = (slideIndex: number, sourceWidth = 4032, sourceHeight = 3024) =>
  placePhotoOnSlide({
    elementId: `e${slideIndex}`,
    assetId: `a${slideIndex}`,
    sourceWidth,
    sourceHeight,
    format: 'portrait',
    slideIndex,
  });

describe('placePhotoOnSlide', () => {
  it('produces a valid element', () => {
    expect(storyElementSchema.safeParse(place(0)).success).toBe(true);
  });

  it('fills its slide exactly', () => {
    const element = place(0);
    expect(element.frame).toEqual(sliceBounds(formatOf('portrait'), 0));
  });

  it('places each photograph on its own slide, in logical canvas coordinates', () => {
    // Slide 2's photograph belongs at x = 2 × slideWidth, not at zero with an
    // offset applied at render time — that is the difference between one canvas
    // and twenty canvases pretending to be one.
    expect(place(0).frame.x).toBe(0);
    expect(place(1).frame.x).toBe(1080);
    expect(place(2).frame.x).toBe(2160);
  });

  it('never leaves a slide partly uncovered', () => {
    for (const source of [
      { w: 4032, h: 3024 },
      { w: 3024, h: 4032 },
      { w: 1000, h: 1000 },
      { w: 6000, h: 1000 },
    ]) {
      const element = place(0, source.w, source.h);
      expect(element.frame.width).toBe(1080);
      expect(element.frame.height).toBe(1350);
      // A cover crop, so the frame is filled rather than letterboxed.
      expect(element.kind).toBe('photo');
      if (element.kind !== 'photo') continue;
      expect(element.crop.width === 1 || element.crop.height === 1).toBe(true);
    }
  });

  it('crops a landscape source horizontally for a portrait slide', () => {
    const element = place(0, 4032, 3024);
    if (element.kind !== 'photo') throw new Error('expected a photo');

    // A wide photograph into a tall slide keeps its full height and loses width.
    expect(element.crop.height).toBe(1);
    expect(element.crop.width).toBeLessThan(1);
    expect(element.crop.x).toBeGreaterThan(0);
  });

  it('records the source dimensions the crop is a fraction of', () => {
    const element = place(0, 4032, 3024);
    if (element.kind !== 'photo') throw new Error('expected a photo');
    expect(element.sourceWidth).toBe(4032);
    expect(element.sourceHeight).toBe(3024);
  });

  it('arrives unlocked, visible and unrotated', () => {
    const element = place(0);
    expect(element.locked).toBe(false);
    expect(element.hidden).toBe(false);
    expect(element.rotation).toBe(0);
    expect(element.opacity).toBe(1);
  });

  it('lays a run of photographs end to end across the whole canvas', () => {
    const elements = [0, 1, 2].map((index) => place(index));
    const total = canvasSize(formatOf('portrait'), 3);

    const last = elements[elements.length - 1];
    expect(elements[0]?.frame.x).toBe(0);
    expect((last?.frame.x ?? 0) + (last?.frame.width ?? 0)).toBe(total.width);
  });
});
