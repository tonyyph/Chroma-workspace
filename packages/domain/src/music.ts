import type { MusicTrack, PaletteMood } from './schemas';

export type RecommendationInput = Readonly<{
  mood: PaletteMood;
  brightness: number;
  saturation: number;
  temperature: number;
  contrast: number;
}>;

export type TrackRecommendation = Readonly<{
  track: MusicTrack;
  explanation: string;
  score: number;
}>;

export interface MusicProvider {
  readonly name: MusicTrack['provider'];
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  searchTracks(query: string): Promise<readonly MusicTrack[]>;
  getRecommendations(input: RecommendationInput): Promise<readonly TrackRecommendation[]>;
  getTrack(id: string): Promise<MusicTrack>;
  getAudioPreview(id: string): Promise<string | null>;
}

const moodTargets: Record<
  PaletteMood,
  Readonly<{ valence: number; energy: number; acousticness: number; tempo: number }>
> = {
  airy: { valence: 0.76, energy: 0.38, acousticness: 0.62, tempo: 94 },
  calm: { valence: 0.6, energy: 0.24, acousticness: 0.78, tempo: 78 },
  energetic: { valence: 0.72, energy: 0.88, acousticness: 0.12, tempo: 132 },
  grounded: { valence: 0.56, energy: 0.48, acousticness: 0.55, tempo: 102 },
  moody: { valence: 0.25, energy: 0.42, acousticness: 0.58, tempo: 86 },
  warm: { valence: 0.7, energy: 0.5, acousticness: 0.67, tempo: 98 },
};

export const rankTracks = (
  tracks: readonly MusicTrack[],
  input: RecommendationInput,
): readonly TrackRecommendation[] => {
  const target = moodTargets[input.mood];
  return tracks
    .map((track) => {
      const features = track.audioFeatures;
      const distance = features
        ? Math.abs(features.valence - target.valence) * 0.32 +
          Math.abs(features.energy - target.energy) * 0.34 +
          Math.abs(features.acousticness - target.acousticness) * 0.18 +
          Math.min(1, Math.abs(features.tempo - target.tempo) / 80) * 0.16
        : 0.72;
      return {
        track,
        score: Math.max(0, 1 - distance),
        explanation: explanationFor(input),
      };
    })
    .sort((left, right) => right.score - left.score || left.track.id.localeCompare(right.track.id));
};

export const explanationFor = (input: RecommendationInput): string => {
  if (input.mood === 'energetic') {
    return 'High contrast and vivid color matched with bright, driving energy.';
  }
  if (input.mood === 'warm') {
    return 'Warm amber character paired with mellow, tactile rhythm.';
  }
  if (input.mood === 'moody') {
    return 'Deep shadows paired with spacious, introspective sound.';
  }
  if (input.mood === 'airy') {
    return 'Soft light and open color paired with a weightless melodic pulse.';
  }
  if (input.mood === 'calm') {
    return 'Quiet color variation paired with slow, restorative texture.';
  }
  return 'Balanced color and contrast paired with an organic, steady groove.';
};
