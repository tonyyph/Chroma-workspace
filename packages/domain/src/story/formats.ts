import { z } from 'zod';

/**
 * The shapes a story can be exported as.
 *
 * A format is a *slide* size, not a canvas size. The canvas is however many
 * slides wide the story is, and that is the whole trick behind a seamless
 * carousel: one composition, sliced at export, rather than N compositions that
 * have to be kept in agreement with each other.
 *
 * **The pixel sizes are deliberately the ones the app already exports at**
 * (`lib/export.ts:SHARE_SIZES`). A second set of dimensions for the same three
 * ratios would mean two answers to "how big is a 4:5 share", and the one that
 * drifts is always the newer one.
 *
 * Adding a format later widens this enum, which every previously-stored project
 * still parses against. No migration is required for that, which is why only the
 * three ratios the first slice ships are defined here rather than the ten the
 * product eventually wants.
 */

export const storyFormatIds = ['portrait', 'square', 'story'] as const;
export const storyFormatIdSchema = z.enum(storyFormatIds);
export type StoryFormatId = z.infer<typeof storyFormatIdSchema>;

export type StoryFormat = Readonly<{
  id: StoryFormatId;
  /** Width of one slide, in logical canvas units. Always an integer. */
  slideWidth: number;
  /** Height of the canvas, in logical canvas units. Always an integer. */
  slideHeight: number;
  /** For copy and for sorting. Not shown raw — the UI localises it. */
  ratio: '4:5' | '1:1' | '9:16';
}>;

export const storyFormats: Readonly<Record<StoryFormatId, StoryFormat>> = {
  portrait: { id: 'portrait', slideWidth: 1080, slideHeight: 1350, ratio: '4:5' },
  square: { id: 'square', slideWidth: 1080, slideHeight: 1080, ratio: '1:1' },
  story: { id: 'story', slideWidth: 1080, slideHeight: 1920, ratio: '9:16' },
};

export const formatOf = (id: StoryFormatId): StoryFormat => storyFormats[id];

/**
 * How many slides a story may hold.
 *
 * The upper bound is the brief's, and it is also roughly where the memory
 * arithmetic stops being comfortable: twenty 1080×1350 slices at four bytes a
 * pixel is ~117MB of surface if they were ever live at once, which is why the
 * exporter renders them one at a time and disposes as it goes.
 */
export const MIN_SLIDES = 1;
export const MAX_SLIDES = 20;

/**
 * The logical canvas a story of `slideCount` slides occupies.
 *
 * Width is an exact integer multiple of the slide width. That is the property
 * the seamlessness proof rests on: there is no fractional slide boundary to
 * round, so no slice can gain or lose a column of pixels at its edge.
 */
export function canvasSize(
  format: StoryFormat,
  slideCount: number,
): { width: number; height: number } {
  return { width: format.slideWidth * slideCount, height: format.slideHeight };
}
