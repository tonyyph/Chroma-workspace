import { describe, expect, it } from 'vitest';

import { acceptRefinedIntent, retainKnownExplanations, type VisualAnalysis } from './analysis';
import { readAtmosphere, type AtmosphereReading } from './atmosphere';
import { accumulatePreference, type MusicFeedback } from './feedback';
import {
  CURATION,
  deriveIntent,
  INTENT_WEIGHTS,
  musicIntentSchema,
  VISUAL_ADJUSTMENT_CAP,
} from './intent';
import { atmosphereMoods } from './atmosphere';
import type { MusicTrackReference } from './music';
import { makeColor } from './palette';

const atmosphere = (overrides: Partial<AtmosphereReading> = {}): AtmosphereReading => ({
  luminosity: 0.5,
  warmth: 0,
  saturation: 0.5,
  contrast: 0.5,
  spread: 0.5,
  coherence: 0.8,
  mood: 'serene',
  ...overrides,
});

const visual = (overrides: Partial<VisualAnalysis> = {}): VisualAnalysis => ({
  caption: null,
  subjects: [],
  scene: null,
  lighting: null,
  timeOfDay: null,
  weather: null,
  indoorOutdoor: null,
  motion: null,
  confidence: 0.8,
  analysisVersion: 'test.1',
  analysedAt: '2026-08-10T12:00:00.000Z',
  ...overrides,
});

describe('the intent weights', () => {
  it('each sum to one, so every output lands in range without clamping doing the work', () => {
    for (const [name, weights] of Object.entries(INTENT_WEIGHTS)) {
      const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
      expect(total, name).toBeCloseTo(1, 10);
    }
  });
});

describe('the curation table', () => {
  it('covers every mood at every energy band', () => {
    for (const mood of atmosphereMoods) {
      for (const band of ['low', 'medium', 'high'] as const) {
        const entry = CURATION[mood][band];
        expect(entry.genres.length, `${mood}/${band}`).toBeGreaterThan(0);
        expect(entry.genres.length).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe('deriveIntent', () => {
  it('is deterministic for the same atmosphere and seed', () => {
    const a = atmosphere();
    expect(deriveIntent({ atmosphere: a, seed: 3 })).toEqual(deriveIntent({ atmosphere: a, seed: 3 }));
  });

  it('produces a schema-valid intent for every mood and every extreme', () => {
    for (const mood of atmosphereMoods) {
      for (const luminosity of [0, 0.5, 1]) {
        for (const saturation of [0, 0.5, 1]) {
          for (const warmth of [-1, 0, 1]) {
            const intent = deriveIntent({
              atmosphere: atmosphere({ mood, luminosity, saturation, warmth, contrast: 1, spread: 1 }),
            });
            expect(musicIntentSchema.safeParse(intent).success, mood).toBe(true);
          }
        }
      }
    }
  });

  it('reads a bright, warm, saturated palette as high valence', () => {
    const intent = deriveIntent({
      atmosphere: atmosphere({ luminosity: 0.9, warmth: 0.8, saturation: 0.7, mood: 'luminous' }),
    });
    expect(intent.valence).toBeGreaterThan(0.75);
  });

  it('reads a dark, muted palette as low valence', () => {
    const intent = deriveIntent({
      atmosphere: atmosphere({ luminosity: 0.1, warmth: -0.6, saturation: 0.1, mood: 'nocturnal' }),
    });
    expect(intent.valence).toBeLessThan(0.25);
  });

  it('treats a tight palette as intimate and a spread one as not', () => {
    const close = deriveIntent({ atmosphere: atmosphere({ spread: 0.05, coherence: 1 }) });
    const wide = deriveIntent({ atmosphere: atmosphere({ spread: 0.95, coherence: 1 }) });
    expect(close.intimacy).toBeGreaterThan(wide.intimacy);
  });

  it('maps energy to pace at the stated thresholds', () => {
    const still = deriveIntent({
      atmosphere: atmosphere({ saturation: 0, contrast: 0, spread: 0 }),
    });
    const driving = deriveIntent({
      atmosphere: atmosphere({ saturation: 1, contrast: 1, spread: 1 }),
    });
    expect(still.pace).toBe('slow');
    expect(driving.pace).toBe('fast');
  });

  it('rotates the lead genre with the seed rather than shuffling it', () => {
    const a = atmosphere({ mood: 'nocturnal', saturation: 0.1, contrast: 0.1, spread: 0.1 });
    const first = deriveIntent({ atmosphere: a, seed: 0 });
    const second = deriveIntent({ atmosphere: a, seed: 1 });

    expect(second.genres[0]).not.toBe(first.genres[0]);
    // Rotation, not replacement: the same curated set, differently ordered.
    expect([...second.genres].sort()).toEqual([...first.genres].sort());
    // And it is reproducible, which a shuffle would not be.
    expect(deriveIntent({ atmosphere: a, seed: 1 })).toEqual(second);
  });

  it('lets a visual reading move the intent, but only within the cap', () => {
    const a = atmosphere();
    const plain = deriveIntent({ atmosphere: a });
    const night = deriveIntent({ atmosphere: a, visual: visual({ timeOfDay: 'night' }) });

    expect(night.valence).toBeLessThan(plain.valence);
    expect(plain.valence - night.valence).toBeLessThanOrEqual(VISUAL_ADJUSTMENT_CAP + 1e-9);
    expect(night.intimacy).toBeGreaterThan(plain.intimacy);
  });

  it('never lets a wrong caption overrule what the colour says', () => {
    // A confidently wrong "active nightclub" reading of a bright, calm image.
    const bright = atmosphere({ luminosity: 0.95, saturation: 0.1, contrast: 0.1, spread: 0.1 });
    const misled = deriveIntent({
      atmosphere: bright,
      visual: visual({ timeOfDay: 'night', motion: 'active', indoorOutdoor: 'indoor' }),
    });
    // Still recognisably a bright, calm image.
    expect(misled.valence).toBeGreaterThan(0.4);
    expect(misled.energy).toBeLessThan(0.4);
  });

  it('lets accumulated preference reorder genres without inventing one', () => {
    const a = atmosphere({ mood: 'serene', saturation: 0.1, contrast: 0.1, spread: 0.1 });
    const neutral = deriveIntent({ atmosphere: a });

    const feedback: MusicFeedback[] = [
      {
        providerTrackId: 't1',
        signal: 'selected',
        at: new Date().toISOString(),
        genres: [neutral.genres[2]!],
      },
    ];
    const biased = deriveIntent({
      atmosphere: a,
      preference: accumulatePreference(feedback),
    });

    expect(biased.genres[0]).toBe(neutral.genres[2]);
    // Nothing added, nothing removed — the curation still bounds the answer.
    expect([...biased.genres].sort()).toEqual([...neutral.genres].sort());
  });

  it('runs end to end from real extracted colours', () => {
    const colors = [
      makeColor('#0B1230', 0.62, 'dominant'),
      makeColor('#1E2A5A', 0.26, 'support'),
      makeColor('#C9A227', 0.12, 'signal'),
    ];
    const intent = deriveIntent({ atmosphere: readAtmosphere(colors, 2.1) });
    expect(musicIntentSchema.safeParse(intent).success).toBe(true);
    expect(intent.genres.length).toBeGreaterThan(0);
  });
});

/* --------------------------------------------- the model cannot invent a track */

const track = (id: string, artist = 'Artist'): MusicTrackReference => ({
  provider: 'itunes',
  providerTrackId: id,
  title: `Track ${id}`,
  artist,
  album: null,
  artworkUrl: null,
  durationMs: 210_000,
  isrc: null,
  genres: ['ambient'],
  releaseYear: 2001,
  externalUrl: null,
  attribution: 'Preview via Apple Music',
});

describe('retainKnownExplanations', () => {
  it('drops any id that was not offered', () => {
    const candidates = [track('a'), track('b')];
    const kept = retainKnownExplanations(
      [
        { providerTrackId: 'a', text: 'real' },
        { providerTrackId: 'invented', text: 'a song that does not exist' },
      ],
      candidates,
    );
    expect(kept.map((entry) => entry.providerTrackId)).toEqual(['a']);
  });

  it('drops duplicates, so one candidate cannot be explained twice', () => {
    const kept = retainKnownExplanations(
      [
        { providerTrackId: 'a', text: 'first' },
        { providerTrackId: 'a', text: 'second' },
      ],
      [track('a')],
    );
    expect(kept).toHaveLength(1);
    expect(kept[0]!.text).toBe('first');
  });

  it('returns nothing when no candidate was offered', () => {
    expect(retainKnownExplanations([{ providerTrackId: 'a', text: 'x' }], [])).toEqual([]);
  });
});

describe('acceptRefinedIntent', () => {
  const baseline = deriveIntent({ atmosphere: atmosphere(), seed: 7 });

  it('falls back to the baseline rather than merging a malformed response', () => {
    expect(acceptRefinedIntent({ valence: 'very high' }, baseline)).toEqual(baseline);
    expect(acceptRefinedIntent(null, baseline)).toEqual(baseline);
    expect(acceptRefinedIntent({ ...baseline, energy: 42 }, baseline)).toEqual(baseline);
    // Genres are `min(1)`: an empty list is not a partial success.
    expect(acceptRefinedIntent({ ...baseline, genres: [] }, baseline)).toEqual(baseline);
  });

  it('accepts a valid refinement but keeps our own seed', () => {
    const refined = { ...baseline, valence: 0.123, seed: 999 };
    const accepted = acceptRefinedIntent(refined, baseline);
    expect(accepted.valence).toBe(0.123);
    expect(accepted.seed).toBe(baseline.seed);
  });
});
