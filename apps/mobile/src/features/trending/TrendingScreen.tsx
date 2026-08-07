import { space } from '@chromawave/design-tokens';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trendingCategories, type TrendingCategory, type TrendingItem } from '@/data';
import { useDiscoveryFilters } from '@/features/discovery/useDiscoveryFilters';
import { useDebounced } from '@/hooks';
import { usePreferences } from '@/providers';
import {
  BandRefreshControl,
  Button,
  CardSkeleton,
  Chip,
  EmptyGlyph,
  Field,
  FilterRail,
  Gutter,
  InlineError,
  Meta,
  NavBar,
  Screen,
  ScreenHeader,
  Shimmer,
  Text,
} from '@/ui';
import { reportBackdropScroll } from '@/ui/backdropMotion';
import { TrendingCard } from './TrendingCard';
import type { TrendingSort } from './trendingRepository';
import { useTrending } from './useTrending';
import { useTrendingSave } from './useTrendingSave';

/**
 * C4 · TRENDING — the whole feed, behind the home rail's "SEE ALL".
 *
 * The home rail shows six and stops. This is the screen that has to hold up when
 * someone actually browses: three filter axes, a search field, an order, and
 * enough rows that they arrive a page at a time. Every state the feed can be in
 * is drawn — first load, empty result, failed read, loading a further page, and
 * the end of the list — because each of those is a place a user can land, and a
 * screen that only draws the happy one is a screen that goes blank.
 */
export function TrendingScreen() {
  const router = useRouter();
  const { t } = usePreferences();
  const insets = useSafeAreaInsets();
  const saver = useTrendingSave();

  const filters = useDiscoveryFilters();
  const [category, setCategory] = useState<TrendingCategory | 'all'>('all');
  const [sort, setSort] = useState<TrendingSort>('popular');
  const debouncedSearch = useDebounced(filters.query.search);

  const feed = useTrending({
    category,
    moods: filters.query.moods,
    styles: filters.query.styles,
    // The field keeps the raw value; the feed waits for the typing to stop, so
    // a five-letter word is one query rather than five.
    search: debouncedSearch,
    sort,
    pageSize: PAGE_SIZE,
  });

  const onScroll = useAnimatedScrollHandler((event) => {
    reportBackdropScroll(event.contentOffset.y);
  });

  // Stable identities, so a keystroke in the search field above does not make
  // every row in the feed re-render to receive an identical handler.
  const { open, save: saveToLibrary, ownedIdFor } = saver;
  const openItem = useCallback((item: TrendingItem) => void open(item), [open]);
  const saveItem = useCallback((item: TrendingItem) => void saveToLibrary(item), [saveToLibrary]);
  const renderRow = useCallback(
    ({ item }: { item: TrendingItem }) => (
      <View style={styles.row}>
        <TrendingCard
          item={item}
          onPress={openItem}
          onSave={saveItem}
          saved={ownedIdFor(item) !== null}
          variant="row"
        />
      </View>
    ),
    [openItem, saveItem, ownedIdFor],
  );

  /**
   * The category rail lives outside the disclosure but is still a filter, so it
   * counts towards the "N ON" pill and is cleared by RESET. A reset that leaves
   * one narrowing in place is the reason people give up and restart a screen.
   * The sort is not a narrowing and keeps its default.
   */
  const activeCount = filters.activeCount + (category === 'all' ? 0 : 1);
  const resetAll = () => {
    filters.reset();
    setCategory('all');
  };

  const categoryOptions = useMemo(
    () =>
      (['all', ...trendingCategories] as const).map((value) => ({
        value,
        label: t(`trending.category.${value}`),
      })),
    [t],
  );

  const header = (
    <>
      {/* Reached by a push from the library, but also deep-linkable, and a back
          that no-ops on a cold open is a dead control. When there is no history
          the leading action goes to the library the screen belongs to. */}
      <NavBar
        leading={t('trending.back')}
        leadingIcon="back"
        onLeading={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      />

      <Gutter style={styles.head}>
        <ScreenHeader
          meta={t('trending.screenMeta', { count: feed.total })}
          title={t('trending.title')}
        />
      </Gutter>

      <Gutter style={styles.search}>
        <Field
          label={t('trending.search')}
          onChangeText={filters.setSearch}
          placeholder={t('trending.search')}
          value={filters.query.search}
        />
      </Gutter>

      {/* Category is its own rail rather than a group inside the disclosure: it
          is the axis people reach for first, and burying the first move behind a
          tap is how a filter set stops being used. */}
      <ScrollView
        contentContainerStyle={styles.categories}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {categoryOptions.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            onPress={() => setCategory(option.value)}
            tone={category === option.value ? 'selected' : 'default'}
          />
        ))}
      </ScrollView>

      <FilterRail
        activeCount={activeCount}
        groups={filters.groups}
        labels={filters.railLabels}
        onReset={resetAll}
        primary={{
          id: 'sort',
          label: t('filter.group.sort'),
          options: [
            { value: 'popular', label: t('trending.sort.popular') },
            { value: 'new', label: t('trending.sort.new') },
          ],
          selected: [sort],
          onToggle: (value) => setSort(value === 'new' ? 'new' : 'popular'),
        }}
      />

      {feed.status === 'ready' && feed.items.length > 0 ? (
        <Gutter style={styles.count}>
          <Meta>{t('trending.resultCount', { count: feed.total })}</Meta>
        </Gutter>
      ) : null}

      {saver.saveFailed ? (
        <Gutter style={styles.count}>
          <InlineError detail={t('trending.saveFailedDetail')} title={t('trending.saveFailed')} />
        </Gutter>
      ) : null}
    </>
  );

  return (
    <Screen scroll={false}>
      <Animated.FlatList
        // Pushed over the tabs rather than inside them, so the only thing to
        // clear at the bottom is the home indicator.
        contentContainerStyle={[
          styles.list,
          { paddingBottom: space.sectionGap * 2 + insets.bottom },
        ]}
        data={feed.status === 'ready' ? feed.items : EMPTY}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={keyOf}
        renderItem={renderRow}
        // Matched to the library grid: a full-width row with a colour strip is
        // no cheaper to mount than a card, and this list pages to hundreds.
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        removeClippedSubviews
        windowSize={7}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Gutter style={styles.state}>
            {feed.status === 'loading' ? (
              <LoadingRows />
            ) : feed.status === 'error' ? (
              <FeedError onRetry={feed.retry} />
            ) : (
              <FeedEmpty onReset={resetAll} showReset={activeCount > 0} />
            )}
          </Gutter>
        }
        ListFooterComponent={
          feed.items.length > 0 ? (
            <Gutter style={styles.footer}>
              {feed.loadingMore ? (
                <Shimmer>
                  <CardSkeleton />
                </Shimmer>
              ) : feed.hasMore ? (
                <Button
                  label={t('trending.loadMore')}
                  onPress={feed.loadMore}
                  size="xs"
                  variant="secondary"
                />
              ) : null}
            </Gutter>
          ) : null
        }
        // Paging happens on approach as well as on the button: the button is for
        // people who scroll to the end and stop, the threshold for people who
        // keep going.
        onEndReached={() => {
          if (feed.hasMore) feed.loadMore();
        }}
        onEndReachedThreshold={0.6}
        onScroll={onScroll}
        refreshControl={
          <BandRefreshControl onRefresh={feed.refresh} refreshing={feed.refreshing} />
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const PAGE_SIZE = 8;
/** A stable empty array, so a non-ready feed does not remount the list each render. */
const keyOf = (item: TrendingItem) => item.id;

const EMPTY: readonly TrendingItem[] = [];

function LoadingRows() {
  const { t } = usePreferences();
  return (
    <View accessibilityLabel={t('trending.loading')} style={styles.loading}>
      <Shimmer>
        <View style={styles.loadingRows}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      </Shimmer>
    </View>
  );
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  const { t } = usePreferences();
  return (
    <View style={styles.stateBody}>
      <EmptyGlyph kind="offline" />
      <Text variant="section">{t('trending.error.title')}</Text>
      <Text style={styles.stateCopy} tone="secondary" variant="body">
        {t('trending.error.body')}
      </Text>
      <Button label={t('trending.retry')} onPress={onRetry} size="xs" />
    </View>
  );
}

function FeedEmpty({ onReset, showReset }: { onReset: () => void; showReset: boolean }) {
  const { t } = usePreferences();
  return (
    <View style={styles.stateBody}>
      <EmptyGlyph kind="no-results" />
      <Text variant="section">{t('trending.empty.title')}</Text>
      <Text style={styles.stateCopy} tone="secondary" variant="body">
        {t('trending.empty.body')}
      </Text>
      {showReset ? (
        <Button label={t('filter.reset')} onPress={onReset} size="xs" variant="secondary" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: space.xs,
  },
  search: {
    paddingTop: space.cardGap,
  },
  categories: {
    paddingHorizontal: space.gutter,
    paddingTop: space.cardGap,
    gap: space.xs,
  },
  count: {
    paddingTop: space.sm,
  },
  list: {
    paddingTop: space.xs,
  },
  row: {
    paddingHorizontal: space.gutter,
    paddingTop: 10,
  },
  footer: {
    paddingTop: space.md,
  },
  state: {
    paddingTop: space.lg,
  },
  stateBody: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
  },
  stateCopy: {
    textAlign: 'center',
  },
  loading: {
    gap: space.sm,
  },
  loadingRows: {
    gap: space.sm,
  },
});
