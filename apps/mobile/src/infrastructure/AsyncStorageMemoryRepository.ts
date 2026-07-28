import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DomainError,
  memoryListSchema,
  memorySchema,
  type Memory,
  type MemoryRepository,
} from '@chromawave/domain';

const STORAGE_KEY = '@chromawave/memories:v1';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class AsyncStorageMemoryRepository implements MemoryRepository {
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  async list(): Promise<readonly Memory[]> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    try {
      const memories = memoryListSchema.parse(JSON.parse(raw));
      return memories.sort(
        (left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt),
      );
    } catch (error) {
      throw new DomainError('PERSISTED_DATA_INVALID', 'Saved Memories could not be validated.', {
        cause: error,
      });
    }
  }

  async getById(id: string): Promise<Memory | null> {
    const memories = await this.list();
    return memories.find((memory) => memory.id === id) ?? null;
  }

  async save(input: Memory): Promise<void> {
    const memory = memorySchema.parse(input);
    const current = await this.list();
    const next = [memory, ...current.filter((item) => item.id !== memory.id)].sort(
      (left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt),
    );
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async setFavorite(id: string, isFavorite: boolean): Promise<Memory | null> {
    const current = await this.getById(id);
    if (current === null) return null;

    const updated = memorySchema.parse({ ...current, isFavorite });
    await this.save(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const current = await this.list();
    await this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify(current.filter((memory) => memory.id !== id)),
    );
  }
}
