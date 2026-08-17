/**
 * Undo and redo, as kept states rather than as replayed inverse edits.
 *
 * The alternative — recording each operation and an instruction for reversing
 * it — has one failure mode that never fully goes away: an inverse that is
 * *nearly* right. Restoring a resize needs the previous frame, restoring a
 * delete needs the element and its z-position, and every new operation is
 * another chance to get its inverse subtly wrong in a way no test thought to
 * check. Because `document.ts` is immutable, the previous state is still the
 * same object, so keeping it costs a reference and restoring it is exact by
 * construction.
 *
 * **Why keeping fifty documents is affordable.** Immutable updates share
 * structure: editing one element's frame produces a new project and a new layers
 * array, while every untouched element, every asset record and the track are the
 * same objects as before. A history entry is a spine, not a copy. Nothing here
 * holds pixels — assets are URIs (`project.ts`), never bytes — so the bound is
 * about keeping the spine list from growing without limit, not about images.
 */

export const HISTORY_LIMIT = 50;

export type History<T> = Readonly<{
  past: readonly T[];
  present: T;
  future: readonly T[];
  /**
   * What produced the present state, when the caller named it.
   *
   * Used only for coalescing (below) and for announcing "Undo move" to a screen
   * reader — the brief requires undo to be announced, and "Undo" alone does not
   * tell someone what came back.
   */
  label: string | null;
}>;

export const createHistory = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
  label: null,
});

export const canUndo = <T>(history: History<T>): boolean => history.past.length > 0;
export const canRedo = <T>(history: History<T>): boolean => history.future.length > 0;

/**
 * Records a new state.
 *
 * **Coalescing.** A slider drag and a burst of typing each produce dozens of
 * states that a person thinks of as one action, and an undo stack that makes
 * them press undo forty times to remove one sentence is not an undo stack. When
 * `coalesceKey` matches the key that produced the current present, the present
 * is replaced instead of pushed — so the whole run collapses to a single step
 * back to where it started. Gestures do not need this: the editor commits once,
 * on gesture end, and never per frame.
 *
 * Pushing always clears the future. Branching histories are a different feature
 * with a different UI, and silently keeping a redo that no longer applies to the
 * current state is how redo restores something impossible.
 */
export function pushHistory<T>(
  history: History<T>,
  present: T,
  options?: { coalesceKey?: string },
): History<T> {
  if (present === history.present) return history;

  const key = options?.coalesceKey;
  if (key !== undefined && key === history.label) {
    return { ...history, present, future: [] };
  }

  const past = [...history.past, history.present];
  return {
    // Dropping from the front keeps the *most recent* fifty steps, which is the
    // half anyone actually reaches for.
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present,
    future: [],
    label: key ?? null,
  };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    // The label described how we *got* to the state being undone; it no longer
    // describes the present. Clearing it also stops a coalesce from reaching
    // back across an undo and swallowing it.
    label: null,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
    label: null,
  };
}

/**
 * Forgets everything but the present.
 *
 * Used when a project is loaded from storage: an undo stack that survives a
 * restart would let someone undo their way to a state from a session they no
 * longer remember, past the point they last deliberately saved.
 */
export const resetHistory = <T>(history: History<T>): History<T> => createHistory(history.present);
