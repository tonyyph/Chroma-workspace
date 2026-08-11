import { size, space, type Skin } from '@chromawave/design-tokens';
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
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { seedPalettes } from '@/data';
import { useTrending } from '@/features/trending/useTrending';
import { usePalettes, useSets } from '@/hooks';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences, useSkin } from '@/providers';
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
  useStyles,
} from '@/ui';
import { reportBackdropScroll } from '@/ui/backdropMotion';
import { useDiscoveryFilters } from '../discovery/useDiscoveryFilters';
import { HeroCarousel } from './HeroCarousel';
import { toLibraryRows, type LibraryRow } from './libraryRows';
import { PaletteRibbon } from './PaletteRibbon';

/**
 * C1 · LIBRARY — the archive.
 *
 * **What this screen used to be.** A masthead, a full-height carousel, a filter
 * rail, and a two-column grid of bordered cards — the layout of every content
 * app there is. The app's own subject, colour someone went out and stood in,
 * was rendered as 167-point thumbnails behind borders, four to a screenful.
 *
 * The grid is what changed. The carousel stayed, at four fifths of its old
 * height: it is worth having somewhere to go next, and it is not worth having
 * that be the tallest thing above your own archive.
 *
 * **What it is now.** Three things, in the order a personal archive should
 * present itself:
 *
 *  1. a carousel of somewhere to go next, sized as a suggestion;
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
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { palettes, loading, refreshing, refresh, save } = usePalettes();
  const { sets } = useSets();
  const { t, preferences } = usePreferences();
  const insets = useSafeAreaInsets();
  const [addingExamples, setAddingExamples] = useState(false);

  const filters = useDiscoveryFilters();
  const { apply, query } = filters;

  const addExamples = useCallback(async () => {
    setAddingExamples(true);
    try {
      for (const palette of seedPalettes()) await save(palette);
    } catch {
    } finally {
      setAddingExamples(false);
    }
  }, [save]);

  const { mood, style } = useLocalSearchParams<{ mood?: string; style?: string }>();

  useEffect(() => {
    const moods = colorMoods.filter((entry): entry is ColorMood => entry === mood);
    const styles = visualStyles.filter((entry): entry is VisualStyle => entry === style);
    if (moods.length || styles.length) apply({ moods, styles });
  }, [apply, mood, style]);

  const visible = useMemo(() => queryPalettes(palettes, query), [palettes, query]);
  const rows = useMemo(() => toLibraryRows(visible), [visible]);

  const onScroll = useAnimatedScrollHandler((event) => {
    reportBackdropScroll(event.contentOffset.y);
  });

  const openPalette = useCallback(
    (palette: Palette) => router.push(`/palette/${palette.id}`),
    [router],
  );

  const renderRow = useCallback(
    ({ item }: { item: LibraryRow }) => {
      if (item.kind === 'palette') {
        return <PaletteRibbon onOpen={openPalette} palette={item.palette} />;
      }

      const cap = skin.round.full;
      const last = item.colors.length - 1;
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
                style={{
                  flex: color.weight,
                  backgroundColor: color.hex,
                  borderTopLeftRadius: index === 0 ? cap : 0,
                  borderBottomLeftRadius: index === 0 ? cap : 0,
                  borderBottomRightRadius: index === last ? cap : 0,
                  borderTopRightRadius: index === last ? cap : 0,
                }}
              />
            ))}
          </View>
        </View>
      );
    },
    [openPalette, preferences.language, skin.round.full, styles, t],
  );

  const filtered = visible.length !== palettes.length;

  const header = (
    <>
      <Gutter style={styles.masthead}>
        <View style={styles.mastheadTop}>
          <Text accessibilityRole="header" variant="title">
            {t('library.title')}
          </Text>
          <Pressable
            accessibilityLabel={t('library.search')}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.navigate('/explore')}
          >
            <Icon color={skin.ui.text.secondary} name="search" scale="action" />
          </Pressable>
        </View>
        <Meta>{t('library.meta', { palettes: palettes.length, collections: sets.length })}</Meta>
      </Gutter>

      <View style={styles.hero}>
        <LandingHero recent={palettes[0] ?? null} />
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

/**
 * The carousel's featured slide needs the top field note, so the hero reads the
 * feed itself rather than the screen threading it down. One page of one item.
 *
 * Memoised for the same reason the carousel it renders is: it holds a feed read
 * and it sits in a list header that the filter rail below it re-renders.
 */
const LandingHero = memo(function LandingHero({ recent }: { recent: Palette | null }) {
  const feed = useTrending({
    category: 'all',
    moods: [],
    styles: [],
    search: '',
    sort: 'featured',
    pageSize: 1,
  });

  return <HeroCarousel featured={feed.items[0] ?? null} recent={recent} />;
});

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
  const styles = useStyles(makeStyles);
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
      {filtered ? (
        <Button label={t('filter.reset')} onPress={onReset} size="xs" variant="secondary" />
      ) : (
        <>
          <Button label={t('library.empty.action')} onPress={onCapture} size="xs" />
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

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    masthead: { gap: 6 },
    mastheadTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 28,
    },
    hero: { paddingTop: space.lg },
    rail: { paddingTop: space.gutter },
    count: { paddingTop: space.sm },
    list: { paddingTop: space.md },
    month: { paddingTop: space.gutter, paddingBottom: space.sm },
    monthCopy: { gap: 2, paddingBottom: space.xs },
    monthBand: {
      height: 4.5,
      flexDirection: 'row',
      marginHorizontal: space.gutter,
    },
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
