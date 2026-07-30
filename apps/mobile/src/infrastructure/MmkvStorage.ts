import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMMKV, type MMKV } from 'react-native-mmkv';

import type { KeyValueStorage } from './KeyValueStorage';

/**
 * The local-first store, on MMKV.
 *
 * BUILD KIT · 08 · STACK names "MMKV — local-first store". MMKV is memory-mapped
 * and synchronous, which is the point: a library scroll over 200 palettes reads
 * without a bridge hop, where AsyncStorage would serialise through the JS thread.
 *
 * The `KeyValueStorage` interface stays async because the repositories are async
 * and because a synchronous read is trivially wrappable, while the reverse is not.
 */
export class MmkvStorage implements KeyValueStorage {
  private readonly mmkv: MMKV;

  constructor(id = 'chromawave') {
    this.mmkv = createMMKV({ id });
  }

  async getItem(key: string): Promise<string | null> {
    return this.mmkv.getString(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.mmkv.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.mmkv.remove(key);
  }

  /** Synchronous read, for call sites that can use it (cold start, selectors). */
  readSync(key: string): string | null {
    return this.mmkv.getString(key) ?? null;
  }

  /**
   * Moves any keys written by the previous AsyncStorage build into MMKV, once.
   *
   * Without this, upgrading users silently lose their library — the data would
   * still be on disk but nothing would read it. Keys are copied rather than moved
   * so a failure part-way leaves the AsyncStorage copy intact and the migration
   * simply runs again next launch.
   */
  async migrateFromAsyncStorage(keys: readonly string[]): Promise<number> {
    const MARKER = '@chromawave/mmkv:migrated:v1';
    if (this.mmkv.getString(MARKER) !== undefined) return 0;

    let moved = 0;
    for (const key of keys) {
      try {
        // Skip anything MMKV already holds — a partial previous run wrote it.
        if (this.mmkv.contains(key)) continue;
        const value = await AsyncStorage.getItem(key);
        if (value === null) continue;
        this.mmkv.set(key, value);
        moved += 1;
      } catch {
        // A single unreadable key must not abort the rest of the migration.
      }
    }

    this.mmkv.set(MARKER, new Date().toISOString());
    return moved;
  }
}

/** The keys the previous AsyncStorage build owned. */
export const LEGACY_KEYS = [
  '@chromawave/palettes:v1',
  '@chromawave/palettes:seeded:v1',
  '@chromawave/preferences:v1',
] as const;
