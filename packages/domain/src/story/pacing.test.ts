import { describe, expect, it } from 'vitest';

import { readAtmosphere } from '../atmosphere';
import { unpairedPairing } from '../music';
import { deriveFacets, emptyPersonalContext, type ChromaticMemory } from '../memory';
import { makeColor } from '../palette';
import { MAX_SLIDES } from './formats';
import {
  emphasisFor,
  holdFor,
  isQuiet,
  MINIMUM_HOLD_MS,
  orderMemories,
  paceIntensities,
  paceStory,
  sequenceOrders,
} from './pacing';

const memory = (input: { id: string; hex: string; capturedAt: string }): ChromaticMemory => {
  const colors = [makeColor(input.hex, 0.6, 'dominant'), makeColor('#101010', 0.4, 'support')];
  const atmosphere = readAtmosphere(colors, 2.4);
  const pairing = unpairedPairing;

  return {
    schemaVersion: 2,
    id: input.id,
    createdAt: input.capturedAt,
    updatedAt: input.capturedAt,
    capturedAt: input.capturedAt,
    image: {
      localUri: 'file:///a.jpg',
      width: 3000,
      height: 4000,
      source: 'photo-library',
      thumbnailUri: null,
      grade: null,
    },
    palette: { colors, deltaE: 2.4, confidence: 0.9, space: 'srgb', tuned: false, source: 'photo' },
    atmosphere,
    visualAnalysis: null,
    musicPairing: pairing,
    personalContext: emptyPersonalContext,
    facets: deriveFacets({ colors, atmosphere, pairing, capturedAt: input.capturedAt }),
    collectionIds: [],
    isPinned: false,
  } as ChromaticMemory;
};

const day = (n: number) => `2026-08-${String(n).padStart(2, '0')}T09:00:00.000Z`;

const three = [
  memory({ id: 'c', hex: '#E8320C', capturedAt: day(3) }),
  memory({ id: 'a', hex: '#7C5CFF', capturedAt: day(1) }),
  memory({ id: 'b', hex: '#22D3EE', capturedAt: day(2) }),
];

describe('holds come from colour, not from a beat', () => {
  it('shortens as energy rises', () => {
    expect(holdFor(0.9, 'flow')).toBeLessThan(holdFor(0.1, 'flow'));
  });

  it('never goes below the floor, at any intensity', () => {
    for (const intensity of paceIntensities) {
      expect(holdFor(1, intensity)).toBeGreaterThanOrEqual(MINIMUM_HOLD_MS);
    }
  });

  it('drives harder at higher intensity', () => {
    expect(holdFor(0.5, 'rush')).toBeLessThan(holdFor(0.5, 'calm'));
  });

  it('clamps an out-of-range energy rather than producing nonsense', () => {
    expect(holdFor(-5, 'flow')).toBe(holdFor(0, 'flow'));
    expect(holdFor(5, 'flow')).toBe(holdFor(1, 'flow'));
  });

  it('returns whole milliseconds', () => {
    expect(Number.isInteger(holdFor(0.37, 'pulse'))).toBe(true);
  });
});

describe('emphasis', () => {
  it('stays inside 0-1 for every memory', () => {
    for (const entry of three) {
      const value = emphasisFor(entry);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('ordering', () => {
  it.each(sequenceOrders)('%s keeps every memory exactly once', (order) => {
    const ids = orderMemories(three, order).map((entry) => entry.id);
    // A sequence that dropped one would be a sequence that lost a photograph.
    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });

  it('puts a chronology in time order', () => {
    expect(orderMemories(three, 'chronological').map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('builds from quietest to most energetic', () => {
    const built = orderMemories(three, 'building');
    for (let index = 0; index < built.length - 1; index += 1) {
      expect(built[index]?.facets.energy ?? 0).toBeLessThanOrEqual(
        built[index + 1]?.facets.energy ?? 0,
      );
    }
  });

  it('is deterministic, whatever order the input arrived in', () => {
    const shuffled = [three[1]!, three[2]!, three[0]!];
    for (const order of sequenceOrders) {
      expect(orderMemories(three, order).map((entry) => entry.id)).toEqual(
        orderMemories(shuffled, order).map((entry) => entry.id),
      );
    }
  });

  it('handles zero, one and two memories without special-casing at the call site', () => {
    for (const order of sequenceOrders) {
      expect(orderMemories([], order)).toEqual([]);
      expect(orderMemories([three[0]!], order)).toHaveLength(1);
      expect(orderMemories([three[0]!, three[1]!], order)).toHaveLength(2);
    }
  });
});

describe('paceStory', () => {
  it('produces one slide per memory, in the chosen order', () => {
    const paced = paceStory({ memories: three, intensity: 'flow', order: 'chronological' });
    expect(paced.slides.map((slide) => slide.memoryId)).toEqual(['a', 'b', 'c']);
  });

  it('reports a total that is the sum of its holds', () => {
    const paced = paceStory({ memories: three, intensity: 'pulse', order: 'building' });
    expect(paced.totalMs).toBe(paced.slides.reduce((sum, slide) => sum + slide.holdMs, 0));
  });

  it('truncates rather than failing when given more than a story can hold', () => {
    const many = Array.from({ length: MAX_SLIDES + 7 }, (_, index) =>
      memory({ id: `m${index}`, hex: '#7C5CFF', capturedAt: day((index % 28) + 1) }),
    );
    const paced = paceStory({ memories: many, intensity: 'calm', order: 'chronological' });

    // A result they can edit, rather than an error to resolve before seeing
    // anything.
    expect(paced.slides).toHaveLength(MAX_SLIDES);
  });

  it('is deterministic', () => {
    const once = paceStory({ memories: three, intensity: 'rush', order: 'colour-flow' });
    const twice = paceStory({ memories: three, intensity: 'rush', order: 'colour-flow' });
    expect(once).toEqual(twice);
  });

  it('returns an empty sequence for no memories', () => {
    const paced = paceStory({ memories: [], intensity: 'flow', order: 'chronological' });
    expect(paced.slides).toEqual([]);
    expect(paced.totalMs).toBe(0);
  });

  it('carries the intensity and order it was asked for', () => {
    const paced = paceStory({ memories: three, intensity: 'calm', order: 'building' });
    expect(paced.intensity).toBe('calm');
    expect(paced.order).toBe('building');
  });
});

describe('quiet moods', () => {
  it('names the moods a building order should open with', () => {
    expect(isQuiet('serene')).toBe(true);
    expect(isQuiet('nocturnal')).toBe(true);
    expect(isQuiet('vivid')).toBe(false);
  });
});
