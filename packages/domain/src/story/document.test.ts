import { describe, expect, it } from 'vitest';

import {
  addAsset,
  addElement,
  duplicateElement,
  mapElement,
  moveElement,
  removeElement,
  reorderElement,
  setElementCrop,
  setElementFrame,
  setElementHidden,
  setElementLocked,
  setElementOpacity,
  setSlideCount,
  setStatus,
  setTitle,
  setTrack,
  updateAsset,
} from './document';
import { storyElementSchema, type StoryElement } from './elements';
import { canvasSize, formatOf, MAX_SLIDES, MIN_SLIDES } from './formats';
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

const asset = (id: string): StoryAsset => ({
  id,
  uri: `file:///story-assets/${id}.jpg`,
  width: 3000,
  height: 4000,
  previewUri: null,
  createdAt: NOW,
});

const photo = (id: string, frame?: Rect, assetId = 'a'): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame: frame ?? { x: 100, y: 100, width: 400, height: 400 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId,
    sourceWidth: 3000,
    sourceHeight: 4000,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  });

const text = (id: string): StoryElement =>
  storyElementSchema.parse({
    kind: 'text',
    id,
    frame: { x: 0, y: 0, width: 500, height: 120 },
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

const start = (): StoryProject =>
  addAsset(
    createStoryProject({ id: ID, format: 'portrait', slideCount: 3, now: NOW }),
    asset('a'),
    NOW,
  );

/* ------------------------------------------------------------ immutability */

describe('operations are immutable', () => {
  it('never mutates the project it was given', () => {
    const project = addElement(start(), photo('p'), NOW);
    const before = JSON.parse(JSON.stringify(project)) as unknown;

    moveElement(project, 'p', 50, 50, LATER);
    removeElement(project, 'p', LATER);
    reorderElement(project, 'p', 0, LATER);

    expect(JSON.parse(JSON.stringify(project))).toEqual(before);
  });

  it('returns the identical object when nothing changed, so undo can compare by reference', () => {
    const project = addElement(start(), photo('p'), NOW);
    expect(moveElement(project, 'absent', 10, 10, LATER)).toBe(project);
    expect(removeElement(project, 'absent', LATER)).toBe(project);
    expect(reorderElement(project, 'p', 0, LATER)).toBe(project);
  });

  it('stamps updatedAt on a real change and not on a no-op', () => {
    const project = addElement(start(), photo('p'), NOW);
    expect(moveElement(project, 'p', 1, 0, LATER).updatedAt).toBe(LATER);
    expect(moveElement(project, 'nope', 1, 0, LATER).updatedAt).toBe(NOW);
  });
});

/* ----------------------------------------------------------------- layers */

describe('addElement', () => {
  it('appends to the front of the z-order', () => {
    const project = addElement(addElement(start(), photo('back'), NOW), text('front'), NOW);
    expect(project.layers.map((layer) => layer.id)).toEqual(['back', 'front']);
  });

  it('refuses a duplicate id rather than producing an invalid document', () => {
    const project = addElement(start(), photo('p'), NOW);
    expect(addElement(project, photo('p'), LATER)).toBe(project);
  });
});

describe('mapElement', () => {
  it('refuses to edit a locked element', () => {
    const locked = setElementLocked(addElement(start(), photo('p'), NOW), 'p', true, NOW);
    expect(moveElement(locked, 'p', 100, 100, LATER)).toBe(locked);
  });

  it('refuses a change that would alter the element id or kind', () => {
    const project = addElement(start(), photo('p'), NOW);
    expect(mapElement(project, 'p', (element) => ({ ...element, id: 'other' }), LATER)).toBe(
      project,
    );
  });
});

describe('geometry edits', () => {
  it('moves by a delta', () => {
    const project = moveElement(addElement(start(), photo('p'), NOW), 'p', 25, -10, LATER);
    expect(project.layers[0]?.frame).toMatchObject({ x: 125, y: 90 });
  });

  it('sets an absolute frame', () => {
    const frame: Rect = { x: 0, y: 0, width: 200, height: 200 };
    const project = setElementFrame(addElement(start(), photo('p'), NOW), 'p', frame, LATER);
    expect(project.layers[0]?.frame).toEqual(frame);
  });

  it('clamps opacity into range instead of storing something invalid', () => {
    const project = addElement(start(), photo('p'), NOW);
    expect(setElementOpacity(project, 'p', 5, LATER).layers[0]?.opacity).toBe(1);
    expect(setElementOpacity(project, 'p', -5, LATER).layers[0]?.opacity).toBe(0);
  });

  it('crops a photo', () => {
    const crop = { x: 0.1, y: 0.1, width: 0.5, height: 0.5 };
    const project = setElementCrop(addElement(start(), photo('p'), NOW), 'p', crop, LATER);
    const layer = project.layers[0];
    expect(layer?.kind).toBe('photo');
    if (layer?.kind === 'photo') expect(layer.crop).toEqual(crop);
  });

  it('leaves a text element alone when asked to crop it', () => {
    const project = addElement(start(), text('t'), NOW);
    expect(setElementCrop(project, 't', { x: 0, y: 0, width: 0.5, height: 0.5 }, LATER)).toBe(
      project,
    );
  });
});

describe('lock and hide', () => {
  it('can always be toggled, including on a locked element', () => {
    const locked = setElementLocked(addElement(start(), photo('p'), NOW), 'p', true, NOW);
    expect(locked.layers[0]?.locked).toBe(true);
    expect(setElementLocked(locked, 'p', false, LATER).layers[0]?.locked).toBe(false);
  });

  it('hides without deleting', () => {
    const project = setElementHidden(addElement(start(), photo('p'), NOW), 'p', true, LATER);
    expect(project.layers).toHaveLength(1);
    expect(project.layers[0]?.hidden).toBe(true);
  });
});

describe('removeElement', () => {
  it('removes the element but keeps its asset, so undo can restore it', () => {
    const project = removeElement(addElement(start(), photo('p'), NOW), 'p', LATER);
    expect(project.layers).toEqual([]);
    expect(project.assets.map((entry) => entry.id)).toEqual(['a']);
  });
});

describe('duplicateElement', () => {
  it('places the copy directly above the original, offset', () => {
    const project = addElement(addElement(start(), photo('p'), NOW), text('t'), NOW);
    const duplicated = duplicateElement(project, 'p', 'copy', 24, LATER);

    expect(duplicated.layers.map((layer) => layer.id)).toEqual(['p', 'copy', 't']);
    expect(duplicated.layers[1]?.frame).toMatchObject({ x: 124, y: 124 });
  });

  it('unlocks the copy, because a locked duplicate cannot be moved into place', () => {
    const locked = setElementLocked(addElement(start(), photo('p'), NOW), 'p', true, NOW);
    expect(duplicateElement(locked, 'p', 'copy', 10, LATER).layers[1]?.locked).toBe(false);
  });

  it('produces a document that still validates', () => {
    const project = duplicateElement(addElement(start(), photo('p'), NOW), 'p', 'copy', 10, LATER);
    expect(storyProjectSchema.safeParse(project).success).toBe(true);
  });
});

describe('reorderElement', () => {
  const three = () =>
    addElement(
      addElement(addElement(start(), photo('a1'), NOW), photo('a2'), NOW),
      photo('a3'),
      NOW,
    );

  it('moves an element to an absolute index', () => {
    expect(reorderElement(three(), 'a3', 0, LATER).layers.map((layer) => layer.id)).toEqual([
      'a3',
      'a1',
      'a2',
    ]);
  });

  it('clamps a target past the end rather than failing', () => {
    expect(reorderElement(three(), 'a1', 99, LATER).layers.map((layer) => layer.id)).toEqual([
      'a2',
      'a3',
      'a1',
    ]);
  });

  it('reorders a locked element, because locking is about the canvas not the list', () => {
    const locked = setElementLocked(three(), 'a1', true, NOW);
    expect(reorderElement(locked, 'a1', 2, LATER).layers.map((layer) => layer.id)).toEqual([
      'a2',
      'a3',
      'a1',
    ]);
  });
});

/* ----------------------------------------------------------------- assets */

describe('assets', () => {
  it('refuses a duplicate asset id', () => {
    const project = start();
    expect(addAsset(project, asset('a'), LATER)).toBe(project);
  });

  it('repairs a moved file in one write, whatever draws it', () => {
    const project = addElement(addElement(start(), photo('one'), NOW), photo('two'), NOW);
    const repaired = updateAsset(project, 'a', { uri: 'file:///new/place.jpg' }, LATER);

    expect(repaired.assets[0]?.uri).toBe('file:///new/place.jpg');
    expect(storyProjectSchema.safeParse(repaired).success).toBe(true);
  });

  it('records a preview once it has been made', () => {
    const project = updateAsset(start(), 'a', { previewUri: 'file:///p.jpg' }, LATER);
    expect(project.assets[0]?.previewUri).toBe('file:///p.jpg');
  });
});

/* --------------------------------------------------------------- document */

describe('document fields', () => {
  it('trims a title and treats blank as absent', () => {
    expect(setTitle(start(), '  Blue Hour  ', LATER).title).toBe('Blue Hour');
    expect(setTitle(start(), '   ', LATER).title).toBeNull();
    expect(setTitle(start(), null, LATER).title).toBeNull();
  });

  it('attaches and clears a track', () => {
    const track = {
      provider: 'itunes' as const,
      providerTrackId: '1',
      title: 'Nightswimming',
      artist: 'R.E.M.',
      album: null,
      artworkUrl: null,
      durationMs: 256_000,
      isrc: null,
      genres: ['Alternative'],
      releaseYear: 1992,
      externalUrl: null,
      attribution: 'Preview via Apple Music',
    };
    const paired = setTrack(start(), track, LATER);
    expect(paired.track?.attribution).toBe('Preview via Apple Music');
    expect(storyProjectSchema.safeParse(paired).success).toBe(true);
    expect(setTrack(paired, null, LATER).track).toBeNull();
  });

  it('marks a project finished', () => {
    expect(setStatus(start(), 'finished', LATER).status).toBe('finished');
  });
});

describe('setSlideCount', () => {
  it('keeps the canvas checksum true', () => {
    const project = setSlideCount(start(), 5, LATER);
    expect(project.canvas).toEqual(canvasSize(formatOf('portrait'), 5));
    expect(storyProjectSchema.safeParse(project).success).toBe(true);
  });

  it('clamps out-of-range counts', () => {
    expect(setSlideCount(start(), 0, LATER).slideCount).toBe(MIN_SLIDES);
    expect(setSlideCount(start(), 999, LATER).slideCount).toBe(MAX_SLIDES);
  });

  it('is a no-op when the count is unchanged', () => {
    const project = start();
    expect(setSlideCount(project, 3, LATER)).toBe(project);
  });

  it('does not delete an element that shrinking left beyond the last slide', () => {
    const far = addElement(start(), photo('far', { x: 2400, y: 0, width: 400, height: 400 }), NOW);
    const shrunk = setSlideCount(far, 1, LATER);
    expect(shrunk.layers).toHaveLength(1);
  });
});

/* ----------------------------------------------- documents stay valid */

describe('a long edit session still validates', () => {
  it('holds after every operation in sequence', () => {
    let project = start();
    project = addElement(project, photo('p1'), NOW);
    project = addElement(project, photo('p2', { x: 900, y: 0, width: 400, height: 400 }), NOW);
    project = addElement(project, text('t1'), NOW);
    project = moveElement(project, 'p1', 30, 30, LATER);
    project = setElementOpacity(project, 'p2', 0.5, LATER);
    project = setElementCrop(project, 'p1', { x: 0, y: 0, width: 0.8, height: 0.8 }, LATER);
    project = duplicateElement(project, 't1', 't2', 20, LATER);
    project = reorderElement(project, 't2', 0, LATER);
    project = setElementLocked(project, 'p2', true, LATER);
    project = setElementHidden(project, 'p1', true, LATER);
    project = removeElement(project, 'p1', LATER);
    project = setSlideCount(project, 4, LATER);
    project = setTitle(project, 'Blue Hour', LATER);
    project = setStatus(project, 'finished', LATER);

    const result = storyProjectSchema.safeParse(project);
    expect(result.success).toBe(true);
    expect(project.layers.map((layer) => layer.id)).toEqual(['t2', 'p2', 't1']);
  });
});
