import { useEffect } from 'react';

import { useLibraryStore } from '@/store/libraryStore';

/** Collections for the Sets tab. Mirrors `usePalettes`, over the same store. */
export function useSets() {
  const sets = useLibraryStore((state) => state.sets);
  const loading = useLibraryStore((state) => state.loading);
  const refreshing = useLibraryStore((state) => state.refreshing);
  const load = useLibraryStore((state) => state.load);
  const refresh = useLibraryStore((state) => state.refresh);
  const save = useLibraryStore((state) => state.saveSet);
  const remove = useLibraryStore((state) => state.removeSet);

  useEffect(() => {
    void load();
  }, [load]);

  return { sets, loading, refreshing, refresh, save, remove };
}
