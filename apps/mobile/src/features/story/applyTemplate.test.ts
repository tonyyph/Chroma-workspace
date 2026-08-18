import {
  createStoryProject,
  makeColor,
  storyElementSchema,
  storyProjectSchema,
  templateFor,
  type StoryElement,
  type StoryProject,
} from '@cw/domain';
import { applyTemplate } from './applyTemplate';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-18T09:00:00.000Z';
const GROUND = '#0C0B18';

const asset = (id: string) => ({
  id,
  uri: `file:///photos/${id}.jpg`,
  width: 4032,
  height: 3024,
  previewUri: null,
  createdAt: NOW,
});

const photo = (id: string, assetId: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame: { x: 0, y: 0, width: 400, height: 400 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId,
    sourceWidth: 4032,
    sourceHeight: 3024,
    // A crop the author chose. It must survive.
    crop: { x: 0.2, y: 0.1, width: 0.6, height: 0.7 },
  });

const text = (id: string, words: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'text',
    id,
    frame: { x: 0, y: 0, width: 400, height: 100 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: words,
    role: 'body',
    align: 'right',
    scale: 1,
    colorHex: '#FFFFFF',
  });

const strip = (id: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'paletteStrip',
    id,
    frame: { x: 0, y: 0, width: 400, height: 40 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
    sourceMemoryId: null,
    orientation: 'horizontal',
    weighted: true,
  });

const project = (layers: readonly StoryElement[], slideCount = 3): StoryProject =>
  storyProjectSchema.parse({
    ...createStoryProject({ id: ID, format: 'portrait', slideCount, now: NOW }),
    assets: [asset('a1'), asset('a2'), asset('a3')],
    layers,
  });

const ids = () => {
  let n = 0;
  return () => `new-${(n += 1)}`;
};

const apply = (proj: StoryProject, family: Parameters<typeof templateFor>[0]) =>
  applyTemplate(proj, templateFor(family), { groundHex: GROUND, now: NOW, nextId: ids() });

describe('a template rearranges rather than replaces', () => {
  it('keeps the author’s crop', () => {
    const before = project([photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a3'), strip('s')]);
    const { project: after } = apply(before, 'chromatic-journey');

    const moved = after.layers.find((layer) => layer.id === 'p1');
    expect(moved?.kind).toBe('photo');
    if (moved?.kind !== 'photo') return;
    // The crop is the author's work. Only the frame is the template's.
    expect(moved.crop).toEqual({ x: 0.2, y: 0.1, width: 0.6, height: 0.7 });
  });

  it('keeps the author’s words', () => {
    const before = project([photo('p1', 'a1'), text('t', 'Nightswimming')]);
    const { project: after } = apply(before, 'chroma-editorial');

    const moved = after.layers.find((layer) => layer.id === 't');
    expect(moved?.kind === 'text' ? moved.text : null).toBe('Nightswimming');
  });

  it('moves the frame', () => {
    const before = project([photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a3')]);
    const { project: after } = apply(before, 'film-diary');

    const moved = after.layers.find((layer) => layer.id === 'p1');
    // Was 400×400 at the origin; a template puts it where the layout says.
    expect(moved?.frame).not.toEqual({ x: 0, y: 0, width: 400, height: 400 });
  });

  it('produces a document that still validates', () => {
    const before = project([photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a3'), strip('s')]);
    for (const family of ['chromatic-journey', 'film-diary', 'mood-spectrum'] as const) {
      expect(storyProjectSchema.safeParse(apply(before, family).project).success).toBe(true);
    }
  });

  it('never mutates the project it was given', () => {
    const before = project([photo('p1', 'a1'), strip('s')]);
    const snapshot = JSON.parse(JSON.stringify(before)) as unknown;

    apply(before, 'chromatic-journey');

    expect(JSON.parse(JSON.stringify(before))).toEqual(snapshot);
  });
});

describe('nothing of the author’s is deleted', () => {
  it('keeps a photograph the layout had no slot for', () => {
    // Four photographs, a three-slide story: one has nowhere to go.
    const before = project([
      photo('p1', 'a1'),
      photo('p2', 'a2'),
      photo('p3', 'a3'),
      photo('p4', 'a1'),
    ]);
    const { project: after, unplaced } = apply(before, 'chromatic-journey');

    expect(unplaced).toBe(1);
    // Silently deleting someone's photograph is not something undo should have
    // to rescue them from.
    expect(after.layers.some((layer) => layer.id === 'p4')).toBe(true);
    expect(after.layers).toHaveLength(before.layers.length + 3);
  });

  it('reports a slot it could not fill rather than leaving an empty rectangle', () => {
    // A template that wants a headline, and a story with no text at all.
    const before = project([photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a3')]);
    const { project: after, unfilled } = apply(before, 'chroma-editorial');

    expect(unfilled).toBe(1);
    expect(after.layers.some((layer) => layer.kind === 'text')).toBe(false);
  });

  it('fills a palette slot from the story rather than leaving it empty', () => {
    // Unlike words, the colours are already in the document — there is nothing
    // to invent and nothing to leave blank.
    const before = project([photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a3'), strip('s')]);
    const { project: after } = apply(before, 'mood-spectrum');

    const stripsAfter = after.layers.filter((layer) => layer.kind === 'paletteStrip');
    expect(stripsAfter.length).toBeGreaterThanOrEqual(3);
    for (const entry of stripsAfter) {
      if (entry.kind !== 'paletteStrip') continue;
      expect(entry.colors[0]?.hex).toBe('#7C5CFF');
    }
  });
});

describe('a template that does not fit is refused', () => {
  it('leaves the project untouched below the minimum slide count', () => {
    // `before-the-song-ends` needs three slides.
    const before = project([photo('p1', 'a1')], 1);
    const result = apply(before, 'before-the-song-ends');

    expect(result.project).toBe(before);
    expect(result.unplaced).toBe(0);
  });
});

describe('determinism', () => {
  it('applies the same layout twice', () => {
    const before = project([photo('p1', 'a1'), photo('p2', 'a2'), photo('p3', 'a3'), strip('s')]);
    expect(apply(before, 'film-diary').project).toEqual(apply(before, 'film-diary').project);
  });
});
