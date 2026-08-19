import { describe, expect, it } from 'vitest';

import { storyElementSchema, type StoryElement } from './elements';
import { MAX_SLIDES, MIN_SLIDES } from './formats';
import { type Rect } from './geometry';
import { createStoryProject, storyProjectSchema, type StoryProject } from './project';
import { elementsCrossingSlides, insertSlide, moveSlide, removeSlide } from './slides';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-18T09:00:00.000Z';
const LATER = '2026-08-18T10:00:00.000Z';
const W = 1080;

const asset = {
  id: 'a',
  uri: 'file:///a.jpg',
  width: 4032,
  height: 3024,
  previewUri: null,
  createdAt: NOW,
};

const photo = (id: string, frame: Rect): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: 'a',
    sourceWidth: 4032,
    sourceHeight: 3024,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  });

/** One photograph per slide, each filling its own. */
const perSlide = (count: number): StoryElement[] =>
  Array.from({ length: count }, (_, index) =>
    photo(`p${index}`, { x: W * index, y: 0, width: W, height: 1350 }),
  );

const project = (layers: readonly StoryElement[], slideCount = 3): StoryProject =>
  storyProjectSchema.parse({
    ...createStoryProject({ id: ID, format: 'portrait', slideCount, now: NOW }),
    assets: [asset],
    layers,
  });

const xs = (p: StoryProject) => p.layers.map((layer) => layer.frame.x);

/* -------------------------------------------------------------- inserting */

describe('inserting a slide', () => {
  it('widens the canvas and keeps it consistent', () => {
    const { project: after } = insertSlide(project(perSlide(3)), 1, LATER);
    expect(after.slideCount).toBe(4);
    expect(storyProjectSchema.safeParse(after).success).toBe(true);
  });

  it('moves everything to the right of the insertion, and nothing else', () => {
    // A slide is a window onto one canvas, so inserting means widening and
    // shifting — not making an array longer.
    const { project: after } = insertSlide(project(perSlide(3)), 1, LATER);
    expect(xs(after)).toEqual([0, W * 2, W * 3]);
  });

  it('appends when asked for the end', () => {
    const { project: after } = insertSlide(project(perSlide(3)), 3, LATER);
    expect(xs(after)).toEqual([0, W, W * 2]);
    expect(after.slideCount).toBe(4);
  });

  it('deletes nothing', () => {
    const before = project(perSlide(3));
    expect(insertSlide(before, 0, LATER).project.layers).toHaveLength(before.layers.length);
  });

  it('clamps an index outside the range rather than failing', () => {
    expect(insertSlide(project(perSlide(3)), -5, LATER).project.slideCount).toBe(4);
    expect(insertSlide(project(perSlide(3)), 99, LATER).project.slideCount).toBe(4);
  });

  it('refuses past the ceiling', () => {
    const full = project(perSlide(MAX_SLIDES), MAX_SLIDES);
    expect(insertSlide(full, 0, LATER).project).toBe(full);
  });
});

/* --------------------------------------------------------------- removing */

describe('removing a slide', () => {
  it('removes what lived entirely on it, and says how much', () => {
    const { project: after, removed } = removeSlide(project(perSlide(3)), 1, LATER);
    expect(removed).toBe(1);
    expect(after.layers.map((layer) => layer.id)).toEqual(['p0', 'p2']);
  });

  it('closes the gap behind it', () => {
    const { project: after } = removeSlide(project(perSlide(3)), 0, LATER);
    expect(after.slideCount).toBe(2);
    expect(xs(after)).toEqual([0, W]);
    expect(storyProjectSchema.safeParse(after).success).toBe(true);
  });

  it('keeps an element that crosses the boundary rather than deleting it', () => {
    // It belongs to its neighbours too; removing it would take content off a
    // slide the author did not ask to remove.
    const crossing = photo('cross', { x: W - 200, y: 0, width: 400, height: 400 });
    const { project: after, removed } = removeSlide(project([...perSlide(3), crossing]), 1, LATER);

    expect(removed).toBe(1);
    expect(after.layers.some((layer) => layer.id === 'cross')).toBe(true);
  });

  it('refuses to remove the last slide', () => {
    const single = project(perSlide(1), 1);
    const result = removeSlide(single, 0, LATER);
    expect(result.project).toBe(single);
    expect(result.removed).toBe(0);
    expect(single.slideCount).toBe(MIN_SLIDES);
  });

  it('clamps an out-of-range index', () => {
    expect(removeSlide(project(perSlide(3)), 99, LATER).project.slideCount).toBe(2);
  });
});

/* --------------------------------------------------------------- moving */

describe('moving a slide', () => {
  it('takes its contents with it', () => {
    const { project: after, refused } = moveSlide(project(perSlide(3)), 0, 2, LATER);

    expect(refused).toBeNull();
    // p0 went to the end; the others each moved one to the left.
    const byId = new Map(after.layers.map((layer) => [layer.id, layer.frame.x]));
    expect(byId.get('p0')).toBe(W * 2);
    expect(byId.get('p1')).toBe(0);
    expect(byId.get('p2')).toBe(W);
  });

  it('is a permutation: nothing is lost or duplicated', () => {
    const before = project(perSlide(4), 4);
    const { project: after } = moveSlide(before, 3, 0, LATER);

    expect(after.layers).toHaveLength(before.layers.length);
    expect([...xs(after)].sort((a, b) => a - b)).toEqual([0, W, W * 2, W * 3]);
  });

  it('leaves a valid document', () => {
    const { project: after } = moveSlide(project(perSlide(3)), 2, 0, LATER);
    expect(storyProjectSchema.safeParse(after).success).toBe(true);
  });

  it('refuses when an element crosses a boundary, and names it', () => {
    // There is no correct answer for where half a photograph goes, and picking
    // one silently is worse than saying so.
    const crossing = photo('cross', { x: W - 200, y: 0, width: 400, height: 400 });
    const result = moveSlide(project([...perSlide(3), crossing]), 0, 2, LATER);

    expect(result.refused).toBe('crossing-element');
    expect(result.blocking).toEqual(['cross']);
    expect(result.project.layers).toEqual(project([...perSlide(3), crossing]).layers);
  });

  it('reports an out-of-range move rather than clamping into a surprise', () => {
    expect(moveSlide(project(perSlide(3)), 0, 9, LATER).refused).toBe('out-of-range');
    expect(moveSlide(project(perSlide(3)), -1, 0, LATER).refused).toBe('out-of-range');
  });

  it('reports a move to where it already is', () => {
    const result = moveSlide(project(perSlide(3)), 1, 1, LATER);
    expect(result.refused).toBe('no-change');
  });
});

/* ------------------------------------------------------------- crossings */

describe('elementsCrossingSlides', () => {
  it('finds an element spanning a boundary', () => {
    const crossing = photo('cross', { x: W - 200, y: 0, width: 400, height: 400 });
    expect(elementsCrossingSlides(project([crossing])).map((layer) => layer.id)).toEqual(['cross']);
  });

  it('does not count an element that exactly fills one slide', () => {
    // The half-open interval again: filling slide 0 exactly is not crossing.
    expect(elementsCrossingSlides(project(perSlide(3)))).toEqual([]);
  });

  it('finds one spanning three slides', () => {
    const wide = photo('wide', { x: 0, y: 0, width: W * 3, height: 400 });
    expect(elementsCrossingSlides(project([wide]))).toHaveLength(1);
  });
});
