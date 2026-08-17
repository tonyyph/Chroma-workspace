import { describe, expect, it } from 'vitest';

import {
  canRedo,
  canUndo,
  createHistory,
  HISTORY_LIMIT,
  pushHistory,
  redo,
  resetHistory,
  undo,
} from './history';

/** A stand-in document. History is generic; nothing here depends on a project. */
type Doc = { readonly n: number };

const doc = (n: number): Doc => ({ n });

describe('a new history', () => {
  it('starts with nothing to undo or redo', () => {
    const history = createHistory(doc(0));
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
    expect(history.present.n).toBe(0);
  });
});

describe('push, undo, redo', () => {
  it('walks back and forward through states', () => {
    let history = createHistory(doc(0));
    history = pushHistory(history, doc(1));
    history = pushHistory(history, doc(2));

    expect(history.present.n).toBe(2);

    history = undo(history);
    expect(history.present.n).toBe(1);
    history = undo(history);
    expect(history.present.n).toBe(0);
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.present.n).toBe(1);
    history = redo(history);
    expect(history.present.n).toBe(2);
    expect(canRedo(history)).toBe(false);
  });

  it('restores the exact previous object, not a reconstruction of it', () => {
    const first = doc(0);
    const second = doc(1);
    const history = pushHistory(createHistory(first), second);
    // Reference equality is the whole argument for storing states rather than
    // inverse operations: what comes back cannot be subtly different.
    expect(undo(history).present).toBe(first);
  });

  it('does nothing at either end rather than throwing', () => {
    const history = createHistory(doc(0));
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('ignores a push of the state already present', () => {
    const only = doc(0);
    const history = createHistory(only);
    expect(pushHistory(history, only)).toBe(history);
  });
});

describe('branching', () => {
  it('clears the redo stack when a new edit follows an undo', () => {
    let history = createHistory(doc(0));
    history = pushHistory(history, doc(1));
    history = undo(history);
    expect(canRedo(history)).toBe(true);

    history = pushHistory(history, doc(99));
    expect(canRedo(history)).toBe(false);
    expect(history.present.n).toBe(99);
  });
});

describe('coalescing', () => {
  it('collapses a run of same-key edits into one undo step', () => {
    let history = createHistory(doc(0));
    for (let n = 1; n <= 40; n += 1) {
      history = pushHistory(history, doc(n), { coalesceKey: 'opacity' });
    }
    expect(history.present.n).toBe(40);
    // One step back returns to before the whole run.
    expect(undo(history).present.n).toBe(0);
    expect(canUndo(undo(history))).toBe(false);
  });

  it('starts a new step when the key changes', () => {
    let history = createHistory(doc(0));
    history = pushHistory(history, doc(1), { coalesceKey: 'opacity' });
    history = pushHistory(history, doc(2), { coalesceKey: 'rotation' });

    expect(undo(history).present.n).toBe(1);
  });

  it('does not coalesce unkeyed pushes', () => {
    let history = createHistory(doc(0));
    history = pushHistory(history, doc(1));
    history = pushHistory(history, doc(2));
    expect(undo(history).present.n).toBe(1);
  });

  it('does not let a coalesce reach back across an undo', () => {
    let history = createHistory(doc(0));
    history = pushHistory(history, doc(1), { coalesceKey: 'opacity' });
    history = undo(history);
    history = pushHistory(history, doc(5), { coalesceKey: 'opacity' });

    // The undone state must still be reachable; the new edit is its own step.
    expect(undo(history).present.n).toBe(0);
  });
});

describe('the bound', () => {
  it('keeps the most recent steps and forgets the oldest', () => {
    let history = createHistory(doc(0));
    for (let n = 1; n <= HISTORY_LIMIT + 20; n += 1) {
      history = pushHistory(history, doc(n));
    }

    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.present.n).toBe(HISTORY_LIMIT + 20);

    // Undoing all the way back reaches the oldest state still kept, not state 0.
    let unwound = history;
    while (canUndo(unwound)) unwound = undo(unwound);
    expect(unwound.present.n).toBe(20);
  });

  it('never exceeds the bound however long the session runs', () => {
    let history = createHistory(doc(0));
    for (let n = 1; n <= 500; n += 1) {
      history = pushHistory(history, doc(n));
      expect(history.past.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    }
  });
});

describe('resetHistory', () => {
  it('keeps the present and forgets both directions', () => {
    let history = createHistory(doc(0));
    history = pushHistory(history, doc(1));
    history = pushHistory(history, doc(2));
    history = undo(history);

    const reset = resetHistory(history);
    expect(reset.present.n).toBe(1);
    expect(canUndo(reset)).toBe(false);
    expect(canRedo(reset)).toBe(false);
  });
});
