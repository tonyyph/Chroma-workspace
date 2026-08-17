import { type StoryElement } from './elements';
import { canvasSize, formatOf, MAX_SLIDES, MIN_SLIDES } from './formats';
import { type Crop, type Rect } from './geometry';
import { MAX_LAYERS, type StoryAsset, type StoryProject } from './project';

/**
 * Every way a story document is allowed to change.
 *
 * **Immutable, total, and clock-free.** Each operation returns a new project and
 * mutates nothing, which is what makes undo a matter of keeping references
 * rather than of replaying inverse edits — the class of bug where undo restores
 * *almost* the previous state simply cannot occur if the previous state is still
 * the same object. Every operation takes `now` rather than reading a clock, so
 * every one of them is assertable against a fixed expected value.
 *
 * **Nothing here validates.** These operations preserve the document's shape;
 * the schema proves it, once, at the storage boundary. Validating on every drag
 * frame would parse a whole document sixty times a second to learn what the
 * type system already said.
 *
 * An operation that cannot be performed returns the project **unchanged** rather
 * than throwing. Moving an element that is no longer there is a race between a
 * gesture and a delete, not an exceptional condition, and a gesture handler is
 * the worst possible place to unwind a stack.
 */

const touch = (project: StoryProject, now: string): StoryProject => ({
  ...project,
  updatedAt: now,
});

/* ----------------------------------------------------------------- layers */

export function addElement(
  project: StoryProject,
  element: StoryElement,
  now: string,
): StoryProject {
  if (project.layers.length >= MAX_LAYERS) return project;
  if (project.layers.some((layer) => layer.id === element.id)) return project;
  return touch({ ...project, layers: [...project.layers, element] }, now);
}

/**
 * Replaces one element with the result of `change`.
 *
 * The callback receives the element already narrowed by the caller's own switch,
 * which keeps kind-specific edits type-safe without this module growing one
 * function per field per kind.
 */
export function mapElement(
  project: StoryProject,
  id: string,
  change: (element: StoryElement) => StoryElement,
  now: string,
): StoryProject {
  const index = project.layers.findIndex((layer) => layer.id === id);
  if (index === -1) return project;

  const current = project.layers[index];
  if (current === undefined) return project;
  if (current.locked) return project;

  const next = change(current);
  if (next === current) return project;
  // A change that renames the element is a replace, not an edit, and would break
  // selection and undo in ways that are hard to see. Refuse it here.
  if (next.id !== current.id || next.kind !== current.kind) return project;

  const layers = [...project.layers];
  layers[index] = next;
  return touch({ ...project, layers }, now);
}

export const moveElement = (
  project: StoryProject,
  id: string,
  dx: number,
  dy: number,
  now: string,
): StoryProject =>
  mapElement(
    project,
    id,
    (element) => ({
      ...element,
      frame: { ...element.frame, x: element.frame.x + dx, y: element.frame.y + dy },
    }),
    now,
  );

export const setElementFrame = (
  project: StoryProject,
  id: string,
  frame: Rect,
  now: string,
): StoryProject => mapElement(project, id, (element) => ({ ...element, frame }), now);

export const setElementRotation = (
  project: StoryProject,
  id: string,
  rotation: number,
  now: string,
): StoryProject => mapElement(project, id, (element) => ({ ...element, rotation }), now);

export const setElementOpacity = (
  project: StoryProject,
  id: string,
  opacity: number,
  now: string,
): StoryProject =>
  mapElement(project, id, (element) => ({ ...element, opacity: clamp01(opacity) }), now);

/**
 * Cropping only means something for elements that have a source to crop.
 *
 * The switch is exhaustive rather than a cast, so the day a fifth element kind
 * arrives this stops compiling and someone decides what cropping means for it.
 */
export function setElementCrop(
  project: StoryProject,
  id: string,
  crop: Crop,
  now: string,
): StoryProject {
  return mapElement(
    project,
    id,
    (element) => {
      switch (element.kind) {
        case 'photo':
        case 'video':
          return { ...element, crop };
        case 'text':
        case 'paletteStrip':
          return element;
      }
    },
    now,
  );
}

/** Lock and hide bypass `mapElement`: it refuses edits to locked elements. */
export function setElementLocked(
  project: StoryProject,
  id: string,
  locked: boolean,
  now: string,
): StoryProject {
  const index = project.layers.findIndex((layer) => layer.id === id);
  const current = index === -1 ? undefined : project.layers[index];
  if (current === undefined) return project;
  const layers = [...project.layers];
  layers[index] = { ...current, locked };
  return touch({ ...project, layers }, now);
}

export function setElementHidden(
  project: StoryProject,
  id: string,
  hidden: boolean,
  now: string,
): StoryProject {
  const index = project.layers.findIndex((layer) => layer.id === id);
  const current = index === -1 ? undefined : project.layers[index];
  if (current === undefined) return project;
  const layers = [...project.layers];
  layers[index] = { ...current, hidden };
  return touch({ ...project, layers }, now);
}

export function removeElement(project: StoryProject, id: string, now: string): StoryProject {
  const layers = project.layers.filter((layer) => layer.id !== id);
  if (layers.length === project.layers.length) return project;
  // The asset stays. Undo has to be able to bring the element back, and it
  // cannot bring back a file that deletion already removed. Collection is a
  // separate, later decision — see `orphanedAssets`.
  return touch({ ...project, layers }, now);
}

export function duplicateElement(
  project: StoryProject,
  id: string,
  newId: string,
  offset: number,
  now: string,
): StoryProject {
  const source = project.layers.find((layer) => layer.id === id);
  if (source === undefined) return project;
  if (project.layers.length >= MAX_LAYERS) return project;

  const copy: StoryElement = {
    ...source,
    id: newId,
    frame: { ...source.frame, x: source.frame.x + offset, y: source.frame.y + offset },
    locked: false,
  };
  // Directly above the original, which is where a duplicate is expected to be.
  const index = project.layers.findIndex((layer) => layer.id === id);
  const layers = [...project.layers];
  layers.splice(index + 1, 0, copy);
  return touch({ ...project, layers }, now);
}

/**
 * Moves an element to an absolute position in the z-order.
 *
 * An out-of-range target clamps rather than failing: the caller is a drag on a
 * list, and a drag that goes one past the end means "the end".
 */
export function reorderElement(
  project: StoryProject,
  id: string,
  toIndex: number,
  now: string,
): StoryProject {
  const from = project.layers.findIndex((layer) => layer.id === id);
  if (from === -1) return project;

  const target = Math.min(project.layers.length - 1, Math.max(0, Math.trunc(toIndex)));
  if (target === from) return project;

  const layers = [...project.layers];
  const [moved] = layers.splice(from, 1);
  if (moved === undefined) return project;
  layers.splice(target, 0, moved);
  return touch({ ...project, layers }, now);
}

/* ----------------------------------------------------------------- assets */

export function addAsset(project: StoryProject, asset: StoryAsset, now: string): StoryProject {
  if (project.assets.some((existing) => existing.id === asset.id)) return project;
  if (project.assets.length >= MAX_LAYERS) return project;
  return touch({ ...project, assets: [...project.assets, asset] }, now);
}

/**
 * Records that an asset's bytes moved, or that a preview was finally made.
 *
 * This is the repair path for the failure `lib/photos.ts` was written about — a
 * file that is no longer where the document says. One write, whatever number of
 * elements draw it.
 */
export function updateAsset(
  project: StoryProject,
  id: string,
  patch: Partial<Pick<StoryAsset, 'uri' | 'previewUri'>>,
  now: string,
): StoryProject {
  const index = project.assets.findIndex((asset) => asset.id === id);
  const current = index === -1 ? undefined : project.assets[index];
  if (current === undefined) return project;

  const assets = [...project.assets];
  assets[index] = { ...current, ...patch };
  return touch({ ...project, assets }, now);
}

/* ---------------------------------------------------------------- document */

export const setTitle = (project: StoryProject, title: string | null, now: string): StoryProject =>
  touch({ ...project, title: title === null ? null : title.trim() || null }, now);

export const setTrack = (
  project: StoryProject,
  track: StoryProject['track'],
  now: string,
): StoryProject => touch({ ...project, track }, now);

export const setStatus = (
  project: StoryProject,
  status: StoryProject['status'],
  now: string,
): StoryProject => touch({ ...project, status }, now);

/**
 * Changes how many slides the story spans, keeping the canvas checksum true.
 *
 * Elements are not moved. Shrinking a story can leave an element beyond the last
 * slide, and that is deliberately survivable rather than destructive: the
 * element still exists, the editor can show it as off-canvas, and the author can
 * drag it back or delete it. Silently deleting someone's work to satisfy a
 * bound is the worse of the two failures.
 */
export function setSlideCount(project: StoryProject, count: number, now: string): StoryProject {
  const slideCount = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.trunc(count)));
  if (slideCount === project.slideCount) return project;
  return touch(
    { ...project, slideCount, canvas: canvasSize(formatOf(project.format), slideCount) },
    now,
  );
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
