import {
  addAsset,
  addElement,
  coverCrop,
  EMPTY_EFFECTS,
  createStoryProject,
  formatOf,
  paceStory,
  sliceBounds,
  type ChromaticMemory,
  type PaceIntensity,
  type SequenceOrder,
  type StoryFormatId,
  type StoryProject,
} from '@cw/domain';

/**
 * Building a story out of memories rather than out of raw photographs.
 *
 * **This is what makes colour-derived pacing possible at all.** `paceStory`
 * orders and paces from `facets.energy`, `atmosphere.contrast` and the rest —
 * signals that exist on a *memory*. The Phase 1 creation path picks files from
 * the photo library, which carry none of that, so pacing had nothing to read.
 * Starting from memories is the entry point the brief lists and the one that
 * connects the two halves of the product.
 *
 * **The palette strips are real here.** A story built from raw photographs gets
 * a placeholder pair of skin colours, because nothing has measured those files.
 * A story built from memories gets each memory's own extracted palette, at its
 * own weights — which is the product's actual claim, carried into the composition.
 *
 * Pure: it takes the ids it needs rather than generating them, and takes `now`
 * rather than reading a clock, so the whole composition is assertable.
 */

export type ComposeInput = {
  memories: readonly ChromaticMemory[];
  format: StoryFormatId;
  intensity: PaceIntensity;
  order: SequenceOrder;
  storyId: string;
  now: string;
  /** Ids for the elements and assets, one call per element. Injected for testability. */
  nextId: () => string;
};

/**
 * A memory whose photograph is gone, or that never had one.
 *
 * `LEGACY_IMAGE_URI` memories are colour-only by design — first-class in the
 * library, but there is no frame to place — so they contribute their palette and
 * no photograph rather than being silently dropped.
 */
const hasFrame = (memory: ChromaticMemory): boolean =>
  memory.image.source !== 'legacy' && memory.image.localUri.startsWith('file:');

export function composeFromMemories(input: ComposeInput): {
  project: StoryProject;
  /** Memories that contributed a palette but no photograph. */
  colourOnly: readonly string[];
} {
  const paced = paceStory({
    memories: input.memories,
    intensity: input.intensity,
    order: input.order,
  });

  const byId = new Map(input.memories.map((memory) => [memory.id, memory]));
  const ordered = paced.slides
    .map((slide) => byId.get(slide.memoryId))
    .filter((memory): memory is ChromaticMemory => memory !== undefined);

  const format = formatOf(input.format);
  const slideCount = Math.max(1, ordered.length);

  let project = createStoryProject({
    id: input.storyId,
    format: input.format,
    slideCount,
    now: input.now,
    sourceMemoryIds: ordered.map((memory) => memory.id),
  });

  const colourOnly: string[] = [];

  for (const [index, memory] of ordered.entries()) {
    const slide = sliceBounds(format, index);

    if (hasFrame(memory)) {
      const assetId = input.nextId();
      project = addAsset(
        project,
        {
          id: assetId,
          uri: memory.image.localUri,
          width: memory.image.width,
          height: memory.image.height,
          // The memory's own thumbnail is already a bounded editing copy.
          previewUri: memory.image.thumbnailUri,
          createdAt: input.now,
        },
        input.now,
      );
      project = addElement(
        project,
        {
          kind: 'photo',
          id: input.nextId(),
          frame: slide,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          assetId,
          sourceWidth: memory.image.width,
          sourceHeight: memory.image.height,
          crop: coverCrop(
            { width: memory.image.width, height: memory.image.height },
            { width: slide.width, height: slide.height },
          ),
          focal: { x: 0.5, y: 0.5 },
          maskAssetId: null,
          effects: EMPTY_EFFECTS,
        },
        input.now,
      );
    } else {
      colourOnly.push(memory.id);
    }

    // The memory's own colours, at its own weights. A colour-only memory still
    // gets this — it is the whole of what that memory is.
    const margin = slide.width * 0.08;
    project = addElement(
      project,
      {
        kind: 'paletteStrip',
        id: input.nextId(),
        frame: {
          x: slide.x + margin,
          y: slide.y + slide.height - slide.height * 0.14,
          width: slide.width - margin * 2,
          height: slide.height * (hasFrame(memory) ? 0.06 : 0.5),
        },
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        colors: memory.palette.colors,
        sourceMemoryId: memory.id,
        orientation: 'horizontal',
        weighted: true,
        animation: null,
      },
      input.now,
    );
  }

  return { project, colourOnly };
}
