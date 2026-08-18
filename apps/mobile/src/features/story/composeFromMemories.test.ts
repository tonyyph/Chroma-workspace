import {
  deriveFacets,
  emptyPersonalContext,
  LEGACY_IMAGE_URI,
  makeColor,
  readAtmosphere,
  storyProjectSchema,
  unpairedPairing,
  type ChromaticMemory,
} from '@cw/domain';
import { composeFromMemories } from './composeFromMemories';

const STORY_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-18T09:00:00.000Z';

const memory = (input: {
  id: string;
  hex: string;
  day: number;
  colourOnly?: boolean;
}): ChromaticMemory => {
  const colors = [makeColor(input.hex, 0.65, 'dominant'), makeColor('#101010', 0.35, 'support')];
  const atmosphere = readAtmosphere(colors, 2.4);
  const capturedAt = `2026-08-${String(input.day).padStart(2, '0')}T09:00:00.000Z`;

  return {
    schemaVersion: 2,
    id: input.id,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    capturedAt,
    image: input.colourOnly
      ? {
          localUri: LEGACY_IMAGE_URI,
          width: 1,
          height: 1,
          source: 'legacy',
          thumbnailUri: null,
          grade: null,
        }
      : {
          localUri: `file:///photos/${input.id}.jpg`,
          width: 4032,
          height: 3024,
          source: 'photo-library',
          thumbnailUri: `file:///photos/${input.id}-thumb.jpg`,
          grade: null,
        },
    palette: { colors, deltaE: 2.4, confidence: 0.9, space: 'srgb', tuned: false, source: 'photo' },
    atmosphere,
    visualAnalysis: null,
    musicPairing: unpairedPairing,
    personalContext: emptyPersonalContext,
    facets: deriveFacets({ colors, atmosphere, pairing: unpairedPairing, capturedAt }),
    collectionIds: [],
    isPinned: false,
  } as ChromaticMemory;
};

const ids = () => {
  let n = 0;
  return () => `id-${(n += 1)}`;
};

const compose = (memories: readonly ChromaticMemory[]) =>
  composeFromMemories({
    memories,
    format: 'portrait',
    intensity: 'flow',
    order: 'chronological',
    storyId: STORY_ID,
    now: NOW,
    nextId: ids(),
  });

/** Real uuids: `sourceMemoryId` is uuid-typed, and a fixture that ignored that
 *  produced a project the schema rightly refused. */
const uuid = (n: number) => `${n}1111111-1111-4111-8111-111111111111`;

const three = [
  memory({ id: uuid(3), hex: '#E8320C', day: 3 }),
  memory({ id: uuid(1), hex: '#7C5CFF', day: 1 }),
  memory({ id: uuid(2), hex: '#22D3EE', day: 2 }),
];

describe('composing a story from memories', () => {
  it('produces a project that validates', () => {
    expect(storyProjectSchema.safeParse(compose(three).project).success).toBe(true);
  });

  it('gives each memory its own slide, in the paced order', () => {
    const { project } = compose(three);
    expect(project.slideCount).toBe(3);
    // Chronological: a1, b1, c1.
    expect(project.sourceMemoryIds).toEqual([uuid(1), uuid(2), uuid(3)]);
  });

  it('carries each memory’s own palette, at its own weights', () => {
    const { project } = compose([three[1]!]);
    const strip = project.layers.find((layer) => layer.kind === 'paletteStrip');

    expect(strip?.kind).toBe('paletteStrip');
    if (strip?.kind !== 'paletteStrip') return;
    // The product's actual claim, carried into the composition — not the
    // placeholder pair a raw-photo story gets.
    expect(strip.colors.map((color) => color.hex)).toEqual(['#7C5CFF', '#101010']);
    expect(strip.sourceMemoryId).toBe(uuid(1));
    expect(strip.weighted).toBe(true);
  });

  it('places each photograph full-bleed on its own slide', () => {
    const { project } = compose(three);
    const photos = project.layers.filter((layer) => layer.kind === 'photo');

    expect(photos).toHaveLength(3);
    expect(photos.map((photo) => photo.frame.x)).toEqual([0, 1080, 2160]);
  });

  it('uses the memory’s thumbnail as the editing preview', () => {
    const { project } = compose([three[1]!]);
    expect(project.assets[0]?.previewUri).toBe(`file:///photos/${uuid(1)}-thumb.jpg`);
  });

  it('records the memories it was built from', () => {
    expect(compose(three).project.sourceMemoryIds).toHaveLength(3);
  });
});

describe('colour-only memories', () => {
  const colourOnlyMemory = memory({ id: uuid(9), hex: '#7C5CFF', day: 5, colourOnly: true });

  it('contributes its palette rather than being dropped', () => {
    const { project, colourOnly } = compose([colourOnlyMemory]);

    expect(colourOnly).toEqual([uuid(9)]);
    // First-class in the library, so first-class here: it is entirely a palette,
    // and it gets a slide that is entirely a palette.
    expect(project.layers.filter((layer) => layer.kind === 'paletteStrip')).toHaveLength(1);
    expect(project.layers.filter((layer) => layer.kind === 'photo')).toHaveLength(0);
  });

  it('gives it a strip large enough to be the slide', () => {
    const { project } = compose([colourOnlyMemory]);
    const strip = project.layers[0];
    expect((strip?.frame.height ?? 0) / 1350).toBeGreaterThan(0.3);
  });

  it('still validates alongside memories that do have frames', () => {
    const mixed = [three[1]!, colourOnlyMemory];
    const { project } = compose(mixed);
    expect(storyProjectSchema.safeParse(project).success).toBe(true);
    expect(project.slideCount).toBe(2);
  });
});

describe('determinism', () => {
  it('produces the same project for the same input', () => {
    const once = composeFromMemories({
      memories: three,
      format: 'portrait',
      intensity: 'pulse',
      order: 'colour-flow',
      storyId: STORY_ID,
      now: NOW,
      nextId: ids(),
    });
    const twice = composeFromMemories({
      memories: three,
      format: 'portrait',
      intensity: 'pulse',
      order: 'colour-flow',
      storyId: STORY_ID,
      now: NOW,
      nextId: ids(),
    });
    expect(once.project).toEqual(twice.project);
  });
});

describe('edge cases', () => {
  it('produces a one-slide story from no memories rather than an invalid one', () => {
    const { project } = compose([]);
    expect(project.slideCount).toBe(1);
    expect(project.layers).toEqual([]);
    expect(storyProjectSchema.safeParse(project).success).toBe(true);
  });
});
