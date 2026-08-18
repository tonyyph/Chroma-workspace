import {
  deriveFacets,
  emptyPersonalContext,
  makeColor,
  readAtmosphere,
  recapFor,
  storyProjectSchema,
  unpairedPairing,
  type ChromaticMemory,
  type Recap,
} from '@cw/domain';
import { composeRecapStory } from './composeRecap';

const STORY_ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-18T09:00:00.000Z';
const GROUND = '#0C0B18';

let seq = 0;
const memory = (hex: string, day: number): ChromaticMemory => {
  seq += 1;
  const colors = [makeColor(hex, 0.7, 'dominant'), makeColor('#101010', 0.3, 'support')];
  const atmosphere = readAtmosphere(colors, 2.4);
  const capturedAt = `2026-08-${String(day).padStart(2, '0')}T09:00:00.000Z`;

  return {
    schemaVersion: 2,
    id: `${seq}1111111-1111-4111-8111-11111111111a`.slice(0, 36),
    createdAt: capturedAt,
    updatedAt: capturedAt,
    capturedAt,
    image: {
      localUri: `file:///photos/${seq}.jpg`,
      width: 4032,
      height: 3024,
      source: 'photo-library',
      thumbnailUri: null,
      grade: null,
    },
    palette: { colors, deltaE: 2.4, confidence: 0.9, space: 'srgb', tuned: false, source: 'photo' },
    atmosphere,
    visualAnalysis: null,
    musicPairing: unpairedPairing,
    personalContext: { ...emptyPersonalContext, note: 'a private note' },
    facets: deriveFacets({ colors, atmosphere, pairing: unpairedPairing, capturedAt }),
    collectionIds: [],
    isPinned: false,
  } as ChromaticMemory;
};

const ids = () => {
  let n = 0;
  return () => `e${(n += 1)}`;
};

const memories = [
  memory('#7C5CFF', 1),
  memory('#22D3EE', 2),
  memory('#E8320C', 3),
  memory('#F2C14E', 4),
  memory('#3E7C59', 5),
];

const recap = recapFor(memories, 'month', '2026-08', new Date(NOW)) as Recap;

const build = (override: Partial<Parameters<typeof composeRecapStory>[0]> = {}) =>
  composeRecapStory({
    recap,
    memories,
    format: 'portrait',
    storyId: STORY_ID,
    now: NOW,
    nextId: ids(),
    groundHex: GROUND,
    ...override,
  });

describe('a recap becomes a real story', () => {
  it('produces a project that validates', () => {
    expect(recap).not.toBeNull();
    expect(storyProjectSchema.safeParse(build()).success).toBe(true);
  });

  it('is an ordinary story document, not a special kind', () => {
    const project = build();
    // Editable from here like any other: nothing about it is read-only, and
    // nothing was published by making it.
    expect(project.status).toBe('draft');
    expect(project.schemaVersion).toBe(1);
  });

  it('carries the memories it was built from', () => {
    expect(build().sourceMemoryIds.length).toBeGreaterThan(0);
  });

  it('opens with the period’s signature and its key', () => {
    const project = build();
    const text = project.layers.find((layer) => layer.kind === 'text');
    expect(text?.kind === 'text' ? text.text : null).toBe('2026-08');
  });

  it('draws the signature as equal bands, not as proportions it never measured', () => {
    const project = build();
    const cover = project.layers.find(
      (layer) => layer.kind === 'paletteStrip' && layer.sourceMemoryId === null,
    );

    expect(cover?.kind).toBe('paletteStrip');
    if (cover?.kind !== 'paletteStrip') return;
    // These colours come from different photographs, so there is no single "how
    // much of the picture" to be proportional to.
    expect(cover.weighted).toBe(false);
  });
});

describe('what a recap story does not carry', () => {
  it('carries no private note anywhere in the document', () => {
    const serialised = JSON.stringify(build());
    expect(serialised).not.toContain('a private note');
  });

  it('writes no caption of its own beyond the period key', () => {
    const texts = build()
      .layers.filter((layer) => layer.kind === 'text')
      .map((layer) => (layer.kind === 'text' ? layer.text : ''));

    // A date, not a sentence about it.
    expect(texts).toEqual(['2026-08']);
  });
});

describe('bounds', () => {
  it('caps how many slides a recap opens with', () => {
    const many = Array.from({ length: 14 }, (_, index) => memory('#7C5CFF', (index % 28) + 1));
    const bigRecap = recapFor(many, 'month', '2026-08', new Date(NOW)) as Recap;

    const project = composeRecapStory({
      recap: bigRecap,
      memories: many,
      format: 'portrait',
      storyId: STORY_ID,
      now: NOW,
      nextId: ids(),
      groundHex: GROUND,
    });

    // A twelve-slide month is a carousel nobody swipes to the end of.
    expect(project.slideCount).toBeLessThanOrEqual(6);
  });

  it('produces a valid one-slide story when no memories survive the filter', () => {
    const project = composeRecapStory({
      recap,
      memories: [],
      format: 'portrait',
      storyId: STORY_ID,
      now: NOW,
      nextId: ids(),
      groundHex: GROUND,
    });

    expect(storyProjectSchema.safeParse(project).success).toBe(true);
    expect(project.layers).toEqual([]);
  });
});
