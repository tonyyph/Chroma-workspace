import { type ColorMood, type VisualStyle } from '@cw/domain';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { unreadActivityCount } from '@/features/tools/activity';
import { usePalettes } from '@/hooks';
import { usePreferences } from '@/providers';
import { Screen } from '@/ui';
import { ControlDeck } from './ControlDeck';
import { RecentCaptures } from './RecentCaptures';
import { SignatureHero } from './SignatureHero';
import { StatsRail } from './StatsRail';
import { TasteSection } from './TasteSection';
import { byRecency, capturedThisMonth, totalColors } from './youInsights';

/**
 * D2 · YOU — a portrait of a library rather than a settings list.
 *
 * **What the folds are, and why in this order.** The previous screen was an
 * avatar, three equal stat tiles and two stacked groups of preference rows.
 * Everything on it was the same size and the same shape, so it read as a form:
 * nothing said what this person's colour actually looks like, and the only thing
 * you could do from it was change a setting.
 *
 * It is now organised by what is *theirs*, in descending order of how personal
 * it is:
 *
 *  1. a signature drawn from their own dominant bands, full-bleed, with the
 *     identity card floating over its lower edge;
 *  2. a compact stat rail that reads in one glance without taking a whole fold;
 *  3. what they keep coming back to, derived from the palettes themselves and
 *     tappable straight through to the library filtered by it;
 *  4. their recent captures;
 *  5. and only then the controls, which have not changed behaviour at all.
 *
 * Depth is doing the hierarchy: the hero is behind, the identity card is glass
 * over it, the mosaic sits on the ground, and the control deck is a single
 * grouped surface. Nothing is a card just because the thing above it was.
 *
 * This file is the running order and nothing else. Each fold owns its own
 * markup and its own styles, in its own file beside this one.
 */
export function YouScreen() {
  const { palettes } = usePalettes();
  const router = useRouter();
  const { preferences } = usePreferences();

  const pinned = useMemo(() => palettes.filter((palette) => palette.isPinned).length, [palettes]);
  const colours = useMemo(() => totalColors(palettes), [palettes]);
  const thisMonth = useMemo(() => capturedThisMonth(palettes), [palettes]);
  const unread = useMemo(
    () => unreadActivityCount(palettes, preferences.activityReadAt),
    [palettes, preferences.activityReadAt],
  );
  const recent = useMemo(() => byRecency(palettes).slice(0, 3), [palettes]);

  const openLibrary = (params?: { mood?: ColorMood; style?: VisualStyle }) => {
    // `navigate`, not `push`: the library is a sibling tab, and pushing it puts
    // a second copy of the whole tab navigator on the stack.
    router.navigate({ pathname: '/(tabs)', params: params ?? {} });
  };

  return (
    <Screen tabBarInset topInset={false}>
      <SignatureHero palettes={palettes} />

      <StatsRail
        colours={colours}
        onOpenLibrary={() => openLibrary()}
        palettes={palettes.length}
        pinned={pinned}
        thisMonth={thisMonth}
      />

      <TasteSection onPick={openLibrary} palettes={palettes} />

      <RecentCaptures onSeeAll={() => openLibrary()} palettes={recent} />

      <ControlDeck unread={unread} />
    </Screen>
  );
}
