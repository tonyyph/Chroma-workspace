import { describe, expect, it } from 'vitest';

import { memorySchema, paletteSchema } from './schemas';

const palette = {
  colors: [
    { hex: '#FFAA00', weight: 0.7, lightness: 0.75, chroma: 0.18, hue: 70 },
    { hex: '#112244', weight: 0.3, lightness: 0.25, chroma: 0.08, hue: 250 },
  ],
  mood: 'warm',
  metrics: { brightness: 60, saturation: 0.5, temperature: 0.5, contrast: 50 },
} as const;

describe('domain schemas', () => {
  it('rejects palette weights that do not represent a whole', () => {
    expect(
      paletteSchema.safeParse({
        ...palette,
        colors: palette.colors.map((color) => ({ ...color, weight: 0.1 })),
      }).success,
    ).toBe(false);
  });

  it('defaults no public visibility implicitly', () => {
    const result = memorySchema.parse({
      schemaVersion: 1,
      id: 'd7a54cb1-86a0-4f48-a524-573d9f3ebdd2',
      createdAt: '2026-07-27T10:00:00.000Z',
      capturedAt: '2026-07-27T10:00:00.000Z',
      note: null,
      isFavorite: false,
      asset: {
        id: '95f34339-1b60-4a77-98e7-40ee84b244f6',
        kind: 'original',
        localUri: 'file:///memory.jpg',
        mediaType: 'image/jpeg',
        width: 1200,
        height: 900,
      },
      palette,
      musicPairing: null,
      syncStatus: 'local',
    });

    expect(result.visibility).toBe('private');
  });
});
