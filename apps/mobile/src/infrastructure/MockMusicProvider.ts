import {
  DomainError,
  musicTrackSchema,
  rankTracks,
  type MusicProvider,
  type MusicTrack,
  type RecommendationInput,
  type TrackRecommendation,
} from '@chromawave/domain';

const catalogue = [
  {
    id: 'mock-afterglow',
    provider: 'mock',
    title: 'Afterglow Rooms',
    artist: 'CHROMAWAVE Sessions',
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
    audioFeatures: { valence: 0.69, energy: 0.46, acousticness: 0.72, tempo: 96 },
  },
  {
    id: 'mock-electric-tide',
    provider: 'mock',
    title: 'Electric Tide',
    artist: 'CHROMAWAVE Sessions',
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
    audioFeatures: { valence: 0.74, energy: 0.9, acousticness: 0.08, tempo: 132 },
  },
  {
    id: 'mock-soft-orbit',
    provider: 'mock',
    title: 'Soft Orbit',
    artist: 'CHROMAWAVE Sessions',
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
    audioFeatures: { valence: 0.61, energy: 0.23, acousticness: 0.82, tempo: 76 },
  },
  {
    id: 'mock-blue-hour',
    provider: 'mock',
    title: 'Blue Hour, Slowly',
    artist: 'CHROMAWAVE Sessions',
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
    audioFeatures: { valence: 0.24, energy: 0.4, acousticness: 0.6, tempo: 84 },
  },
] satisfies readonly MusicTrack[];

export class MockMusicProvider implements MusicProvider {
  readonly name = 'mock' as const;

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async searchTracks(query: string): Promise<readonly MusicTrack[]> {
    const normalized = query.trim().toLocaleLowerCase();
    return catalogue.filter(
      (track) =>
        track.title.toLocaleLowerCase().includes(normalized) ||
        track.artist.toLocaleLowerCase().includes(normalized),
    );
  }

  async getRecommendations(input: RecommendationInput): Promise<readonly TrackRecommendation[]> {
    return rankTracks(catalogue, input).slice(0, 3);
  }

  async getTrack(id: string): Promise<MusicTrack> {
    const track = catalogue.find((item) => item.id === id);
    if (!track) throw new DomainError('MEMORY_NOT_FOUND', `Track ${id} was not found.`);
    return musicTrackSchema.parse(track);
  }

  async getAudioPreview(id: string): Promise<string | null> {
    return (await this.getTrack(id)).previewUrl;
  }
}
