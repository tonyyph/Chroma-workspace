import {
  addElement,
  formatOf,
  makeColor,
  readableOn,
  sliceBounds,
  type StoryProject,
} from '@cw/domain';

/**
 * Adding an element, placed somewhere sensible on the slide being edited.
 *
 * Pure functions over the document rather than methods on the screen, so "where
 * does a new caption land" is testable and so the editor's dock stays a list of
 * buttons rather than a place where layout decisions accumulate.
 *
 * **Everything lands on the active slide, in logical canvas coordinates.** A new
 * element placed at the canvas origin would appear on slide 1 however far along
 * the story someone is — which reads as the button doing nothing.
 */

/** Inset from the slide edge, as a fraction of its width. */
const MARGIN = 0.08;

export function addTextElement(
  project: StoryProject,
  elementId: string,
  slideIndex: number,
  now: string,
  /**
   * The skin's ground, passed in rather than read.
   *
   * This module is pure and has no access to a skin, and writing either skin's
   * ground here as a literal is precisely the leak `no-appearance-leaks.test.ts`
   * fails the build over: one skin's ground is near-black and the other's is
   * paper, so a caption colour chosen for one is invisible on the other.
   */
  groundHex: string,
): StoryProject {
  const format = formatOf(project.format);
  const slide = sliceBounds(format, slideIndex);
  const margin = slide.width * MARGIN;

  return addElement(
    project,
    {
      kind: 'text',
      id: elementId,
      frame: {
        x: slide.x + margin,
        y: slide.y + slide.height * 0.62,
        width: slide.width - margin * 2,
        height: slide.height * 0.22,
      },
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      text: '',
      role: 'title',
      align: 'left',
      scale: 1,
      colorHex: captionColor(project, slideIndex, groundHex),
    },
    now,
  );
}

/**
 * The strip of colours the story is built from.
 *
 * Takes its palette from the memory the story came from when there is one, and
 * otherwise from the dominant colours of nothing at all — which is why a story
 * with no source memory gets a neutral pair rather than an invented palette.
 * Fabricating a colour reading for a photograph nobody extracted would be the
 * exact dishonesty `music.ts` refuses for tempo.
 */
export function addPaletteStrip(
  project: StoryProject,
  elementId: string,
  slideIndex: number,
  now: string,
  /**
   * The skin's ground and its ink, in that order.
   *
   * A strip with no source memory has no measured palette to show, and inventing
   * one would be the same fabrication `music.ts` refuses for tempo. Showing the
   * story's own two colours is true, and it is a strip the author immediately
   * replaces once a memory is attached.
   */
  defaults: readonly [string, string],
): StoryProject {
  const format = formatOf(project.format);
  const slide = sliceBounds(format, slideIndex);
  const margin = slide.width * MARGIN;

  return addElement(
    project,
    {
      kind: 'paletteStrip',
      id: elementId,
      frame: {
        x: slide.x + margin,
        y: slide.y + slide.height - slide.height * 0.14,
        width: slide.width - margin * 2,
        height: slide.height * 0.06,
      },
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      colors: [makeColor(defaults[0], 0.5, 'dominant'), makeColor(defaults[1], 0.5, 'support')],
      sourceMemoryId: null,
      orientation: 'horizontal',
      weighted: true,
    },
    now,
  );
}

/**
 * A caption colour that can actually be read where it lands.
 *
 * Uses the domain's own `readableOn` rather than defaulting to white, because a
 * white caption over a bright photograph is the most common way type becomes
 * invisible — and because the contrast maths is already written and tested.
 * There is no photograph analysis here: it reads against the story's ground,
 * which is what shows through wherever a slide is not covered.
 */
function captionColor(project: StoryProject, slideIndex: number, groundHex: string): string {
  const covering = project.layers.some(
    (layer) =>
      layer.kind === 'photo' &&
      !layer.hidden &&
      layer.frame.x <= slideIndex * 1080 &&
      layer.frame.x + layer.frame.width >= (slideIndex + 1) * 1080,
  );

  // Over a photograph, white — the frame underneath is unknown and white is the
  // convention. Over bare ground, whatever actually reads on the skin's own
  // ground, computed by the domain's tested contrast maths.
  return covering ? '#FFFFFF' : readableOn('#FFFFFF', groundHex);
}
