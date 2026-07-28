import { describe, expect, it } from 'vitest';

import { rankTracks } from './music';
import type { MusicTrack } from './schemas';

const track = (
  id: string,
  energy: number,
  acousticness: number,
  valence: number,
  tempo: number,
): MusicTrack => ({
  id,
  provider: 'mock',
  title: id,
  artist: 'CHROMAWAVE Sessions',
  artworkUrl: null,
  previewUrl: null,
  externalUrl: null,
  audioFeatures: { energy, acousticness, valence, tempo },
});

describe('pairing ranker', () => {
  it('ranks high-energy music for an energetic palette', () => {
    const result = rankTracks(
      [track('quiet', 0.2, 0.9, 0.4, 72), track('pulse', 0.9, 0.1, 0.75, 130)],
      { mood: 'energetic', brightness: 55, saturation: 0.8, temperature: 0, contrast: 70 },
    );

    expect(result[0]?.track.id).toBe('pulse');
    expect(result[0]?.explanation).toMatch(/contrast/i);
  });
});
