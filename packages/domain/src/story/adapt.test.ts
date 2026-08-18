import { describe, expect, it } from 'vitest';

import { makeColor } from '../palette';
import { adaptProject, adaptRect, focalCrop, nudgeIntoSafeArea, outsideSafeArea } from './adapt';
import { storyElementSchema, type StoryElement } from './elements';
import { canvasSize, formatOf, safeArea, storyFormatIds } from './formats';
import { type Rect } from './geometry';
import {
  createStoryProject,
  storyProjectSchema,
  type StoryAsset,
  type StoryProject,
} from './project';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-17T09:00:00.000Z';
const LATER = '2026-08-17T10:00:00.000Z';

const asset: StoryAsset = {
  id: 'a',
  uri: 'file:///story-assets/a.jpg',
  width: 4032,
  height: 3024,
  previewUri: null,
  createdAt: NOW,
};

const photo = (frame: Rect, focal = { x: 0.5, y: 0.5 }): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id: 'p',
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: 'a',
    sourceWidth: 4032,
    sourceHeight: 3024,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    focal,
  });

const text = (frame: Rect, scale = 1): StoryElement =>
  storyElementSchema.parse({
    kind: 'text',
    id: 't',
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    text: 'Nightswimming',
    role: 'title',
    align: 'left',
    scale,
    colorHex: '#FFFFFF',
  });

const projectWith = (layers: readonly StoryElement[]): StoryProject =>
  storyProjectSchema.parse({
    ...createStoryProject({ id: ID, format: 'portrait', slideCount: 3, now: NOW }),
    assets: [asset],
    layers,
  });

/* --------------------------------------------------------------- rects */

describe('adaptRect', () => {
  const from = formatOf('portrait');
  const to = formatOf('story');

  it('keeps an element on the slide it started on', () => {
    // Slide 2 of a portrait story starts at 2160; of a 9:16 story, also 2160
    // (same slide width) — but the test is the general property, not the number.
    const rect: Rect = { x: 2160 + 100, y: 0, width: 200, height: 200 };
    const adapted = adaptRect(rect, from, to, 2);
    expect(adapted.x).toBe(2160 + 100);
  });

  it('keeps proportional position within the slide', () => {
    // A third of the way down a 1350-tall slide should be a third of the way
    // down a 1920-tall one.
    const rect: Rect = { x: 0, y: 450, width: 100, height: 100 };
    const adapted = adaptRect(rect, from, to, 0);
    expect(adapted.y / to.slideHeight).toBeCloseTo(450 / from.slideHeight);
  });

  it('scales height by the height ratio', () => {
    const rect: Rect = { x: 0, y: 0, width: 100, height: 135 };
    const adapted = adaptRect(rect, from, to, 0);
    expect(adapted.height).toBeCloseTo(135 * (1920 / 1350));
  });

  it('is the identity when the formats match', () => {
    const rect: Rect = { x: 300, y: 400, width: 100, height: 100 };
    expect(adaptRect(rect, from, from, 0)).toEqual(rect);
  });
});

/* --------------------------------------------------------------- crops */

describe('focalCrop', () => {
  const source = { width: 4032, height: 3024 };

  it('centres on the focal point when there is room', () => {
    const crop = focalCrop(source, { width: 1080, height: 1920 }, { x: 0.3, y: 0.5 });
    expect(crop.x + crop.width / 2).toBeCloseTo(0.3);
  });

  it('slides back inside rather than running off the source', () => {
    const crop = focalCrop(source, { width: 1080, height: 1920 }, { x: 0.02, y: 0.5 });
    expect(crop.x).toBe(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('never produces a crop outside the source, for any focal point', () => {
    for (const fx of [0, 0.1, 0.5, 0.9, 1]) {
      for (const fy of [0, 0.25, 0.75, 1]) {
        for (const frame of [
          { width: 1080, height: 1350 },
          { width: 1080, height: 1080 },
          { width: 1080, height: 1920 },
        ]) {
          const crop = focalCrop(source, frame, { x: fx, y: fy });
          expect(crop.x).toBeGreaterThanOrEqual(0);
          expect(crop.y).toBeGreaterThanOrEqual(0);
          expect(crop.x + crop.width).toBeLessThanOrEqual(1 + 1e-9);
          expect(crop.y + crop.height).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it('keeps an off-centre subject in frame where a centre crop would lose it', () => {
    // A subject at x = 0.15 of a landscape source, going into a tall 9:16 frame.
    const focal = { x: 0.15, y: 0.5 };
    const focused = focalCrop(source, { width: 1080, height: 1920 }, focal);
    const centred = focalCrop(source, { width: 1080, height: 1920 }, { x: 0.5, y: 0.5 });

    const inside = (crop: typeof focused) => focal.x >= crop.x && focal.x <= crop.x + crop.width;

    expect(inside(focused)).toBe(true);
    // The whole point: the centred crop does not contain the subject.
    expect(inside(centred)).toBe(false);
  });
});

/* ---------------------------------------------------------- safe areas */

describe('safe areas', () => {
  it('gives TikTok a narrower usable width than Instagram at the same size', () => {
    const story = formatOf('story');
    const tiktok = formatOf('tiktok');

    expect(tiktok.slideWidth).toBe(story.slideWidth);
    expect(tiktok.slideHeight).toBe(story.slideHeight);
    // Same pixels, different safe zone — the entire reason it is a separate id.
    expect(safeArea(tiktok, 0).width).toBeLessThan(safeArea(story, 0).width);
  });

  it('offsets the safe area onto the right slide', () => {
    const area = safeArea(formatOf('tiktok'), 2);
    expect(area.x).toBe(1080 * 2 + 0);
  });

  it('nudges a rect inside', () => {
    const safe: Rect = { x: 0, y: 250, width: 1080, height: 1420 };
    const result = nudgeIntoSafeArea({ x: 0, y: 0, width: 100, height: 100 }, safe);
    expect(result.moved).toBe(true);
    expect(result.rect.y).toBe(250);
  });

  it('leaves a rect that already fits', () => {
    const safe: Rect = { x: 0, y: 250, width: 1080, height: 1420 };
    const rect: Rect = { x: 10, y: 300, width: 100, height: 100 };
    const result = nudgeIntoSafeArea(rect, safe);
    expect(result.moved).toBe(false);
    expect(result.rect).toEqual(rect);
  });

  it('refuses to shrink something larger than the safe area', () => {
    const safe: Rect = { x: 0, y: 250, width: 1080, height: 1420 };
    const bleed: Rect = { x: 0, y: 0, width: 1080, height: 1920 };
    const result = nudgeIntoSafeArea(bleed, safe);
    expect(result.moved).toBe(false);
    expect(result.rect).toEqual(bleed);
  });
});

/* ------------------------------------------------------------ projects */

describe('adaptProject', () => {
  it('produces a project that validates, for every target format', () => {
    const project = projectWith([
      photo({ x: 0, y: 0, width: 1080, height: 1350 }),
      text({ x: 80, y: 900, width: 900, height: 300 }),
    ]);

    for (const target of storyFormatIds) {
      const { project: adapted } = adaptProject(project, target, LATER);
      const parsed = storyProjectSchema.safeParse(adapted);
      expect(parsed.success).toBe(true);
      expect(adapted.canvas).toEqual(canvasSize(formatOf(target), 3));
    }
  });

  it('is a no-op for the format it already is', () => {
    const project = projectWith([photo({ x: 0, y: 0, width: 1080, height: 1350 })]);
    const result = adaptProject(project, 'portrait', LATER);
    expect(result.project).toBe(project);
    expect(result.notes).toEqual([]);
  });

  it('never mutates the original', () => {
    const project = projectWith([photo({ x: 0, y: 0, width: 1080, height: 1350 })]);
    const before = JSON.parse(JSON.stringify(project)) as unknown;

    adaptProject(project, 'story', LATER);

    expect(JSON.parse(JSON.stringify(project))).toEqual(before);
  });

  it('recrops photographs around their focal point', () => {
    const project = projectWith([
      photo({ x: 0, y: 0, width: 1080, height: 1350 }, { x: 0.2, y: 0.4 }),
    ]);
    const { project: adapted } = adaptProject(project, 'story', LATER);

    const layer = adapted.layers[0];
    expect(layer?.kind).toBe('photo');
    if (layer?.kind !== 'photo') return;
    // The focal point stays inside the visible window.
    expect(0.2).toBeGreaterThanOrEqual(layer.crop.x);
    expect(0.2).toBeLessThanOrEqual(layer.crop.x + layer.crop.width);
  });

  it('scales type by width only, so a headline does not balloon in the taller format', () => {
    const project = projectWith([text({ x: 80, y: 900, width: 900, height: 200 }, 1)]);
    const { project: adapted } = adaptProject(project, 'story', LATER);

    const layer = adapted.layers[0];
    if (layer?.kind !== 'text') throw new Error('expected text');
    // Portrait and story share a slide width, so the scale is unchanged even
    // though the slide got 42% taller.
    expect(layer.scale).toBe(1);
  });

  it('moves a caption out from under TikTok’s chrome', () => {
    // A caption at the very bottom of a 4:5 slide.
    const project = projectWith([text({ x: 80, y: 1250, width: 900, height: 80 })]);
    const { project: adapted, notes } = adaptProject(project, 'tiktok', LATER);

    const layer = adapted.layers[0];
    if (layer?.kind !== 'text') throw new Error('expected text');

    const safe = safeArea(formatOf('tiktok'), 0);
    expect(layer.frame.y + layer.frame.height).toBeLessThanOrEqual(safe.y + safe.height + 1e-9);
    expect(notes.some((note) => note.kind === 'moved-into-safe-area')).toBe(true);
  });

  it('leaves a full-bleed photograph running under the chrome', () => {
    const project = projectWith([photo({ x: 0, y: 0, width: 1080, height: 1350 })]);
    const { project: adapted } = adaptProject(project, 'tiktok', LATER);

    const layer = adapted.layers[0];
    if (layer?.kind !== 'photo') throw new Error('expected photo');
    // A background is supposed to bleed. Nudging it would leave a gap.
    expect(layer.frame.y).toBe(0);
  });

  it('reports what it changed, for the review screen', () => {
    const project = projectWith([
      photo({ x: 0, y: 0, width: 1080, height: 1350 }),
      text({ x: 80, y: 1250, width: 900, height: 80 }),
    ]);
    const { notes } = adaptProject(project, 'tiktok', LATER);

    expect(notes.some((note) => note.kind === 'recropped')).toBe(true);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('keeps each element on its own slide across the change', () => {
    const project = projectWith([photo({ x: 2160, y: 0, width: 1080, height: 1350 })]);
    const { project: adapted } = adaptProject(project, 'story', LATER);

    // Still on slide 2, not smeared across a boundary.
    expect(adapted.layers[0]?.frame.x).toBe(2160);
  });
});

describe('outsideSafeArea', () => {
  it('reports a caption under the chrome and ignores the background', () => {
    const project = projectWith([
      photo({ x: 0, y: 0, width: 1080, height: 1350 }),
      text({ x: 80, y: 1300, width: 900, height: 80 }),
    ]);

    const offenders = outsideSafeArea(project, formatOf('tiktok'));
    expect(offenders.map((element) => element.id)).toEqual(['t']);
  });

  it('reports nothing for a format with no chrome', () => {
    const project = projectWith([text({ x: 80, y: 1250, width: 900, height: 80 })]);
    expect(outsideSafeArea(project, formatOf('portrait'))).toEqual([]);
  });

  it('ignores hidden elements', () => {
    const hidden = storyElementSchema.parse({
      ...JSON.parse(JSON.stringify(text({ x: 80, y: 1300, width: 900, height: 80 }))),
      hidden: true,
    });
    const project = projectWith([hidden]);
    expect(outsideSafeArea(project, formatOf('tiktok'))).toEqual([]);
  });
});

describe('palette strips adapt too', () => {
  it('moves a strip into the safe area', () => {
    const strip = storyElementSchema.parse({
      kind: 'paletteStrip',
      id: 's',
      frame: { x: 80, y: 1280, width: 900, height: 60 },
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
      sourceMemoryId: null,
      orientation: 'horizontal',
      weighted: true,
    });

    const { project: adapted } = adaptProject(projectWith([strip]), 'tiktok', LATER);
    const safe = safeArea(formatOf('tiktok'), 0);
    const layer = adapted.layers[0];

    expect((layer?.frame.y ?? 0) + (layer?.frame.height ?? 0)).toBeLessThanOrEqual(
      safe.y + safe.height + 1e-9,
    );
  });
});
