import {
  addElement,
  createStoryProject,
  formatOf,
  makeColor,
  readableOn,
  sliceBounds,
  type ChromaticMemory,
  type Recap,
  type StoryFormatId,
  type StoryProject,
} from '@cw/domain';
import { composeFromMemories } from './composeFromMemories';

/**
 * A recap, as a story someone can actually post.
 *
 * **This is the bridge the two halves of the product needed.** Colour DNA reads
 * what a period was made of; Story Studio makes something shareable. Without
 * this, a recap is a screen you can look at and nothing else, and the "shareable
 * recap story" the brief asks for stays a screenshot.
 *
 * **What it shares, and what it does not.** The colours and the counts, and the
 * photographs from the recap's own memories. Never a private note, never a
 * caption the author did not write, never a location. The recap becomes an
 * ordinary `StoryProject` from that point on — editable, and nothing is
 * published by making one.
 */

/** The most slides a recap will open with. Beyond this it stops being a recap. */
const MAX_RECAP_SLIDES = 6;

export function composeRecapStory(input: {
  recap: Recap;
  memories: readonly ChromaticMemory[];
  format: StoryFormatId;
  storyId: string;
  now: string;
  nextId: () => string;
  /** The skin's ground, for a readable title. Passed in — this module reads no skin. */
  groundHex: string;
}): StoryProject {
  const members = input.memories.filter((memory) => input.recap.memoryIds.includes(memory.id));

  // The strongest few rather than all of them: a twelve-slide month is a
  // carousel nobody swipes to the end of.
  const chosen = members.slice(0, MAX_RECAP_SLIDES);

  if (chosen.length === 0) {
    return createStoryProject({
      id: input.storyId,
      format: input.format,
      slideCount: 1,
      now: input.now,
    });
  }

  // Built through the ordinary path, so a recap story is not a special kind of
  // document with its own rules — it is a story that happened to start from a
  // period.
  const { project } = composeFromMemories({
    memories: chosen,
    format: input.format,
    intensity: 'flow',
    order: 'chronological',
    storyId: input.storyId,
    now: input.now,
    nextId: input.nextId,
  });

  return withCover(project, input);
}

/**
 * A first slide that says what the period was.
 *
 * The recap's own signature colours at equal weight, and its key as a title.
 * Equal weight is deliberate and different from a memory's palette strip: these
 * colours come from *different* photographs, so there is no single "how much of
 * the picture" to be proportional to. Claiming a proportion here would be
 * inventing one.
 */
function withCover(
  project: StoryProject,
  input: {
    recap: Recap;
    now: string;
    nextId: () => string;
    groundHex: string;
    format: StoryFormatId;
  },
): StoryProject {
  const signature = input.recap.signature.slice(0, 6);
  if (signature.length < 2) return project;

  const format = formatOf(input.format);
  const slide = sliceBounds(format, 0);
  const margin = slide.width * 0.08;

  const share = 1 / signature.length;
  let next = addElement(
    project,
    {
      kind: 'paletteStrip',
      id: input.nextId(),
      frame: {
        x: slide.x + margin,
        y: slide.y + slide.height * 0.08,
        width: slide.width - margin * 2,
        height: slide.height * 0.1,
      },
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      colors: signature.map((hex, index) =>
        makeColor(hex, share, index === 0 ? 'dominant' : 'extra'),
      ),
      // Not from one memory: this is the period's signature, drawn from several.
      sourceMemoryId: null,
      orientation: 'horizontal',
      // Equal bands, and `weighted: false` says so rather than implying a
      // measurement that was never made.
      weighted: false,
      animation: null,
    },
    input.now,
  );

  next = addElement(
    next,
    {
      kind: 'text',
      id: input.nextId(),
      frame: {
        x: slide.x + margin,
        y: slide.y + slide.height * 0.2,
        width: slide.width - margin * 2,
        height: slide.height * 0.12,
      },
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      // The period key — `2026-08` or `2026`. A date, not a sentence about it.
      text: input.recap.key,
      role: 'display',
      align: 'left',
      scale: 1,
      colorHex: readableOn('#FFFFFF', input.groundHex),
    },
    input.now,
  );

  return next;
}
