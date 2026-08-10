import { DevelopmentAnalytics } from '@chromawave/analytics';
import { UnconfiguredMusicProvider, type MusicProvider } from '@chromawave/domain';
import { PreviewPlayer } from './audio/PreviewPlayer';
import { ExpoHapticsService } from './ExpoHapticsService';
import { ExpoNotificationScheduler } from './ExpoNotificationScheduler';
import { ExpoSoundService } from './ExpoSoundService';
import { MemoryBackedPaletteRepository } from './MemoryBackedPaletteRepository';
import { migrateToMemories } from './migrateMemories';
import { LEGACY_KEYS, MmkvStorage } from './MmkvStorage';
import { ITunesMusicProvider } from './music/ITunesMusicProvider';
import { StoredEntitlements } from './StoredEntitlements';
import { StoredMemoryRepository } from './StoredMemoryRepository';
import { StoredPreferencesRepository } from './StoredPreferencesRepository';
import { StoredSetRepository } from './StoredSetRepository';

export const analytics = new DevelopmentAnalytics(__DEV__);

/**
 * One MMKV instance behind every repository — BUILD KIT · 08 names it as the
 * local-first store. The repositories are unchanged: they were already written
 * against `KeyValueStorage`, which is what made this a one-line swap.
 */
export const storage = new MmkvStorage();

/** Copies any data the previous AsyncStorage build wrote. Safe to call repeatedly. */
export const migrateStorage = () => storage.migrateFromAsyncStorage(LEGACY_KEYS);

/**
 * Widens a v1 palette library into v2 memories, once. Idempotent, and it never
 * deletes the v1 key — that key is the rollback. See docs/09.
 */
export const migrateMemories = () => migrateToMemories(storage);

export const memoryRepository = new StoredMemoryRepository(storage);

/**
 * The v1 `Palette` interface, projected from memories.
 *
 * Ten `tools/*` screens, `libraryStore`, `mergePalettes` and `discovery` are all
 * written against this and keep working untouched. The aggregate moved; the
 * interface did not.
 */
export const paletteRepository = new MemoryBackedPaletteRepository(memoryRepository);

export const preferencesRepository = new StoredPreferencesRepository(storage);
export const setRepository = new StoredSetRepository(storage);
export const entitlements = new StoredEntitlements(storage);
export const hapticsService = new ExpoHapticsService();
export const notificationScheduler = new ExpoNotificationScheduler();
export const soundService = new ExpoSoundService();

/**
 * One player for the whole app, which is what makes overlapping previews
 * unreachable rather than merely discouraged. See docs/11.
 */
export const previewPlayer = new PreviewPlayer();

/**
 * The catalogue.
 *
 * iTunes Search is the default because it is the only provider that gives a new
 * application a playable preview with no key, no account and no backend — which
 * is what lets the core loop work on a fresh install with nothing provisioned.
 * `UnconfiguredMusicProvider` is the honest fallback: it reports that pairing is
 * unavailable rather than returning invented songs. See docs/07.
 */
export const musicProvider: MusicProvider = new ITunesMusicProvider();

/**
 * Kept wired so the unconfigured path is a real, reachable code path rather than
 * a claim in a document: swapping the line above is the whole of "ship without a
 * catalogue", and the screens must already handle it.
 */
export { UnconfiguredMusicProvider };
