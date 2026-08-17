import { describe, expect, it } from 'vitest';

import { makeColor } from '../palette';
import { storyElementSchema, type StoryElement } from './elements';
import { canvasSize, formatOf, MAX_SLIDES, MIN_SLIDES } from './formats';
import { type Rect } from './geometry';
import {
  createStoryProject,
  findAsset,
  findLayer,
  MAX_LAYERS,
  orphanedAssets,
  STORY_SCHEMA_VERSION,
  storyProjectSchema,
  type StoryAsset,
  type StoryProject,
} from './project';

const ID = '11111111-1111-4111-8111-111111111111';
const MEMORY_ID = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-08-17T09:00:00.000Z';

const asset = (id: string): StoryAsset => ({
  id,
  uri: `file:///story-assets/${id}.jpg`,
  width: 3000,
  height: 4000,
  previewUri: null,
  createdAt: NOW,
});

const photo = (id: string, assetId: string, frame?: Rect): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame: frame ?? { x: 40, y: 40, width: 600, height: 800 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId,
    sourceWidth: 3000,
    sourceHeight: 4000,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  });

const base = (): StoryProject =>
  createStoryProject({ id: ID, format: 'portrait', slideCount: 3, now: NOW });

/**
 * A project with fields replaced, typed loosely on purpose.
 *
 * Most of these tests feed the schema shapes it is supposed to *reject*, and a
 * `Partial<StoryProject>` would make those unwriteable — the compiler would
 * refuse the very inputs the runtime check exists for.
 */
const valid = (overrides: Record<string, unknown> = {}): unknown => ({ ...base(), ...overrides });

describe('createStoryProject', () => {
  it('produces a project that validates', () => {
    expect(storyProjectSchema.safeParse(base()).success).toBe(true);
  });

  it('starts empty, as a draft, at the current schema version', () => {
    const project = base();
    expect(project.schemaVersion).toBe(STORY_SCHEMA_VERSION);
    expect(project.layers).toEqual([]);
    expect(project.assets).toEqual([]);
    expect(project.status).toBe('draft');
    expect(project.track).toBeNull();
  });

  it('does not invent a title', () => {
    expect(base().title).toBeNull();
    expect(
      createStoryProject({ id: ID, format: 'square', slideCount: 1, now: NOW, title: '  ' }).title,
    ).toBe('  ');
  });

  it('derives the canvas from the format and slide count', () => {
    const project = createStoryProject({ id: ID, format: 'story', slideCount: 4, now: NOW });
    expect(project.canvas).toEqual(canvasSize(formatOf('story'), 4));
    expect(project.canvas.width).toBe(1080 * 4);
    expect(project.canvas.height).toBe(1920);
  });

  it('clamps an out-of-range slide count rather than producing an invalid project', () => {
    expect(
      createStoryProject({ id: ID, format: 'portrait', slideCount: 0, now: NOW }).slideCount,
    ).toBe(MIN_SLIDES);
    expect(
      createStoryProject({ id: ID, format: 'portrait', slideCount: 999, now: NOW }).slideCount,
    ).toBe(MAX_SLIDES);
  });

  it('carries the memories it was built from', () => {
    const project = createStoryProject({
      id: ID,
      format: 'portrait',
      slideCount: 2,
      now: NOW,
      sourceMemoryIds: [MEMORY_ID],
    });
    expect(project.sourceMemoryIds).toEqual([MEMORY_ID]);
  });

  it('has no owner field, because the app has no accounts', () => {
    expect(base()).not.toHaveProperty('owner');
  });
});

describe('the canvas checksum', () => {
  it('rejects a canvas that disagrees with the format', () => {
    const result = storyProjectSchema.safeParse(valid({ canvas: { width: 999, height: 1350 } }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('canvas'))).toBe(true);
    }
  });

  it('rejects a canvas that disagrees with the slide count', () => {
    // Right width for 3 slides, but the record claims 2.
    expect(storyProjectSchema.safeParse(valid({ slideCount: 2 })).success).toBe(false);
  });

  it('accepts every format at every legal slide count', () => {
    for (const format of ['portrait', 'square', 'story'] as const) {
      for (let slideCount = MIN_SLIDES; slideCount <= MAX_SLIDES; slideCount += 1) {
        const project = createStoryProject({ id: ID, format, slideCount, now: NOW });
        expect(storyProjectSchema.safeParse(project).success).toBe(true);
      }
    }
  });
});

describe('element and asset invariants', () => {
  it('rejects duplicate element ids', () => {
    const project = valid({
      assets: [asset('a')],
      layers: [photo('dup', 'a'), photo('dup', 'a')],
    });
    expect(storyProjectSchema.safeParse(project).success).toBe(false);
  });

  it('rejects duplicate asset ids', () => {
    const project = valid({ assets: [asset('a'), asset('a')], layers: [] });
    expect(storyProjectSchema.safeParse(project).success).toBe(false);
  });

  it('rejects a photo pointing at an asset that is not in the manifest', () => {
    const project = valid({ assets: [], layers: [photo('p', 'missing')] });
    const result = storyProjectSchema.safeParse(project);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('missing');
    }
  });

  it('accepts two elements sharing one asset, which is how a repeat works', () => {
    const project = valid({
      assets: [asset('a')],
      layers: [photo('one', 'a'), photo('two', 'a')],
    });
    expect(storyProjectSchema.safeParse(project).success).toBe(true);
  });

  it('allows an element to bleed off the canvas', () => {
    const project = valid({
      assets: [asset('a')],
      layers: [photo('bleed', 'a', { x: -300, y: -300, width: 900, height: 900 })],
    });
    expect(storyProjectSchema.safeParse(project).success).toBe(true);
  });

  it('rejects an element parked somewhere unreachable', () => {
    const project = valid({
      assets: [asset('a')],
      layers: [photo('lost', 'a', { x: -99_999, y: 0, width: 10, height: 10 })],
    });
    expect(storyProjectSchema.safeParse(project).success).toBe(false);
  });

  it('rejects more layers than the ceiling allows', () => {
    const layers = Array.from({ length: MAX_LAYERS + 1 }, (_, index) => photo(`p${index}`, 'a'));
    expect(storyProjectSchema.safeParse(valid({ assets: [asset('a')], layers })).success).toBe(
      false,
    );
  });
});

describe('video is defined but not constructible', () => {
  const videoElement = {
    kind: 'video',
    id: 'v',
    frame: { x: 0, y: 0, width: 100, height: 100 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: 'a',
    sourceWidth: 1920,
    sourceHeight: 1080,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    startMs: 0,
    durationMs: 5000,
    muted: true,
  };

  it('refuses a video element on its own', () => {
    const result = storyElementSchema.safeParse(videoElement);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message.includes('D2'))).toBe(true);
    }
  });

  it('refuses a project containing one, so none can ever be stored', () => {
    expect(
      storyProjectSchema.safeParse(valid({ assets: [asset('a')], layers: [videoElement] })).success,
    ).toBe(false);
  });
});

describe('palette strip elements', () => {
  const stripWith = (weights: readonly number[]): unknown => ({
    kind: 'paletteStrip',
    id: 's',
    frame: { x: 0, y: 0, width: 400, height: 80 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    colors: weights.map((weight, index) =>
      makeColor(index === 0 ? '#7C5CFF' : '#22D3EE', weight, index === 0 ? 'dominant' : 'support'),
    ),
    sourceMemoryId: null,
    orientation: 'horizontal',
    weighted: true,
  });

  it('accepts weights that sum to one', () => {
    expect(storyElementSchema.safeParse(stripWith([0.6, 0.4])).success).toBe(true);
  });

  it('rejects weights that do not, so proportional bands cannot draw wrong', () => {
    expect(storyElementSchema.safeParse(stripWith([0.6, 0.1])).success).toBe(false);
  });

  it('tolerates the same rounding slack a memory palette does', () => {
    expect(storyElementSchema.safeParse(stripWith([0.6, 0.405])).success).toBe(true);
  });
});

describe('accessors', () => {
  const project = storyProjectSchema.parse(
    valid({ assets: [asset('a')], layers: [photo('p', 'a')] }),
  );

  it('finds a layer and an asset by id', () => {
    expect(findLayer(project, 'p')?.id).toBe('p');
    expect(findAsset(project, 'a')?.id).toBe('a');
  });

  it('returns null rather than undefined for a miss', () => {
    expect(findLayer(project, 'nope')).toBeNull();
    expect(findAsset(project, 'nope')).toBeNull();
  });
});

describe('orphanedAssets', () => {
  it('reports an asset no element draws', () => {
    const project = storyProjectSchema.parse(
      valid({ assets: [asset('used'), asset('spare')], layers: [photo('p', 'used')] }),
    );
    expect(orphanedAssets(project).map((entry) => entry.id)).toEqual(['spare']);
  });

  it('reports nothing when every asset is in use', () => {
    const project = storyProjectSchema.parse(
      valid({ assets: [asset('a')], layers: [photo('p', 'a')] }),
    );
    expect(orphanedAssets(project)).toEqual([]);
  });
});
