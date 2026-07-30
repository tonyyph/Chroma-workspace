import { round, space, ui } from '@chromawave/design-tokens';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { trendingPalettes } from '@/data/seed';
import { usePreferences } from '@/providers/PreferencesProvider';
import { BandCanvas, Card, Chip, Field, Gutter, Screen, Text, SwatchStrip } from '@/ui';

const BANNER_HEIGHT = 186;
const CARD_WIDTH = 342;

/**
 * C2 · EXPLORE — editorial banner over the band field, then trending rows.
 *
 * The trending content is seeded fixture data: this build is local-first with
 * no server, so save counts and handles come from `@/data/seed` rather than a
 * feed. The layout is the design's.
 */
export function ExploreScreen() {
  const [query, setQuery] = useState('');
  const { t } = usePreferences();

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

      <Gutter style={styles.bannerWrap}>
        <View style={styles.banner}>
          <View style={StyleSheet.absoluteFill}>
            <BandCanvas
              background={ui.bg.media}
              blur={13}
              height={BANNER_HEIGHT}
              width={CARD_WIDTH}
            />
          </View>
          <View style={styles.bannerScrim} />
          <View style={styles.bannerCopy}>
            <Text tone="info" variant="eyebrow">
              {t('explore.editorial')}
            </Text>
            <Text variant="section">{t('explore.featured')}</Text>
          </View>
        </View>
      </Gutter>

      <Gutter style={styles.sectionHead}>
        <Text variant="rowTitle">{t('explore.trending')}</Text>
        <Text tone="tertiary" variant="chip">
          {t('explore.seeAll')}
        </Text>
      </Gutter>

      <Gutter style={styles.rows}>
        {trendingPalettes.map((item) => (
          <Card key={item.id} style={styles.row}>
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
            <Chip label={t('explore.save')} onPress={() => {}} />
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
  rowCopy: {
    flex: 1,
    gap: 3,
  },
});
