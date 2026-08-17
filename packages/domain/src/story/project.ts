import { z } from 'zod';

import { musicTrackReferenceSchema } from '../music';
import { storyElementSchema, type StoryElement } from './elements';
import { canvasSize, formatOf, MAX_SLIDES, MIN_SLIDES, storyFormatIdSchema } from './formats';
import { withinAllowedBounds } from './geometry';

/**
 * A story project — the document Chroma Story Studio edits.
 *
 * Written to the same rules `chromaticMemorySchema` established, because those
 * rules were learned the expensive way and this document is larger and more
 * fragile than a memory: a versioned literal, invariants enforced at parse time
 * rather than trusted, and a repository that quarantines one bad record instead
 * of losing the collection.
 *
 * **What this holds is only what exists.** The brief specifies a project that
 * also carries musical analysis, an animation timeline, AI composition metadata,
 * template origin and remix attribution. None of those features exist yet, and
 * inventing their shapes now would mean guessing at five schemas and migrating
 * away from the wrong guesses later. Each arrives with the phase that builds it,
 * as a widening with a default — which `imageRefSchema.grade` already proves
 * costs no migration. What is here is what Phase 1 actually writes and reads.
 *
 * **There is no `owner`.** The app has no accounts, no auth and no identity
 * (audit §9). A field that would be the same constant on every record, on every
 * device, is not an owner — it is a decoration that makes the document look
 * multi-user. It arrives with the backend or not at all.
 */

/* ------------------------------------------------------------------ assets */

/**
 * One imported photograph, and where its bytes actually are.
 *
 * Separated from the elements that draw it so that two elements can share one
 * import — a subject repeated across a carousel is one file, not two — and so
 * that repairing a moved file is one write rather than a walk of the layer tree.
 *
 * `uri` points at the project's own durable copy under `story-assets/`, never at
 * the picker's temporary URI. iOS purges the cache directory, and the app has
 * already been bitten by exactly that: `lib/photos.ts` exists because "a palette
 * saved in March showed a blank card in April".
 */
export const storyAssetSchema = z.object({
  id: z.string().min(1).max(64),
  uri: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /**
   * A downscaled copy for the editor, or null when it has not been made yet.
   *
   * The editor must never decode originals: twenty 48MP frames is an
   * out-of-memory crash, and `bakeGrade.ts` documents that exact failure. The
   * preview is what the canvas draws; the original is what the exporter reads.
   */
  previewUri: z.string().min(1).nullable(),
  createdAt: z.iso.datetime(),
});

export type StoryAsset = z.infer<typeof storyAssetSchema>;

/* ----------------------------------------------------------------- project */

export const STORY_SCHEMA_VERSION = 1;

/** Past this a document is not a composition; it is a memory-exhaustion test. */
export const MAX_LAYERS = 200;

export const storyProjectStatuses = ['draft', 'finished'] as const;
export const storyProjectStatusSchema = z.enum(storyProjectStatuses);
export type StoryProjectStatus = z.infer<typeof storyProjectStatusSchema>;

export const storyProjectSchema = z
  .object({
    schemaVersion: z.literal(STORY_SCHEMA_VERSION),
    id: z.string().uuid(),
    /** Null until the author names it. Never auto-filled with "Untitled 3". */
    title: z.string().trim().max(80).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),

    format: storyFormatIdSchema,
    slideCount: z.number().int().min(MIN_SLIDES).max(MAX_SLIDES),
    /**
     * The logical canvas, stored *and* checked against the format below.
     *
     * Storing it looks like the denormalisation `deriveFacets` warns about, and
     * the answer is the same one: it is stored because a project must not
     * silently re-lay-out if a format's pixel size is ever corrected, and it is
     * validated on every parse so it cannot drift. A stored value that is proven
     * on read is not duplication; it is a checksum.
     */
    canvas: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),

    /** Back to front. The array *is* the z-order; there is no `zIndex` field. */
    layers: z.array(storyElementSchema).max(MAX_LAYERS),
    assets: z.array(storyAssetSchema).max(MAX_LAYERS),

    /** Which memories this story was built from, for provenance and for Collect. */
    sourceMemoryIds: z.array(z.string().uuid()).max(MAX_SLIDES),

    /**
     * The track this story is *about*, or null.
     *
     * A reference, never audio and never a preview URL — `music.ts` forbids
     * persisting those and a test enforces it. Carried here so a music card can
     * render its required `attribution` without a network round trip, which is a
     * licence condition rather than a nicety.
     */
    track: musicTrackReferenceSchema.nullable(),

    status: storyProjectStatusSchema,
  })
  .superRefine((project, context) => {
    const format = formatOf(project.format);

    // The checksum described above. A mismatch means the document was written by
    // a build whose formats disagree with this one's — better to quarantine one
    // project than to silently redraw it at the wrong size.
    const expected = canvasSize(format, project.slideCount);
    if (project.canvas.width !== expected.width || project.canvas.height !== expected.height) {
      context.addIssue({
        code: 'custom',
        message: `Canvas must be ${expected.width}×${expected.height} for ${project.slideCount} ${project.format} slides.`,
        path: ['canvas'],
      });
    }

    // Duplicate ids make selection ambiguous and undo incorrect: two elements
    // answering to one id means an edit can land on either.
    const layerIds = project.layers.map((layer) => layer.id);
    if (new Set(layerIds).size !== layerIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Element ids must be unique.',
        path: ['layers'],
      });
    }

    const assetIds = project.assets.map((asset) => asset.id);
    if (new Set(assetIds).size !== assetIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Asset ids must be unique.',
        path: ['assets'],
      });
    }

    // A photo element pointing at nothing would draw a hole with no way to fix
    // it from the UI. A *missing file* is recoverable and expected; a missing
    // manifest entry is a bug in whatever wrote the document.
    const known = new Set(assetIds);
    project.layers.forEach((layer, index) => {
      if ((layer.kind === 'photo' || layer.kind === 'video') && !known.has(layer.assetId)) {
        context.addIssue({
          code: 'custom',
          message: `Element ${layer.id} references unknown asset ${layer.assetId}.`,
          path: ['layers', index, 'assetId'],
        });
      }
      if (!withinAllowedBounds(layer.frame, format, project.slideCount)) {
        context.addIssue({
          code: 'custom',
          message: `Element ${layer.id} sits outside the reachable canvas.`,
          path: ['layers', index, 'frame'],
        });
      }
    });
  });

export type StoryProject = z.infer<typeof storyProjectSchema>;

/* ------------------------------------------------------------- construction */

/**
 * A new, empty project.
 *
 * Takes its id and timestamp rather than making them: the domain has no clock
 * and no crypto by design, which is what lets every function here be asserted
 * against a fixed expected value instead of being mocked.
 */
export function createStoryProject(input: {
  id: string;
  format: StoryProject['format'];
  slideCount: number;
  now: string;
  title?: string | null;
  sourceMemoryIds?: readonly string[];
}): StoryProject {
  const slideCount = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.trunc(input.slideCount)));
  const project = {
    schemaVersion: STORY_SCHEMA_VERSION as typeof STORY_SCHEMA_VERSION,
    id: input.id,
    title: input.title ?? null,
    createdAt: input.now,
    updatedAt: input.now,
    format: input.format,
    slideCount,
    canvas: canvasSize(formatOf(input.format), slideCount),
    layers: [],
    assets: [],
    sourceMemoryIds: [...(input.sourceMemoryIds ?? [])],
    track: null,
    status: 'draft' as const,
  };
  return project as StoryProject;
}

/* ---------------------------------------------------------------- accessors */

export const findLayer = (project: StoryProject, id: string): StoryElement | null =>
  project.layers.find((layer) => layer.id === id) ?? null;

export const findAsset = (project: StoryProject, id: string): StoryAsset | null =>
  project.assets.find((asset) => asset.id === id) ?? null;

/**
 * Assets no element refers to any more.
 *
 * Deleting an element must not delete its file immediately — undo would then
 * restore an element whose bytes are gone. Collection happens when a project is
 * saved and its history no longer reaches the element, which is why this reports
 * rather than acts.
 */
export function orphanedAssets(project: StoryProject): readonly StoryAsset[] {
  const referenced = new Set(
    project.layers.flatMap((layer) =>
      layer.kind === 'photo' || layer.kind === 'video' ? [layer.assetId] : [],
    ),
  );
  return project.assets.filter((asset) => !referenced.has(asset.id));
}

/** Problems a stored project can have that are the *data's* fault, not ours. */
export type StoryRecordProblem = {
  index: number;
  id: string | null;
  issues: string;
  raw: unknown;
};

/**
 * Storage, as the domain sees it.
 *
 * Declared here rather than in the app for the same reason
 * `ChromaticMemoryRepository` is: it lets the editor and the autosave loop be
 * written and tested against an in-memory double, with no MMKV, no file system
 * and no Expo anywhere in the test graph.
 *
 * `listInvalid` is part of the interface rather than an implementation detail
 * because a repository that can silently drop a record is one that eventually
 * does. Making the quarantine visible in the type forces every implementation to
 * have an answer for what it did with what it could not read.
 */
export interface StoryProjectRepository {
  list(): Promise<readonly StoryProject[]>;
  get(id: string): Promise<StoryProject | null>;
  save(project: StoryProject): Promise<void>;
  remove(id: string): Promise<void>;
  listInvalid(): Promise<readonly StoryRecordProblem[]>;
}
