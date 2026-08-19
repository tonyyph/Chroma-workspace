import { z } from 'zod';

import { colorSchema } from '../palette';
import { EMPTY_EFFECTS } from './effects';
import {
  paletteOrientationSchema,
  textAlignmentSchema,
  textRoleSchema,
  type StoryElement,
} from './elements';
import { canvasSize, formatOf, MAX_SLIDES, storyFormatIdSchema } from './formats';
import { rectSchema } from './geometry';
import { livingPaletteConfigSchema } from './livingPalette';
import { createStoryProject, MAX_LAYERS, type StoryAsset, type StoryProject } from './project';

/**
 * A remix recipe: the shape of a composition, with nothing of its contents.
 *
 * **The rule this module exists to make mechanical: a recipe carries slots, not
 * content.** Where a story has a photograph, a recipe has a rectangle. Where a
 * story has a caption someone wrote, a recipe has a text slot with a role and an
 * alignment and no words. There is no field anywhere in this schema that can
 * hold a file, a URI, an asset id, or authored text — so "a remix leaked my
 * photograph" is not a bug that can be introduced by a careless caller. It is a
 * shape the type cannot express.
 *
 * `06-remix-privacy-model.md` sets out the three concepts that must never be
 * one: the private source project, the public rendered result, and this. Only
 * this one is designed to travel.
 *
 * **Palette colours do travel.** They are the composition's design — the thing
 * being shared — and they are derived measurements, not media. A remixer may
 * replace them with their own, which is what `applyRecipe` is for.
 *
 * **Captions do not travel.** A caption is something a person wrote about their
 * own memory. `06` lists it among the things never published without a separate,
 * explicit consent, and the cheapest way to honour that is to give the recipe
 * nowhere to put one.
 */

export const REMIX_RECIPE_VERSION = 1;

/** How deep a remix chain may be read. Beyond this it is a recursive load. */
export const MAX_CHAIN_DEPTH = 20;

/* --------------------------------------------------------------- slots */

const slotBase = {
  frame: rectSchema,
  rotation: z.number().min(-360).max(360),
  opacity: z.number().min(0).max(1),
};

/** Where a photograph goes. Carries no asset, no uri, no dimensions of an original. */
export const photoSlotSchema = z.object({
  ...slotBase,
  kind: z.literal('photo'),
});

/** Where words go. Carries how they are set, never what they said. */
export const textSlotSchema = z.object({
  ...slotBase,
  kind: z.literal('text'),
  role: textRoleSchema,
  align: textAlignmentSchema,
  scale: z.number().min(0.5).max(3),
});

export const paletteSlotSchema = z.object({
  ...slotBase,
  kind: z.literal('paletteStrip'),
  orientation: paletteOrientationSchema,
  weighted: z.boolean(),
  animation: livingPaletteConfigSchema.nullable(),
  /** The original's colours, as a starting point a remixer may replace. */
  colors: z.array(colorSchema).min(2).max(8),
});

export const remixSlotSchema = z.discriminatedUnion('kind', [
  photoSlotSchema,
  textSlotSchema,
  paletteSlotSchema,
]);

export type RemixSlot = z.infer<typeof remixSlotSchema>;

/* --------------------------------------------------------- attribution */

export const remixAttributionSchema = z.object({
  /** The composition this was remixed from, or null for an original. */
  sourceRecipeId: z.string().min(1).max(64).nullable(),
  /**
   * Who made the one before this.
   *
   * Nullable and free text rather than a user id, because there are no accounts
   * (audit §9). When a backend exists this becomes an identity; until then it is
   * whatever the author chose to be called, or nothing.
   */
  sourceAuthor: z.string().trim().max(60).nullable(),
  /** Ancestors, newest first. Bounded — see `MAX_CHAIN_DEPTH`. */
  chain: z.array(z.string().min(1).max(64)).max(MAX_CHAIN_DEPTH),
  createdAt: z.iso.datetime(),
});

export type RemixAttribution = z.infer<typeof remixAttributionSchema>;

/* ------------------------------------------------------------- recipe */

export const remixRecipeSchema = z
  .object({
    version: z.literal(REMIX_RECIPE_VERSION),
    id: z.string().min(1).max(64),
    /** A name for the composition, if its author gave it one. Never a caption. */
    title: z.string().trim().max(80).nullable(),
    format: storyFormatIdSchema,
    slideCount: z.number().int().min(1).max(MAX_SLIDES),
    slots: z.array(remixSlotSchema).max(MAX_LAYERS),
    attribution: remixAttributionSchema,
  })
  .superRefine((recipe, context) => {
    if (recipe.attribution.chain.length >= MAX_CHAIN_DEPTH) {
      context.addIssue({
        code: 'custom',
        message: 'Remix chain is too deep to read.',
        path: ['attribution', 'chain'],
      });
    }
  });

export type RemixRecipe = z.infer<typeof remixRecipeSchema>;

/* ------------------------------------------------------------ to recipe */

/**
 * Strips a project down to what may travel.
 *
 * Every asset reference, every source memory id, every word the author typed and
 * the whole draft state are dropped — not redacted, **not present in the
 * output's type at all**. A `video` element cannot occur (decision D2) and is
 * dropped rather than given a slot.
 */
export function toRecipe(
  project: StoryProject,
  input: { recipeId: string; now: string; sourceAuthor?: string | null },
): RemixRecipe {
  const slots = project.layers.flatMap((layer): RemixSlot[] => {
    switch (layer.kind) {
      case 'photo':
        return [
          {
            kind: 'photo',
            frame: layer.frame,
            rotation: layer.rotation,
            opacity: layer.opacity,
          },
        ];
      case 'text':
        // The slot, never the words.
        return [
          {
            kind: 'text',
            frame: layer.frame,
            rotation: layer.rotation,
            opacity: layer.opacity,
            role: layer.role,
            align: layer.align,
            scale: layer.scale,
          },
        ];
      case 'paletteStrip':
        return [
          {
            kind: 'paletteStrip',
            frame: layer.frame,
            rotation: layer.rotation,
            opacity: layer.opacity,
            orientation: layer.orientation,
            weighted: layer.weighted,
            animation: layer.animation,
            colors: layer.colors,
          },
        ];
      case 'video':
        return [];
    }
  });

  return {
    version: REMIX_RECIPE_VERSION,
    id: input.recipeId,
    title: project.title,
    format: project.format,
    slideCount: project.slideCount,
    slots,
    attribution: {
      sourceRecipeId: null,
      sourceAuthor: input.sourceAuthor ?? null,
      chain: [],
      createdAt: input.now,
    },
  };
}

/* ---------------------------------------------------------- from recipe */

export type RemixMaterials = {
  /** The remixer's own photographs, in the order they fill the photo slots. */
  readonly assets: readonly StoryAsset[];
  /** Their own palette, or null to keep the recipe's. */
  readonly colors: readonly z.infer<typeof colorSchema>[] | null;
};

export type RemixResult = Readonly<{
  project: StoryProject;
  /** Photo slots with no photograph supplied for them. */
  unfilled: number;
}>;

/**
 * Builds a new project from a recipe and the remixer's own material.
 *
 * **Nothing is inherited that the recipe did not carry.** The photographs are
 * the remixer's, the words are theirs to write, and the palette is theirs unless
 * they keep the original's. What survives is the arrangement — which is what a
 * remix is.
 *
 * An unfilled photo slot is **left out and counted**, not filled with a
 * placeholder: a slot drawn as a grey rectangle is something someone exports
 * without noticing.
 */
export function applyRecipe(
  recipe: RemixRecipe,
  materials: RemixMaterials,
  input: { storyId: string; now: string; nextId: () => string },
): RemixResult {
  const format = formatOf(recipe.format);

  let project: StoryProject = {
    ...createStoryProject({
      id: input.storyId,
      format: recipe.format,
      slideCount: recipe.slideCount,
      now: input.now,
    }),
    title: recipe.title,
    canvas: canvasSize(format, recipe.slideCount),
  };

  const assets = [...materials.assets];
  let unfilled = 0;
  const layers: StoryElement[] = [];
  const manifest: StoryAsset[] = [];

  for (const slot of recipe.slots) {
    switch (slot.kind) {
      case 'photo': {
        const asset = assets.shift();
        if (asset === undefined) {
          unfilled += 1;
          break;
        }
        manifest.push(asset);
        layers.push({
          kind: 'photo',
          id: input.nextId(),
          frame: slot.frame,
          rotation: slot.rotation,
          opacity: slot.opacity,
          locked: false,
          hidden: false,
          assetId: asset.id,
          sourceWidth: asset.width,
          sourceHeight: asset.height,
          crop: { x: 0, y: 0, width: 1, height: 1 },
          focal: { x: 0.5, y: 0.5 },
          maskAssetId: null,
          // The remixer's own composition starts clean: a recipe carries the
          // arrangement, and effects arrive with the slot in Task 6.
          effects: EMPTY_EFFECTS,
        });
        break;
      }

      case 'text':
        layers.push({
          kind: 'text',
          id: input.nextId(),
          frame: slot.frame,
          rotation: slot.rotation,
          opacity: slot.opacity,
          locked: false,
          hidden: false,
          // Empty, because the recipe carried no words and this app will not
          // invent any to put in someone else's composition.
          text: '',
          role: slot.role,
          align: slot.align,
          scale: slot.scale,
          colorHex: '#FFFFFF',
        });
        break;

      case 'paletteStrip':
        layers.push({
          kind: 'paletteStrip',
          id: input.nextId(),
          frame: slot.frame,
          rotation: slot.rotation,
          opacity: slot.opacity,
          locked: false,
          hidden: false,
          // Spread: the element schema wants a mutable array, and handing it a
          // caller's readonly one would tie the document's lifetime to theirs.
          colors: [...(materials.colors ?? slot.colors)],
          // The remixer's strip is not from any memory of theirs unless they
          // attach one; claiming a source they did not choose would be wrong.
          sourceMemoryId: null,
          orientation: slot.orientation,
          weighted: slot.weighted,
          animation: slot.animation,
        });
        break;
    }
  }

  project = { ...project, layers, assets: manifest };
  return { project, unfilled };
}

/**
 * The attribution a remix of this recipe should carry.
 *
 * The chain is **bounded and trimmed from the far end**: the nearest ancestors
 * are the ones a reader cares about, and an unbounded chain is a recursive load
 * on the device — one of the failures `06` names explicitly.
 */
export function remixAttribution(
  source: RemixRecipe,
  input: { now: string; author?: string | null },
): RemixAttribution {
  const chain = [source.id, ...source.attribution.chain].slice(0, MAX_CHAIN_DEPTH - 1);

  return {
    sourceRecipeId: source.id,
    sourceAuthor: input.author ?? source.attribution.sourceAuthor,
    chain,
    createdAt: input.now,
  };
}

/**
 * Whether attribution has been kept intact across a remix.
 *
 * Used to refuse a recipe whose chain has been shortened or whose source has
 * been dropped — "silent removal of attribution" is the first thing `06` says
 * to prevent, and the way to prevent it is to check rather than to trust.
 */
export function attributionIntact(child: RemixAttribution, parent: RemixRecipe): boolean {
  if (child.sourceRecipeId !== parent.id) return false;
  if (child.chain[0] !== parent.id) return false;

  const expected = [parent.id, ...parent.attribution.chain].slice(0, MAX_CHAIN_DEPTH - 1);
  return expected.every((id, index) => child.chain[index] === id);
}
