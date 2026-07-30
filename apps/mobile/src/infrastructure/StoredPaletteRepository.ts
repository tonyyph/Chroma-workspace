import {
  DomainError,
  paletteListSchema,
  paletteSchema,
  type Palette,
  type PaletteRepository,
} from '@chromawave/domain';

import { seedPalettes } from '@/data/seed';

import type { KeyValueStorage } from './KeyValueStorage';

const STORAGE_KEY = '@chromawave/palettes:v1';
const SEEDED_KEY = '@chromawave/palettes:seeded:v1';

export class StoredPaletteRepository implements PaletteRepository {
  // Storage is injected rather than defaulted so the backing store is visible
  // at the wiring site — see `dependencies.ts`.
  constructor(private readonly storage: KeyValueStorage) {}

  async list(): Promise<readonly Palette[]> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw === null) return this.seed();
    try {
      return paletteListSchema
        .parse(JSON.parse(raw))
        .sort((left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt));
    } catch (error) {
      throw new DomainError('PERSISTED_DATA_INVALID', 'Saved palettes could not be validated.', {
        cause: error,
      });
    }
  }

  async get(id: string): Promise<Palette | null> {
    const all = await this.list();
    return all.find((palette) => palette.id === id) ?? null;
  }

  async save(palette: Palette): Promise<void> {
    const parsed = paletteSchema.parse(palette);
    const all = await this.list();
    const next = [parsed, ...all.filter((item) => item.id !== parsed.id)];
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify(all.filter((palette) => palette.id !== id)),
    );
  }

  /**
   * Seeds the library once, then records that it happened. Without the marker a
   * user who deletes every palette would find them all back on next launch.
   */
  private async seed(): Promise<readonly Palette[]> {
    if ((await this.storage.getItem(SEEDED_KEY)) !== null) return [];
    const seeded = paletteListSchema.parse(seedPalettes());
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    await this.storage.setItem(SEEDED_KEY, 'true');
    return seeded;
  }
}
