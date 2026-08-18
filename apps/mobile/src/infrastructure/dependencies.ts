import { DevelopmentAnalytics } from '@cw/analytics';
import {
  UnavailableSubjectExtractor,
  UnconfiguredMusicProvider,
  type MusicProvider,
  type SubjectExtractor,
} from '@cw/domain';
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
import { StoredRecipeRepository } from './story/StoredRecipeRepository';
import { StoredStoryRepository } from './story/StoredStoryRepository';
import { ExpoSharedContainer, ExpoTimelineReloader } from './widgets/ExpoSharedContainer';
import { WidgetSnapshotWriter } from './widgets/WidgetSnapshotWriter';

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

/**
 * Story projects.
 *
 * Shares the one MMKV instance — there is no reason for a second — but lays its
 * data out differently: one key per project rather than one key for the library,
 * because autosave writes during editing and must not serialise every story a
 * person has ever made to record one moved element. See the class comment.
 */
export const storyRepository = new StoredStoryRepository(storage);

/**
 * Remix recipes, on this device only.
 *
 * Decision D5: there is no backend, no account and no identity, so a recipe is
 * saved here and remixed here. `06-remix-privacy-model.md` specifies the API a
 * server would need; nothing in this app reaches one.
 */
export const recipeRepository = new StoredRecipeRepository(storage);

/**
 * Subject extraction for Chroma Cutout.
 *
 * Decision D4 chose iOS Vision, which needs a native module this build does not
 * have yet — so the honest implementation is the one that reports itself
 * unavailable. Wired here rather than left unreferenced for the same reason
 * `UnconfiguredMusicProvider` is: the unavailable path has to be a real,
 * reachable code path that the UI already handles, not a claim in a document.
 *
 * Every surface must consult `availability()` and **hide** the feature when it
 * answers no. There is deliberately no fallback that produces a rectangle.
 */
export const subjectExtractor: SubjectExtractor = new UnavailableSubjectExtractor();

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

/**
 * What the home screen widget reads.
 *
 * Reports `unavailable` and does nothing at all on Android, in Expo Go, and on
 * any build whose App Group entitlement was never provisioned — which is why it
 * is constructed unconditionally rather than behind a platform check. The
 * absence is a state the writer already models, not a branch every caller has
 * to remember.
 */
export const widgetSnapshotWriter = new WidgetSnapshotWriter(
  new ExpoSharedContainer(),
  new ExpoTimelineReloader(),
  storage,
);

/**
 * Publishes the current library to the shared container.
 *
 * Reads through `memoryRepository` rather than taking the library store's
 * palettes, because a widget shows a track and the palette projection has
 * nowhere to put one. Never throws: the caller is a side effect of a save.
 */
export async function publishWidgetSnapshot(skin: 'chroma' | 'swiss') {
  try {
    return await widgetSnapshotWriter.sync(await memoryRepository.list(), skin);
  } catch {
    return { status: 'failed', reason: 'library-unreadable' } as const;
  }
}
