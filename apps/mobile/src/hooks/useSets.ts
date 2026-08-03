import type { PaletteSet } from '@chromawave/domain';
import { useCallback, useEffect, useState } from 'react';

import { setRepository } from '@/infrastructure/dependencies';

/** Collections for the Sets tab. Mirrors `usePalettes`. */
export function useSets() {
  const [sets, setSets] = useState<readonly PaletteSet[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSets(await setRepository.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setRepository
      .list()
      .then((next) => {
        if (active) setSets(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(
    async (set: PaletteSet) => {
      await setRepository.save(set);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await setRepository.remove(id);
      await refresh();
    },
    [refresh],
  );

  return { sets, loading, refresh, save, remove };
}
