import type { Palette } from '@chromawave/domain';
import { useCallback, useEffect, useState } from 'react';

import { paletteRepository } from '@/infrastructure/dependencies';

type State = {
  palettes: readonly Palette[];
  loading: boolean;
  error: boolean;
};

/**
 * The library's data source. Kept deliberately small — a load, a refresh and a
 * save — because every screen that mutates a palette writes through the
 * repository and then refreshes, rather than holding its own copy.
 */
export function usePalettes() {
  const [state, setState] = useState<State>({ palettes: [], loading: true, error: false });

  const refresh = useCallback(async () => {
    try {
      const palettes = await paletteRepository.list();
      setState({ palettes, loading: false, error: false });
    } catch {
      setState({ palettes: [], loading: false, error: true });
    }
  }, []);

  useEffect(() => {
    let active = true;
    paletteRepository
      .list()
      .then((palettes) => {
        if (active) setState({ palettes, loading: false, error: false });
      })
      .catch(() => {
        if (active) setState({ palettes: [], loading: false, error: true });
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(
    async (palette: Palette) => {
      await paletteRepository.save(palette);
      await refresh();
    },
    [refresh],
  );

  return { ...state, refresh, save };
}
