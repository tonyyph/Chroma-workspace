import { DomainError, defaultUserPreferences, type UserPreferences } from '@chromawave/domain';

import {
  StoredPreferencesRepository,
  PREFERENCES_STORAGE_KEY,
} from './StoredPreferencesRepository';
import type { KeyValueStorage } from './KeyValueStorage';

class PreferenceStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe('StoredPreferencesRepository', () => {
  it('uses defaults for a first launch and round-trips valid preferences', async () => {
    const repository = new StoredPreferencesRepository(new PreferenceStorage());
    expect(await repository.get()).toEqual(defaultUserPreferences);

    const vietnameseIvory: UserPreferences = {
      ...defaultUserPreferences,
      language: 'vi',
      theme: 'ivory',
      hapticsEnabled: false,
    };
    await repository.save(vietnameseIvory);

    expect(await repository.get()).toEqual(vietnameseIvory);
  });

  it('surfaces invalid persisted input without silently overwriting it', async () => {
    const storage = new PreferenceStorage();
    await storage.setItem(PREFERENCES_STORAGE_KEY, '{"theme":"neon"}');
    const repository = new StoredPreferencesRepository(storage);

    await expect(repository.get()).rejects.toMatchObject<Partial<DomainError>>({
      code: 'PERSISTED_DATA_INVALID',
    });
  });
});
