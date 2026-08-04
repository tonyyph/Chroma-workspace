import type { Palette, PaletteSet } from '@chromawave/domain';
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

async function readAll() {
  const [palettes, sets] = await Promise.all([paletteRepository.list(), setRepository.list()]);
  return { palettes, sets };
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  palettes: [],
  sets: [],
  loading: true,
  refreshing: false,
  error: false,

  load: async () => {
    // A second screen mounting while the first is still loading must not restart
    // the read; it will be re-rendered by the one already in flight.
    if (!get().loading && get().palettes.length) return;
    try {
      set({ ...(await readAll()), loading: false, error: false });
    } catch {
      set({ palettes: [], sets: [], loading: false, error: true });
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

    if (outcome.ok) set({ ...outcome.data, loading: false, error: false });
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
