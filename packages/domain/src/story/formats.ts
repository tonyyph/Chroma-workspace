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
 * (`lib/export.ts:SHARE_SIZES`). A second set of dimensions for the same ratios
 * would mean two answers to "how big is a 4:5 share", and the one that drifts is
 * always the newer one.
 *
 * **A format is a size *and* a safe zone.** `story` and `tiktok` are the same
 * 1080×1920 and differ only in what the host app draws on top — which is a real
 * difference to an author placing a caption, and the reason they are separate
 * ids rather than one.
 *
 * Adding a format later widens this enum, and every previously-stored project
 * still parses against it. No migration is required, which is why formats arrive
 * when something can actually use them rather than all at once.
 */

export const storyFormatIds = ['portrait', 'square', 'story', 'tiktok'] as const;
export const storyFormatIdSchema = z.enum(storyFormatIds);
export type StoryFormatId = z.infer<typeof storyFormatIdSchema>;

/**
 * Where another app's chrome sits on top of the frame.
 *
 * In logical canvas units, from each edge. Nothing is *clipped* to these — a
 * full-bleed photograph is supposed to run underneath a caption bar — but
 * anything that has to stay readable belongs inside them, and the export review
 * screen draws them so the author can see what a platform will cover.
 */
export type SafeInsets = Readonly<{ top: number; right: number; bottom: number; left: number }>;

export type StoryFormat = Readonly<{
  id: StoryFormatId;
  /** Width of one slide, in logical canvas units. Always an integer. */
  slideWidth: number;
  /** Height of the canvas, in logical canvas units. Always an integer. */
  slideHeight: number;
  /** For copy and for sorting. Not shown raw — the UI localises it. */
  ratio: '4:5' | '1:1' | '9:16';
  safeInsets: SafeInsets;
}>;

const NO_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export const storyFormats: Readonly<Record<StoryFormatId, StoryFormat>> = {
  // Feed posts: the platform draws its UI outside the image, so the whole frame
  // is usable.
  portrait: {
    id: 'portrait',
    slideWidth: 1080,
    slideHeight: 1350,
    ratio: '4:5',
    safeInsets: NO_INSETS,
  },
  square: {
    id: 'square',
    slideWidth: 1080,
    slideHeight: 1080,
    ratio: '1:1',
    safeInsets: NO_INSETS,
  },
  // Instagram's story chrome: the avatar and name across the top, the reply bar
  // across the bottom.
  story: {
    id: 'story',
    slideWidth: 1080,
    slideHeight: 1920,
    ratio: '9:16',
    safeInsets: { top: 250, right: 0, bottom: 250, left: 0 },
  },
  /**
   * TikTok — the same pixels as `story`, a different safe zone.
   *
   * Not a fourth canvas size: 1080×1920 exactly as above. What differs is that
   * TikTok's right-hand action rail (follow, like, comment, share, the spinning
   * disc) covers roughly 240 units of the right edge, and its caption block sits
   * lower and taller than Instagram's reply bar. Collapsing the two would show a
   * TikTok user an Instagram safe zone, which is worse than an enum entry that
   * looks redundant.
   */
  tiktok: {
    id: 'tiktok',
    slideWidth: 1080,
    slideHeight: 1920,
    ratio: '9:16',
    safeInsets: { top: 120, right: 240, bottom: 420, left: 0 },
  },
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

/**
 * The rectangle inside one slide that no platform chrome covers.
 *
 * In logical canvas coordinates, so it can be compared directly against an
 * element's frame. A format with no insets returns the slide itself.
 */
export function safeArea(
  format: StoryFormat,
  slideIndex: number,
): { x: number; y: number; width: number; height: number } {
  const { top, right, bottom, left } = format.safeInsets;
  return {
    x: format.slideWidth * slideIndex + left,
    y: top,
    width: format.slideWidth - left - right,
    height: format.slideHeight - top - bottom,
  };
}
