import { z } from 'zod';

import { colorSchema, hexSchema } from '../palette';
import { cropSchema, rectSchema } from './geometry';
import { livingPaletteConfigSchema } from './livingPalette';

/**
 * The things a story is made of.
 *
 * A discriminated union on `kind`, so a renderer that forgets a case fails to
 * compile rather than drawing nothing and calling it a layout. Z-order is the
 * position in the project's `layers` array and is deliberately **not** a field:
 * two elements with the same `zIndex` is a state the array cannot represent, and
 * reordering is then a list operation rather than a renumbering pass.
 *
 * Every element carries its frame in logical canvas units (see `geometry.ts`),
 * which is what lets one element cross a slide boundary without knowing that
 * slides exist.
 */

/**
 * What every element has, whatever it draws.
 *
 * `locked` and `hidden` are separate because they solve different problems:
 * locked means "stop me from moving this by accident", hidden means "I want to
 * see what's underneath". An element that is hidden is still exported as absent,
 * not as invisible-but-present — there is no meaningful difference in the output
 * and one fewer thing to explain.
 */
const elementBase = {
  id: z.string().min(1).max(64),
  frame: rectSchema,
  /** Degrees, clockwise, about the frame's centre. */
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0).max(1),
  locked: z.boolean(),
  hidden: z.boolean(),
};

/* ------------------------------------------------------------------- photo */

export const photoElementSchema = z.object({
  ...elementBase,
  kind: z.literal('photo'),
  /**
   * A key into the project's asset manifest, never a file path.
   *
   * The indirection is what makes a project survivable. File URIs move — iOS
   * purges caches, a reinstall changes the container path, and a photograph
   * copied out of the picker lives somewhere the picker no longer knows about.
   * An asset id lets one place resolve and repair those, and lets a missing file
   * degrade into a visible, replaceable gap rather than a crash.
   */
  assetId: z.string().min(1).max(64),
  /** The original's pixel dimensions, so a crop means the same at any preview scale. */
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
  crop: cropSchema,
  /**
   * The part of the source that must survive a reframe, in normalised source
   * coordinates.
   *
   * This is what makes cross-format adaptation something other than a centre
   * crop. Moving a 4:5 composition to 9:16 has to throw away pixels, and the
   * only question worth answering is *which* — a centred crop answers "the
   * outside ones", which is how a subject standing off to the left gets cut in
   * half in the story version.
   *
   * `.default` rather than required: every project written before this field
   * existed still parses, and the centre is exactly what those projects
   * implicitly meant. The same widening `imageRefSchema.grade` uses.
   */
  focal: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    .default({ x: 0.5, y: 0.5 }),
  /**
   * A subject mask to composite through, or null for the whole frame.
   *
   * An asset id, for the same reason the photograph itself is one: a mask for a
   * 4096px frame is megabytes, and neither the document nor application state is
   * a place for pixels.
   *
   * `.default(null)` is a widening — every existing project reads as unmasked,
   * which is what it is. Nothing can set this yet: no extractor is implemented
   * (decision D4), and the app offers no control that would produce one.
   */
  maskAssetId: z.string().min(1).max(64).nullable().default(null),
});

export type PhotoElement = z.infer<typeof photoElementSchema>;

/* -------------------------------------------------------------------- text */

/**
 * Type is chosen by role, never by font name or pixel size.
 *
 * The app has two complete skins, and `swiss` sets every label and number in
 * mono while `chroma` does not. A story that stored "Space Grotesk 42px" would
 * render as chroma's idea of a title under both skins, which is exactly the
 * appearance leak `no-appearance-leaks.test.ts` fails the build over. A role is
 * a request the skin answers.
 */
export const textRoles = ['display', 'title', 'body', 'meta'] as const;
export const textRoleSchema = z.enum(textRoles);
export type TextRole = z.infer<typeof textRoleSchema>;

export const textAlignments = ['left', 'center', 'right'] as const;
export const textAlignmentSchema = z.enum(textAlignments);

export const textElementSchema = z.object({
  ...elementBase,
  kind: z.literal('text'),
  text: z.string().max(280),
  role: textRoleSchema,
  align: textAlignmentSchema,
  /**
   * Multiplier on the role's own size, not a size.
   *
   * Bounded tightly on purpose: this is the knob that adapts a headline between
   * a 1:1 post and a 9:16 story, and an unbounded one produces text that is
   * either unreadable or the entire slide. Anything outside this range is a
   * different role.
   */
  scale: z.number().min(0.5).max(3),
  colorHex: hexSchema,
});

export type TextElement = z.infer<typeof textElementSchema>;

/* ----------------------------------------------------------- palette strip */

export const paletteOrientations = ['horizontal', 'vertical'] as const;
export const paletteOrientationSchema = z.enum(paletteOrientations);

export const paletteStripElementSchema = z
  .object({
    ...elementBase,
    kind: z.literal('paletteStrip'),
    /**
     * The colours themselves, copied in — not a reference to the memory.
     *
     * A story is a finished thing. If the strip pointed at a memory, deleting
     * that memory would silently change a story the author considered done, and
     * re-tuning its palette would rewrite a composition months later. The
     * memory id is kept alongside for attribution and for an explicit "refresh
     * from source", which is a decision rather than a side effect.
     */
    colors: z.array(colorSchema).min(2).max(8),
    sourceMemoryId: z.string().uuid().nullable(),
    orientation: paletteOrientationSchema,
    /**
     * True proportions, or equal bands.
     *
     * Weighted is the default and the honest one: the whole product claims these
     * colours are what the photograph is *made of*, and an even grid quietly
     * drops the "how much" half of that claim.
     */
    weighted: z.boolean(),
    /**
     * How this strip moves, or null for a still one.
     *
     * `.default(null)` rather than required — a widening, so every project
     * written before Living Palette existed still parses, and reads as still,
     * which is exactly what those projects meant.
     *
     * Motion is a property of *this element*, not of the project, because a
     * story may hold a breathing palette on one slide and a still one on the
     * next, and a single project-wide setting could not say that.
     */
    animation: livingPaletteConfigSchema.nullable().default(null),
  })
  .superRefine((element, context) => {
    // The same invariant `chromaticMemorySchema` enforces, for the same reason:
    // every proportional band in the app divides by this sum.
    const total = element.colors.reduce((sum, color) => sum + color.weight, 0);
    if (Math.abs(total - 1) > 0.02) {
      context.addIssue({
        code: 'custom',
        message: 'Colour weights must sum to one.',
        path: ['colors'],
      });
    }
  });

export type PaletteStripElement = z.infer<typeof paletteStripElementSchema>;

/* ------------------------------------------------------------------- video */

/**
 * Defined, and deliberately impossible to construct.
 *
 * Decision D2 (`docs/creative-platform/00-repository-audit.md` §15): the app has
 * no video dependency, no video permission, no player, and Skia's offscreen
 * composition has no video frame source. Shipping video meant tripling the first
 * slice; leaving the type out entirely meant a schema migration the day it lands.
 *
 * So the case exists in the union — every `switch` over element kinds must
 * already handle it, and the exporter and renderer carry real branches for it —
 * but the schema always fails, so no document containing one can be stored or
 * loaded. When video arrives, this refinement is deleted and nothing else about
 * the document model changes.
 *
 * This is a placeholder that cannot masquerade as a feature: there is no path
 * by which a user sees a video element that does not work.
 */
export const videoElementSchema = z
  .object({
    ...elementBase,
    kind: z.literal('video'),
    assetId: z.string().min(1).max(64),
    sourceWidth: z.number().int().positive(),
    sourceHeight: z.number().int().positive(),
    crop: cropSchema,
    /** Milliseconds into the source that this element begins playing. */
    startMs: z.number().int().min(0),
    durationMs: z.number().int().positive(),
    muted: z.boolean(),
  })
  .superRefine((_element, context) => {
    context.addIssue({
      code: 'custom',
      message: 'Video elements are not supported yet (see decision D2).',
      path: ['kind'],
    });
  });

export type VideoElement = z.infer<typeof videoElementSchema>;

/* ------------------------------------------------------------------- union */

export const storyElementSchema = z.discriminatedUnion('kind', [
  photoElementSchema,
  textElementSchema,
  paletteStripElementSchema,
  videoElementSchema,
]);

export type StoryElement = z.infer<typeof storyElementSchema>;
export type StoryElementKind = StoryElement['kind'];

export const storyElementKinds = [
  'photo',
  'text',
  'paletteStrip',
  'video',
] as const satisfies readonly StoryElementKind[];

/** The kinds a person can actually add today. `video` is absent by decision D2. */
export const constructibleElementKinds = ['photo', 'text', 'paletteStrip'] as const;
export type ConstructibleElementKind = (typeof constructibleElementKinds)[number];

/**
 * Whether an element occupies space in the output.
 *
 * One predicate rather than `!hidden && opacity > 0` written in six places, so
 * the exporter and the layer list cannot drift on what "visible" means.
 */
export const isVisible = (element: StoryElement): boolean => !element.hidden && element.opacity > 0;

/** A stable, human-readable name for the layer list. Never persisted. */
export function describeElement(element: StoryElement): string {
  switch (element.kind) {
    case 'photo':
      return 'Photo';
    case 'text':
      return element.text.trim().slice(0, 24) || 'Text';
    case 'paletteStrip':
      return 'Palette';
    case 'video':
      return 'Video';
  }
}
