import { z } from 'zod';

import { canvasSize, type StoryFormat } from './formats';

/**
 * The coordinate system every element lives in, and the maths that moves between
 * it and the slides a story is finally cut into.
 *
 * **There is exactly one coordinate space for authored content: logical canvas
 * units.** The origin is the top-left of the first slide; x runs across every
 * slide in sequence; y runs down the single shared height. A slide is not a
 * space — it is a *window* onto this one, and `sliceBounds` is the only place
 * that relationship is written down.
 *
 * That choice is what makes a seamless carousel possible rather than merely
 * intended. An element that straddles slides 2 and 3 is one element with one
 * position; nothing splits it, nothing duplicates it, and no two slides can
 * disagree about where it is. The alternative — per-slide coordinates with an
 * offset bookkept somewhere — has the seam built into the data model, and no
 * amount of care at render time takes it back out.
 *
 * Everything here is pure and total. It does not know what a photograph is.
 */

export const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export type Point = z.infer<typeof pointSchema>;

export const sizeSchema = z.object({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

export type Size = z.infer<typeof sizeSchema>;

/**
 * An axis-aligned rectangle in logical canvas units.
 *
 * Deliberately **not** clamped to the canvas. Bleed is a composition technique,
 * not a mistake: a photograph that runs off the top edge and a colour field that
 * extends past the last slide are both things people mean to do, and a model
 * that forbids them makes every full-bleed layout a fight. What is bounded is
 * how far — see `MAX_OVERFLOW` — so a stray gesture cannot park an element four
 * thousand units off-canvas where it is unreachable and invisible.
 */
export const rectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});

export type Rect = z.infer<typeof rectSchema>;

/**
 * How far outside the canvas an element may sit, as a multiple of the canvas
 * dimension. One canvas-width of bleed in any direction is past any composition
 * anyone means; beyond it, an element is lost rather than placed.
 */
export const MAX_OVERFLOW = 1;

export const centerOf = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

export const rectFromCenter = (center: Point, size: Size): Rect => ({
  x: center.x - size.width / 2,
  y: center.y - size.height / 2,
  width: size.width,
  height: size.height,
});

export const translateRect = (rect: Rect, dx: number, dy: number): Rect => ({
  ...rect,
  x: rect.x + dx,
  y: rect.y + dy,
});

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export const containsPoint = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

/* ------------------------------------------------------------------ slides */

/**
 * The window slide `index` opens onto the logical canvas.
 *
 * **Every number here is an exact integer**, because `slideWidth` is an integer
 * and `index` is an integer. No rounding happens, so no slice can be a
 * half-pixel wider than its neighbour — which is the entire mechanism by which
 * a seam would otherwise appear. `slicing.ts` proves the consequence; this is
 * where it comes from.
 */
export function sliceBounds(format: StoryFormat, index: number): Rect {
  return {
    x: format.slideWidth * index,
    y: 0,
    width: format.slideWidth,
    height: format.slideHeight,
  };
}

/**
 * Which slides an element actually appears on, in order.
 *
 * Used to decide what a slice has to draw and to tell the author, honestly, that
 * the thing they just moved now crosses a boundary. An element wholly outside
 * the canvas returns an empty list rather than a nonsense index.
 */
export function slidesSpannedBy(
  rect: Rect,
  format: StoryFormat,
  slideCount: number,
): readonly number[] {
  const spanned: number[] = [];
  for (let index = 0; index < slideCount; index += 1) {
    if (rectsIntersect(rect, sliceBounds(format, index))) spanned.push(index);
  }
  return spanned;
}

/** The slide a point falls on, or null when it falls off the canvas entirely. */
export function slideAt(point: Point, format: StoryFormat, slideCount: number): number | null {
  if (point.x < 0 || point.y < 0 || point.y > format.slideHeight) return null;
  const index = Math.floor(point.x / format.slideWidth);
  return index >= 0 && index < slideCount ? index : null;
}

/**
 * A logical-canvas rect expressed relative to one slide's top-left.
 *
 * This is the *only* transform a renderer needs: draw the whole scene, once,
 * translated by `-sliceBounds(format, index).x`. Nothing else about the scene
 * changes between slides, which is why two adjacent slices agree at their shared
 * edge by construction rather than by care.
 */
export const toSlideSpace = (rect: Rect, format: StoryFormat, index: number): Rect =>
  translateRect(rect, -sliceBounds(format, index).x, 0);

/** The bounds an element is allowed to occupy, given the canvas it lives on. */
export function allowedBounds(format: StoryFormat, slideCount: number): Rect {
  const canvas = canvasSize(format, slideCount);
  return {
    x: -canvas.width * MAX_OVERFLOW,
    y: -canvas.height * MAX_OVERFLOW,
    width: canvas.width * (1 + 2 * MAX_OVERFLOW),
    height: canvas.height * (1 + 2 * MAX_OVERFLOW),
  };
}

/** Whether an element sits somewhere a person could still find and edit it. */
export const withinAllowedBounds = (
  rect: Rect,
  format: StoryFormat,
  slideCount: number,
): boolean => {
  const bounds = allowedBounds(format, slideCount);
  return (
    rect.x >= bounds.x &&
    rect.y >= bounds.y &&
    rect.x + rect.width <= bounds.x + bounds.width &&
    rect.y + rect.height <= bounds.y + bounds.height
  );
};

/* -------------------------------------------------------------------- crop */

/**
 * Which part of a source image fills an element's frame, in normalised units.
 *
 * Normalised rather than in source pixels for one reason that matters later: the
 * editor works against a downscaled preview and the exporter against the full
 * original, and a crop expressed in pixels would mean something different to
 * each of them. A fraction means the same thing at every resolution, which is
 * what makes "what you edited is what you exported" true rather than approximate.
 */
export const cropSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .superRefine((crop, context) => {
    if (crop.x + crop.width > 1 + 1e-6) {
      context.addIssue({ code: 'custom', message: 'Crop runs past the right edge.', path: ['x'] });
    }
    if (crop.y + crop.height > 1 + 1e-6) {
      context.addIssue({ code: 'custom', message: 'Crop runs past the bottom edge.', path: ['y'] });
    }
  });

export type Crop = z.infer<typeof cropSchema>;

export const fullCrop: Crop = { x: 0, y: 0, width: 1, height: 1 };

/** The crop as source pixels, for handing to a renderer that wants a rect. */
export const cropToSourceRect = (crop: Crop, source: Size): Rect => ({
  x: crop.x * source.width,
  y: crop.y * source.height,
  width: crop.width * source.width,
  height: crop.height * source.height,
});

/**
 * The crop that fills `frame` with `source` without distorting it.
 *
 * This is the *default*, not the policy. The brief is right that centre-cropping
 * every image into every format is how a composition gets ruined in translation,
 * and the cure is a focal point the author can move — which arrives with
 * cross-format adaptation. Until then a centred cover crop is the honest
 * starting position, and it is one the author can already drag.
 */
export function coverCrop(source: Size, frame: Size): Crop {
  const sourceAspect = source.width / source.height;
  const frameAspect = frame.width / frame.height;

  if (sourceAspect > frameAspect) {
    // Source is wider: keep full height, take a centred horizontal slice.
    const width = frameAspect / sourceAspect;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }
  // Source is taller (or equal): keep full width, take a centred vertical slice.
  const height = sourceAspect / frameAspect;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

/**
 * The largest rect of `source`'s aspect that fits inside `bounds`, centred.
 *
 * Used when an image is first placed: it lands whole and undistorted rather than
 * pre-cropped, so the author's first move is composition instead of repair.
 */
export function fitWithin(source: Size, bounds: Rect): Rect {
  const scale = Math.min(bounds.width / source.width, bounds.height / source.height);
  const size = { width: source.width * scale, height: source.height * scale };
  return rectFromCenter(centerOf(bounds), size);
}
