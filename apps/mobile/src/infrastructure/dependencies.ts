import { DevelopmentAnalytics } from '@chromawave/analytics';

import { AsyncStorageCollectionRepository } from './AsyncStorageCollectionRepository';
import { AsyncStorageMemoryRepository } from './AsyncStorageMemoryRepository';
import { AsyncStoragePreferencesRepository } from './AsyncStoragePreferencesRepository';
import { ExpoHapticsService } from './ExpoHapticsService';
import { ExpoMemoryAssetStore } from './ExpoMemoryAssetStore';
import { ExpoNotificationScheduler } from './ExpoNotificationScheduler';
import { ExpoPaletteExtractor } from './ExpoPaletteExtractor';
import { MockMusicProvider } from './MockMusicProvider';

export const analytics = new DevelopmentAnalytics(__DEV__);
export const assetStore = new ExpoMemoryAssetStore();
export const collectionRepository = new AsyncStorageCollectionRepository();
export const memoryRepository = new AsyncStorageMemoryRepository();
export const musicProvider = new MockMusicProvider();
export const paletteExtractor = new ExpoPaletteExtractor();
export const preferencesRepository = new AsyncStoragePreferencesRepository();
export const hapticsService = new ExpoHapticsService();
export const notificationScheduler = new ExpoNotificationScheduler();
