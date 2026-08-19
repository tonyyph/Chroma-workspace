import type { StoryElement } from './elements';
import { canvasSize, formatOf, MAX_SLIDES, MIN_SLIDES } from './formats';
import { sliceBounds, translateRect } from './geometry';
import type { StoryProject } from './project';

/**
 * Adding, removing and reordering slides.
 *
 * **Why this is domain work and not a button.** A slide is a *window* onto one
 * logical canvas, not a container — so inserting one is not "make the array
 * longer", it is "widen the canvas and move everything to the right of here".
 * Every element's position is an absolute x in canvas units, and an operation
 * that changed `slideCount` without moving them would leave a story whose
 * pictures had all silently shifted a slide to the left.
 *
 * **Three rules, all of them about not destroying work.**
 *
 *   1. Inserting never deletes anything.
 *   2. Removing deletes only what lived *entirely* on the removed slide, and
 *      reports how much. That is what "remove this slide" means; anything
 *      broader would be a surprise.
 *   3. Reordering **refuses** when an element crosses the boundary being moved.
 *      There is no correct answer for where half a photograph goes, and picking
 *      one silently is worse than saying so.
 */

export type SlideInsert = Readonly<{ project: StoryProject }>;
export type SlideRemoval = Readonly<{ project: StoryProject; removed: number }>;
export type SlideMove = Readonly<{
  project: StoryProject;
  refused: SlideMoveRefusal | null;
  /** Ids of the elements standing in the way, so the editor can name them. */
  blocking: readonly string[];
}>;

/**
 * Inserts a blank slide at `index`, shifting everything after it right.
 *
 * `index === slideCount` appends. An index outside the range clamps rather than
 * failing: the caller is a button on a filmstrip.
 */
export function insertSlide(project: StoryProject, index: number, now: string): SlideInsert {
  if (project.slideCount >= MAX_SLIDES) return { project };

  const format = formatOf(project.format);
  const at = Math.min(project.slideCount, Math.max(0, Math.trunc(index)));
  const boundary = format.slideWidth * at;

  const layers = project.layers.map((layer) =>
    // Strictly at or past the boundary: an element ending exactly on it belongs
    // to the slide before and stays put.
    layer.frame.x >= boundary
      ? { ...layer, frame: translateRect(layer.frame, format.slideWidth, 0) }
      : layer,
  );

  const slideCount = project.slideCount + 1;
  return {
    project: {
      ...project,
      slideCount,
      canvas: canvasSize(format, slideCount),
      layers,
      updatedAt: now,
    },
  };
}

/**
 * Removes a slide and whatever lived entirely on it.
 *
 * An element that *crosses* the removed slide's boundary is kept and shifted —
 * it belongs to its neighbours too, and deleting it would take content off a
 * slide the author did not ask to remove.
 */
export function removeSlide(project: StoryProject, index: number, now: string): SlideRemoval {
  if (project.slideCount <= MIN_SLIDES) return { project, removed: 0 };

  const format = formatOf(project.format);
  const at = Math.min(project.slideCount - 1, Math.max(0, Math.trunc(index)));
  const slide = sliceBounds(format, at);
  const end = slide.x + slide.width;

  const wholly = (layer: StoryElement): boolean =>
    layer.frame.x >= slide.x && layer.frame.x + layer.frame.width <= end;

  const kept = project.layers.filter((layer) => !wholly(layer));
  const removed = project.layers.length - kept.length;

  const layers = kept.map((layer) =>
    layer.frame.x >= end
      ? { ...layer, frame: translateRect(layer.frame, -format.slideWidth, 0) }
      : layer,
  );

  const slideCount = project.slideCount - 1;
  return {
    project: {
      ...project,
      slideCount,
      canvas: canvasSize(format, slideCount),
      layers,
      updatedAt: now,
    },
    removed,
  };
}

export const slideMoveRefusals = ['crossing-element', 'out-of-range', 'no-change'] as const;
export type SlideMoveRefusal = (typeof slideMoveRefusals)[number];

/**
 * Moves a slide, taking its contents with it.
 *
 * **Refuses when anything crosses the boundaries involved.** A photograph
 * spanning slides 2 and 3 has no defined position once slide 2 moves to the end
 * — and the honest answer to "where does half of it go" is to say that this
 * cannot be done rather than to guess. The editor tells the author which element
 * is in the way, and moving or resizing it makes the operation available.
 */
export function moveSlide(project: StoryProject, from: number, to: number, now: string): SlideMove {
  const format = formatOf(project.format);
  const last = project.slideCount - 1;

  if (from < 0 || from > last || to < 0 || to > last) {
    return { project, refused: 'out-of-range', blocking: [] };
  }
  if (from === to) return { project, refused: 'no-change', blocking: [] };

  const blocking = elementsCrossingSlides(project).map((layer) => layer.id);
  if (blocking.length > 0) {
    return { project, refused: 'crossing-element', blocking };
  }

  // Which slide each slide ends up as. Built as a permutation so no element can
  // be lost or duplicated by the move.
  const order = Array.from({ length: project.slideCount }, (_, index) => index);
  const [moved] = order.splice(from, 1);
  if (moved === undefined) return { project, refused: 'out-of-range', blocking: [] };
  order.splice(to, 0, moved);

  /** Old slide index → new slide index. */
  const destination = new Map<number, number>();
  for (const [newIndex, oldIndex] of order.entries()) destination.set(oldIndex, newIndex);

  const layers = project.layers.map((layer) => {
    const oldIndex = Math.floor(layer.frame.x / format.slideWidth);
    const newIndex = destination.get(oldIndex);
    if (newIndex === undefined) return layer;

    const shift = (newIndex - oldIndex) * format.slideWidth;
    return shift === 0 ? layer : { ...layer, frame: translateRect(layer.frame, shift, 0) };
  });

  return {
    project: { ...project, layers, updatedAt: now },
    refused: null,
    blocking: [],
  };
}

/**
 * Elements that span more than one slide.
 *
 * The seamless carousel's whole point — and the reason reordering has to refuse.
 * Reported by id so the editor can name what is in the way instead of saying
 * "cannot reorder".
 *
 * Named apart from `slicing.ts`'s `crossingElements`, which answers the same
 * question from a list of slice plans. This one asks it of a project, and two
 * exports with one name would make which is which a matter of import order.
 */
export function elementsCrossingSlides(project: StoryProject): readonly StoryElement[] {
  const format = formatOf(project.format);
  return project.layers.filter((layer) => {
    const first = Math.floor(layer.frame.x / format.slideWidth);
    const lastTouched = Math.floor((layer.frame.x + layer.frame.width - 1) / format.slideWidth);
    return lastTouched > first;
  });
}
