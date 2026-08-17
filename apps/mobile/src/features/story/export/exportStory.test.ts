import { formatOf, planSlices, storyElementSchema, type StoryElement } from '@cw/domain';
import { assetsForSlice } from './exportStory';

/**
 * The memory guarantee, asserted.
 *
 * `exportStory` itself needs a GPU surface and a decoder, so it is verified on a
 * device like `renderGraded` is. What *can* be checked here is the claim the
 * whole memory strategy rests on: that a slide decodes only the masters it
 * actually shows. If this is wrong, a twenty-photograph story decodes twenty
 * 4096px images at once and is killed partway through the export.
 */

const photo = (
  id: string,
  x: number,
  width: number,
  overrides: Partial<StoryElement> = {},
): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame: { x, y: 0, width, height: 400 },
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

const plans = planSlices(formatOf('portrait'), 3);
const [first, second, third] = plans;

describe('assetsForSlice', () => {
  it('decodes only what the slide shows', () => {
    const layers = [photo('a', 0, 500), photo('b', 1200, 500), photo('c', 2300, 500)];

    expect(first).toBeDefined();
    if (first === undefined) return;
    expect([...assetsForSlice(layers, first)]).toEqual(['asset-a']);
  });

  it('decodes a crossing element on both of the slides it touches', () => {
    const layers = [photo('wide', 900, 400)];

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;

    expect([...assetsForSlice(layers, first)]).toEqual(['asset-wide']);
    expect([...assetsForSlice(layers, second)]).toEqual(['asset-wide']);
  });

  it('does not decode a master for an element that is hidden', () => {
    const layers = [photo('h', 0, 500, { hidden: true })];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(assetsForSlice(layers, first).size).toBe(0);
  });

  it('does not decode a master for a fully transparent element', () => {
    const layers = [photo('t', 0, 500, { opacity: 0 })];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(assetsForSlice(layers, first).size).toBe(0);
  });

  it('counts one shared asset once, however many elements draw it', () => {
    const repeated = [
      photo('one', 0, 300),
      { ...photo('two', 400, 300), assetId: 'asset-one' } as StoryElement,
    ];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(assetsForSlice(repeated, first).size).toBe(1);
  });

  it('treats the shared boundary as belonging to the slide that begins there', () => {
    // Matches `rectsIntersect`: an element starting exactly at 1080 is on slide 1.
    const layers = [photo('edge', 1080, 200)];

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;

    expect(assetsForSlice(layers, first).size).toBe(0);
    expect([...assetsForSlice(layers, second)]).toEqual(['asset-edge']);
  });

  it('ignores elements with no source to decode', () => {
    const text = storyElementSchema.parse({
      kind: 'text',
      id: 't',
      frame: { x: 0, y: 0, width: 500, height: 100 },
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      text: 'Nightswimming',
      role: 'title',
      align: 'left',
      scale: 1,
      colorHex: '#FFFFFF',
    });

    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(assetsForSlice([text], first).size).toBe(0);
  });

  it('keeps peak decoding to one photograph for a one-photo-per-slide story', () => {
    // The shape the ceiling was written for: twenty slides, twenty masters, and
    // never more than one of them live at a time.
    const twenty = planSlices(formatOf('portrait'), 20);
    const layers = Array.from({ length: 20 }, (_, index) =>
      photo(`p${index}`, index * 1080 + 40, 1000),
    );

    for (const plan of twenty) {
      expect(assetsForSlice(layers, plan).size).toBe(1);
    }
  });

  it('reports nothing for a slide with nothing on it', () => {
    expect(third).toBeDefined();
    if (third === undefined) return;
    expect(assetsForSlice([photo('a', 0, 500)], third).size).toBe(0);
  });
});
