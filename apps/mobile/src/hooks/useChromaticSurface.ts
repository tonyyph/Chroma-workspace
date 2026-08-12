import type { Color } from '@cw/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { adoptChroma, bandsFor, releaseChroma } from '@/ui/chroma';

/**
 * Makes the screen's own colour the app's colour while it is in front.
 *
 * Adopted on focus and released on blur rather than on mount and unmount: a
 * screen further down the stack is still mounted, and a field that kept the
 * colour of something two pushes back would be showing the wrong palette with
 * total confidence.
 *
 * Pass null on a screen with no single subject — the library grid is about
 * everything at once, so it stays on the brand's own bands.
 */
export function useChromaticSurface(colors: readonly Color[] | null): void {
  const reduced = useReducedMotion();
  // Keyed on the array itself, which the store keeps stable — a retune produces
  // a new palette object and so a new array, and the field follows it without
  // the caller having to say so.
  const bands = useMemo(() => (colors?.length ? bandsFor(colors) : null), [colors]);

  useFocusEffect(
    useCallback(() => {
      if (!bands) return;
      // Reduce motion means no 620ms colour crossfade; the field still adapts,
      // it simply arrives already there.
      adoptChroma(bands, !reduced);
      return () => releaseChroma(!reduced);
    }, [bands, reduced]),
  );
}
