import { describe, expect, it } from 'vitest';

import { deriveMemoryInsights, filterMemories } from './library';
import { memorySchema, type Memory, type PaletteMood } from './schemas';

const makeMemory = ({
  id,
  mood,
  note,
  favorite = false,
}: {
  id: string;
  mood: PaletteMood;
  note: string | null;
  favorite?: boolean;
}): Memory =>
  memorySchema.parse({
    schemaVersion: 1,
    id,
    createdAt: '2026-07-27T10:00:00.000Z',
    capturedAt: '2026-07-27T10:00:00.000Z',
    visibility: 'private',
    note,
    isFavorite: favorite,
    asset: {
      id: 'd17883bd-23ad-476c-bb09-ff347fe960b0',
      kind: 'original',
      localUri: `file:///${id}.jpg`,
      mediaType: 'image/jpeg',
      width: 800,
      height: 600,
    },
    palette: {
      colors: [
        { hex: '#D8B878', weight: 0.7, lightness: 0.75, chroma: 0.18, hue: 70 },
        { hex: '#112244', weight: 0.3, lightness: 0.25, chroma: 0.08, hue: 250 },
      ],
      mood,
      metrics: { brightness: 60, saturation: 0.5, temperature: 0.5, contrast: 50 },
    },
    musicPairing: null,
    syncStatus: 'local',
  });

const memories = [
  makeMemory({
    id: 'a6a1d672-3870-4427-a259-252c005b7d8a',
    mood: 'warm',
    note: 'Golden hour',
    favorite: true,
  }),
  makeMemory({
    id: 'f1bd046f-78f4-42a2-83d7-4dc697dcc649',
    mood: 'warm',
    note: 'Quiet breakfast',
  }),
  makeMemory({
    id: 'f149aab0-e21b-442b-95bd-753474120c68',
    mood: 'calm',
    note: 'Blue water',
  }),
] as const;

describe('Memory library', () => {
  it('filters by query, mood, and favorite status without exposing raw data elsewhere', () => {
    expect(
      filterMemories(memories, { query: 'golden', mood: 'warm', favoritesOnly: true }).map(
        (memory) => memory.id,
      ),
    ).toEqual([memories[0].id]);
    expect(filterMemories(memories, { query: '', mood: 'calm', favoritesOnly: false })).toEqual([
      memories[2],
    ]);
  });

  it('derives stable archive insights from Memories', () => {
    expect(deriveMemoryInsights(memories)).toMatchObject({
      total: 3,
      favoriteCount: 1,
      moodDiversity: 2,
      dominantMood: 'warm',
      dominantMoodCount: 2,
      recentColors: ['#D8B878', '#112244'],
    });
  });
});
