import { create } from 'zustand';

/**
 * What the editor is showing, as opposed to what the document says.
 *
 * Everything here is **transient**: it is never written to disk, it is cleared
 * when the editor closes, and losing it costs the user nothing but a tap. That
 * is the whole reason it lives apart from `storyStore` — mixing it in would mean
 * selecting a layer marks the document dirty and schedules a write, and the
 * autosave badge would flicker every time someone tapped a photograph.
 *
 * Gesture state is *not* here either. An in-flight drag lives in Reanimated
 * shared values on the UI thread; putting it in a store would re-render the
 * canvas sixty times a second to move one element.
 */

/** Which contextual tool the bottom dock is showing. */
export const storyTools = ['select', 'photo', 'text', 'palette'] as const;
export type StoryTool = (typeof storyTools)[number];

type StoryEditorState = {
  selectedId: string | null;
  activeSlide: number;
  tool: StoryTool;
  overview: boolean;

  select: (id: string | null) => void;
  setActiveSlide: (index: number) => void;
  setTool: (tool: StoryTool) => void;
  toggleOverview: () => void;
  reset: () => void;
};

const initial = {
  selectedId: null,
  activeSlide: 0,
  tool: 'select' as StoryTool,
  overview: false,
};

export const useStoryEditorStore = create<StoryEditorState>((set) => ({
  ...initial,

  select: (selectedId) =>
    set((state) => (state.selectedId === selectedId ? state : { ...state, selectedId })),

  setActiveSlide: (index) =>
    set((state) => (state.activeSlide === index ? state : { ...state, activeSlide: index })),

  setTool: (tool) => set((state) => (state.tool === tool ? state : { ...state, tool })),

  toggleOverview: () => set((state) => ({ ...state, overview: !state.overview })),

  reset: () => set({ ...initial }),
}));

/**
 * Clears the selection if it points at an element that no longer exists.
 *
 * Deleting the selected layer, or undoing the edit that created it, leaves a
 * selection id with nothing behind it — and every consumer would then have to
 * handle "selected but absent". One reconciliation here means they do not.
 */
export const reconcileSelection = (existingIds: readonly string[]): void => {
  const { selectedId } = useStoryEditorStore.getState();
  if (selectedId !== null && !existingIds.includes(selectedId)) {
    useStoryEditorStore.setState({ selectedId: null });
  }
};
