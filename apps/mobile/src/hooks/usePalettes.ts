import { useEffect } from 'react';

import { useLibraryStore } from '@/store/libraryStore';

/**
 * The library's palettes, from the shared store.
 *
 * Kept as a hook with the same shape it always had so call sites did not need to
 * change — but the state now lives in one place, which is what makes a save on
 * one screen visible on every other. See `libraryStore` for why.
 */
export function usePalettes() {
  const palettes = useLibraryStore((state) => state.palettes);
  const loading = useLibraryStore((state) => state.loading);
  const refreshing = useLibraryStore((state) => state.refreshing);
  const error = useLibraryStore((state) => state.error);
  const load = useLibraryStore((state) => state.load);
  const refresh = useLibraryStore((state) => state.refresh);
  const save = useLibraryStore((state) => state.savePalette);
  const remove = useLibraryStore((state) => state.removePalette);

  useEffect(() => {
    void load();
  }, [load]);

  return { palettes, loading, refreshing, error, refresh, save, remove };
}
