import { describe, expect, it } from 'vitest';

import { makeColor } from '../palette';
import { storyElementSchema, type StoryElement } from './elements';
import { createStoryProject, storyProjectSchema, type StoryProject } from './project';
import { EMPTY_EFFECTS, MAX_GLOW_RADIUS } from './effects';
import { acceptStoryPatch, applyStoryPatch, STORY_PATCH_VERSION, type StoryPatch } from './patch';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-18T09:00:00.000Z';
const GROUND = '#0C0B18';

const photo = (id: string, overrides: Record<string, unknown> = {}): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame: { x: 0, y: 0, width: 1080, height: 1350 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: 'a',
    sourceWidth: 4032,
    sourceHeight: 3024,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    ...overrides,
  });

const text = (id: string, colorHex = '#FFFFFF', overrides: Record<string, unknown> = {}) =>
  storyElementSchema.parse({
    kind: 'text',
    id,
    frame: { x: 80, y: 900, width: 900, height: 200 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: 'Nightswimming',
    role: 'title',
    align: 'left',
    scale: 1,
    colorHex,
    ...overrides,
  });

const strip = (id: string, overrides: Record<string, unknown> = {}) =>
  storyElementSchema.parse({
    kind: 'paletteStrip',
    id,
    frame: { x: 80, y: 1200, width: 900, height: 60 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
    sourceMemoryId: null,
    orientation: 'horizontal',
    weighted: true,
    ...overrides,
  });

const projectWith = (layers: readonly StoryElement[]): StoryProject =>
  storyProjectSchema.parse({
    ...createStoryProject({ id: ID, format: 'portrait', slideCount: 1, now: NOW }),
    assets: [
      {
        id: 'a',
        uri: 'file:///a.jpg',
        width: 4032,
        height: 3024,
        previewUri: null,
        createdAt: NOW,
      },
    ],
    layers,
  });

const patch = (overrides: Partial<StoryPatch> = {}): StoryPatch => ({
  version: STORY_PATCH_VERSION,
  theme: null,
  slideOrder: null,
  crops: [],
  typography: [],
  animation: null,
  effects: [],
  ...overrides,
});

/* ------------------------------------------------------------- parsing */

describe('accepting an untrusted patch', () => {
  it('accepts a well-formed one', () => {
    expect(acceptStoryPatch(patch())).not.toBeNull();
  });

  it('rejects a patch from another version outright', () => {
    expect(acceptStoryPatch({ ...patch(), version: 99 })).toBeNull();
  });

  it('rejects rather than repairing a malformed field', () => {
    // All-or-nothing, following `acceptRefinedIntent`: the document it was going
    // to change is already correct, so a bad patch costs nothing.
    expect(acceptStoryPatch({ ...patch(), crops: 'not an array' })).toBeNull();
  });

  it('rejects a crop outside the source', () => {
    expect(
      acceptStoryPatch({
        ...patch(),
        crops: [{ elementId: 'p', crop: { x: 0.8, y: 0, width: 0.5, height: 1 } }],
      }),
    ).toBeNull();
  });

  it('rejects a scale outside the permitted range', () => {
    expect(
      acceptStoryPatch({
        ...patch(),
        typography: [{ elementId: 't', role: 'title', scale: 99 }],
      }),
    ).toBeNull();
  });

  it('rejects an unknown animation preset', () => {
    expect(acceptStoryPatch({ ...patch(), animation: 'strobe' })).toBeNull();
  });

  it('rejects an unknown text role', () => {
    expect(
      acceptStoryPatch({
        ...patch(),
        typography: [{ elementId: 't', role: 'gigantic', scale: 1 }],
      }),
    ).toBeNull();
  });

  it('rejects junk without throwing', () => {
    for (const junk of [null, undefined, 42, 'patch', [], { nope: true }]) {
      expect(acceptStoryPatch(junk)).toBeNull();
    }
  });
});

/* ------------------------------------------------------------ applying */

describe('a patch cannot introduce what the document does not have', () => {
  it('refuses a change to an element that does not exist', () => {
    const project = projectWith([photo('p')]);
    const result = applyStoryPatch(
      project,
      patch({ crops: [{ elementId: 'ghost', crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }] }),
      GROUND,
    );

    expect(result.changed).toBe(false);
    expect(result.rejected).toContainEqual({ reason: 'unknown-element', elementId: 'ghost' });
  });

  it('refuses a crop aimed at something that is not a photograph', () => {
    const project = projectWith([text('t')]);
    const result = applyStoryPatch(
      project,
      patch({ crops: [{ elementId: 't', crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }] }),
      GROUND,
    );

    expect(result.rejected).toContainEqual({ reason: 'wrong-element-kind', elementId: 't' });
  });

  it('refuses an order that is not a permutation', () => {
    const project = projectWith([photo('p'), text('t')]);

    for (const order of [['p'], ['p', 't', 'p'], ['p', 'ghost']]) {
      const result = applyStoryPatch(project, patch({ slideOrder: order }), GROUND);
      // Refused whole rather than partly applied: a half-applied order is an
      // order nobody asked for.
      expect(result.rejected).toContainEqual({ reason: 'not-a-permutation', elementId: null });
      expect(result.project.layers.map((layer) => layer.id)).toEqual(['p', 't']);
    }
  });
});

describe('a patch respects what the author protected', () => {
  it('refuses to re-crop a locked photograph', () => {
    const project = projectWith([photo('p', { locked: true })]);
    const result = applyStoryPatch(
      project,
      patch({ crops: [{ elementId: 'p', crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }] }),
      GROUND,
    );

    expect(result.rejected).toContainEqual({ reason: 'element-locked', elementId: 'p' });
    expect(result.changed).toBe(false);
  });

  it('leaves a locked palette strip un-animated', () => {
    const project = projectWith([strip('s', { locked: true }), strip('s2')]);
    const result = applyStoryPatch(project, patch({ animation: 'pulse' }), GROUND);

    const locked = result.project.layers.find((layer) => layer.id === 's');
    const free = result.project.layers.find((layer) => layer.id === 's2');

    expect(locked?.kind === 'paletteStrip' ? locked.animation : 'x').toBeNull();
    expect(free?.kind === 'paletteStrip' ? free.animation?.preset : null).toBe('pulse');
  });
});

describe('a patch cannot make text unreadable', () => {
  it('refuses to emphasise text that fails contrast on the ground', () => {
    // Near-black text on the near-black ground: legal in the schema, unreadable
    // in fact. The domain already has the maths, so this is checked rather than
    // trusted.
    const project = projectWith([text('t', '#0C0B18')]);
    const result = applyStoryPatch(
      project,
      patch({ typography: [{ elementId: 't', role: 'display', scale: 2 }] }),
      GROUND,
    );

    expect(result.rejected).toContainEqual({ reason: 'text-unreadable', elementId: 't' });
    expect(result.changed).toBe(false);
  });

  it('allows it when the contrast holds', () => {
    const project = projectWith([text('t', '#FFFFFF')]);
    const result = applyStoryPatch(
      project,
      patch({ typography: [{ elementId: 't', role: 'display', scale: 2 }] }),
      GROUND,
    );

    const layer = result.project.layers[0];
    expect(layer?.kind === 'text' ? layer.role : null).toBe('display');
    expect(layer?.kind === 'text' ? layer.scale : null).toBe(2);
  });
});

describe('what a valid patch does', () => {
  it('reorders when given a real permutation', () => {
    const project = projectWith([photo('p'), text('t')]);
    const result = applyStoryPatch(project, patch({ slideOrder: ['t', 'p'] }), GROUND);

    expect(result.project.layers.map((layer) => layer.id)).toEqual(['t', 'p']);
    expect(result.rejected).toEqual([]);
  });

  it('leaves a document that still validates', () => {
    const project = projectWith([photo('p'), text('t'), strip('s')]);
    const result = applyStoryPatch(
      project,
      patch({
        theme: 'Blue hour',
        slideOrder: ['s', 't', 'p'],
        crops: [{ elementId: 'p', crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } }],
        typography: [{ elementId: 't', role: 'body', scale: 1.5 }],
        animation: 'calm',
      }),
      GROUND,
    );

    expect(storyProjectSchema.safeParse(result.project).success).toBe(true);
    expect(result.project.title).toBe('Blue hour');
  });

  it('never mutates the project it was given', () => {
    const project = projectWith([photo('p'), text('t')]);
    const before = JSON.parse(JSON.stringify(project)) as unknown;

    applyStoryPatch(project, patch({ slideOrder: ['t', 'p'], animation: 'rush' }), GROUND);

    expect(JSON.parse(JSON.stringify(project))).toEqual(before);
  });

  it('reports doing nothing when the patch asks for nothing', () => {
    const project = projectWith([photo('p')]);
    const result = applyStoryPatch(project, patch(), GROUND);

    expect(result.changed).toBe(false);
    expect(result.project).toBe(project);
  });

  it('keeps the existing title when the patch proposes none', () => {
    const project = { ...projectWith([strip('s')]), title: 'Kept' };
    const result = applyStoryPatch(project, patch({ animation: 'flow' }), GROUND);
    expect(result.project.title).toBe('Kept');
  });
});

describe('a patch cannot propose an absurd effect', () => {
  it('is rejected at parse time when a bound is exceeded', () => {
    // The ceiling lives in `effects.ts`, so the refusal happens before
    // `applyStoryPatch` ever sees the value.
    const bad = {
      ...patch(),
      effects: [
        {
          elementId: 'p',
          effects: {
            ...EMPTY_EFFECTS,
            glow: { radius: MAX_GLOW_RADIUS + 1, colorHex: '#FFFFFF' },
          },
        },
      ],
    };
    expect(acceptStoryPatch(bad)).toBeNull();
  });

  it('applies a valid one', () => {
    const project = projectWith([photo('p')]);
    const result = applyStoryPatch(
      project,
      patch({
        effects: [
          { elementId: 'p', effects: { ...EMPTY_EFFECTS, grain: { amount: 0.3, seed: 5 } } },
        ],
      }),
      GROUND,
    );

    const layer = result.project.layers[0];
    expect(layer?.kind === 'photo' ? layer.effects.grain?.seed : null).toBe(5);
  });

  it('refuses to change effects on a locked element', () => {
    const project = projectWith([photo('p', { locked: true })]);
    const result = applyStoryPatch(
      project,
      patch({ effects: [{ elementId: 'p', effects: EMPTY_EFFECTS }] }),
      GROUND,
    );

    expect(result.rejected).toContainEqual({ reason: 'element-locked', elementId: 'p' });
    expect(result.changed).toBe(false);
  });

  it('refuses effects on something that is not a photograph', () => {
    const project = projectWith([text('t')]);
    const result = applyStoryPatch(
      project,
      patch({ effects: [{ elementId: 't', effects: EMPTY_EFFECTS }] }),
      GROUND,
    );

    expect(result.rejected).toContainEqual({ reason: 'wrong-element-kind', elementId: 't' });
  });
});
