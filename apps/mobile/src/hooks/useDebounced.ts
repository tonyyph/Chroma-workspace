import { useEffect, useState } from 'react';

/**
 * How long typing has to pause before the value counts as settled.
 *
 * Short enough that a result still feels like it arrived as you typed; long
 * enough that a normal typing rate — a keystroke every 100-150ms — produces one
 * search rather than one per letter.
 */
export const SEARCH_DEBOUNCE_MS = 180;

/**
 * A value, held back until it stops changing.
 *
 * The field itself stays on the immediate value, so typing never lags behind the
 * finger. Only the work *downstream* of it — a feed query, a scan of the whole
 * library — waits, which is the half that cannot keep up with a keystroke.
 */
export function useDebounced(value: string, delay: number = SEARCH_DEBOUNCE_MS): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    // An empty field is not a search anyone is mid-way through typing: clearing
    // should restore the unfiltered list at once, not a fifth of a second later.
    if (value === settled || value === '') {
      setSettled(value);
      return;
    }
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, settled, delay]);

  return settled;
}
