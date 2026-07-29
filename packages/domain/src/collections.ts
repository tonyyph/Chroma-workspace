import { z } from 'zod';

import type { Memory } from './schemas';

export const collectionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  memoryIds: z
    .array(z.string().uuid())
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Collection Memory ids must be unique.',
    }),
});

export const collectionListSchema = z.array(collectionSchema);

export type Collection = z.infer<typeof collectionSchema>;

export interface CollectionRepository {
  list(): Promise<readonly Collection[]>;
  save(collection: Collection): Promise<void>;
  remove(id: string): Promise<void>;
}

export type MonthlyRecap = {
  key: string;
  year: number;
  month: number;
  total: number;
  favoriteCount: number;
  dominantMood: Memory['palette']['mood'] | null;
  signatureColors: readonly string[];
};

export type PaletteSignature = {
  harmony: 'monochrome' | 'analogous' | 'balanced' | 'contrasting';
  averageBrightness: number;
  averageSaturation: number;
  warmth: 'cool' | 'neutral' | 'warm';
  signatureColors: readonly string[];
};

export function deriveMonthlyRecaps(memories: readonly Memory[]): readonly MonthlyRecap[] {
  const buckets = new Map<string, Memory[]>();
  for (const memory of memories) {
    const date = new Date(memory.capturedAt);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, [...(buckets.get(key) ?? []), memory]);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, items]) => {
      const moods = new Map<Memory['palette']['mood'], number>();
      items.forEach((memory) =>
        moods.set(memory.palette.mood, (moods.get(memory.palette.mood) ?? 0) + 1),
      );
      const dominantMood =
        [...moods.entries()].sort(
          ([leftMood, leftCount], [rightMood, rightCount]) =>
            rightCount - leftCount || leftMood.localeCompare(rightMood),
        )[0]?.[0] ?? null;
      const [year = 0, month = 0] = key.split('-').map(Number);
      return {
        key,
        year,
        month,
        total: items.length,
        favoriteCount: items.filter((memory) => memory.isFavorite).length,
        dominantMood,
        signatureColors: items
          .flatMap((memory) => memory.palette.colors.slice(0, 2).map((color) => color.hex))
          .filter((color, index, colors) => colors.indexOf(color) === index)
          .slice(0, 5),
      };
    });
}

export function derivePaletteSignature(memories: readonly Memory[]): PaletteSignature | null {
  if (memories.length === 0) return null;
  const colors = memories.flatMap((memory) => memory.palette.colors.slice(0, 2));
  const circularDistance = (left: number, right: number) => {
    const delta = Math.abs(left - right);
    return Math.min(delta, 360 - delta);
  };
  const hueSpread = Math.max(
    ...colors.flatMap((left) => colors.map((right) => circularDistance(left.hue, right.hue))),
  );
  const harmony =
    hueSpread < 18
      ? 'monochrome'
      : hueSpread < 72
        ? 'analogous'
        : hueSpread > 145
          ? 'contrasting'
          : 'balanced';
  const temperature =
    memories.reduce((sum, memory) => sum + memory.palette.metrics.temperature, 0) / memories.length;

  return {
    harmony,
    averageBrightness: Math.round(
      memories.reduce((sum, memory) => sum + memory.palette.metrics.brightness, 0) /
        memories.length,
    ),
    averageSaturation:
      memories.reduce((sum, memory) => sum + memory.palette.metrics.saturation, 0) /
      memories.length,
    warmth: temperature > 0.2 ? 'warm' : temperature < -0.2 ? 'cool' : 'neutral',
    signatureColors: colors
      .sort((left, right) => right.weight - left.weight)
      .map((color) => color.hex)
      .filter((color, index, items) => items.indexOf(color) === index)
      .slice(0, 6),
  };
}
