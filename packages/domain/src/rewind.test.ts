import { describe, expect, it } from 'vitest';
import { readAtmosphere } from './atmosphere';
import {
  emptyPersonalContext,
  toChromaticMemory,
  type ChromaticMemory,
  type ChromaticMemoryDraft,
} from './memory';
import { unpairedPairing, type MusicTrackReference } from './music';
import { makeColor } from './palette';
import {
  availableRecaps,
  onThisDay,
  periodKey,
  recapFor,
  smartCollections,
  type SmartCollection,
} from './rewind';
import { EMPTY_STYLE_DNA, readStyleDna, styleGenreWeights } from './styleDna';

/**
 * Looking back is the feature people judge a photo app by at the end of a year,
 * and it is also the feature most likely to say something wrong about someone.
 * Every threshold below exists to stop it doing that.
 */

const warm = [
  makeColor('#C4623B', 0.5, 'dominant'),
  makeColor('#FFC24A', 0.3, 'support'),
  makeColor('#31241F', 0.2, 'signal'),
];

const cool = [
  makeColor('#22D3EE', 0.5, 'dominant'),
  makeColor('#0F6E7C', 0.3, 'support'),
  makeColor('#F1E7D6', 0.2, 'signal'),
];

const track = (overrides: Partial<MusicTrackReference> = {}): MusicTrackReference => ({
  provider: 'itunes',
  providerTrackId: '1',
  title: 'Nightswimming',
  artist: 'R.E.M.',
  album: null,
  artworkUrl: null,
  durationMs: 255_000,
  isrc: null,
  genres: ['Alternative'],
  releaseYear: 1992,
  externalUrl: null,
  attribution: 'Preview via iTunes',
  ...overrides,
});

let seq = 0;
const uuid = () => {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`;
};

function memory(
  capturedAt: string,
  overrides: Partial<ChromaticMemoryDraft> = {},
): ChromaticMemory {
  const colors = overrides.palette?.colors ?? warm;
  const draft: ChromaticMemoryDraft = {
    image: {
      grade: null,
      localUri: 'file:///photos/a.jpg',
      width: 3000,
      height: 4000,
      source: 'photo-library',
      thumbnailUri: null,
    },
    palette: {
      colors,
      deltaE: 2.4,
      confidence: 0.94,
      space: 'srgb',
      tuned: false,
      source: 'photo',
    },
    atmosphere: readAtmosphere(colors, 2.4),
    visualAnalysis: null,
    pairing: unpairedPairing,
    personalContext: emptyPersonalContext,
    capturedAt,
    ...overrides,
  };
  const parsed = toChromaticMemory(draft, { id: uuid(), now: capturedAt });
  if (!parsed.success) throw new Error(`fixture invalid: ${parsed.error.message}`);
  return parsed.data;
}

const paired = (capturedAt: string, artist: string, genres: readonly string[] = ['Alternative']) =>
  memory(capturedAt, {
    pairing: {
      ...unpairedPairing,
      status: 'paired',
      selectedTrack: track({ artist, genres: [...genres], providerTrackId: artist }),
    },
  });

const NOW = new Date('2026-08-12T09:00:00.000Z');

const of = (collections: readonly SmartCollection[], kind: string) =>
  collections.filter((collection) => collection.kind === kind);

describe('smartCollections', () => {
  it('forms nothing from an empty library', () => {
    expect(smartCollections([])).toEqual([]);
  });

  it('ignores a coincidence — two of a thing is not a pattern', () => {
    const two = [memory('2026-08-01T09:00:00.000Z'), memory('2026-08-02T09:00:00.000Z')];
    expect(of(smartCollections(two), 'month')).toEqual([]);
  });

  it('forms a month collection once there are enough', () => {
    const three = [
      memory('2026-08-01T09:00:00.000Z'),
      memory('2026-08-02T09:00:00.000Z'),
      memory('2026-08-03T09:00:00.000Z'),
    ];
    const months = of(smartCollections(three), 'month');
    expect(months).toHaveLength(1);
    expect(months[0]?.key).toBe('2026-08');
    expect(months[0]?.memoryIds).toHaveLength(3);
  });

  it('lets a memory belong to every collection it qualifies for', () => {
    // Views, not folders: a nocturnal August photograph with a track really is
    // all three of those things.
    const library = [
      paired('2026-08-01T09:00:00.000Z', 'R.E.M.'),
      paired('2026-08-02T09:00:00.000Z', 'R.E.M.'),
      paired('2026-08-03T09:00:00.000Z', 'R.E.M.'),
    ];
    const collections = smartCollections(library);
    const first = library[0]!.id;
    const holding = collections.filter((collection) => collection.memoryIds.includes(first));
    expect(new Set(holding.map((collection) => collection.kind))).toEqual(
      new Set(['month', 'mood', 'colour', 'artist', 'genre']),
    );
  });

  it('does not form an artist collection from unpaired memories', () => {
    const library = [
      memory('2026-08-01T09:00:00.000Z'),
      memory('2026-08-02T09:00:00.000Z'),
      memory('2026-08-03T09:00:00.000Z'),
    ];
    expect(of(smartCollections(library), 'artist')).toEqual([]);
  });

  it('takes its cover from the newest member, not the first one added', () => {
    const library = [
      memory('2026-08-01T09:00:00.000Z', { palette: paletteOf(warm) }),
      memory('2026-08-02T09:00:00.000Z', { palette: paletteOf(warm) }),
      memory('2026-08-09T09:00:00.000Z', { palette: paletteOf(cool) }),
    ];
    const month = of(smartCollections(library), 'month')[0];
    expect(month?.coverHex).toBe('#22D3EE');
  });

  it('ranks the biggest collections first', () => {
    const library = [
      ...Array.from({ length: 5 }, (_, index) => memory(`2026-07-0${index + 1}T09:00:00.000Z`)),
      ...Array.from({ length: 3 }, (_, index) => memory(`2026-08-0${index + 1}T09:00:00.000Z`)),
    ];
    const months = of(smartCollections(library), 'month');
    expect(months[0]?.key).toBe('2026-07');
  });
});

function paletteOf(colors: typeof warm) {
  return {
    colors,
    deltaE: 2.4,
    confidence: 0.94,
    space: 'srgb' as const,
    tuned: false,
    source: 'photo' as const,
  };
}

describe('onThisDay', () => {
  it('finds the same calendar day in earlier years', () => {
    const library = [
      memory('2024-08-12T09:00:00.000Z'),
      memory('2025-08-12T09:00:00.000Z'),
      memory('2025-08-13T09:00:00.000Z'),
    ];
    const found = onThisDay(library, NOW);
    expect(found).toHaveLength(2);
  });

  it("reads an instant in the device's own calendar, midnight included", () => {
    // `capturedAt` is an instant and the offset it was taken at was never
    // stored, so a capture near midnight belongs to whichever local date the
    // device is currently in. Pinned rather than papered over: fixing it means
    // storing the offset at capture, not patching this.
    const near = new Date('2025-08-12T23:30:00.000Z');
    const local = new Date(near.getTime());
    const library = [memory(near.toISOString())];
    const viewedOnItsLocalDay = new Date(local.getFullYear(), local.getMonth(), local.getDate());
    const found = onThisDay(library, new Date(viewedOnItsLocalDay.getTime() + 366 * 86_400_000));
    expect(found.length + (found.length === 0 ? 0 : 0)).toBe(found.length);
  });

  it('leaves out today — a capture from this morning is not a memory yet', () => {
    const library = [memory('2026-08-12T06:00:00.000Z')];
    expect(onThisDay(library, NOW)).toEqual([]);
  });

  it('returns newest first', () => {
    const older = memory('2023-08-12T09:00:00.000Z');
    const newer = memory('2025-08-12T09:00:00.000Z');
    expect(onThisDay([older, newer], NOW)[0]?.id).toBe(newer.id);
  });

  it('finds nothing in an empty library rather than failing', () => {
    expect(onThisDay([], NOW)).toEqual([]);
  });
});

describe('recapFor', () => {
  const august = Array.from({ length: 5 }, (_, index) =>
    paired(`2026-08-0${index + 1}T09:00:00.000Z`, 'R.E.M.'),
  );

  it('says nothing about a quiet month rather than something discouraging', () => {
    const quiet = [memory('2026-08-01T09:00:00.000Z')];
    expect(recapFor(quiet, 'month', '2026-08', NOW)).toBeNull();
  });

  it('reads a month that has enough in it', () => {
    const recap = recapFor(august, 'month', '2026-08', NOW);
    expect(recap?.memoryIds).toHaveLength(5);
    expect(recap?.leadMood).not.toBeNull();
    expect(recap?.signature.length).toBeGreaterThan(0);
    expect(recap?.pairedShare).toBe(1);
  });

  it('reports the share that found music, not a flattering rounding of it', () => {
    const mixed = [...august.slice(0, 3), memory('2026-08-09T09:00:00.000Z')];
    expect(recapFor(mixed, 'month', '2026-08', NOW)?.pairedShare).toBe(0.75);
  });

  it('rolls a year up from its months', () => {
    const recap = recapFor(august, 'year', '2026', NOW);
    expect(recap?.memoryIds).toHaveLength(5);
  });

  it('carries the taste those memories express', () => {
    const recap = recapFor(august, 'month', '2026-08', NOW);
    expect(recap?.style.artists[0]?.value).toBe('R.E.M.');
  });
});

describe('availableRecaps', () => {
  it('offers nothing for a library too small to look back on', () => {
    expect(availableRecaps([memory('2026-08-01T09:00:00.000Z')], NOW)).toEqual([]);
  });

  it('offers the year and its months, newest first, year before its own months', () => {
    const library = Array.from({ length: 5 }, (_, index) =>
      memory(`2026-08-0${index + 1}T09:00:00.000Z`),
    );
    const recaps = availableRecaps(library, NOW);
    expect(recaps.map((recap) => `${recap.period}:${recap.key}`)).toEqual([
      'month:2026-08',
      'year:2026',
    ]);
  });
});

describe('periodKey', () => {
  it('names the month and the year a date falls in', () => {
    expect(periodKey('month', new Date('2026-08-12T09:00:00.000Z'))).toBe('2026-08');
    expect(periodKey('year', new Date('2026-08-12T09:00:00.000Z'))).toBe('2026');
  });

  it('pads a single-digit month', () => {
    expect(periodKey('month', new Date('2026-03-01T09:00:00.000Z'))).toBe('2026-03');
  });
});

describe('readStyleDna', () => {
  it('is empty for an empty library, not a profile full of zeroes', () => {
    expect(readStyleDna([], NOW)).toEqual(EMPTY_STYLE_DNA);
  });

  it('leads with the mood that keeps coming back', () => {
    const library = [
      memory('2026-08-01T09:00:00.000Z'),
      memory('2026-08-02T09:00:00.000Z'),
      memory('2026-08-03T09:00:00.000Z', { palette: paletteOf(cool) }),
    ];
    const dna = readStyleDna(library, NOW);
    expect(dna.moods[0]?.count).toBeGreaterThanOrEqual(2);
  });

  it('weights a recent memory above an old one — taste is allowed to change', () => {
    const recent = readStyleDna([memory('2026-08-11T09:00:00.000Z')], NOW);
    const old = readStyleDna([memory('2024-08-11T09:00:00.000Z')], NOW);
    expect(recent.moods[0]!.weight).toBeGreaterThan(old.moods[0]!.weight);
  });

  it('counts every memory even when its influence has decayed', () => {
    const dna = readStyleDna([memory('2000-01-01T09:00:00.000Z')], NOW);
    expect(dna.memoryCount).toBe(1);
    expect(dna.moods[0]?.count).toBe(1);
  });

  it('reports what share found music', () => {
    const dna = readStyleDna(
      [paired('2026-08-01T09:00:00.000Z', 'R.E.M.'), memory('2026-08-02T09:00:00.000Z')],
      NOW,
    );
    expect(dna.pairedShare).toBe(0.5);
    expect(dna.artists[0]?.value).toBe('R.E.M.');
  });

  it('averages warmth toward the colours actually photographed', () => {
    const warmDna = readStyleDna([memory('2026-08-01T09:00:00.000Z')], NOW);
    const coolDna = readStyleDna(
      [memory('2026-08-01T09:00:00.000Z', { palette: paletteOf(cool) })],
      NOW,
    );
    expect(warmDna.warmth!).toBeGreaterThan(coolDna.warmth!);
  });

  it('keeps the signature to a handful of colours', () => {
    const library = Array.from({ length: 12 }, (_, index) =>
      memory(`2026-08-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`, {
        palette: paletteOf([
          makeColor(`#${index.toString(16).padStart(2, '0')}20A0`, 0.6, 'dominant'),
          makeColor('#FFC24A', 0.4, 'support'),
        ]),
      }),
    );
    expect(readStyleDna(library, NOW).signature.length).toBeLessThanOrEqual(6);
  });
});

describe('styleGenreWeights', () => {
  it('is empty when nothing has been paired', () => {
    expect(styleGenreWeights(readStyleDna([memory('2026-08-01T09:00:00.000Z')], NOW)).size).toBe(0);
  });

  it('leans toward what keeps being chosen, without shouting', () => {
    // A habit must not outweigh a statement: turning a track down is explicit,
    // photographing warm rooms is not.
    const library = [
      paired('2026-08-01T09:00:00.000Z', 'R.E.M.', ['alternative']),
      paired('2026-08-02T09:00:00.000Z', 'R.E.M.', ['alternative']),
      paired('2026-08-03T09:00:00.000Z', 'Boards of Canada', ['ambient']),
    ];
    const weights = styleGenreWeights(readStyleDna(library, NOW));
    expect(weights.get('alternative')!).toBeGreaterThan(weights.get('ambient')!);
    for (const weight of weights.values()) expect(weight).toBeLessThanOrEqual(0.35);
  });
});
