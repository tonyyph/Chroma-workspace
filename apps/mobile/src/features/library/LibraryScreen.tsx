import { size, space, ui } from '@chromawave/design-tokens';
import {
  colorMoods,
  libraryFilters,
  queryPalettes,
  visualStyles,
  type ColorMood,
  type Palette,
  type VisualStyle,
} from '@chromawave/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { seedPalettes } from '@/data';
import { usePalettes, useSets } from '@/hooks';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers';
import {
  BandRefreshControl,
  Button,
  CardSkeleton,
  EmptyGlyph,
  FilterRail,
  Gutter,
  Icon,
  Meta,
  Pressable,
  Screen,
  Shimmer,
  Text,
} from '@/ui';
import { reportBackdropScroll } from '@/ui/backdropMotion';
import { useDiscoveryFilters } from '../discovery/useDiscoveryFilters';
import { toLibraryRows, type LibraryRow } from './libraryRows';
import { LibrarySignature } from './LibrarySignature';
import { PaletteRibbon } from './PaletteRibbon';

/**
 * C1 · LIBRARY — the archive.
 *
 * **What this screen used to be.** A masthead, a carousel of up to four things
 * to go and do, a filter rail, and a two-column grid of bordered cards. Which
 * is the layout of every content app there is: promo strip, then tiles. The
 * app's own subject — colour someone went out and stood in — was rendered as
 * 167-point thumbnails behind borders, four to a screenful.
 *
 * **What it is now.** Three things, in the order a personal archive should
 * present itself:
 *
 *  1. the whole collection merged into one signature, which no other install
 *     has and which is made entirely of the user's own work;
 *  2. the filter rail, when there is enough to be worth narrowing;
 *  3. the archive itself as a continuous ribbon, cut into months.
 *
 * Time is the ordering because that is what a record of light *is*. Each month
 * opens with its own merged colour, so scrolling back is scrolling through what
 * the year actually looked like rather than through a paginated grid.
 *
 * Still one recycling `FlatList` with everything above it as the header. Months
 * are interleaved into the same flat array rather than made into sections: a
 * `SectionList` or a nested scroller would cost more than the grouping is worth.
 */
export function LibraryScreen() {
  const router = useRouter();
  const { palettes, loading, refreshing, refresh, save } = usePalettes();
  const { sets } = useSets();
  const { t, preferences } = usePreferences();
  const insets = useSafeAreaInsets();
  const [addingExamples, setAddingExamples] = useState(false);

  const filters = useDiscoveryFilters();
  const { apply, query } = filters;

  /**
   * The examples, on request. They are written through the ordinary save path
   * rather than straight into storage, so they are real palettes the user can
   * rename, tag and delete exactly like their own — which is the only honest
   * way to show someone what a saved palette is.
   */
  const addExamples = useCallback(async () => {
    setAddingExamples(true);
    try {
      for (const palette of seedPalettes()) await save(palette);
    } catch {
      // Nothing to say here that the still-empty archive does not already say.
    } finally {
      setAddingExamples(false);
    }
  }, [save]);

  // A deep link — the You tab's taste chips land here — arrives as params rather
  // than as state, and has to be applied when it changes, not only on mount.
  const { mood, style } = useLocalSearchParams<{ mood?: string; style?: string }>();
  useEffect(() => {
    const moods = colorMoods.filter((entry): entry is ColorMood => entry === mood);
    const styles = visualStyles.filter((entry): entry is VisualStyle => entry === style);
    if (moods.length || styles.length) apply({ moods, styles });
  }, [apply, mood, style]);

  const visible = useMemo(() => queryPalettes(palettes, query), [palettes, query]);
  const rows = useMemo(() => toLibraryRows(visible), [visible]);

  // The archive is the app's busiest scroll, so it is the one the backdrop most
  // needs to move against.
  const onScroll = useAnimatedScrollHandler((event) => {
    reportBackdropScroll(event.contentOffset.y);
  });

  const openPalette = useCallback(
    (palette: Palette) => router.push(`/palette/${palette.id}`),
    [router],
  );

  /**
   * A month reads as a rule across the page: its own colour as a thin bar, the
   * month itself, and how many readings it holds. Deliberately quiet — it is a
   * chapter mark, and competing with the ribbon underneath would defeat it.
   */
  const renderRow = useCallback(
    ({ item }: { item: LibraryRow }) => {
      if (item.kind === 'palette') {
        return <PaletteRibbon onOpen={openPalette} palette={item.palette} />;
      }
      return (
        <View style={styles.month}>
          <Gutter style={styles.monthCopy}>
            <Text variant="section">
              {new Date(item.iso).toLocaleDateString(preferences.language, {
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Meta>{t('library.monthCount', { count: item.count })}</Meta>
          </Gutter>
          <View style={styles.monthBand}>
            {item.colors.map((color, index) => (
              <View
                key={`${index}:${color.hex}`}
                style={{ flex: color.weight, backgroundColor: color.hex }}
              />
            ))}
          </View>
        </View>
      );
    },
    [openPalette, preferences.language, t],
  );

  const filtered = visible.length !== palettes.length;

  const header = (
    <>
      {/* MASTHEAD. One title, with the counts as its eyebrow and search sharing
          that line, so nothing sits beside 46pt type to be measured against. */}
      <Gutter style={styles.masthead}>
        <View style={styles.mastheadTop}>
          <Meta>{t('library.meta', { palettes: palettes.length, collections: sets.length })}</Meta>
          <Pressable
            accessibilityLabel={t('library.search')}
            accessibilityRole="button"
            hitSlop={12}
            // Explore is the next tab along, not a screen to stack on top of
            // this one — `push` left a duplicate tab bar behind it.
            onPress={() => router.navigate('/explore')}
          >
            <Icon color={ui.text.secondary} name="search" scale="action" />
          </Pressable>
        </View>
        <Text accessibilityRole="header" variant="hero">
          {t('library.title')}
        </Text>
      </Gutter>

      <View style={styles.signature}>
        <LibrarySignature palettes={palettes} />
      </View>

      <View style={styles.rail}>
        <FilterRail
          activeCount={filters.activeCount}
          groups={filters.groups}
          labels={filters.railLabels}
          onReset={filters.reset}
          primary={{
            id: 'base',
            label: t('library.title'),
            options: libraryFilters.map((key) => ({
              value: key,
              label: t(`library.filter.${key}`),
            })),
            selected: [query.base],
            onToggle: (value) => {
              const next = libraryFilters.find((entry) => entry === value) ?? 'all';
              filters.setBase(next);
              analytics.track('library_filter_changed', { filter: next });
            },
          }}
        />
      </View>

      {/* Only when a filter is narrowing something. An unfiltered archive
          counting itself twice on one screen is noise. */}
      {filtered ? (
        <Gutter style={styles.count}>
          <Meta>{t('library.resultCount', { count: visible.length, total: palettes.length })}</Meta>
        </Gutter>
      ) : null}
    </>
  );

  return (
    <Screen scroll={false}>
      <Animated.FlatList
        contentContainerStyle={[
          styles.list,
          { paddingBottom: size.tabBar + space.sectionGap * 2 + insets.bottom },
        ]}
        data={loading ? EMPTY : rows}
        // The search control lives in this list's header, so without these the
        // filter chips and every row below need a tap to close the keyboard
        // before they take one of their own.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={keyOf}
        renderItem={renderRow}
        ListEmptyComponent={
          loading ? (
            <Gutter style={styles.loading}>
              <Shimmer>
                <CardSkeleton />
              </Shimmer>
            </Gutter>
          ) : (
            <Gutter>
              <EmptyLibrary
                addingExamples={addingExamples}
                filtered={filters.activeCount > 0}
                onAddExamples={() => void addExamples()}
                onCapture={() => router.push('/capture')}
                onReset={filters.reset}
              />
            </Gutter>
          )
        }
        ListHeaderComponent={header}
        onScroll={onScroll}
        refreshControl={
          <BandRefreshControl onRefresh={() => void refresh()} refreshing={refreshing} />
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        windowSize={9}
      />
    </Screen>
  );
}

const EMPTY: readonly LibraryRow[] = [];
const keyOf = (row: LibraryRow) => row.key;

/** FLOW E · "Nothing captured yet" — the mark with its wave missing. */
function EmptyLibrary({
  onCapture,
  onReset,
  onAddExamples,
  addingExamples,
  filtered,
}: {
  onCapture: () => void;
  onReset: () => void;
  onAddExamples: () => void;
  addingExamples: boolean;
  filtered: boolean;
}) {
  const { t } = usePreferences();
  return (
    <View style={styles.empty}>
      <EmptyGlyph kind={filtered ? 'no-results' : 'no-library'} />
      <Text variant="section">
        {t(filtered ? 'library.noResults.title' : 'library.empty.title')}
      </Text>
      <Text style={styles.emptyBody} tone="secondary" variant="body">
        {t(filtered ? 'library.noResults.body' : 'library.empty.body')}
      </Text>
      {/* A filtered empty state offers the way out of the filter; an empty
          archive offers the only thing that can fill it. */}
      {filtered ? (
        <Button label={t('filter.reset')} onPress={onReset} size="xs" variant="secondary" />
      ) : (
        <>
          <Button label={t('library.empty.action')} onPress={onCapture} size="xs" />
          {/* Secondary, and secondary on purpose: the examples are worth having
              to see what a saved palette looks like, but an archive that fills
              itself with someone else's work is what this replaced. */}
          <Button
            disabled={addingExamples}
            label={t(addingExamples ? 'common.working' : 'library.empty.examples')}
            onPress={onAddExamples}
            size="xs"
            variant="ghost"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: { paddingTop: space.sm, gap: 6 },
  mastheadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  signature: { paddingTop: space.lg },
  rail: { paddingTop: space.gutter },
  count: { paddingTop: space.sm },
  list: { paddingTop: space.md },
  /** Air above a chapter, none below it: the rule belongs to the month it
   *  opens, and an even gap would leave it floating between two of them. */
  month: { paddingTop: space.xl, paddingBottom: space.sm },
  monthCopy: { gap: 2, paddingBottom: space.xs },
  monthBand: { height: 3, flexDirection: 'row', marginHorizontal: space.gutter },
  loading: { paddingTop: space.md },
  empty: {
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
  },
  emptyBody: {
    textAlign: 'center',
  },
});
