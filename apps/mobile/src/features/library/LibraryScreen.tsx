import { size, space, ui } from '@chromawave/design-tokens';
import { filterPalettes, libraryFilters, type LibraryFilter } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalettes } from '@/hooks/usePalettes';
import { useSets } from '@/hooks/useSets';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  Button,
  BandRefreshControl,
  CardSkeleton,
  Chip,
  EmptyGlyph,
  Gutter,
  Icon,
  Pressable,
  Screen,
  ScreenHeader,
  Shimmer,
  Text,
} from '@/ui';
import { reportBackdropScroll } from '@/ui/backdropMotion';

import { PaletteCard } from './PaletteCard';

/** C1 · LIBRARY — two-column grid of palette cards under a filter rail. */
export function LibraryScreen() {
  const router = useRouter();
  const { palettes, loading, refreshing, refresh } = usePalettes();
  const { t } = usePreferences();
  const [filter, setFilter] = useState<LibraryFilter>('all');

  const visible = useMemo(() => filterPalettes(palettes, filter), [palettes, filter]);
  const { sets } = useSets();
  const insets = useSafeAreaInsets();

  // The grid is the app's busiest scroll, so it is the one the backdrop most
  // needs to move against.
  const onScroll = useAnimatedScrollHandler((event) => {
    reportBackdropScroll(event.contentOffset.y);
  });

  const header = (
    <>
      <Gutter style={styles.header}>
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

      <ScrollView
        contentContainerStyle={styles.filters}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {libraryFilters.map((key) => (
          <Chip
            key={key}
            label={t(`library.filter.${key}`)}
            onPress={() => {
              setFilter(key);
              analytics.track('library_filter_changed', { filter: key });
            }}
            tone={filter === key ? 'selected' : 'default'}
          />
        ))}
      </ScrollView>
    </>
  );

  const renderCard = useCallback(
    ({ item }: { item: (typeof visible)[number] }) => (
      <View style={styles.column}>
        <PaletteCard onPress={() => router.push(`/palette/${item.id}`)} palette={item} />
      </View>
    ),
    [router],
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
              <EmptyLibrary onCapture={() => router.push('/capture')} filtered={filter !== 'all'} />
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

/** FLOW E · "Nothing captured yet" — the mark with its wave missing. */
function EmptyLibrary({ onCapture, filtered }: { onCapture: () => void; filtered: boolean }) {
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
      {filtered ? null : <Button label={t('library.empty.action')} onPress={onCapture} size="xs" />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {},
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
  filters: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    gap: space.xs,
  },
  list: {
    paddingTop: space.md,
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
