import {
  DomainError,
  defaultUserPreferences,
  userPreferencesSchema,
  type PreferencesRepository,
  type UserPreferences,
} from '@chromawave/domain';
import type { KeyValueStorage } from './KeyValueStorage';

export const PREFERENCES_STORAGE_KEY = '@chromawave/preferences:v1';

export class StoredPreferencesRepository implements PreferencesRepository {
  // Storage is injected rather than defaulted so the backing store is visible
  // at the wiring site — see `dependencies.ts`.
  constructor(private readonly storage: KeyValueStorage) {}

  async get(): Promise<UserPreferences> {
    const raw = await this.storage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw === null) return defaultUserPreferences;

    try {
      return userPreferencesSchema.parse(JSON.parse(raw));
    } catch (error) {
      throw new DomainError('PERSISTED_DATA_INVALID', 'Saved preferences could not be validated.', {
        cause: error,
      });
    }
  }

  async save(input: UserPreferences): Promise<void> {
    const preferences = userPreferencesSchema.parse(input);
    await this.storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }
}
