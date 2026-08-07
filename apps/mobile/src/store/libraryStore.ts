import { dedupeById, type Palette, type PaletteSet } from '@chromawave/domain';
import { create } from 'zustand';
import { paletteRepository, setRepository } from '@/infrastructure/dependencies';

/**
 * One copy of the library, shared by every screen that shows it.
 *
 * **Why this replaced per-screen hooks.** `usePalettes` and `useSets` each held
 * their own `useState` and loaded independently. Nothing connected them, so a
 * set created on the Sets tab left the Library header still reporting the old
 * count, deleting a palette left it on screen in Explore's search results, and a
 * rename showed only after the screen happened to remount. Every screen was
 * looking at its own snapshot of the same store.
 *
 * A single store means a write refreshes once and every subscriber re-renders.
 */
type LibraryState = {
  palettes: readonly Palette[];
  sets: readonly PaletteSet[];
  loading: boolean;
  /** True once storage has been read, however little came back. */
  loaded: boolean;
  /** True while a read is in flight, so a second mount does not start another. */
  reading: boolean;
  /** True while a pull-to-refresh is in flight, so the spinner is not shown on first load. */
  refreshing: boolean;
  error: boolean;

  load: () => Promise<void>;
  refresh: () => Promise<void>;
  savePalette: (palette: Palette) => Promise<void>;
  removePalette: (id: string) => Promise<void>;
  saveSet: (set: PaletteSet) => Promise<void>;
  removeSet: (id: string) => Promise<void>;
};

/**
 * Reads both collections together. They are shown side by side — the Library
 * header counts sets, a set lists palettes — so loading them separately would
 * put two renders' worth of inconsistency on screen.
 */
/**
 * How long the spinner stays up at minimum. Long enough that the control's
 * true→false transition always spans a commit, short enough not to feel held.
 */
const MIN_SPINNER_MS = 450;

/**
 * Both collections, deduplicated on the way in.
 *
 * This is the only door into the store, which makes it the only place identity
 * has to be enforced. Storage is a key-value blob written by several call sites
 * — a save, an import, a seed on first launch — and a write that lands twice, or
 * a seed that runs against a library that already has it, produces two records
 * with one id. Every screen then renders the card twice, and the second copy has
 * a duplicate React key, so its press handler goes to the first.
 *
 * Filtering it out in a renderer would hide exactly one symptom of that; doing
 * it here means every subscriber, every filter and every count sees one library.
 */
async function readAll() {
  const [palettes, sets] = await Promise.all([paletteRepository.list(), setRepository.list()]);
  return { palettes: dedupeById(palettes), sets: dedupeById(sets) };
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  palettes: [],
  sets: [],
  loading: true,
  loaded: false,
  reading: false,
  refreshing: false,
  error: false,

  load: async () => {
    // A second screen mounting while the first is still loading must not restart
    // the read; it will be re-rendered by the one already in flight.
    //
    // The guard is a flag rather than "is there anything in `palettes`", which
    // is the same question only for a library that has something in it. On a
    // fresh install it is false forever, so every screen that mounted — which is
    // every push, since `usePalettes` loads on mount — re-read storage on the
    // frame the transition started. The one user who sees that is the one
    // opening the app for the first time.
    if (get().loaded || get().reading) return;
    set({ reading: true });
    try {
      set({ ...(await readAll()), loaded: true, loading: false, error: false });
    } catch {
      set({ palettes: [], sets: [], loading: false, error: true });
    } finally {
      set({ reading: false });
    }
  },

  refresh: async () => {
    // A second pull while one is running would start a second read whose
    // completion clears the flag out from under the first.
    if (get().refreshing) return;
    set({ refreshing: true });

    // `RefreshControl` is controlled: the spinner the user's gesture started
    // only ends when React commits a render where `refreshing` has gone back to
    // false. Storage here is MMKV, which answers within a microtask — fast
    // enough that the true and the false can land in one batch, leaving the
    // control with no transition to act on. The floor below is a macrotask, so
    // the `true` is always committed first, and it also stops the spinner
    // flashing for one frame on a library that reloads instantly.
    const [outcome] = await Promise.all([
      readAll().then(
        (data) => ({ ok: true as const, data }),
        () => ({ ok: false as const, data: null }),
      ),
      new Promise((resolve) => setTimeout(resolve, MIN_SPINNER_MS)),
    ]);

    if (outcome.ok) set({ ...outcome.data, loaded: true, loading: false, error: false });
    else set({ error: true });
    set({ refreshing: false });
  },

  savePalette: async (palette) => {
    await paletteRepository.save(palette);
    set(await readAll());
  },

  removePalette: async (id) => {
    await paletteRepository.remove(id);
    set(await readAll());
  },

  saveSet: async (paletteSet) => {
    await setRepository.save(paletteSet);
    set(await readAll());
  },

  removeSet: async (id) => {
    await setRepository.remove(id);
    set(await readAll());
  },
}));
