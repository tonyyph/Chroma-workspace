import { describe, expect, it } from 'vitest';

import { atmosphereMoods, type AtmosphereReading } from './atmosphere';
import { accumulatePreference, FEEDBACK_WEIGHTS, type MusicFeedback } from './feedback';
import { deriveIntent } from './intent';
import { musicRecommendationSchema, type MusicTrackReference } from './music';
import { rankCandidates } from './ranking';

const atmosphere = (overrides: Partial<AtmosphereReading> = {}): AtmosphereReading => ({
  luminosity: 0.4,
  warmth: -0.2,
  saturation: 0.2,
  contrast: 0.3,
  spread: 0.2,
  coherence: 0.85,
  mood: 'serene',
  ...overrides,
});

const intent = deriveIntent({ atmosphere: atmosphere() });

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

describe('rankCandidates', () => {
  it('returns schema-valid recommendations', () => {
    const results = rankCandidates({
      intent,
      candidates: [track('a'), track('b'), track('c')],
    });
    for (const result of results) {
      expect(musicRecommendationSchema.safeParse(result).success).toBe(true);
    }
  });

  it('always gives every card at least one reason', () => {
    const results = rankCandidates({ intent, candidates: [track('a')] });
    expect(results[0]!.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic', () => {
    const candidates = [track('a'), track('b'), track('c'), track('d')];
    expect(rankCandidates({ intent, candidates })).toEqual(rankCandidates({ intent, candidates }));
  });

  it('does not depend on the order the provider returned results in', () => {
    const candidates = [track('a'), track('b'), track('c'), track('d'), track('e')];
    const forwards = rankCandidates({ intent, candidates });
    const backwards = rankCandidates({ intent, candidates: [...candidates].reverse() });
    expect(backwards.map((r) => r.track.providerTrackId)).toEqual(
      forwards.map((r) => r.track.providerTrackId),
    );
  });

  it('ranks a genre match above a candidate with no genre at all', () => {
    const results = rankCandidates({
      intent,
      candidates: [track('plain'), track('match', { genres: [intent.genres[0]!] })],
      limit: 2,
    });
    expect(results[0]!.track.providerTrackId).toBe('match');
    expect(results[0]!.reasons.some((reason) => reason.kind === 'genre')).toBe(true);
  });

  it('never lets one artist take three of five places', () => {
    const candidates = [
      ...Array.from({ length: 6 }, (_, index) =>
        track(`same-${index}`, { artist: 'One Artist', genres: [intent.genres[0]!] }),
      ),
      track('other-1', { artist: 'Someone Else' }),
      track('other-2', { artist: 'Third Party' }),
      track('other-3', { artist: 'Fourth Wall' }),
    ];
    const results = rankCandidates({ intent, candidates, limit: 5 });
    const byArtist = results.filter((r) => r.track.artist === 'One Artist');
    expect(byArtist.length).toBeLessThanOrEqual(2);
  });

  it('sinks a track the user has already rejected', () => {
    const candidates = [track('rejected'), track('fresh')];
    const feedback: MusicFeedback[] = [
      {
        providerTrackId: 'rejected',
        signal: 'rejected',
        at: new Date().toISOString(),
        genres: [],
      },
    ];
    const results = rankCandidates({
      intent,
      candidates,
      preference: accumulatePreference(feedback),
      limit: 2,
    });
    expect(results[0]!.track.providerTrackId).toBe('fresh');
    // Ranked last, not hidden — the user can still choose it if they change their mind.
    expect(results.map((r) => r.track.providerTrackId)).toContain('rejected');
  });

  it('prefers a playable candidate over an unplayable one, all else equal', () => {
    const results = rankCandidates({
      intent,
      candidates: [track('silent'), track('playable')],
      previewAvailable: new Set(['playable']),
      limit: 2,
    });
    expect(results[0]!.track.providerTrackId).toBe('playable');
    expect(results[0]!.previewAvailable).toBe(true);
    // But it still offers the unplayable one rather than dropping it.
    expect(results[1]!.previewAvailable).toBe(false);
  });

  it('backfills rather than returning two cards when diversity thins the list', () => {
    const candidates = Array.from({ length: 5 }, (_, index) =>
      track(`same-${index}`, { artist: 'One Artist' }),
    );
    const results = rankCandidates({ intent, candidates, limit: 5 });
    expect(results).toHaveLength(5);
    expect(new Set(results.map((r) => r.track.providerTrackId)).size).toBe(5);
  });

  it('returns nothing for nothing, without throwing', () => {
    expect(rankCandidates({ intent, candidates: [] })).toEqual([]);
  });

  it('numbers ranks from zero, contiguously', () => {
    const results = rankCandidates({
      intent,
      candidates: Array.from({ length: 5 }, (_, i) => track(`t${i}`)),
      limit: 5,
    });
    expect(results.map((r) => r.rank)).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps scores inside the schema range for every mood', () => {
    for (const mood of atmosphereMoods) {
      const results = rankCandidates({
        intent: deriveIntent({ atmosphere: atmosphere({ mood }) }),
        candidates: [track('a', { genres: ['ambient'], releaseYear: 1999 })],
      });
      expect(results[0]!.score).toBeGreaterThanOrEqual(0);
      expect(results[0]!.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('accumulatePreference', () => {
  const now = new Date('2026-08-10T12:00:00.000Z');

  it('raises a genre on selection and lowers it on rejection', () => {
    const liked = accumulatePreference(
      [{ providerTrackId: 'a', signal: 'selected', at: now.toISOString(), genres: ['Ambient'] }],
      now,
    );
    const disliked = accumulatePreference(
      [{ providerTrackId: 'b', signal: 'rejected', at: now.toISOString(), genres: ['Ambient'] }],
      now,
    );
    expect(liked.genreWeights.get('ambient')!).toBeGreaterThan(0);
    expect(disliked.genreWeights.get('ambient')!).toBeLessThan(0);
  });

  it('weighs an old signal less than a fresh one', () => {
    const quarterAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();
    const fresh = accumulatePreference(
      [{ providerTrackId: 'a', signal: 'selected', at: now.toISOString(), genres: ['jazz'] }],
      now,
    );
    const stale = accumulatePreference(
      [{ providerTrackId: 'a', signal: 'selected', at: quarterAgo, genres: ['jazz'] }],
      now,
    );
    expect(stale.genreWeights.get('jazz')!).toBeCloseTo(fresh.genreWeights.get('jazz')! / 2, 5);
  });

  it('treats a future timestamp as current rather than unboundedly important', () => {
    const future = new Date(now.getTime() + 10 * 86_400_000).toISOString();
    const result = accumulatePreference(
      [{ providerTrackId: 'a', signal: 'selected', at: future, genres: ['jazz'] }],
      now,
    );
    expect(result.genreWeights.get('jazz')).toBeCloseTo(FEEDBACK_WEIGHTS.selected, 5);
  });

  it('records rejections and replacements as tracks to avoid', () => {
    const result = accumulatePreference(
      [
        { providerTrackId: 'r', signal: 'rejected', at: now.toISOString(), genres: [] },
        { providerTrackId: 'p', signal: 'replaced', at: now.toISOString(), genres: [] },
        { providerTrackId: 's', signal: 'selected', at: now.toISOString(), genres: [] },
      ],
      now,
    );
    expect([...result.rejectedTrackIds].sort()).toEqual(['p', 'r']);
  });

  it('is case-insensitive across genre spellings', () => {
    const result = accumulatePreference(
      [
        { providerTrackId: 'a', signal: 'selected', at: now.toISOString(), genres: ['Trip Hop'] },
        { providerTrackId: 'b', signal: 'selected', at: now.toISOString(), genres: ['trip hop'] },
      ],
      now,
    );
    expect(result.genreWeights.size).toBe(1);
    expect(result.genreWeights.get('trip hop')!).toBeCloseTo(2 * FEEDBACK_WEIGHTS.selected, 5);
  });

  it('is empty for no feedback', () => {
    const result = accumulatePreference([]);
    expect(result.genreWeights.size).toBe(0);
    expect(result.rejectedTrackIds.size).toBe(0);
  });
});
