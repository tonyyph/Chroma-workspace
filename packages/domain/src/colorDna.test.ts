import { describe, expect, it } from 'vitest';

import { readAtmosphere } from './atmosphere';
import { busiestMonth, explain, MINIMUM_EVIDENCE, rarestColour, strongestMood } from './colorDna';
import { deriveFacets, emptyPersonalContext, type ChromaticMemory } from './memory';
import { unpairedPairing, type MusicTrackReference } from './music';
import { makeColor } from './palette';
import { EMPTY_STYLE_DNA, readStyleDna } from './styleDna';

const NOW = new Date('2026-08-18T09:00:00.000Z');

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

let seq = 0;
const memory = (input: { hex: string; month: string; paired?: boolean }): ChromaticMemory => {
  seq += 1;
  const colors = [makeColor(input.hex, 0.7, 'dominant'), makeColor('#101010', 0.3, 'support')];
  const atmosphere = readAtmosphere(colors, 2.4);
  const capturedAt = `${input.month}-05T09:00:00.000Z`;
  const pairing = input.paired
    ? ({ status: 'paired', selectedTrack: track, candidates: [], intent: null } as never)
    : unpairedPairing;

  return {
    schemaVersion: 2,
    id: `${seq}1111111-1111-4111-8111-111111111111`,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    capturedAt,
    image: {
      localUri: 'file:///a.jpg',
      width: 100,
      height: 100,
      source: 'photo-library',
      thumbnailUri: null,
      grade: null,
    },
    palette: { colors, deltaE: 2.4, confidence: 0.9, space: 'srgb', tuned: false, source: 'photo' },
    atmosphere,
    visualAnalysis: null,
    musicPairing: pairing,
    personalContext: emptyPersonalContext,
    facets: deriveFacets({ colors, atmosphere, pairing, capturedAt }),
    collectionIds: [],
    isPinned: false,
  } as ChromaticMemory;
};

const many = (count: number, hex: string, month = '2026-08') =>
  Array.from({ length: count }, () => memory({ hex, month }));

describe('a library too small to say anything about', () => {
  it('explains nothing below the evidence floor', () => {
    const memories = many(MINIMUM_EVIDENCE - 1, '#7C5CFF');
    expect(explain(readStyleDna(memories, NOW), memories)).toEqual([]);
  });

  it('explains nothing for an empty profile', () => {
    expect(explain(EMPTY_STYLE_DNA, [])).toEqual([]);
  });
});

describe('what it will say', () => {
  const memories = many(8, '#7C5CFF');
  const dna = readStyleDna(memories, NOW);

  it('names a recurring colour with its count and total', () => {
    const found = explain(dna, memories).find((entry) => entry.kind === 'recurring-colour');
    expect(found?.subject).toBe('#7C5CFF');
    expect(found?.count).toBe(8);
    expect(found?.total).toBe(8);
  });

  it('carries count and total on every explanation, so a reader can judge strength', () => {
    for (const entry of explain(dna, memories)) {
      expect(entry.count).toBeGreaterThan(0);
      expect(entry.total).toBeGreaterThan(0);
      expect(entry.count).toBeLessThanOrEqual(entry.total);
    }
  });

  it('never emits an explanation below the floor', () => {
    for (const entry of explain(dna, memories)) {
      expect(entry.count).toBeGreaterThanOrEqual(MINIMUM_EVIDENCE);
    }
  });

  it('is deterministic', () => {
    expect(explain(dna, memories)).toEqual(explain(readStyleDna(memories, NOW), memories));
  });
});

describe('sound is reported against paired memories, not the library', () => {
  it('uses the paired count as the total for a recurring artist', () => {
    // Four paired out of twelve. "In 60% of your memories" would be wrong, and
    // it is the kind of number nobody checks.
    const memories = [
      ...many(8, '#7C5CFF'),
      ...Array.from({ length: 4 }, () =>
        memory({ hex: '#22D3EE', month: '2026-08', paired: true }),
      ),
    ];
    const dna = readStyleDna(memories, NOW);

    const sound = explain(dna, memories).find((entry) => entry.kind === 'recurring-sound');
    expect(sound?.subject).toBe('R.E.M.');
    expect(sound?.total).toBe(4);
  });

  it('says nothing about sound when too few memories are paired', () => {
    const memories = many(8, '#7C5CFF');
    expect(
      explain(readStyleDna(memories, NOW), memories).some((e) => e.kind === 'recurring-sound'),
    ).toBe(false);
  });
});

describe('busiest month', () => {
  it('finds the month with the most memories', () => {
    const memories = [...many(5, '#7C5CFF', '2026-08'), ...many(2, '#22D3EE', '2026-07')];
    expect(busiestMonth(memories)).toEqual({ key: '2026-08', count: 5 });
  });

  it('resolves a tie to the earliest month rather than to iteration luck', () => {
    const memories = [...many(3, '#7C5CFF', '2026-08'), ...many(3, '#22D3EE', '2026-07')];
    expect(busiestMonth(memories)?.key).toBe('2026-07');
  });

  it('reports nothing for no memories', () => {
    expect(busiestMonth([])).toBeNull();
  });
});

describe('rarest colour', () => {
  it('refuses to name a colour seen only once', () => {
    // Seen once is incidental, not rare. Dressing that up would be exactly the
    // coincidence-as-pattern this module refuses.
    const memories = [...many(5, '#7C5CFF'), memory({ hex: '#E8320C', month: '2026-08' })];
    expect(rarestColour(memories)).toBeNull();
  });

  it('names the least common colour seen at least twice', () => {
    const memories = [...many(5, '#7C5CFF'), ...many(2, '#E8320C')];
    expect(rarestColour(memories)).toBe('#E8320C');
  });

  it('reports nothing for no memories', () => {
    expect(rarestColour([])).toBeNull();
  });
});

describe('strongest mood', () => {
  it('refuses to pick on a tie', () => {
    // "Your strongest mood was serene, or possibly vivid" is not a finding.
    const tied = {
      ...EMPTY_STYLE_DNA,
      memoryCount: 10,
      moods: [
        { value: 'serene' as const, weight: 5, count: 5, share: 0.5 },
        { value: 'vivid' as const, weight: 5, count: 5, share: 0.5 },
      ],
    };
    expect(strongestMood(tied)).toBeNull();
  });

  it('names a clear winner', () => {
    const clear = {
      ...EMPTY_STYLE_DNA,
      memoryCount: 10,
      moods: [
        { value: 'serene' as const, weight: 7, count: 7, share: 0.7 },
        { value: 'vivid' as const, weight: 3, count: 3, share: 0.3 },
      ],
    };
    expect(strongestMood(clear)).toBe('serene');
  });

  it('refuses below the evidence floor', () => {
    const thin = {
      ...EMPTY_STYLE_DNA,
      memoryCount: 2,
      moods: [{ value: 'serene' as const, weight: 2, count: 2, share: 1 }],
    };
    expect(strongestMood(thin)).toBeNull();
  });
});

describe('what it will never say', () => {
  it('has no explanation kind that asserts a cause', () => {
    const memories = many(10, '#7C5CFF');
    for (const entry of explain(readStyleDna(memories, NOW), memories)) {
      // Every kind is a count of something in the library. None of them is a
      // claim about why — this app has no standing to make one.
      expect(entry.kind).not.toContain('because');
      expect(entry.kind).not.toContain('personality');
    }
  });
});
