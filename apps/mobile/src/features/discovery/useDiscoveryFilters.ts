import {
  activeFilterCount,
  colorMoods,
  toggleIn,
  visualStyles,
  type ColorMood,
  type LibraryFilter,
  type PaletteQuery,
  type VisualStyle,
} from '@chromawave/domain';
import { useCallback, useMemo, useState } from 'react';
import { usePreferences } from '@/providers';
import type { FilterGroup, FilterOption } from '@/ui';

/**
 * The colour-mood and visual-style filter groups, in the user's language.
 *
 * Two surfaces browse by these axes — the library and the trending feed — and
 * they must offer the same words in the same order, or a user who learns
 * "pastel" in one place cannot find it in the other. So the groups are built
 * here once from the domain's own lists: adding a mood to `colorMoods` puts a
 * chip on both screens, and forgetting its string is a type error rather than a
 * blank pill.
 */
export function useDiscoveryFilters(initial?: Partial<PaletteQuery>) {
  const { t } = usePreferences();
  const [query, setQuery] = useState<PaletteQuery>({
    base: initial?.base ?? 'all',
    moods: initial?.moods ?? [],
    styles: initial?.styles ?? [],
    search: initial?.search ?? '',
  });

  const setBase = useCallback((base: LibraryFilter) => {
    setQuery((current) => ({ ...current, base }));
  }, []);

  /** Applies a whole selection at once — what a deep link into the library does. */
  const apply = useCallback((next: Partial<PaletteQuery>) => {
    setQuery((current) => ({ ...current, ...next }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setQuery((current) => ({ ...current, search }));
  }, []);

  const toggleMood = useCallback((mood: ColorMood) => {
    setQuery((current) => ({ ...current, moods: toggleIn(current.moods, mood) }));
  }, []);

  const toggleStyle = useCallback((style: VisualStyle) => {
    setQuery((current) => ({ ...current, styles: toggleIn(current.styles, style) }));
  }, []);

  /** Resets the axes, not the search field — clearing text the user typed is theft. */
  const reset = useCallback(() => {
    setQuery((current) => ({ ...current, base: 'all', moods: [], styles: [] }));
  }, []);

  const moodOptions = useMemo<readonly FilterOption[]>(
    () => colorMoods.map((mood) => ({ value: mood, label: t(`library.mood.${mood}`) })),
    [t],
  );

  const styleOptions = useMemo<readonly FilterOption[]>(
    () => visualStyles.map((style) => ({ value: style, label: t(`library.style.${style}`) })),
    [t],
  );

  const groups = useMemo<readonly FilterGroup[]>(
    () => [
      {
        id: 'mood',
        label: t('filter.group.mood'),
        options: moodOptions,
        selected: query.moods,
        onToggle: (value) => toggleMood(value as ColorMood),
      },
      {
        id: 'style',
        label: t('filter.group.style'),
        options: styleOptions,
        selected: query.styles,
        onToggle: (value) => toggleStyle(value as VisualStyle),
      },
    ],
    [moodOptions, query.moods, query.styles, styleOptions, t, toggleMood, toggleStyle],
  );

  const count = activeFilterCount(query);

  const railLabels = useMemo(
    () => ({
      toggle: t('filter.toggle'),
      active: t('filter.active', { count }),
      reset: t('filter.reset'),
      expand: t('filter.expand'),
      collapse: t('filter.collapse'),
    }),
    [count, t],
  );

  return {
    query,
    groups,
    railLabels,
    /** Counts the search too, which is what the header's "N on" pill reports. */
    activeCount: count,
    apply,
    setBase,
    setSearch,
    toggleMood,
    toggleStyle,
    reset,
  };
}
