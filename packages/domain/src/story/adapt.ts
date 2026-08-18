import type { StoryElement } from './elements';
import { canvasSize, formatOf, safeArea, type StoryFormat, type StoryFormatId } from './formats';
import { sliceBounds, type Crop, type Rect } from './geometry';
import type { StoryProject } from './project';

/**
 * The Cross-Format Composer.
 *
 * **The problem, stated exactly.** A 4:5 slide is 1080×1350; a 9:16 slide is
 * 1080×1920. Moving a composition between them changes the *shape* of the space,
 * not just its size, so something has to give. Centre-cropping answers "throw
 * away the outside" — which is how a subject standing left of frame loses their
 * head in the story version, and why the brief says not to do it.
 *
 * **What this does instead.**
 *
 *   1. Positions are mapped by *proportion within the slide*, so an element a
 *      third of the way down stays a third of the way down.
 *   2. Photograph crops are recomputed around the element's **focal point**, so
 *      the part that mattered stays in frame even when the aspect changes.
 *   3. Type is scaled by the *width* ratio only. Scaling by area or by height
 *      makes a headline balloon in the taller format, where the extra room is
 *      vertical and a headline does not want to be taller.
 *   4. Elements are nudged inside the target's **safe area** where that is
 *      possible without moving them far — a caption that lands under TikTok's
 *      action rail is a caption nobody reads.
 *
 * Everything here is pure and produces a **new project**. The original is never
 * mutated, so adapting a story to test a 9:16 version cannot damage the 4:5 one
 * the author already finished.
 */

export type AdaptationNote = Readonly<{
  elementId: string;
  kind: 'moved-into-safe-area' | 'recropped' | 'rescaled' | 'left-outside-safe-area';
}>;

export type AdaptationResult = Readonly<{
  project: StoryProject;
  /** What was changed and why, for the review screen the brief requires. */
  notes: readonly AdaptationNote[];
}>;

/**
 * Maps a rect from one format's slide to another's, by proportion.
 *
 * Works in slide-local space and puts the result back into canvas space, which
 * is what keeps an element on the slide it started on. Doing this in canvas
 * space directly would smear elements across slide boundaries as the slide width
 * changed.
 */
export function adaptRect(
  rect: Rect,
  from: StoryFormat,
  to: StoryFormat,
  slideIndex: number,
): Rect {
  const fromSlide = sliceBounds(from, slideIndex);
  const toSlide = sliceBounds(to, slideIndex);

  const scaleX = to.slideWidth / from.slideWidth;
  const scaleY = to.slideHeight / from.slideHeight;

  const localX = rect.x - fromSlide.x;
  return {
    x: toSlide.x + localX * scaleX,
    y: rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

/**
 * A crop that fills `frame` from `source`, centred on the focal point.
 *
 * The focal point is clamped rather than honoured absolutely: a focal point at
 * the very edge would otherwise produce a crop that runs off the source, so the
 * window slides back inside and the focal point ends up as near the centre as
 * the source allows. That is the correct behaviour — the alternative is a black
 * band where the image ran out.
 */
export function focalCrop(
  source: { width: number; height: number },
  frame: { width: number; height: number },
  focal: { x: number; y: number },
): Crop {
  const sourceAspect = source.width / source.height;
  const frameAspect = frame.width / frame.height;

  // The size of the window, as a fraction of the source.
  const width = sourceAspect > frameAspect ? frameAspect / sourceAspect : 1;
  const height = sourceAspect > frameAspect ? 1 : sourceAspect / frameAspect;

  // Centre the window on the focal point, then slide it back inside the source.
  const x = clamp(focal.x - width / 2, 0, 1 - width);
  const y = clamp(focal.y - height / 2, 0, 1 - height);

  return { x, y, width, height };
}

/**
 * Nudges a rect inside a safe area, **per axis**.
 *
 * The axes are handled independently, and that is the whole subtlety. A caption
 * 900 units wide does not fit inside TikTok's 840-unit safe width, but it still
 * needs lifting off the bottom where the caption block sits. Treating "does not
 * fit" as a single verdict leaves it exactly where it was unreadable — which is
 * the bug this function was first written with.
 *
 * An axis the rect is too large for is left alone rather than shrunk: resizing
 * is a change the author did not ask for, and an element wider than the safe
 * area is often a deliberate full-bleed band.
 */
export function nudgeIntoSafeArea(rect: Rect, safe: Rect): { rect: Rect; moved: boolean } {
  const x =
    rect.width > safe.width ? rect.x : clamp(rect.x, safe.x, safe.x + safe.width - rect.width);
  const y =
    rect.height > safe.height ? rect.y : clamp(rect.y, safe.y, safe.y + safe.height - rect.height);

  if (x === rect.x && y === rect.y) return { rect, moved: false };
  return { rect: { ...rect, x, y }, moved: true };
}

/**
 * Adapts a whole project to a different format.
 *
 * Text and palette strips are nudged into the safe area; photographs are not.
 * A photograph is usually the background, it is *supposed* to run under the
 * platform's chrome, and moving it would leave a gap at the edge it moved away
 * from.
 */
export function adaptProject(
  project: StoryProject,
  targetFormat: StoryFormatId,
  now: string,
): AdaptationResult {
  const from = formatOf(project.format);
  const to = formatOf(targetFormat);
  const notes: AdaptationNote[] = [];

  if (project.format === targetFormat) {
    return { project, notes };
  }

  const widthRatio = to.slideWidth / from.slideWidth;

  const layers = project.layers.map((layer): StoryElement => {
    const slideIndex = Math.max(
      0,
      Math.min(project.slideCount - 1, Math.floor(layer.frame.x / from.slideWidth)),
    );
    const frame = adaptRect(layer.frame, from, to, slideIndex);

    switch (layer.kind) {
      case 'photo':
      case 'video': {
        // Re-crop around the focal point so the subject survives the new aspect.
        const crop = focalCrop(
          { width: layer.sourceWidth, height: layer.sourceHeight },
          frame,
          layer.kind === 'photo' ? layer.focal : { x: 0.5, y: 0.5 },
        );
        notes.push({ elementId: layer.id, kind: 'recropped' });
        return { ...layer, frame, crop };
      }

      case 'text': {
        const safe = safeArea(to, slideIndex);
        const nudged = nudgeIntoSafeArea(frame, safe);
        if (nudged.moved) notes.push({ elementId: layer.id, kind: 'moved-into-safe-area' });
        else if (!fitsInside(frame, safe)) {
          notes.push({ elementId: layer.id, kind: 'left-outside-safe-area' });
        }

        // Width ratio only — see the module comment.
        const scale = clamp(layer.scale * widthRatio, 0.5, 3);
        if (scale !== layer.scale) notes.push({ elementId: layer.id, kind: 'rescaled' });

        return { ...layer, frame: nudged.rect, scale };
      }

      case 'paletteStrip': {
        const safe = safeArea(to, slideIndex);
        const nudged = nudgeIntoSafeArea(frame, safe);
        if (nudged.moved) notes.push({ elementId: layer.id, kind: 'moved-into-safe-area' });
        return { ...layer, frame: nudged.rect };
      }
    }
  });

  return {
    project: {
      ...project,
      format: targetFormat,
      canvas: canvasSize(to, project.slideCount),
      layers,
      updatedAt: now,
    },
    notes,
  };
}

/** Which elements would sit under platform chrome in a given format. */
export function outsideSafeArea(
  project: StoryProject,
  format: StoryFormat,
): readonly StoryElement[] {
  return project.layers.filter((layer) => {
    // A photograph running under the chrome is the intended look, not a problem.
    if (layer.kind === 'photo' || layer.kind === 'video') return false;
    if (layer.hidden) return false;

    const slideIndex = Math.max(0, Math.floor(layer.frame.x / format.slideWidth));
    return !fitsInside(layer.frame, safeArea(format, slideIndex));
  });
}

const fitsInside = (rect: Rect, container: Rect): boolean =>
  rect.x >= container.x &&
  rect.y >= container.y &&
  rect.x + rect.width <= container.x + container.width &&
  rect.y + rect.height <= container.y + container.height;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));
