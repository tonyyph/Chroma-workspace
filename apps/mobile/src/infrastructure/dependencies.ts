import { DevelopmentAnalytics } from '@chromawave/analytics';

import { StoredPaletteRepository } from './StoredPaletteRepository';
import { StoredPreferencesRepository } from './StoredPreferencesRepository';
import { LEGACY_KEYS, MmkvStorage } from './MmkvStorage';
import { ExpoHapticsService } from './ExpoHapticsService';
import { ExpoNotificationScheduler } from './ExpoNotificationScheduler';
import { ExpoSoundService } from './ExpoSoundService';

export const analytics = new DevelopmentAnalytics(__DEV__);

/**
 * One MMKV instance behind every repository — BUILD KIT · 08 names it as the
 * local-first store. The repositories are unchanged: they were already written
 * against `KeyValueStorage`, which is what made this a one-line swap.
 */
export const storage = new MmkvStorage();

/** Copies any data the previous AsyncStorage build wrote. Safe to call repeatedly. */
export const migrateStorage = () => storage.migrateFromAsyncStorage(LEGACY_KEYS);

export const paletteRepository = new StoredPaletteRepository(storage);
export const preferencesRepository = new StoredPreferencesRepository(storage);
export const hapticsService = new ExpoHapticsService();
export const notificationScheduler = new ExpoNotificationScheduler();
export const soundService = new ExpoSoundService();
