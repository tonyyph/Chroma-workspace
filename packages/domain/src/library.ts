import { z } from 'zod';

import { paletteMoodSchema, type Memory, type PaletteMood } from './schemas';

export const memoryFilterSchema = z.object({
  query: z.string().trim().max(100),
  mood: paletteMoodSchema.nullable(),
  favoritesOnly: z.boolean(),
});

export type MemoryFilter = z.infer<typeof memoryFilterSchema>;

export type MemoryInsights = {
  total: number;
  favoriteCount: number;
  moodDiversity: number;
  dominantMood: PaletteMood | null;
  dominantMoodCount: number;
  recentColors: readonly string[];
};

export function filterMemories(
  memories: readonly Memory[],
  input: MemoryFilter,
): readonly Memory[] {
  const filter = memoryFilterSchema.parse(input);
  const query = filter.query.toLocaleLowerCase();

  return memories.filter((memory) => {
    if (filter.favoritesOnly && !memory.isFavorite) return false;
    if (filter.mood !== null && memory.palette.mood !== filter.mood) return false;
    if (query.length === 0) return true;

    return [
      memory.note,
      memory.palette.mood,
      memory.musicPairing?.track.title,
      memory.musicPairing?.track.artist,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });
}

export function deriveMemoryInsights(memories: readonly Memory[]): MemoryInsights {
  const moodCounts = new Map<PaletteMood, number>();
  const recentColors: string[] = [];

  for (const memory of memories) {
    moodCounts.set(memory.palette.mood, (moodCounts.get(memory.palette.mood) ?? 0) + 1);

    for (const paletteColor of memory.palette.colors) {
      if (!recentColors.includes(paletteColor.hex)) recentColors.push(paletteColor.hex);
      if (recentColors.length === 6) break;
    }
  }

  let dominantMood: PaletteMood | null = null;
  let dominantMoodCount = 0;
  for (const [mood, count] of moodCounts) {
    if (count > dominantMoodCount) {
      dominantMood = mood;
      dominantMoodCount = count;
    }
  }

  return {
    total: memories.length,
    favoriteCount: memories.filter((memory) => memory.isFavorite).length,
    moodDiversity: moodCounts.size,
    dominantMood,
    dominantMoodCount,
    recentColors,
  };
}
