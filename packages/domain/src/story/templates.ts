import type { Color } from '../palette';
import { readableOn } from '../color';
import type { MusicTrackReference } from '../music';
import { formatOf, type StoryFormatId } from './formats';
import { sliceBounds, type Rect } from './geometry';

/**
 * The template families, as data rather than as screens.
 *
 * **Schema-driven, which the brief asks for and which is also the only way this
 * survives.** A template that is a hard-coded screen works at one slide count in
 * one format with one palette. These are functions from
 * `(slideCount, format, palette, track)` to a list of layout slots — so the same
 * family produces three slides or twelve, portrait or 9:16, and consumes
 * whatever colours the author's photographs actually had.
 *
 * **They contain no colours of their own.** Every colour a template places comes
 * from the palette it was handed or is computed for contrast against the ground
 * it was told about. That is what lets one template work under both skins, and
 * it is enforced by `no-appearance-leaks.test.ts` for anything in the app —
 * this module simply has no literal to leak.
 *
 * **They contain no third-party assets, no fonts and no artwork.** A template is
 * rectangles and roles. Type is requested by role and answered by the skin.
 */

export const templateFamilies = [
  'chromatic-journey',
  'sound-in-colour',
  'film-diary',
  'album-notes',
  'mood-spectrum',
  'minimal-swiss-sequence',
  'chroma-editorial',
  'before-the-song-ends',
] as const;
export type TemplateFamily = (typeof templateFamilies)[number];

/** What a template puts on a slide. Positions only — never pixels. */
export type TemplateSlot =
  | Readonly<{ kind: 'photo'; frame: Rect; slide: number }>
  | Readonly<{
      kind: 'text';
      frame: Rect;
      slide: number;
      role: 'display' | 'title' | 'body' | 'meta';
      align: 'left' | 'center' | 'right';
      /** What the slot is *for*, so a caller knows what to put in it. */
      purpose: TextPurpose;
      colorHex: string;
    }>
  | Readonly<{
      kind: 'paletteStrip';
      frame: Rect;
      slide: number;
      orientation: 'horizontal' | 'vertical';
      weighted: boolean;
      colors: readonly Color[];
    }>;

/**
 * What a text slot expects.
 *
 * A template never supplies words — the author's or nobody's. `purpose` tells a
 * caller which of the author's own strings belongs there, and a slot with
 * nothing to fill it is dropped rather than left as a prompt on an exported
 * slide.
 */
export const textPurposes = ['title', 'caption', 'track', 'index', 'date'] as const;
export type TextPurpose = (typeof textPurposes)[number];

export type TemplateInput = Readonly<{
  format: StoryFormatId;
  slideCount: number;
  /** The author's own palette. Templates consume it; they never invent one. */
  palette: readonly Color[];
  /** The ground the story sits on, for contrast. Passed in — no skin is read. */
  groundHex: string;
  /** Present only when the story carries a track. */
  track: MusicTrackReference | null;
}>;

export type StoryTemplate = Readonly<{
  family: TemplateFamily;
  /** One template per family is free, mirroring `looks.ts`. */
  free: boolean;
  /** Whether the family does anything with a track, so the UI can say so. */
  usesMusic: boolean;
  minSlides: number;
  maxSlides: number;
  build: (input: TemplateInput) => readonly TemplateSlot[];
}>;

/* ------------------------------------------------------------- helpers */

const MARGIN = 0.08;

/** Every slide's rect, so a family iterates rather than indexing. */
const slidesOf = (input: TemplateInput): readonly Rect[] => {
  const format = formatOf(input.format);
  return Array.from({ length: input.slideCount }, (_, index) => sliceBounds(format, index));
};

const inset = (slide: Rect, fraction = MARGIN): Rect => ({
  x: slide.x + slide.width * fraction,
  y: slide.y + slide.height * fraction,
  width: slide.width * (1 - fraction * 2),
  height: slide.height * (1 - fraction * 2),
});

/** A caption colour that reads on the ground it will sit on. */
const onGround = (input: TemplateInput): string => readableOn('#FFFFFF', input.groundHex);

/**
 * Full-bleed photograph on every slide.
 *
 * The shared spine of most families: what differs between them is what sits on
 * top, not whether the photograph fills the frame.
 */
const bleedPhotos = (input: TemplateInput): TemplateSlot[] =>
  slidesOf(input).map((slide, index) => ({ kind: 'photo', frame: slide, slide: index }));

/* ----------------------------------------------------------- families */

const chromaticJourney: StoryTemplate = {
  family: 'chromatic-journey',
  free: true,
  usesMusic: false,
  minSlides: 2,
  maxSlides: 20,
  build: (input) => {
    const slots: TemplateSlot[] = bleedPhotos(input);
    // One continuous palette band along the foot of every slide: the journey is
    // the colour changing under a line that does not.
    for (const [index, slide] of slidesOf(input).entries()) {
      slots.push({
        kind: 'paletteStrip',
        slide: index,
        frame: {
          x: slide.x + slide.width * MARGIN,
          y: slide.y + slide.height * 0.88,
          width: slide.width * (1 - MARGIN * 2),
          height: slide.height * 0.04,
        },
        orientation: 'horizontal',
        weighted: true,
        colors: input.palette,
      });
    }
    return slots;
  },
};

const soundInColour: StoryTemplate = {
  family: 'sound-in-colour',
  free: false,
  usesMusic: true,
  minSlides: 2,
  maxSlides: 12,
  build: (input) => {
    const slots: TemplateSlot[] = bleedPhotos(input);
    const slides = slidesOf(input);
    const last = slides[slides.length - 1];

    // The track is named once, on the last slide, and only when there is one.
    // A "track card" with no track is an empty card — the rule `livingMemory.ts`
    // already applies to its scenes.
    if (input.track !== null && last !== undefined) {
      slots.push({
        kind: 'text',
        slide: slides.length - 1,
        frame: {
          x: last.x + last.width * MARGIN,
          y: last.y + last.height * 0.74,
          width: last.width * (1 - MARGIN * 2),
          height: last.height * 0.1,
        },
        role: 'title',
        align: 'left',
        purpose: 'track',
        colorHex: onGround(input),
      });
    }
    return slots;
  },
};

const filmDiary: StoryTemplate = {
  family: 'film-diary',
  free: true,
  usesMusic: false,
  minSlides: 1,
  maxSlides: 20,
  build: (input) => {
    const slots: TemplateSlot[] = [];
    // Inset frame with a wide base, the shape of a print with a caption strip.
    for (const [index, slide] of slidesOf(input).entries()) {
      slots.push({
        kind: 'photo',
        slide: index,
        frame: {
          x: slide.x + slide.width * 0.07,
          y: slide.y + slide.height * 0.07,
          width: slide.width * 0.86,
          height: slide.height * 0.72,
        },
      });
      slots.push({
        kind: 'text',
        slide: index,
        frame: {
          x: slide.x + slide.width * 0.07,
          y: slide.y + slide.height * 0.83,
          width: slide.width * 0.86,
          height: slide.height * 0.08,
        },
        role: 'meta',
        align: 'left',
        purpose: 'date',
        colorHex: onGround(input),
      });
    }
    return slots;
  },
};

const albumNotes: StoryTemplate = {
  family: 'album-notes',
  free: false,
  usesMusic: true,
  minSlides: 1,
  maxSlides: 8,
  build: (input) => {
    const slots: TemplateSlot[] = [];
    for (const [index, slide] of slidesOf(input).entries()) {
      // A square plate high on the slide, notes beneath — the shape of a sleeve.
      //
      // Sized against the *height* as well as the width, because a square plate
      // at 78% of a 1080-wide square slide leaves no room for the strip and the
      // notes underneath it. The layout has to fit the shortest format it
      // claims to support, not only the tallest.
      const plate = Math.min(slide.width * 0.78, slide.height * 0.6);
      slots.push({
        kind: 'photo',
        slide: index,
        frame: {
          x: slide.x + (slide.width - plate) / 2,
          y: slide.y + slide.height * 0.08,
          width: plate,
          height: plate,
        },
      });
      slots.push({
        kind: 'paletteStrip',
        slide: index,
        frame: {
          x: slide.x + (slide.width - plate) / 2,
          y: slide.y + slide.height * 0.08 + plate,
          width: plate,
          height: slide.height * 0.03,
        },
        orientation: 'horizontal',
        weighted: true,
        colors: input.palette,
      });
      if (input.track !== null) {
        slots.push({
          kind: 'text',
          slide: index,
          frame: {
            x: slide.x + (slide.width - plate) / 2,
            y: slide.y + slide.height * 0.08 + plate + slide.height * 0.05,
            width: plate,
            height: slide.height * 0.09,
          },
          role: 'body',
          align: 'left',
          purpose: 'track',
          colorHex: onGround(input),
        });
      }
    }
    return slots;
  },
};

const moodSpectrum: StoryTemplate = {
  family: 'mood-spectrum',
  free: false,
  usesMusic: false,
  minSlides: 2,
  maxSlides: 20,
  build: (input) => {
    const slots: TemplateSlot[] = [];
    // The palette runs vertically down one edge and the photograph takes the
    // rest: the spectrum is beside the picture rather than under it.
    for (const [index, slide] of slidesOf(input).entries()) {
      const band = slide.width * 0.14;
      slots.push({
        kind: 'paletteStrip',
        slide: index,
        frame: { x: slide.x, y: slide.y, width: band, height: slide.height },
        orientation: 'vertical',
        weighted: true,
        colors: input.palette,
      });
      slots.push({
        kind: 'photo',
        slide: index,
        frame: {
          x: slide.x + band,
          y: slide.y,
          width: slide.width - band,
          height: slide.height,
        },
      });
    }
    return slots;
  },
};

const minimalSwissSequence: StoryTemplate = {
  family: 'minimal-swiss-sequence',
  free: true,
  usesMusic: false,
  minSlides: 2,
  maxSlides: 20,
  build: (input) => {
    const slots: TemplateSlot[] = [];
    // Generous margin, a numbered slide, nothing else. Structure from position
    // rather than from ornament — which is what Swiss is, and what makes this
    // the family that looks *right* rather than merely acceptable under it.
    for (const [index, slide] of slidesOf(input).entries()) {
      slots.push({
        kind: 'photo',
        slide: index,
        frame: {
          x: slide.x + slide.width * 0.12,
          y: slide.y + slide.height * 0.16,
          width: slide.width * 0.76,
          height: slide.height * 0.62,
        },
      });
      slots.push({
        kind: 'text',
        slide: index,
        frame: {
          x: slide.x + slide.width * 0.12,
          y: slide.y + slide.height * 0.06,
          width: slide.width * 0.76,
          height: slide.height * 0.06,
        },
        role: 'meta',
        align: 'left',
        purpose: 'index',
        colorHex: onGround(input),
      });
    }
    return slots;
  },
};

const chromaEditorial: StoryTemplate = {
  family: 'chroma-editorial',
  free: false,
  usesMusic: false,
  minSlides: 2,
  maxSlides: 20,
  build: (input) => {
    const slots: TemplateSlot[] = bleedPhotos(input);
    const first = slidesOf(input)[0];
    // One headline, on the opening slide only. A headline on every slide is a
    // magazine nobody reads past the cover.
    if (first !== undefined) {
      slots.push({
        kind: 'text',
        slide: 0,
        frame: {
          x: first.x + first.width * MARGIN,
          y: first.y + first.height * 0.62,
          width: first.width * (1 - MARGIN * 2),
          height: first.height * 0.22,
        },
        role: 'display',
        align: 'left',
        purpose: 'title',
        colorHex: onGround(input),
      });
    }
    return slots;
  },
};

const beforeTheSongEnds: StoryTemplate = {
  family: 'before-the-song-ends',
  free: false,
  usesMusic: true,
  minSlides: 3,
  maxSlides: 20,
  build: (input) => {
    const slots: TemplateSlot[] = bleedPhotos(input);
    const slides = slidesOf(input);
    const last = slides[slides.length - 1];

    // A closing slide that is the palette alone — the picture stops before the
    // music does. The full-bleed photo on that slide stays underneath; this sits
    // over it.
    if (last !== undefined) {
      slots.push({
        kind: 'paletteStrip',
        slide: slides.length - 1,
        frame: inset(last, 0.12),
        orientation: 'horizontal',
        weighted: true,
        colors: input.palette,
      });

      // The song this stopped before, named. A family called
      // `before-the-song-ends` that never says which song was declaring
      // `usesMusic` and not earning it.
      if (input.track !== null) {
        slots.push({
          kind: 'text',
          slide: slides.length - 1,
          frame: {
            x: last.x + last.width * MARGIN,
            y: last.y + last.height * 0.82,
            width: last.width * (1 - MARGIN * 2),
            height: last.height * 0.08,
          },
          role: 'meta',
          align: 'center',
          purpose: 'track',
          colorHex: onGround(input),
        });
      }
    }
    return slots;
  },
};

export const STORY_TEMPLATES: readonly StoryTemplate[] = [
  chromaticJourney,
  soundInColour,
  filmDiary,
  albumNotes,
  moodSpectrum,
  minimalSwissSequence,
  chromaEditorial,
  beforeTheSongEnds,
];

export const templateFor = (family: TemplateFamily): StoryTemplate => {
  const found = STORY_TEMPLATES.find((template) => template.family === family);
  // Total by construction: `templateFamilies` and `STORY_TEMPLATES` are checked
  // against each other by a test, so this cannot be reached.
  if (found === undefined) throw new Error(`Unknown template family: ${family}`);
  return found;
};

/**
 * Whether a family can do anything with this story.
 *
 * A music family with no track still lays out photographs — it simply omits the
 * track slot. What it must not do is present an empty card, which is why the
 * families check `input.track` rather than assuming one.
 */
export const supportsSlideCount = (template: StoryTemplate, slideCount: number): boolean =>
  slideCount >= template.minSlides && slideCount <= template.maxSlides;
