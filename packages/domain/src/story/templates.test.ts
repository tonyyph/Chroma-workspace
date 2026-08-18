import { describe, expect, it } from 'vitest';

import type { MusicTrackReference } from '../music';
import { makeColor, type Color } from '../palette';
import { canvasSize, formatOf, storyFormatIds, MAX_SLIDES } from './formats';
import {
  STORY_TEMPLATES,
  supportsSlideCount,
  templateFamilies,
  templateFor,
  type TemplateInput,
} from './templates';

const palette: readonly Color[] = [
  makeColor('#7C5CFF', 0.5, 'dominant'),
  makeColor('#22D3EE', 0.3, 'support'),
  makeColor('#E8320C', 0.2, 'signal'),
];

const track: MusicTrackReference = {
  provider: 'itunes',
  providerTrackId: '1',
  title: 'Nightswimming',
  artist: 'R.E.M.',
  album: null,
  artworkUrl: null,
  durationMs: 256_000,
  isrc: null,
  genres: ['Alternative'],
  releaseYear: 1992,
  externalUrl: null,
  attribution: 'Preview via Apple Music',
};

const input = (overrides: Partial<TemplateInput> = {}): TemplateInput => ({
  format: 'portrait',
  slideCount: 3,
  palette,
  groundHex: '#0C0B18',
  track: null,
  ...overrides,
});

/* ------------------------------------------------------------ the registry */

describe('the registry', () => {
  it('has one template per named family, and no others', () => {
    expect([...STORY_TEMPLATES.map((entry) => entry.family)].sort()).toEqual(
      [...templateFamilies].sort(),
    );
  });

  it('offers eight families, as the brief asks', () => {
    expect(STORY_TEMPLATES).toHaveLength(8);
  });

  it('resolves every family', () => {
    for (const family of templateFamilies) {
      expect(templateFor(family).family).toBe(family);
    }
  });

  it('leaves some families free, so the library is not a wall of locks', () => {
    // `looks.ts`: "a wall of locked chips tells someone the app is not for them".
    const free = STORY_TEMPLATES.filter((entry) => entry.free);
    expect(free.length).toBeGreaterThan(0);
    expect(free.length).toBeLessThan(STORY_TEMPLATES.length);
  });

  it('declares its slide range honestly', () => {
    for (const template of STORY_TEMPLATES) {
      expect(template.minSlides).toBeGreaterThanOrEqual(1);
      expect(template.maxSlides).toBeLessThanOrEqual(MAX_SLIDES);
      expect(template.minSlides).toBeLessThanOrEqual(template.maxSlides);
    }
  });
});

/* -------------------------------------------------------------- geometry */

describe('every family lays out at every size it claims to support', () => {
  it.each(STORY_TEMPLATES)('$family', (template) => {
    for (const format of storyFormatIds) {
      for (const slideCount of [template.minSlides, 5, template.maxSlides]) {
        if (!supportsSlideCount(template, slideCount)) continue;

        const slots = template.build(input({ format, slideCount, track }));
        expect(slots.length).toBeGreaterThan(0);

        const canvas = canvasSize(formatOf(format), slideCount);
        for (const slot of slots) {
          // Every slot is on a real slide, and inside the canvas it belongs to.
          expect(slot.slide).toBeGreaterThanOrEqual(0);
          expect(slot.slide).toBeLessThan(slideCount);

          expect(slot.frame.width).toBeGreaterThan(0);
          expect(slot.frame.height).toBeGreaterThan(0);
          expect(slot.frame.x).toBeGreaterThanOrEqual(0);
          expect(slot.frame.x + slot.frame.width).toBeLessThanOrEqual(canvas.width + 1e-6);
          expect(slot.frame.y).toBeGreaterThanOrEqual(0);
          expect(slot.frame.y + slot.frame.height).toBeLessThanOrEqual(canvas.height + 1e-6);
        }
      }
    }
  });

  it('puts each slot on the slide it says it is on', () => {
    for (const template of STORY_TEMPLATES) {
      const slideCount = Math.max(template.minSlides, 4);
      if (!supportsSlideCount(template, slideCount)) continue;

      const format = formatOf('portrait');
      for (const slot of template.build(input({ slideCount }))) {
        const left = format.slideWidth * slot.slide;
        // Within its own slide's column — a slot that claimed slide 2 and sat on
        // slide 0 would be a layout that only works at one slide count.
        expect(slot.frame.x).toBeGreaterThanOrEqual(left - 1e-6);
        expect(slot.frame.x).toBeLessThan(left + format.slideWidth);
      }
    }
  });
});

/* --------------------------------------------------------------- palette */

describe('templates consume the author’s palette and invent nothing', () => {
  it('places only colours it was handed', () => {
    for (const template of STORY_TEMPLATES) {
      const slots = template.build(input({ slideCount: Math.max(3, template.minSlides) }));
      for (const slot of slots) {
        if (slot.kind !== 'paletteStrip') continue;
        expect(slot.colors).toEqual(palette);
      }
    }
  });

  it('takes its text colour from the ground it was told about', () => {
    const onDark = STORY_TEMPLATES.flatMap((template) =>
      template.build(input({ groundHex: '#0C0B18', track })).filter((slot) => slot.kind === 'text'),
    );
    const onPaper = STORY_TEMPLATES.flatMap((template) =>
      template.build(input({ groundHex: '#F2F1EE', track })).filter((slot) => slot.kind === 'text'),
    );

    expect(onDark.length).toBeGreaterThan(0);
    // The two skins have opposite grounds; a template that hard-coded a colour
    // would produce the same one for both, which is the appearance leak.
    expect(onDark.map((slot) => (slot.kind === 'text' ? slot.colorHex : ''))).not.toEqual(
      onPaper.map((slot) => (slot.kind === 'text' ? slot.colorHex : '')),
    );
  });
});

/* ----------------------------------------------------------------- music */

describe('music families omit rather than fake', () => {
  const musical = STORY_TEMPLATES.filter((template) => template.usesMusic);

  it('there is at least one', () => {
    expect(musical.length).toBeGreaterThan(0);
  });

  it('places no track slot when there is no track', () => {
    for (const template of musical) {
      const slots = template.build(
        input({ track: null, slideCount: Math.max(3, template.minSlides) }),
      );
      // A track card with no track is an empty card — the rule `livingMemory.ts`
      // already applies to its scenes.
      expect(slots.some((slot) => slot.kind === 'text' && slot.purpose === 'track')).toBe(false);
    }
  });

  it('places one when there is', () => {
    for (const template of musical) {
      const slots = template.build(input({ track, slideCount: Math.max(3, template.minSlides) }));
      expect(slots.some((slot) => slot.kind === 'text' && slot.purpose === 'track')).toBe(true);
    }
  });

  it('a family that does not use music places no track slot even when given one', () => {
    for (const template of STORY_TEMPLATES.filter((entry) => !entry.usesMusic)) {
      const slots = template.build(input({ track, slideCount: Math.max(3, template.minSlides) }));
      expect(slots.some((slot) => slot.kind === 'text' && slot.purpose === 'track')).toBe(false);
    }
  });
});

/* ---------------------------------------------------------------- words */

describe('templates supply no words', () => {
  it('every text slot declares a purpose and carries no content', () => {
    for (const template of STORY_TEMPLATES) {
      for (const slot of template.build(input({ track, slideCount: 3 }))) {
        if (slot.kind !== 'text') continue;
        // A template says what belongs there. It never says what it says.
        expect(slot.purpose).toBeTruthy();
        expect(Object.keys(slot)).not.toContain('text');
      }
    }
  });
});

/* --------------------------------------------------------- determinism */

describe('determinism', () => {
  it('builds the same layout twice', () => {
    for (const template of STORY_TEMPLATES) {
      const once = template.build(input({ track, slideCount: 4 }));
      const twice = template.build(input({ track, slideCount: 4 }));
      expect(once).toEqual(twice);
    }
  });

  it('adapts to a different format rather than repeating one geometry', () => {
    for (const template of STORY_TEMPLATES) {
      const portrait = template.build(input({ format: 'portrait', slideCount: 3 }));
      const story = template.build(input({ format: 'story', slideCount: 3 }));

      // Same slots, different geometry. Asserted on the whole layout rather than
      // on the first slot's height: `album-notes` draws a *square* plate, which
      // is correctly the same size in both formats — the earlier assertion was
      // testing an assumption about one family, not the property.
      expect(portrait.length).toBe(story.length);
      expect(portrait).not.toEqual(story);
    }
  });
});
