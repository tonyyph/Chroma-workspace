import { describe, expect, it } from 'vitest';

import { collectionSchema, deriveMonthlyRecaps, derivePaletteSignature } from './collections';
import { memorySchema, type Memory } from './schemas';

function memory(input: {
  id: string;
  date: string;
  hue: number;
  mood: Memory['palette']['mood'];
  favorite?: boolean;
}): Memory {
  return memorySchema.parse({
    schemaVersion: 1,
    id: input.id,
    createdAt: input.date,
    capturedAt: input.date,
    visibility: 'private',
    note: null,
    isFavorite: input.favorite ?? false,
    asset: {
      id: crypto.randomUUID(),
      kind: 'original',
      localUri: 'file:///memory.jpg',
      mediaType: 'image/jpeg',
      width: 1200,
      height: 1600,
    },
    palette: {
      colors: [
        {
          hex: '#664433',
          weight: 1,
          lightness: 0.4,
          chroma: 0.12,
          hue: input.hue,
        },
      ],
      mood: input.mood,
      metrics: { brightness: 42, saturation: 0.55, temperature: 0.35, contrast: 48 },
    },
    musicPairing: null,
    syncStatus: 'local',
  });
}

describe('collection and atelier projections', () => {
  it('rejects duplicate Memory ids in a Collection', () => {
    const id = crypto.randomUUID();
    expect(() =>
      collectionSchema.parse({
        schemaVersion: 1,
        id: crypto.randomUUID(),
        name: 'Summer',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
        memoryIds: [id, id],
      }),
    ).toThrow();
  });

  it('derives monthly recaps and a palette signature', () => {
    const memories = [
      memory({
        id: '11111111-1111-4111-8111-111111111111',
        date: '2026-07-20T10:00:00.000Z',
        hue: 20,
        mood: 'warm',
        favorite: true,
      }),
      memory({
        id: '22222222-2222-4222-8222-222222222222',
        date: '2026-07-10T10:00:00.000Z',
        hue: 45,
        mood: 'warm',
      }),
    ];

    expect(deriveMonthlyRecaps(memories)[0]).toMatchObject({
      key: '2026-07',
      total: 2,
      favoriteCount: 1,
      dominantMood: 'warm',
    });
    expect(derivePaletteSignature(memories)).toMatchObject({
      harmony: 'analogous',
      warmth: 'warm',
      averageBrightness: 42,
    });
  });
});
