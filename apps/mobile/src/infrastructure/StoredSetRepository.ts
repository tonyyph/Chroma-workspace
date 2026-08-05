import {
  DomainError,
  setListSchema,
  setSchema,
  type PaletteSet,
  type SetRepository,
} from '@chromawave/domain';
import type { KeyValueStorage } from './KeyValueStorage';

const STORAGE_KEY = '@chromawave/sets:v1';

/**
 * Sets, on the same store as everything else.
 *
 * Storage-agnostic like the palette repository — see `dependencies.ts` for which
 * backing store is wired in.
 */
export class StoredSetRepository implements SetRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async list(): Promise<readonly PaletteSet[]> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    try {
      return setListSchema
        .parse(JSON.parse(raw))
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    } catch (error) {
      throw new DomainError('PERSISTED_DATA_INVALID', 'Saved sets could not be validated.', {
        cause: error,
      });
    }
  }

  async get(id: string): Promise<PaletteSet | null> {
    return (await this.list()).find((set) => set.id === id) ?? null;
  }

  async save(set: PaletteSet): Promise<void> {
    const parsed = setSchema.parse(set);
    const all = await this.list();
    const next = [parsed, ...all.filter((item) => item.id !== parsed.id)];
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(all.filter((set) => set.id !== id)));
  }
}
