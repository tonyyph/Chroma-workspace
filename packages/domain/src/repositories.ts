import type { Memory, Palette } from './schemas';

export interface MemoryRepository {
  list(): Promise<readonly Memory[]>;
  getById(id: string): Promise<Memory | null>;
  save(memory: Memory): Promise<void>;
  setFavorite(id: string, isFavorite: boolean): Promise<Memory | null>;
  remove(id: string): Promise<void>;
}

export interface MemoryAssetStore {
  persist(input: {
    sourceUri: string;
    memoryId: string;
    extension: 'heic' | 'heif' | 'jpg' | 'png' | 'webp';
  }): Promise<string>;
}

export interface PaletteExtractor {
  extract(sourceUri: string): Promise<Palette>;
}
