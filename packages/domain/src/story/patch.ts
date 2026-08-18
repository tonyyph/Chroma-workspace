import { z } from 'zod';

import { contrastRatio } from '../color';
import { textRoleSchema, type StoryElement } from './elements';
import { cropSchema } from './geometry';
import { livingPaletteConfig, livingPalettePresetSchema } from './livingPalette';
import { MAX_SLIDES } from './formats';
import type { StoryProject } from './project';

/**
 * What a composer — local or remote — is allowed to say, and how it is checked.
 *
 * **A patch against a document the app already built, never a document.** The
 * reasoning is in `05-ai-director-adr.md`: a model returning a whole project
 * would have to be trusted about element ids, asset references, canvas
 * dimensions and the weights-sum-to-one invariant. A patch against a *valid*
 * document can only ever make it differently valid, because every field it
 * touches is re-checked against the schema that already governs that document.
 *
 * **Nothing here is executable and nothing here is a free-form structure.**
 * Every field is a closed enum, a bounded number, or an id that must already
 * exist. `retainKnownExplanations` in `analysis.ts` established the principle:
 * a model cannot introduce something the pipeline never offered, and that is a
 * property of the types rather than a promise in a prompt.
 *
 * **Rejections are reported, not repaired into something plausible.** A crop
 * that is out of range is dropped and named. Silently clamping it would mean the
 * author sees a composition nobody chose and has no way to find out why.
 */

export const STORY_PATCH_VERSION = 1;

export const storyPatchSchema = z.object({
  version: z.literal(STORY_PATCH_VERSION),
  /** A short name for the composition. Never shown as fact about the memories. */
  theme: z.string().trim().max(40).nullable(),
  /** Element ids, in the order they should appear. Must be a permutation. */
  slideOrder: z.array(z.string().min(1).max(64)).max(MAX_SLIDES).nullable(),
  /** Re-crops, by element id. */
  crops: z
    .array(z.object({ elementId: z.string().min(1).max(64), crop: cropSchema }))
    .max(MAX_SLIDES),
  /** Typography changes, by element id. */
  typography: z
    .array(
      z.object({
        elementId: z.string().min(1).max(64),
        role: textRoleSchema,
        scale: z.number().min(0.5).max(3),
      }),
    )
    .max(MAX_SLIDES),
  /** A palette animation preset to apply to every strip, or null to leave them. */
  animation: livingPalettePresetSchema.nullable(),
});

export type StoryPatch = z.infer<typeof storyPatchSchema>;

export const rejectionReasons = [
  'unknown-element',
  'wrong-element-kind',
  'not-a-permutation',
  'crop-out-of-range',
  'scale-out-of-range',
  'text-unreadable',
  'element-locked',
] as const;
export type RejectionReason = (typeof rejectionReasons)[number];

export type Rejection = Readonly<{
  reason: RejectionReason;
  /** The element the rejected change referred to, when it named one. */
  elementId: string | null;
}>;

export type PatchResult = Readonly<{
  project: StoryProject;
  /** Everything that was refused, so a screen can say what was ignored. */
  rejected: readonly Rejection[];
  /** Whether anything at all was applied. */
  changed: boolean;
}>;

/**
 * The contrast a caption must reach against what sits behind it.
 *
 * 4.5:1 is the WCAG AA threshold for body text, and the domain already has the
 * maths (`contrastRatio`). A composer proposing white on pale sand is proposing
 * something nobody can read, and that is a rejection rather than a style.
 */
const MINIMUM_TEXT_CONTRAST = 4.5;

/**
 * Applies a validated patch, dropping anything that does not hold.
 *
 * Total: it never throws. A patch is untrusted input by definition — from a
 * model, from a stored proposal, from a future version of this app — and the
 * caller is a screen.
 */
export function applyStoryPatch(
  project: StoryProject,
  patch: StoryPatch,
  /** What a caption would sit on, for the contrast check. Usually the ground. */
  backgroundHex: string,
): PatchResult {
  const rejected: Rejection[] = [];
  const byId = new Map(project.layers.map((layer) => [layer.id, layer]));

  let layers = [...project.layers];
  let changed = false;

  /* ------------------------------------------------------------- ordering */

  if (patch.slideOrder !== null) {
    const proposed = patch.slideOrder;
    const known = proposed.every((id) => byId.has(id));
    const isPermutation = known && proposed.length === layers.length;

    if (!isPermutation) {
      // A reorder that adds, drops or renames an element is not a reorder. It is
      // refused whole rather than partly applied, because a half-applied order
      // is an order nobody asked for.
      rejected.push({ reason: 'not-a-permutation', elementId: null });
    } else {
      layers = proposed.flatMap((id) => {
        const layer = byId.get(id);
        return layer === undefined ? [] : [layer];
      });
      changed = true;
    }
  }

  /* ---------------------------------------------------------------- crops */

  for (const entry of patch.crops) {
    const layer = byId.get(entry.elementId);
    if (layer === undefined) {
      rejected.push({ reason: 'unknown-element', elementId: entry.elementId });
      continue;
    }
    if (layer.kind !== 'photo') {
      rejected.push({ reason: 'wrong-element-kind', elementId: entry.elementId });
      continue;
    }
    if (layer.locked) {
      // A locked element is one the author protected. A composer does not
      // override that; it reports that it wanted to.
      rejected.push({ reason: 'element-locked', elementId: entry.elementId });
      continue;
    }

    layers = replace(layers, entry.elementId, { ...layer, crop: entry.crop });
    changed = true;
  }

  /* ----------------------------------------------------------- typography */

  for (const entry of patch.typography) {
    const layer = byId.get(entry.elementId);
    if (layer === undefined) {
      rejected.push({ reason: 'unknown-element', elementId: entry.elementId });
      continue;
    }
    if (layer.kind !== 'text') {
      rejected.push({ reason: 'wrong-element-kind', elementId: entry.elementId });
      continue;
    }
    if (layer.locked) {
      rejected.push({ reason: 'element-locked', elementId: entry.elementId });
      continue;
    }
    if (contrastRatio(layer.colorHex, backgroundHex) < MINIMUM_TEXT_CONTRAST) {
      // The colour is the author's, but making this text bigger or a heavier
      // role draws attention to something unreadable. Refused with a reason the
      // screen can act on.
      rejected.push({ reason: 'text-unreadable', elementId: entry.elementId });
      continue;
    }

    layers = replace(layers, entry.elementId, {
      ...layer,
      role: entry.role,
      scale: entry.scale,
    });
    changed = true;
  }

  /* ------------------------------------------------------------ animation */

  if (patch.animation !== null) {
    const preset = patch.animation;
    layers = layers.map((layer) =>
      layer.kind === 'paletteStrip' && !layer.locked
        ? { ...layer, animation: livingPaletteConfig(preset) }
        : layer,
    );
    changed = true;
  }

  if (!changed) return { project, rejected, changed: false };

  return {
    project: {
      ...project,
      layers,
      title: patch.theme ?? project.title,
    },
    rejected,
    changed: true,
  };
}

const replace = (layers: readonly StoryElement[], id: string, next: StoryElement): StoryElement[] =>
  layers.map((layer) => (layer.id === id ? next : layer));

/**
 * Parses an untrusted patch.
 *
 * All-or-nothing, following `acceptRefinedIntent`: a malformed patch costs
 * nothing because the document it was going to change is already correct. There
 * is no partial parse and no repair — a response that does not fit the schema is
 * a response this app did not ask for.
 */
export function acceptStoryPatch(candidate: unknown): StoryPatch | null {
  const parsed = storyPatchSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
