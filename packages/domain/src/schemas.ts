import { z } from 'zod';

export const memoryIdSchema = z.string().uuid();

export const paletteMoodSchema = z.enum(['airy', 'calm', 'energetic', 'grounded', 'moody', 'warm']);

export const paletteColorSchema = z.object({
  hex: z.string().regex(/^#[0-9A-F]{6}$/),
  weight: z.number().min(0).max(1),
  lightness: z.number().min(0).max(1),
  chroma: z.number().min(0).max(0.5),
  hue: z.number().min(0).max(360),
});

export const paletteMetricsSchema = z.object({
  brightness: z.number().min(0).max(100),
  saturation: z.number().min(0).max(1),
  temperature: z.number().min(-1).max(1),
  contrast: z.number().min(0).max(100),
});

export const paletteSchema = z
  .object({
    colors: z.array(paletteColorSchema).min(1).max(6),
    mood: paletteMoodSchema,
    metrics: paletteMetricsSchema,
  })
  .superRefine((palette, context) => {
    const total = palette.colors.reduce((sum, color) => sum + color.weight, 0);
    if (Math.abs(total - 1) > 0.02) {
      context.addIssue({
        code: 'custom',
        message: 'Palette color weights must sum to one.',
        path: ['colors'],
      });
    }
  });

export const memoryAssetSchema = z.object({
  id: z.string().uuid(),
  kind: z.literal('original'),
  localUri: z.string().min(1),
  mediaType: z.enum(['image/heic', 'image/heif', 'image/jpeg', 'image/png', 'image/webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const musicTrackSchema = z.object({
  id: z.string().min(1),
  provider: z.enum(['mock', 'spotify', 'apple-music', 'soundscape']),
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  artworkUrl: z.url().nullable(),
  previewUrl: z.url().nullable(),
  externalUrl: z.url().nullable(),
  audioFeatures: z
    .object({
      valence: z.number().min(0).max(1),
      energy: z.number().min(0).max(1),
      acousticness: z.number().min(0).max(1),
      tempo: z.number().positive(),
    })
    .nullable(),
});

export const musicPairingSchema = z.object({
  track: musicTrackSchema,
  explanation: z.string().min(1).max(240),
  pairedAt: z.iso.datetime(),
});

export const memorySchema = z.object({
  schemaVersion: z.literal(1),
  id: memoryIdSchema,
  createdAt: z.iso.datetime(),
  capturedAt: z.iso.datetime(),
  visibility: z.enum(['private', 'public']).default('private'),
  note: z.string().trim().max(500).nullable(),
  isFavorite: z.boolean(),
  asset: memoryAssetSchema,
  palette: paletteSchema,
  musicPairing: musicPairingSchema.nullable(),
  syncStatus: z.enum(['local', 'pending', 'synced', 'failed']),
});

export const memoryListSchema = z.array(memorySchema);

export type Memory = z.infer<typeof memorySchema>;
export type MemoryAsset = z.infer<typeof memoryAssetSchema>;
export type MusicPairing = z.infer<typeof musicPairingSchema>;
export type MusicTrack = z.infer<typeof musicTrackSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type PaletteColor = z.infer<typeof paletteColorSchema>;
export type PaletteMetrics = z.infer<typeof paletteMetricsSchema>;
export type PaletteMood = z.infer<typeof paletteMoodSchema>;
