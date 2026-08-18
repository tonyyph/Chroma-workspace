import { describe, expect, it } from 'vitest';

import { makeColor } from '../palette';
import { livingPaletteConfig } from './livingPalette';
import { storyElementSchema, type StoryElement } from './elements';
import {
  createStoryProject,
  storyProjectSchema,
  type StoryAsset,
  type StoryProject,
} from './project';
import {
  applyRecipe,
  attributionIntact,
  MAX_CHAIN_DEPTH,
  remixAttribution,
  remixRecipeSchema,
  remixSlotSchema,
  toRecipe,
} from './remix';

const ID = '11111111-1111-4111-8111-111111111111';
const MEMORY_ID = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-08-18T09:00:00.000Z';

const SECRET_URI = 'file:///private/photos/very-secret.jpg';
const SECRET_CAPTION = 'the day I told her';

const asset = (id: string, uri = SECRET_URI): StoryAsset => ({
  id,
  uri,
  width: 4032,
  height: 3024,
  previewUri: `${uri}.preview`,
  createdAt: NOW,
});

const photo = (id: string, assetId: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame: { x: 0, y: 0, width: 1080, height: 1350 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId,
    sourceWidth: 4032,
    sourceHeight: 3024,
    crop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  });

const text = (id: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'text',
    id,
    frame: { x: 80, y: 900, width: 900, height: 200 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: SECRET_CAPTION,
    role: 'title',
    align: 'left',
    scale: 1.25,
    colorHex: '#FFFFFF',
  });

const strip = (id: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'paletteStrip',
    id,
    frame: { x: 80, y: 1200, width: 900, height: 60 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
    sourceMemoryId: MEMORY_ID,
    orientation: 'horizontal',
    weighted: true,
    animation: livingPaletteConfig('calm'),
  });

const project = (): StoryProject =>
  storyProjectSchema.parse({
    ...createStoryProject({
      id: ID,
      format: 'portrait',
      slideCount: 2,
      now: NOW,
      sourceMemoryIds: [MEMORY_ID],
    }),
    title: 'Blue hour',
    assets: [asset('a1')],
    layers: [photo('p', 'a1'), text('t'), strip('s')],
  });

const recipe = () => toRecipe(project(), { recipeId: 'r1', now: NOW });

const ids = () => {
  let n = 0;
  return () => `e${(n += 1)}`;
};

/* ------------------------------------------- the privacy line, mechanically */

describe('a recipe carries slots, not contents', () => {
  it('validates', () => {
    expect(remixRecipeSchema.safeParse(recipe()).success).toBe(true);
  });

  it('contains no uri anywhere, at any depth', () => {
    // The central guarantee. Serialised and searched rather than checked field
    // by field, because a future field could reintroduce one.
    const serialised = JSON.stringify(recipe());
    expect(serialised).not.toContain(SECRET_URI);
    expect(serialised).not.toContain('file:');
    expect(serialised).not.toContain('preview');
  });

  it('contains no asset id', () => {
    expect(JSON.stringify(recipe())).not.toContain('a1');
  });

  it('contains no words the author wrote', () => {
    // A caption is something a person wrote about their own memory. The recipe
    // has nowhere to put one.
    expect(JSON.stringify(recipe())).not.toContain(SECRET_CAPTION);
  });

  it('contains no source memory id', () => {
    expect(JSON.stringify(recipe())).not.toContain(MEMORY_ID);
  });

  it('keeps the text slot’s setting while dropping its words', () => {
    const slot = recipe().slots.find((entry) => entry.kind === 'text');
    expect(slot?.kind).toBe('text');
    if (slot?.kind !== 'text') return;

    expect(slot.role).toBe('title');
    expect(slot.scale).toBe(1.25);
    expect(Object.keys(slot)).not.toContain('text');
  });

  it('carries the palette, which is the design being shared', () => {
    const slot = recipe().slots.find((entry) => entry.kind === 'paletteStrip');
    expect(slot?.kind === 'paletteStrip' ? slot.colors.length : 0).toBe(2);
  });

  it('carries no crop, because a crop describes a photograph nobody else has', () => {
    const slot = recipe().slots.find((entry) => entry.kind === 'photo');
    expect(Object.keys(slot ?? {})).not.toContain('crop');
  });
});

/* ---------------------------------------------------------------- applying */

describe('applying a recipe', () => {
  const materials = { assets: [asset('mine', 'file:///mine/1.jpg')], colors: null };

  it('produces a project that validates', () => {
    const { project: remixed } = applyRecipe(recipe(), materials, {
      storyId: ID,
      now: NOW,
      nextId: ids(),
    });
    expect(storyProjectSchema.safeParse(remixed).success).toBe(true);
  });

  it('uses the remixer’s own photograph', () => {
    const { project: remixed } = applyRecipe(recipe(), materials, {
      storyId: ID,
      now: NOW,
      nextId: ids(),
    });
    expect(remixed.assets.map((entry) => entry.uri)).toEqual(['file:///mine/1.jpg']);
  });

  it('leaves the words for the remixer to write', () => {
    const { project: remixed } = applyRecipe(recipe(), materials, {
      storyId: ID,
      now: NOW,
      nextId: ids(),
    });
    const written = remixed.layers.find((layer) => layer.kind === 'text');
    expect(written?.kind === 'text' ? written.text : null).toBe('');
  });

  it('keeps the arrangement, which is what a remix is', () => {
    const { project: remixed } = applyRecipe(recipe(), materials, {
      storyId: ID,
      now: NOW,
      nextId: ids(),
    });
    const original = project();

    expect(remixed.layers.map((layer) => layer.kind)).toEqual(
      original.layers.map((layer) => layer.kind),
    );
    expect(remixed.layers[1]?.frame).toEqual(original.layers[1]?.frame);
  });

  it('lets the remixer substitute their own palette', () => {
    const mine = [makeColor('#E8320C', 0.5, 'dominant'), makeColor('#F2C14E', 0.5, 'support')];
    const { project: remixed } = applyRecipe(
      recipe(),
      { assets: materials.assets, colors: mine },
      { storyId: ID, now: NOW, nextId: ids() },
    );

    const applied = remixed.layers.find((layer) => layer.kind === 'paletteStrip');
    expect(applied?.kind === 'paletteStrip' ? applied.colors[0]?.hex : null).toBe('#E8320C');
  });

  it('claims no source memory the remixer did not choose', () => {
    const { project: remixed } = applyRecipe(recipe(), materials, {
      storyId: ID,
      now: NOW,
      nextId: ids(),
    });
    const applied = remixed.layers.find((layer) => layer.kind === 'paletteStrip');
    expect(applied?.kind === 'paletteStrip' ? applied.sourceMemoryId : 'x').toBeNull();
  });

  it('counts an unfilled photo slot rather than drawing a placeholder', () => {
    // A grey rectangle is something someone exports without noticing.
    const { project: remixed, unfilled } = applyRecipe(
      recipe(),
      { assets: [], colors: null },
      { storyId: ID, now: NOW, nextId: ids() },
    );

    expect(unfilled).toBe(1);
    expect(remixed.layers.filter((layer) => layer.kind === 'photo')).toHaveLength(0);
    expect(storyProjectSchema.safeParse(remixed).success).toBe(true);
  });
});

/* ------------------------------------------------------------ attribution */

describe('attribution', () => {
  it('records the source and puts it at the head of the chain', () => {
    const attribution = remixAttribution(recipe(), { now: NOW, author: 'Tony' });
    expect(attribution.sourceRecipeId).toBe('r1');
    expect(attribution.chain[0]).toBe('r1');
  });

  it('accumulates across generations', () => {
    const first = recipe();
    const second = { ...first, id: 'r2', attribution: remixAttribution(first, { now: NOW }) };
    const third = remixAttribution(second, { now: NOW });

    expect(third.chain).toEqual(['r2', 'r1']);
  });

  it('bounds the chain rather than growing without limit', () => {
    let current = recipe();
    for (let generation = 0; generation < MAX_CHAIN_DEPTH + 10; generation += 1) {
      current = {
        ...current,
        id: `r${generation}`,
        attribution: remixAttribution(current, { now: NOW }),
      };
    }
    // An unbounded chain is a recursive load on the device.
    expect(current.attribution.chain.length).toBeLessThan(MAX_CHAIN_DEPTH);
    expect(remixRecipeSchema.safeParse(current).success).toBe(true);
  });

  it('detects a chain that has been shortened', () => {
    const parent = recipe();
    const honest = remixAttribution(parent, { now: NOW });
    expect(attributionIntact(honest, parent)).toBe(true);

    // "Silent removal of attribution" is the first failure `06` names.
    expect(attributionIntact({ ...honest, chain: [] }, parent)).toBe(false);
    expect(attributionIntact({ ...honest, sourceRecipeId: null }, parent)).toBe(false);
  });

  it('detects a source swapped for someone else’s', () => {
    const parent = recipe();
    const forged = { ...remixAttribution(parent, { now: NOW }), sourceRecipeId: 'someone-else' };
    expect(attributionIntact(forged, parent)).toBe(false);
  });
});

describe('a recipe cannot carry a video slot', () => {
  it('has exactly three slot kinds, and video is not one of them', () => {
    // Asserted on the *schema* rather than on an instance: comparing a slot's
    // kind to 'video' is a type error, which is the real guarantee — a video
    // slot is not something a caller could construct even carelessly. If video
    // ever lands, this is the test that has to change first and the place that
    // has to decide what a video slot means.
    const kinds = remixSlotSchema.options.map((option) => option.shape.kind.value);
    expect([...kinds].sort()).toEqual(['paletteStrip', 'photo', 'text']);
  });
});
