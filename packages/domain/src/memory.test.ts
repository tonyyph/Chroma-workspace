import { describe, expect, it } from 'vitest';

import { readAtmosphere } from './atmosphere';
import {
  chromaticMemorySchema,
  deriveFacets,
  emptyPersonalContext,
  isColorOnly,
  LEGACY_IMAGE_URI,
  toChromaticMemory,
  withSelectedTrack,
  type ChromaticMemoryDraft,
} from './memory';
import { unpairedPairing, type MusicPairing, type MusicTrackReference } from './music';
import { makeColor } from './palette';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-10T12:00:00.000Z';

const colors = [
  makeColor('#7C5CFF', 0.5, 'dominant'),
  makeColor('#4A3AA8', 0.3, 'support'),
  makeColor('#22D3EE', 0.2, 'signal'),
];

const draft = (overrides: Partial<ChromaticMemoryDraft> = {}): ChromaticMemoryDraft => ({
  image: {
    localUri: 'file:///photos/a.jpg',
    width: 3000,
    height: 4000,
    source: 'photo-library',
    thumbnailUri: null,
  },
  palette: { colors, deltaE: 2.4, confidence: 0.94, space: 'srgb', tuned: false, source: 'photo' },
  atmosphere: readAtmosphere(colors, 2.4),
  visualAnalysis: null,
  pairing: unpairedPairing,
  personalContext: emptyPersonalContext,
  capturedAt: NOW,
  ...overrides,
});

const track: MusicTrackReference = {
  provider: 'itunes',
  providerTrackId: '12345',
  title: 'Nightswimming',
  artist: 'R.E.M.',
  album: 'Automatic for the People',
  artworkUrl: 'https://example.test/art.jpg',
  durationMs: 256_000,
  isrc: null,
  genres: ['Alternative'],
  releaseYear: 1992,
  externalUrl: 'https://music.apple.com/track/12345',
  attribution: 'Preview via Apple Music',
};

describe('toChromaticMemory', () => {
  it('builds a valid memory from a draft', () => {
    const result = toChromaticMemory(draft(), { id: ID, now: NOW });
    expect(result.success).toBe(true);
  });

  it('saves as unpaired when the user never reached the music step', () => {
    const memory = toChromaticMemory(draft(), { id: ID, now: NOW }).data!;
    expect(memory.musicPairing.status).toBe('unpaired');
    expect(memory.facets.paired).toBe(false);
  });

  it('normalises a still-loading pairing to unpaired rather than refusing to save', () => {
    // Pressing save while music is in flight is a save, not an error.
    const pending: MusicPairing = { ...unpairedPairing, status: 'pending' };
    const memory = toChromaticMemory(draft({ pairing: pending }), { id: ID, now: NOW }).data!;
    expect(memory.musicPairing.status).toBe('unpaired');
  });

  it('derives facets that agree with the palette', () => {
    const memory = toChromaticMemory(draft(), { id: ID, now: NOW }).data!;
    expect(memory.facets.dominantHex).toBe('#7C5CFF');
    expect(memory.facets.monthKey).toBe('2026-08');
    expect(memory.facets.mood).toBe(memory.atmosphere.mood);
  });
});

describe('the memory invariants', () => {
  const valid = toChromaticMemory(draft(), { id: ID, now: NOW }).data!;

  it('rejects colour weights that do not sum to one', () => {
    const broken = {
      ...valid,
      palette: {
        ...valid.palette,
        colors: [makeColor('#7C5CFF', 0.2, 'dominant'), makeColor('#22D3EE', 0.2, 'support')],
      },
    };
    expect(chromaticMemorySchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a repeated named role', () => {
    const broken = {
      ...valid,
      palette: {
        ...valid.palette,
        colors: [makeColor('#7C5CFF', 0.5, 'dominant'), makeColor('#22D3EE', 0.5, 'dominant')],
      },
    };
    expect(chromaticMemorySchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a paired memory with no track', () => {
    const broken = {
      ...valid,
      musicPairing: { ...valid.musicPairing, status: 'paired' as const, selectedTrack: null },
    };
    const result = chromaticMemorySchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain('must carry its track');
  });

  it('refuses to persist the runtime pending state', () => {
    const broken = {
      ...valid,
      musicPairing: { ...valid.musicPairing, status: 'pending' as const },
    };
    expect(chromaticMemorySchema.safeParse(broken).success).toBe(false);
  });

  it('accepts every legitimate pairing state', () => {
    for (const status of ['unpaired', 'suggested', 'failed'] as const) {
      const candidate = { ...valid, musicPairing: { ...valid.musicPairing, status } };
      expect(chromaticMemorySchema.safeParse(candidate).success, status).toBe(true);
    }
    for (const status of ['paired', 'unavailable'] as const) {
      const candidate = {
        ...valid,
        musicPairing: { ...valid.musicPairing, status, selectedTrack: track },
      };
      expect(chromaticMemorySchema.safeParse(candidate).success, status).toBe(true);
    }
  });
});

describe('withSelectedTrack', () => {
  const memory = toChromaticMemory(draft(), { id: ID, now: NOW }).data!;

  it('moves the status, the track and the facets together', () => {
    const paired = withSelectedTrack(memory, track, NOW);
    expect(paired.musicPairing.status).toBe('paired');
    expect(paired.musicPairing.selectedTrack).toEqual(track);
    // The facet is what filtering reads; forgetting it is the silent failure.
    expect(paired.facets.paired).toBe(true);
    expect(paired.facets.genres).toEqual(['Alternative']);
    expect(paired.updatedAt).toBe(NOW);
  });

  it('produces a memory that still validates', () => {
    expect(chromaticMemorySchema.safeParse(withSelectedTrack(memory, track)).success).toBe(true);
  });

  it('clears any previous failure', () => {
    const failed = {
      ...memory,
      musicPairing: { ...memory.musicPairing, status: 'failed' as const, error: 'offline' as const },
    };
    expect(withSelectedTrack(failed, track).musicPairing.error).toBeNull();
  });
});

describe('colour-only memories', () => {
  it('are recognised by the sentinel', () => {
    const memory = toChromaticMemory(
      draft({
        image: {
          localUri: LEGACY_IMAGE_URI,
          width: 1,
          height: 1,
          source: 'legacy',
          thumbnailUri: null,
        },
      }),
      { id: ID, now: NOW },
    ).data!;
    expect(isColorOnly(memory.image)).toBe(true);
  });

  it('a real photograph is not one', () => {
    const memory = toChromaticMemory(draft(), { id: ID, now: NOW }).data!;
    expect(isColorOnly(memory.image)).toBe(false);
  });
});

describe('deriveFacets', () => {
  it('reports paired only when a track is actually attached', () => {
    const claimed: MusicPairing = { ...unpairedPairing, status: 'paired', selectedTrack: null };
    const facets = deriveFacets({
      colors,
      atmosphere: readAtmosphere(colors),
      pairing: claimed,
      capturedAt: NOW,
    });
    expect(facets.paired).toBe(false);
  });

  it('survives a palette whose colours carry no dominant role', () => {
    const unroled = [makeColor('#112233', 0.6), makeColor('#445566', 0.4)];
    const facets = deriveFacets({
      colors: unroled,
      atmosphere: readAtmosphere(unroled),
      pairing: unpairedPairing,
      capturedAt: NOW,
    });
    expect(facets.dominantHex).toBe('#112233');
  });
});
