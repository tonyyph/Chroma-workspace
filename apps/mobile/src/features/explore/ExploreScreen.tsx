import { round, space, ui } from '@chromawave/design-tokens';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { trendingPalettes } from '@/data/seed';
import { usePalettes } from '@/hooks/usePalettes';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  BandCanvas,
  Card,
  Chip,
  Field,
  Gutter,
  InlineError,
  Meta,
  Screen,
  SwatchStrip,
  Text,
} from '@/ui';

const BANNER_HEIGHT = 186;
/** How many trending rows show before "SEE ALL" is worth tapping. */
const TRENDING_PREVIEW = 3;

/**
 * C2 · EXPLORE — editorial banner over the band field, then trending rows.
 *
 * The trending content is seeded fixture data: this build is local-first with
 * no server, so save counts and handles come from `@/data/seed` rather than a
 * feed. The layout is the design's.
 */
export function ExploreScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();
  const [query, setQuery] = useState(q ?? '');
  const { t } = usePreferences();
  const { palettes, save } = usePalettes();
  // Trending id → the id of the palette it was copied into, so a saved row can
  // open the copy the user now owns rather than the fixture.
  const [saved, setSaved] = useState<Readonly<Record<string, string>>>({});
  const [saveError, setSaveError] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const { width } = useWindowDimensions();

  // Arriving from a tag chip on B4 lands here with the tag already typed.
  useEffect(() => {
    if (q) setQuery(q);
  }, [q]);

  const search = query.trim().toLocaleLowerCase();

  /**
   * The field searches both feeds: the seeded trending rows and the user's own
   * library. Searching only the fixtures would leave someone typing the name of
   * a palette they saved five seconds ago and getting nothing.
   */
  const trending = useMemo(() => {
    const matches = search
      ? trendingPalettes.filter(
          (item) =>
            item.name.toLocaleLowerCase().includes(search) ||
            item.author.toLocaleLowerCase().includes(search) ||
            item.colors.some((color) => color.hex.toLocaleLowerCase().includes(search)),
        )
      : trendingPalettes;
    return showAll || search ? matches : matches.slice(0, TRENDING_PREVIEW);
  }, [search, showAll]);

  const mine = useMemo(() => {
    if (!search) return [];
    return palettes.filter(
      (palette) =>
        palette.name.toLocaleLowerCase().includes(search) ||
        palette.tags.some((tag) => tag.toLocaleLowerCase().includes(search)) ||
        palette.colors.some((color) => color.hex.toLocaleLowerCase().includes(search)),
    );
  }, [palettes, search]);

  /**
   * Trending entries are fixture data, not remote records — saving one copies it
   * into the user's own library as a real palette they then own outright.
   */
  const saveTrending = async (item: (typeof trendingPalettes)[number]) => {
    const now = new Date().toISOString();
    const id = Crypto.randomUUID();
    try {
      await save({
        schemaVersion: 1,
        id,
        name: item.name,
        createdAt: now,
        capturedAt: now,
        source: 'photo',
        colors: [...item.colors],
        tags: [item.author],
        location: null,
        photoUri: null,
        deltaE: 0,
        confidence: 1,
        space: 'srgb',
        tuned: false,
        setIds: [],
        isPinned: false,
      });
      setSaved((current) => ({ ...current, [item.id]: id }));
      return id;
    } catch {
      // A failed save has to say so — a button that silently does nothing is the
      // worst possible outcome here.
      setSaveError(true);
      return null;
    }
  };

  /**
   * Tapping a row opens the palette. It has to exist first, so an unsaved row
   * saves on the way through — which is the same thing the SAVE chip does, just
   * without stopping to ask.
   */
  const openTrending = async (item: (typeof trendingPalettes)[number]) => {
    const id = saved[item.id] ?? (await saveTrending(item));
    if (id) router.push(`/palette/${id}`);
  };

  return (
    <Screen tabBarInset>
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

      {/* The editorial banner is the featured palette, so it opens it. */}
      <Gutter style={styles.bannerWrap}>
        <Pressable
          accessibilityLabel={t('explore.featured')}
          accessibilityRole="button"
          onPress={() => {
            const featured = trendingPalettes[0];
            if (featured) void openTrending(featured);
          }}
          style={styles.banner}
        >
          <View style={StyleSheet.absoluteFill}>
            {/* Measured, not assumed: the fixed 342 this used to draw at was
                clipped on a 375pt phone and left a strip of bare ground on a
                430pt one. */}
            <BandCanvas
              background={ui.bg.media}
              blur={13}
              height={BANNER_HEIGHT}
              width={width - space.gutter * 2}
            />
          </View>
          <View style={styles.bannerScrim} />
          <View style={styles.bannerCopy}>
            <Text tone="info" variant="eyebrow">
              {t('explore.editorial')}
            </Text>
            <Text variant="section">{t('explore.featured')}</Text>
          </View>
        </Pressable>
      </Gutter>

      {mine.length ? (
        <>
          <Gutter style={styles.sectionHead}>
            <Text variant="rowTitle">{t('explore.inYourLibrary')}</Text>
            <Meta>{t('explore.resultCount', { count: mine.length })}</Meta>
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
        <Text variant="rowTitle">{t('explore.trending')}</Text>
        {search ? (
          <Meta>{t('explore.resultCount', { count: trending.length })}</Meta>
        ) : (
          <Pressable
            accessibilityLabel={t(showAll ? 'explore.seeLess' : 'explore.seeAll')}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setShowAll((current) => !current)}
          >
            <Text tone="tertiary" variant="chip">
              {t(showAll ? 'explore.seeLess' : 'explore.seeAll')}
            </Text>
          </Pressable>
        )}
      </Gutter>

      {saveError ? (
        <Gutter style={styles.error}>
          <InlineError detail={t('explore.saveFailedDetail')} title={t('explore.saveFailed')} />
        </Gutter>
      ) : null}

      <Gutter style={styles.rows}>
        {trending.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text tone="secondary" variant="body">
              {t('explore.noResults', { query: query.trim() })}
            </Text>
          </Card>
        ) : null}
        {trending.map((item) => (
          <Card
            accessibilityLabel={item.name}
            key={item.id}
            onPress={() => void openTrending(item)}
            style={styles.row}
          >
            <SwatchStrip colors={item.colors} height={44} radius={11} style={styles.rowStrip} />
            <View style={styles.rowCopy}>
              <Text variant="cardTitle">{item.name}</Text>
              <Text tone="tertiary" variant="monoSmall">
                {t('explore.saves', {
                  count: (item.saves / 1000).toFixed(1),
                  author: item.author,
                })}
              </Text>
            </View>
            <Chip
              label={t(saved[item.id] ? 'common.selected' : 'explore.save')}
              onPress={() => void saveTrending(item)}
              tone={saved[item.id] ? 'selected' : 'default'}
            />
          </Card>
        ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
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
