import { describe, expect, it, vi } from 'vitest';

import type {
  ImageUnderstandingProvider,
  RecommendationProvider,
  VisualAnalysis,
} from './analysis';
import { readAtmosphere } from './atmosphere';
import type { MusicFeedback } from './feedback';
import { deriveIntent } from './intent';
import type { MusicPreview, MusicProvider, MusicSearchResult, MusicTrackReference } from './music';
import { runPairing, type PairingProgress } from './pairing';
import { makeColor } from './palette';

const colors = [
  makeColor('#0B1230', 0.55, 'dominant'),
  makeColor('#1E2A5A', 0.3, 'support'),
  makeColor('#C9A227', 0.15, 'signal'),
];
const atmosphere = readAtmosphere(colors, 2.4);

const track = (id: string, overrides: Partial<MusicTrackReference> = {}): MusicTrackReference => ({
  provider: 'itunes',
  providerTrackId: id,
  title: `Track ${id}`,
  artist: `Artist ${id}`,
  album: null,
  artworkUrl: null,
  durationMs: 240_000,
  isrc: null,
  genres: [],
  releaseYear: null,
  externalUrl: null,
  attribution: 'Preview via Apple Music',
  ...overrides,
});

const preview: MusicPreview = {
  url: 'https://audio.test/clip.m4a',
  durationMs: 30_000,
  expiresAt: null,
  providerSupplied: true,
};

/** A provider that answers with the tracks it was given. */
function stubMusic(
  results: readonly MusicSearchResult[],
  overrides: Partial<MusicProvider> = {},
): MusicProvider {
  return {
    id: 'itunes',
    attribution: 'Preview via Apple Music',
    search: async () => results,
    getTrack: async () => null,
    getPreview: async () => preview,
    openExternal: async () => undefined,
    ...overrides,
  };
}

const results = (count: number): MusicSearchResult[] =>
  Array.from({ length: count }, (_, index) => ({
    track: track(`t${index}`),
    matchedGenre: null,
  }));

const signal = () => new AbortController().signal;

const visual: VisualAnalysis = {
  caption: 'A harbour at dusk.',
  subjects: ['water'],
  scene: 'harbour',
  lighting: 'low',
  timeOfDay: 'dusk',
  weather: null,
  indoorOutdoor: 'outdoor',
  motion: 'still',
  confidence: 0.8,
  analysisVersion: 'test.1',
  analysedAt: '2026-08-11T12:00:00.000Z',
};

describe('runPairing · the happy path', () => {
  it('returns ranked, playable candidates', async () => {
    const outcome = await runPairing({
      atmosphere,
      music: stubMusic(results(8)),
      signal: signal(),
    });

    expect(outcome.error).toBeNull();
    expect(outcome.recommendations).toHaveLength(5);
    expect(outcome.recommendations[0]!.previewAvailable).toBe(true);
    expect(outcome.intent.genres.length).toBeGreaterThan(0);
    expect(outcome.version).toBe('1.1.itunes');
  });

  it('reports each stage in order', async () => {
    const seen: PairingProgress[] = [];
    await runPairing({
      atmosphere,
      music: stubMusic(results(5)),
      signal: signal(),
      onProgress: (progress) => seen.push(progress),
    });

    expect(seen.map((p) => p.stage)).toEqual([
      'reading-atmosphere',
      'finding-music',
      'preparing-previews',
      'done',
    ]);
    // Colour is already read by the time this pipeline starts, so it is complete
    // from the first report — which is what lets the palette show immediately.
    expect(seen[0]!.completed).toEqual(['reading-colour']);
    expect(seen[seen.length - 1]!.completed).toContain('preparing-previews');
  });

  it('is deterministic for the same inputs', async () => {
    const music = stubMusic(results(8));
    const a = await runPairing({ atmosphere, music, signal: signal() });
    const b = await runPairing({ atmosphere, music, signal: signal() });
    expect(b.recommendations.map((r) => r.track.providerTrackId)).toEqual(
      a.recommendations.map((r) => r.track.providerTrackId),
    );
  });

  it('explores different ground when the seed rotates', async () => {
    const music = stubMusic(results(8));
    const a = await runPairing({ atmosphere, music, seed: 0, signal: signal() });
    const b = await runPairing({ atmosphere, music, seed: 1, signal: signal() });
    // "Try again" changes the intent's lead genre, so it changes what is asked for.
    expect(b.intent.genres[0]).not.toBe(a.intent.genres[0]);
  });
});

describe('runPairing · partial success', () => {
  it('produces a full result with no AI providers at all', async () => {
    const outcome = await runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      signal: signal(),
    });
    // The default configuration. Not a degraded mode — the shipping one.
    expect(outcome.degraded).toEqual([]);
    expect(outcome.visualAnalysis).toBeNull();
    expect(outcome.recommendations.length).toBeGreaterThan(0);
  });

  it('keeps going when vision fails', async () => {
    const vision: ImageUnderstandingProvider = {
      id: 'test',
      version: '1',
      analyse: async () => {
        throw new Error('down');
      },
    };

    const outcome = await runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      vision,
      image: { base64: 'x', mimeType: 'image/jpeg', width: 1024, height: 768 },
      signal: signal(),
    });

    expect(outcome.degraded).toContain('vision-unavailable');
    expect(outcome.visualAnalysis).toBeNull();
    expect(outcome.recommendations.length).toBeGreaterThan(0);
    expect(outcome.error).toBeNull();
  });

  it('lets a successful vision reading move the intent', async () => {
    const vision: ImageUnderstandingProvider = {
      id: 'test',
      version: '1',
      analyse: async () => visual,
    };

    const plain = await runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      signal: signal(),
    });
    const seeing = await runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      vision,
      image: { base64: 'x', mimeType: 'image/jpeg', width: 1024, height: 768 },
      signal: signal(),
    });

    expect(seeing.visualAnalysis).toEqual(visual);
    // Dusk lowers valence and draws the intent closer.
    expect(seeing.intent.valence).toBeLessThan(plain.intent.valence);
  });

  it('falls back to the computed intent when refinement returns nonsense', async () => {
    const recommendation: RecommendationProvider = {
      id: 'test',
      version: '1',
      refineIntent: async () => ({ valence: 'not a number' }) as never,
      explain: async () => [],
    };

    const outcome = await runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      recommendation,
      signal: signal(),
    });

    expect(outcome.degraded).toContain('refine-invalid');
    expect(outcome.intent).toEqual(deriveIntent({ atmosphere, seed: 0 }));
  });

  it('drops an explanation for a track it never offered', async () => {
    const recommendation: RecommendationProvider = {
      id: 'test',
      version: '1',
      refineIntent: async ({ baseline }) => baseline,
      explain: async ({ candidates }) => [
        { providerTrackId: candidates[0]!.providerTrackId, text: 'a real reason' },
        { providerTrackId: 'a-song-that-does-not-exist', text: 'invented' },
      ],
    };

    const outcome = await runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      recommendation,
      signal: signal(),
    });

    expect(outcome.recommendations[0]!.explanation).toBe('a real reason');
    expect(JSON.stringify(outcome.recommendations)).not.toContain('invented');
    expect(outcome.recommendations.map((r) => r.track.providerTrackId)).not.toContain(
      'a-song-that-does-not-exist',
    );
  });

  it('shows cards without previews rather than hiding them', async () => {
    const music = stubMusic(results(6), { getPreview: async () => null });
    const outcome = await runPairing({ atmosphere, music, signal: signal() });

    expect(outcome.recommendations.length).toBeGreaterThan(0);
    expect(outcome.previewAvailable.size).toBe(0);
    for (const entry of outcome.recommendations) {
      expect(entry.previewAvailable).toBe(false);
    }
    // Still selectable: the user can save the pairing and open it in the store.
    expect(outcome.error).toBeNull();
  });

  it('does not treat unknown preview availability as unavailable', async () => {
    const music = stubMusic(results(6), {
      getPreview: async () => {
        throw new Error('flaky');
      },
    });
    const outcome = await runPairing({ atmosphere, music, signal: signal() });
    expect(outcome.recommendations.length).toBeGreaterThan(0);
    expect(outcome.error).toBeNull();
  });
});

describe('runPairing · failure', () => {
  it('reports a provider outage without losing the atmosphere', async () => {
    const music = stubMusic([], {
      search: async () => {
        throw new Error('offline');
      },
    });
    const outcome = await runPairing({ atmosphere, music, signal: signal() });

    expect(outcome.error).toBe('provider-unavailable');
    expect(outcome.recommendations).toEqual([]);
    // Everything needed to save a colour-only memory is still here.
    expect(outcome.atmosphere).toEqual(atmosphere);
    expect(outcome.intent.genres.length).toBeGreaterThan(0);
  });

  it('distinguishes an empty catalogue from a dead network', async () => {
    const outcome = await runPairing({
      atmosphere,
      music: stubMusic([]),
      signal: signal(),
    });
    // Different words for the user: "nothing matched" vs "we could not reach it".
    expect(outcome.error).toBe('no-results');
  });

  it('gives up on a search that never settles', async () => {
    vi.useFakeTimers();
    const music = stubMusic([], { search: () => new Promise(() => {}) });
    const promise = runPairing({ atmosphere, music, signal: signal() });
    await vi.advanceTimersByTimeAsync(7_000);
    const outcome = await promise;
    vi.useRealTimers();

    expect(outcome.error).toBe('timeout');
  });

  it('gives up on vision that never settles, and still finds music', async () => {
    vi.useFakeTimers();
    const vision: ImageUnderstandingProvider = {
      id: 'test',
      version: '1',
      analyse: () => new Promise(() => {}),
    };
    const promise = runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      vision,
      image: { base64: 'x', mimeType: 'image/jpeg', width: 1024, height: 768 },
      signal: signal(),
    });
    await vi.advanceTimersByTimeAsync(9_000);
    const outcome = await promise;
    vi.useRealTimers();

    expect(outcome.degraded).toContain('vision-timeout');
    expect(outcome.recommendations.length).toBeGreaterThan(0);
  });

  it('stops when the caller aborts', async () => {
    const controller = new AbortController();
    const music = stubMusic([], { search: () => new Promise(() => {}) });
    const promise = runPairing({ atmosphere, music, signal: controller.signal });
    controller.abort();
    // An abort is the user leaving the screen, not a provider failure.
    await expect(promise).resolves.toMatchObject({ error: 'provider-unavailable' });
  });
});

describe('runPairing · feedback', () => {
  it('sinks a track the user rejected before', async () => {
    const feedback: MusicFeedback[] = [
      {
        providerTrackId: 't0',
        signal: 'rejected',
        at: new Date().toISOString(),
        genres: [],
      },
    ];
    const outcome = await runPairing({
      atmosphere,
      music: stubMusic(results(6)),
      feedback,
      signal: signal(),
    });
    expect(outcome.recommendations[0]!.track.providerTrackId).not.toBe('t0');
  });
});
