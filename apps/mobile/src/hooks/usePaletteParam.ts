import type { Palette } from '@cw/domain';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { paletteRepository } from '@/infrastructure/dependencies';

/**
 * Loads the palette a tool route was opened for. Every G-series screen operates
 * on one palette, addressed as `?id=` so the routes stay deep-linkable
 * (`chromawave://tools/contrast?id=…`).
 *
 * Falls back to the most recent palette when no id is supplied, so the tools are
 * reachable from the You tab without first picking one.
 */
export function usePaletteParam(): { palette: Palette | null; loading: boolean } {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const resolved = id
        ? await paletteRepository.get(id)
        : ((await paletteRepository.list())[0] ?? null);
      if (!active) return;
      setPalette(resolved);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return { palette, loading };
}

/** The two palettes G3 Compare needs — `id` and `vs`, or the two most recent. */
export function useComparePair(): {
  first: Palette | null;
  second: Palette | null;
  loading: boolean;
} {
  const { id, vs } = useLocalSearchParams<{ id?: string; vs?: string }>();
  const [pair, setPair] = useState<{ first: Palette | null; second: Palette | null }>({
    first: null,
    second: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const all = await paletteRepository.list();
      const first = (id ? all.find((p) => p.id === id) : all[0]) ?? null;
      const second =
        (vs ? all.find((p) => p.id === vs) : all.find((p) => p.id !== first?.id)) ?? null;
      if (!active) return;
      setPair({ first, second });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, vs]);

  return { ...pair, loading };
}
