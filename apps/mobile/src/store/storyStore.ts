import {
  canRedo,
  canUndo,
  createHistory,
  createStoryProject,
  pushHistory,
  redo as redoHistory,
  resetHistory,
  undo as undoHistory,
  type History,
  type StoryFormatId,
  type StoryProject,
} from '@cw/domain';
import { create } from 'zustand';
import { storyRepository } from '@/infrastructure/dependencies';

/**
 * The story being edited, and nothing else.
 *
 * **This store holds only persistent document state.** Selection, the active
 * slide and the open tool live in `storyEditorStore`; gesture positions live in
 * Reanimated shared values and never reach React at all. The separation is not
 * tidiness — it is what stops a drag from re-rendering the document, and what
 * makes "what gets saved" a question with one answer.
 *
 * **Undo is here rather than in the editor store** because the thing being
 * undone *is* the document. Keeping the history beside the present state means
 * they cannot disagree about which version is current.
 */

/** What the user is told about their work being safe. */
export type SaveState = 'saved' | 'dirty' | 'saving' | 'failed';

export type StoryLoadState = 'idle' | 'loading' | 'ready' | 'missing' | 'failed';

/**
 * How long after the last edit the document is written.
 *
 * Short enough that killing the app costs at most this much work, long enough
 * that dragging an element does not write to disk on every gesture end. Gesture
 * frames never reach here at all — the canvas commits once, when a gesture
 * finishes — so this debounce is smoothing seconds, not frames.
 */
const AUTOSAVE_MS = 800;

type StoryState = {
  history: History<StoryProject> | null;
  loadState: StoryLoadState;
  saveState: SaveState;
  /** Set when a load failed for a reason worth naming on screen. */
  problem: string | null;

  create: (input: {
    id: string;
    format: StoryFormatId;
    slideCount: number;
    now: string;
    sourceMemoryIds?: readonly string[];
  }) => Promise<StoryProject>;
  load: (id: string) => Promise<void>;
  close: () => void;

  /**
   * Applies a document operation and records it.
   *
   * Every edit in the app goes through here, which is what makes undo total: an
   * operation that bypassed this would be invisible to the history and would
   * silently break the next undo rather than merely failing to be undoable.
   */
  apply: (
    change: (project: StoryProject) => StoryProject,
    options?: { coalesceKey?: string },
  ) => void;

  undo: () => void;
  redo: () => void;

  /** Writes now, cancelling any pending autosave. Used when leaving the editor. */
  flush: () => Promise<void>;
};

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

const cancelAutosave = (): void => {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
};

export const useStoryStore = create<StoryState>((set, get) => {
  /**
   * Writes the present document.
   *
   * Reads the project at call time rather than closing over one: between the
   * timer being set and it firing, the user has almost certainly edited again,
   * and saving the version that scheduled the write would silently discard
   * everything since.
   */
  const write = async (): Promise<void> => {
    const project = get().history?.present;
    if (project === undefined) return;

    set({ saveState: 'saving' });
    try {
      await storyRepository.save(project);
      // Only report saved if nothing changed while the write was in flight.
      // Otherwise the badge says "saved" over work that is not on disk yet.
      const current = get().history?.present;
      set({ saveState: current === project ? 'saved' : 'dirty' });
    } catch {
      // A failed write must stay visible. Reporting 'saved' here is the exact
      // dishonesty that makes someone close an editor over lost work.
      set({ saveState: 'failed' });
    }
  };

  const scheduleAutosave = (): void => {
    cancelAutosave();
    set({ saveState: 'dirty' });
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void write();
    }, AUTOSAVE_MS);
  };

  return {
    history: null,
    loadState: 'idle',
    saveState: 'saved',
    problem: null,

    create: async (input) => {
      const project = createStoryProject(input);
      // Written immediately rather than left to autosave: a project that exists
      // in memory but not on disk is one the drafts list cannot show and a crash
      // erases without trace.
      set({
        history: createHistory(project),
        loadState: 'ready',
        saveState: 'saving',
        problem: null,
      });
      await write();
      return project;
    },

    load: async (id) => {
      cancelAutosave();
      set({ loadState: 'loading', problem: null });
      try {
        const project = await storyRepository.get(id);
        if (project === null) {
          set({ history: null, loadState: 'missing' });
          return;
        }
        // A fresh history, deliberately. An undo stack that survived a restart
        // would let someone undo their way into a state from a session they no
        // longer remember, past the last point they deliberately stopped.
        set({ history: createHistory(project), loadState: 'ready', saveState: 'saved' });
      } catch {
        set({ history: null, loadState: 'failed', problem: 'story.error.load' });
      }
    },

    close: () => {
      cancelAutosave();
      set({ history: null, loadState: 'idle', saveState: 'saved', problem: null });
    },

    apply: (change, options) => {
      const history = get().history;
      if (history === null) return;

      const next = change(history.present);
      // Reference equality: `document.ts` returns the same object when an
      // operation could not be performed, so a refused edit costs no history
      // entry and no write.
      if (next === history.present) return;

      set({
        history: pushHistory(
          history,
          next,
          options?.coalesceKey === undefined ? undefined : { coalesceKey: options.coalesceKey },
        ),
      });
      scheduleAutosave();
    },

    undo: () => {
      const history = get().history;
      if (history === null || !canUndo(history)) return;
      set({ history: undoHistory(history) });
      scheduleAutosave();
    },

    redo: () => {
      const history = get().history;
      if (history === null || !canRedo(history)) return;
      set({ history: redoHistory(history) });
      scheduleAutosave();
    },

    flush: async () => {
      cancelAutosave();
      await write();
    },
  };
});

/* ------------------------------------------------------------- selectors */

/**
 * Selectors rather than inline `state => state.history?.present`.
 *
 * `PreferencesProvider` is a React Compiler bail-out and the editor is the
 * hottest path in the app; a selector that constructs a new object each call
 * re-renders every subscriber on every store write. These return the stored
 * references unchanged.
 */
export const selectProject = (state: StoryState): StoryProject | null =>
  state.history?.present ?? null;

export const selectCanUndo = (state: StoryState): boolean =>
  state.history !== null && canUndo(state.history);

export const selectCanRedo = (state: StoryState): boolean =>
  state.history !== null && canRedo(state.history);

/** Discards the undo stack while keeping the document — used after a save point. */
export const clearStoryHistory = (): void => {
  const history = useStoryStore.getState().history;
  if (history !== null) useStoryStore.setState({ history: resetHistory(history) });
};
