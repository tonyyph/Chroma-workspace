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
import { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTrending } from '@/features/trending/useTrending';
import { usePalettes } from '@/hooks/usePalettes';
import { useSets } from '@/hooks/useSets';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  BandRefreshControl,
  Button,
  CardSkeleton,
  EmptyGlyph,
  FilterRail,
  Gutter,
  Icon,
  Pressable,
  Screen,
  ScreenHeader,
  SectionHead,
  Shimmer,
  Text,
} from '@/ui';
import { reportBackdropScroll } from '@/ui/backdropMotion';
import { useDiscoveryFilters } from '../discovery/useDiscoveryFilters';
import { HeroCarousel } from './HeroCarousel';
import { PaletteCard } from './PaletteCard';

/**
 * C1 · LIBRARY — the landing screen.
 *
 * Three bands of content, in the order someone opens the app wanting them:
 *
 *  1. a carousel of destinations, each one a thing to *do* right now;
 *  2. what the rest of the app is saving, as a rail with its own screen behind it;
 *  3. the user's own library, under a filter rail that can ask real questions of it.
 *
 * The grid stays a `FlatList` and everything above it is its header, rather than
 * the whole screen being a `ScrollView` with a nested list. Two nested scrollers
 * on the same axis break recycling — the grid would mount every card it has —
 * and on a library of any size that is the difference between a screen that
 * opens instantly and one that hitches.
 */
export function LibraryScreen() {
  const router = useRouter();
  const { palettes, loading, refreshing, refresh } = usePalettes();
  const { sets } = useSets();
  const { t } = usePreferences();
  const insets = useSafeAreaInsets();

  const filters = useDiscoveryFilters();
  const { apply, query } = filters;

  // A deep link — the You tab's taste chips land here — arrives as params rather
  // than as state, and has to be applied when it changes, not only on mount.
  const { mood, style } = useLocalSearchParams<{ mood?: string; style?: string }>();
  useEffect(() => {
    const moods = colorMoods.filter((entry): entry is ColorMood => entry === mood);
    const styles = visualStyles.filter((entry): entry is VisualStyle => entry === style);
    if (moods.length || styles.length) apply({ moods, styles });
  }, [apply, mood, style]);

  const visible = useMemo(() => queryPalettes(palettes, query), [palettes, query]);

  // The grid is the app's busiest scroll, so it is the one the backdrop most
  // needs to move against.
  const onScroll = useAnimatedScrollHandler((event) => {
    reportBackdropScroll(event.contentOffset.y);
  });

  const openPalette = useCallback(
    (palette: Palette) => router.push(`/palette/${palette.id}`),
    [router],
  );

  const renderCard = useCallback(
    ({ item }: { item: (typeof visible)[number] }) => (
      <View style={styles.column}>
        <PaletteCard onOpen={openPalette} palette={item} />
      </View>
    ),
    [openPalette],
  );

  const header = (
    <>
      <Gutter>
        <ScreenHeader
          meta={t('library.meta', { palettes: palettes.length, collections: sets.length })}
          title={t('library.title')}
          trailing={
            <Pressable
              accessibilityLabel={t('library.search')}
              accessibilityRole="button"
              onPress={() => router.push('/explore')}
              style={styles.searchButton}
            >
              <Icon name="search" scale="action" />
            </Pressable>
          }
        />
      </Gutter>

      <View style={styles.hero}>
        <LandingHero recent={palettes[0] ?? null} />
      </View>

      <Gutter style={styles.libraryHead}>
        <SectionHead
          meta={
            visible.length === palettes.length
              ? undefined
              : t('library.resultCount', { count: visible.length, total: palettes.length })
          }
          title={t('library.title')}
        />
      </Gutter>

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
    </>
  );

  return (
    <Screen scroll={false}>
      <Animated.FlatList
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: size.tabBar + space.sectionGap * 2 + insets.bottom },
        ]}
        data={loading ? [] : visible}
        // The search field lives in this list's header, so without these the
        // filter chips and every card below it need a tap to close the keyboard
        // before they take one of their own.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListEmptyComponent={
          loading ? (
            <Gutter>
              <Shimmer>
                <View style={styles.grid}>
                  <View style={styles.column}>
                    <CardSkeleton />
                  </View>
                  <View style={styles.column}>
                    <CardSkeleton />
                  </View>
                </View>
              </Shimmer>
            </Gutter>
          ) : (
            <Gutter>
              <EmptyLibrary
                filtered={filters.activeCount > 0}
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
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        numColumns={2}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        windowSize={7}
      />
    </Screen>
  );
}

/**
 * The carousel's featured slide needs the top trending entry, so the hero reads
 * the feed itself rather than the screen threading it down. One page of one item
 * — the rail below asks for its own six, and both are served from the same
 * validated catalogue.
 */
/**
 * Memoised for the same reason the carousel it renders is: it holds the feed
 * read for the hero, and it sits in a list header that the filter rail below it
 * re-renders.
 */
const LandingHero = memo(function LandingHero({ recent }: { recent: Palette | null }) {
  const feed = useTrending({
    category: 'all',
    moods: [],
    styles: [],
    search: '',
    sort: 'popular',
    pageSize: 1,
  });

  return <HeroCarousel featured={feed.items[0] ?? null} recent={recent} />;
});

/** FLOW E · "Nothing captured yet" — the mark with its wave missing. */
function EmptyLibrary({
  onCapture,
  onReset,
  filtered,
}: {
  onCapture: () => void;
  onReset: () => void;
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
          library offers the only thing that can fill it. */}
      {filtered ? (
        <Button label={t('filter.reset')} onPress={onReset} size="xs" variant="secondary" />
      ) : (
        <Button label={t('library.empty.action')} onPress={onCapture} size="xs" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ui.fill.chip,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingTop: space.md,
  },
  libraryHead: {
    paddingTop: space.sectionGap,
  },
  list: {
    paddingTop: space.cardGap,
  },
  row: {
    alignItems: 'flex-start',
    paddingHorizontal: space.gutter - space.cardGap / 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: space.md,
    marginHorizontal: -space.cardGap / 2,
  },
  column: {
    flex: 1,
    paddingHorizontal: space.cardGap / 2,
    paddingBottom: space.cardGap,
  },
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
