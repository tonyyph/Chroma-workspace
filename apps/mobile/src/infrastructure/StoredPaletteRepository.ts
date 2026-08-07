import {
  DomainError,
  paletteListSchema,
  paletteSchema,
  type Palette,
  type PaletteRepository,
} from '@chromawave/domain';
import { deletePhoto } from '@/lib/photos';
import type { KeyValueStorage } from './KeyValueStorage';

const STORAGE_KEY = '@chromawave/palettes:v1';

export class StoredPaletteRepository implements PaletteRepository {
  // Storage is injected rather than defaulted so the backing store is visible
  // at the wiring site — see `dependencies.ts`.
  constructor(private readonly storage: KeyValueStorage) {}

  /**
   * An untouched library is empty, not pre-filled.
   *
   * Four example palettes used to be written here on first launch, so someone
   * who had just installed the app opened it to a grid of work that was not
   * theirs — and their own first capture arrived as the fifth card in someone
   * else's collection. The examples are still available, but as something the
   * empty state offers rather than something the store assumes.
   */
  async list(): Promise<readonly Palette[]> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
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
    // Removal is the one choke point every delete goes through, so the frame is
    // cleaned up here rather than at each call site. Dropping only the record
    // would leave orphaned photos that no screen can reach or remove.
    deletePhoto(all.find((palette) => palette.id === id)?.photoUri ?? null);
    await this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify(all.filter((palette) => palette.id !== id)),
    );
  }
}
