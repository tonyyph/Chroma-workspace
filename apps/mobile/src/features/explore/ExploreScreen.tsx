import { round, space, ui } from '@chromawave/design-tokens';
import { emptyQuery, queryPalettes } from '@chromawave/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { type TrendingItem } from '@/data';
import { TrendingCard } from '@/features/trending/TrendingCard';
import { useTrending } from '@/features/trending/useTrending';
import { useTrendingSave } from '@/features/trending/useTrendingSave';
import { useDebounced, usePalettes } from '@/hooks';
import { usePreferences } from '@/providers';
import {
  BandCanvas,
  Card,
  CardSkeleton,
  Field,
  Gutter,
  InlineError,
  Pressable,
  Screen,
  SectionHead,
  Shimmer,
  SwatchStrip,
  Text,
} from '@/ui';

const BANNER_HEIGHT = 186;
/** How many feed rows show here before the Trending screen is the better place. */
const EXPLORE_PREVIEW = 6;
/** A stable empty set, so "exclude nothing" is not a new object every render. */
const NOTHING_EXCLUDED: ReadonlySet<string> = new Set();

/**
 * C2 · EXPLORE — search across both feeds, over the editorial banner.
 *
 * The field searches the trending catalogue *and* the user's own library, because
 * searching only the feed leaves someone typing the name of a palette they saved
 * five seconds ago and getting nothing back.
 *
 * That is also what makes this the one screen where the same palette can be
 * shown twice: once as the entry it came from, and once as the copy the user now
 * owns. They have different ids — the copy is a new record — so id-based
 * deduplication cannot see it. The feed is asked to exclude anything whose
 * colours are already in the library, which is the property the two share.
 */
export function ExploreScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();
  const [query, setQuery] = useState(q ?? '');
  const { t } = usePreferences();
  const { palettes, refreshing, refresh } = usePalettes();
  const saver = useTrendingSave();
  const { width } = useWindowDimensions();

  // Arriving from a tag chip on B4 lands here with the tag already typed.
  useEffect(() => {
    if (q) setQuery(q);
  }, [q]);

  // The field renders `query`; everything expensive reads this. A keystroke
  // otherwise refetched the feed *and* scanned the whole library, both on the
  // thread that has to draw the next character.
  const search = useDebounced(query.trim());

  const feed = useTrending({
    category: 'all',
    moods: [],
    styles: [],
    search,
    sort: 'featured',
    pageSize: EXPLORE_PREVIEW,
    // While searching, anything already owned is listed above under the user's
    // own name for it, so offering it again as a feed entry is the same palette
    // twice. With no search there is no library section to collide with, and
    // excluding it there would instead make a row vanish the moment it is
    // saved — so the exclusion is scoped to exactly the case that needs it.
    exclude: search ? saver.ownedSignatures : NOTHING_EXCLUDED,
  });

  // Stable across keystrokes, which is what lets the memoised cards below sit
  // still while the field above them takes another letter.
  const { open, save: saveItemToLibrary } = saver;
  const openItem = useCallback((item: TrendingItem) => void open(item), [open]);
  const saveItem = useCallback(
    (item: TrendingItem) => void saveItemToLibrary(item),
    [saveItemToLibrary],
  );

  /** The user's own matches. Only shown while searching — this is not the library. */
  const mine = useMemo(
    () => (search ? queryPalettes(palettes, { ...emptyQuery, search }) : []),
    [palettes, search],
  );

  const featured = feed.items[0] ?? null;

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing} tabBarInset>
      <Gutter style={styles.head}>
        <Text accessibilityRole="header" variant="title">
          {t('explore.title')}
        </Text>
      </Gutter>

      <Gutter style={styles.search}>
        <Field
          label={t('explore.searchPlaceholder')}
          onChangeText={setQuery}
          placeholder={t('explore.searchPlaceholder')}
          value={query}
        />
      </Gutter>

      {/* The editorial banner is the featured palette, so it opens it. It is
          only drawn when there is one — a banner that opens nothing is worse
          than a screen that starts at the results. */}
      {featured ? (
        <Gutter style={styles.bannerWrap}>
          <Pressable
            accessibilityHint={featured.blurb}
            accessibilityLabel={featured.name}
            accessibilityRole="button"
            onPress={() => void saver.open(featured)}
            style={styles.banner}
          >
            <View style={StyleSheet.absoluteFill}>
              {/* Measured, not assumed: the fixed 342 this used to draw at was
                  clipped on a 375pt phone and left a strip of bare ground on a
                  430pt one. */}
              <BandCanvas
                background={ui.bg.media}
                blur={13}
                colors={featured.colors.map((color) => color.hex)}
                height={BANNER_HEIGHT}
                width={width - space.gutter * 2}
              />
            </View>
            <View style={styles.bannerScrim} />
            <View style={styles.bannerCopy}>
              <Text tone="info" variant="eyebrow">
                {t('explore.editorial')}
              </Text>
              <Text variant="section">{featured.name}</Text>
              <Text numberOfLines={1} tone="secondary" variant="body">
                {featured.blurb}
              </Text>
            </View>
          </Pressable>
        </Gutter>
      ) : null}

      {mine.length ? (
        <>
          <Gutter style={styles.sectionHead}>
            <SectionHead
              meta={t('explore.resultCount', { count: mine.length })}
              title={t('explore.inYourLibrary')}
            />
          </Gutter>
          <Gutter style={styles.rows}>
            {mine.map((palette) => (
              <Card
                accessibilityLabel={palette.name}
                key={palette.id}
                onPress={() => router.push(`/palette/${palette.id}`)}
                style={styles.row}
              >
                <SwatchStrip
                  colors={palette.colors}
                  height={44}
                  radius={11}
                  style={styles.rowStrip}
                />
                <View style={styles.rowCopy}>
                  <Text variant="cardTitle">{palette.name}</Text>
                  <Text tone="tertiary" variant="monoSmall">
                    {palette.colors.map((color) => color.hex.slice(1)).join(' · ')}
                  </Text>
                </View>
              </Card>
            ))}
          </Gutter>
        </>
      ) : null}

      <Gutter style={styles.sectionHead}>
        <SectionHead
          action={t('trending.seeAll')}
          meta={search ? t('trending.resultCount', { count: feed.total }) : t('trending.homeMeta')}
          onAction={() => router.push('/trending')}
          title={t('trending.title')}
        />
      </Gutter>

      {saver.saveFailed ? (
        <Gutter style={styles.error}>
          <InlineError detail={t('trending.saveFailedDetail')} title={t('trending.saveFailed')} />
        </Gutter>
      ) : null}

      <Gutter style={styles.rows}>
        {feed.status === 'loading' ? (
          <Shimmer>
            <View style={styles.rows}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          </Shimmer>
        ) : feed.status === 'error' ? (
          <InlineError detail={t('trending.error.body')} title={t('trending.error.title')} />
        ) : feed.items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text tone="secondary" variant="body">
              {search ? t('explore.noResults', { query: search }) : t('trending.empty.body')}
            </Text>
          </Card>
        ) : (
          feed.items.map((item) => (
            <TrendingCard
              item={item}
              key={item.id}
              onPress={openItem}
              onSave={saveItem}
              saved={saver.ownedIdFor(item) !== null}
              variant="row"
            />
          ))
        )}
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: space.cardGap,
  },
  search: {
    paddingTop: space.cardGap,
  },
  bannerWrap: {
    paddingTop: space.md + 2,
  },
  banner: {
    height: BANNER_HEIGHT,
    borderRadius: round.media,
    overflow: 'hidden',
    backgroundColor: ui.bg.media,
    justifyContent: 'flex-end',
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,7,14,.45)',
  },
  bannerCopy: {
    padding: space.md,
    gap: 6,
  },
  sectionHead: {
    paddingTop: space.gutter,
  },
  error: {
    paddingTop: space.md,
  },
  rows: {
    paddingTop: space.cardGap,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  rowStrip: {
    width: 74,
  },
  emptyCard: {
    paddingVertical: space.md,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
});
