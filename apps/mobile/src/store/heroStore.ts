import type { Color } from '@cw/domain';
import { create } from 'zustand';

/** Where the strip was on screen when it was tapped, in window coordinates. */
export type HeroRect = { x: number; y: number; width: number; height: number };

type HeroState = {
  /** Non-null only while a transition is running. */
  colors: readonly Color[] | null;
  from: HeroRect | null;
  begin: (from: HeroRect, colors: readonly Color[]) => void;
  end: () => void;
};

/**
 * The palette strip in flight between a card and the screen it opens.
 *
 * Reanimated 4 still ships the `sharedTransitionTag` *type* but dropped the
 * runtime that made it work, so this is a measured overlay rather than a
 * built-in shared element: the card reports where it was, and a copy of its
 * bands flies from there to where the detail hero is about to be.
 *
 * Deliberately a store rather than context — the card that starts a transition
 * and the overlay that runs it are on opposite sides of the navigator, and
 * threading a provider between them would mean re-rendering the whole tree to
 * move one rectangle.
 */
export const useHeroStore = create<HeroState>((set) => ({
  colors: null,
  from: null,
  begin: (from, colors) => set({ from, colors }),
  end: () => set({ from: null, colors: null }),
}));
