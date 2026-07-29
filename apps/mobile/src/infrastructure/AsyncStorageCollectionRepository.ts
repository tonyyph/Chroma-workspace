import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collectionListSchema,
  collectionSchema,
  DomainError,
  type Collection,
  type CollectionRepository,
} from '@chromawave/domain';

import type { KeyValueStorage } from './AsyncStorageMemoryRepository';

const STORAGE_KEY = '@chromawave/collections:v1';

export class AsyncStorageCollectionRepository implements CollectionRepository {
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  async list(): Promise<readonly Collection[]> {
    const raw = await this.storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    try {
      return collectionListSchema
        .parse(JSON.parse(raw))
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    } catch (error) {
      throw new DomainError('PERSISTED_DATA_INVALID', 'Saved Collections could not be validated.', {
        cause: error,
      });
    }
  }

  async save(input: Collection): Promise<void> {
    const collection = collectionSchema.parse(input);
    const current = await this.list();
    const next = [collection, ...current.filter((item) => item.id !== collection.id)].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    );
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async remove(id: string): Promise<void> {
    const current = await this.list();
    await this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify(current.filter((collection) => collection.id !== id)),
    );
  }
}
