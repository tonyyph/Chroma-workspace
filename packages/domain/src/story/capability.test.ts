import { describe, expect, it } from 'vitest';

import type { MusicTrackReference } from '../music';
import {
  canAnalyseAudio,
  exportCarriesAudio,
  HIGHEST_REACHABLE_RUNG,
  isReachable,
  musicCapabilityRungs,
  trackCapability,
} from './capability';

const track = (overrides: Partial<MusicTrackReference> = {}): MusicTrackReference => ({
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
  externalUrl: 'https://music.apple.com/track/1',
  attribution: 'Preview via Apple Music',
  ...overrides,
});

describe('what a track can actually do', () => {
  it('reports nothing when no track is attached', () => {
    expect(trackCapability(null, false)).toBe('none');
  });

  it('reports metadata for a track with no link and no preview', () => {
    expect(trackCapability(track({ externalUrl: null }), false)).toBe('metadata');
  });

  it('reports an external link when there is somewhere to go', () => {
    expect(trackCapability(track(), false)).toBe('external-link');
  });

  it('reports playback when the provider handed over an excerpt', () => {
    expect(trackCapability(track(), true)).toBe('preview-playback');
  });
});

describe('the rungs this build cannot reach', () => {
  it('stops at playback', () => {
    expect(HIGHEST_REACHABLE_RUNG).toBe('preview-playback');
  });

  it('marks the analysis rungs unreachable', () => {
    for (const rung of ['user-audio', 'royalty-free', 'analysed'] as const) {
      expect(isReachable(rung)).toBe(false);
    }
  });

  it('marks everything up to playback reachable', () => {
    for (const rung of ['none', 'metadata', 'external-link', 'preview-playback'] as const) {
      expect(isReachable(rung)).toBe(true);
    }
  });

  it('never permits audio analysis at any reachable rung', () => {
    // The rule this whole module exists to make mechanical: nothing may cite a
    // beat or a tempo while every reachable rung answers false.
    for (const rung of musicCapabilityRungs) {
      if (isReachable(rung)) expect(canAnalyseAudio(rung)).toBe(false);
    }
  });

  it('would permit analysis only on rungs that do not exist yet', () => {
    expect(canAnalyseAudio('user-audio')).toBe(true);
    expect(canAnalyseAudio('analysed')).toBe(true);
  });
});

describe('export truthfulness', () => {
  it('never claims an export carries the music', () => {
    // A PNG carries no audio. One place decides this so no screen can imply
    // otherwise on its own.
    expect(exportCarriesAudio()).toBe(false);
  });
});
