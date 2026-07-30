import { space, ui } from '@chromawave/design-tokens';
import { filterPalettes, libraryFilters, type LibraryFilter } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { usePalettes } from '@/hooks/usePalettes';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  Button,
  CardSkeleton,
  Chip,
  EmptyGlyph,
  Gutter,
  Screen,
  ScreenHeader,
  Shimmer,
  Text,
} from '@/ui';

import { PaletteCard } from './PaletteCard';

/** C1 · LIBRARY — two-column grid of palette cards under a filter rail. */
export function LibraryScreen() {
  const router = useRouter();
  const { palettes, loading } = usePalettes();
  const { t } = usePreferences();
  const [filter, setFilter] = useState<LibraryFilter>('all');

  const visible = useMemo(() => filterPalettes(palettes, filter), [palettes, filter]);
  const collectionCount = 0;

  return (
    <Screen tabBarInset>
      <Gutter style={styles.header}>
        <ScreenHeader
          meta={t('library.meta', { palettes: palettes.length, collections: collectionCount })}
          title={t('library.title')}
          trailing={
            <Pressable
              accessibilityLabel={t('library.search')}
              accessibilityRole="button"
              onPress={() => router.push('/explore')}
              style={styles.searchButton}
            >
              <Text tone="primary" variant="mono">
                ⌕
              </Text>
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

      <Gutter>
        {loading ? (
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
        ) : visible.length === 0 ? (
          <EmptyLibrary onCapture={() => router.push('/capture')} filtered={filter !== 'all'} />
        ) : (
          <View style={styles.grid}>
            {visible.map((palette) => (
              <View key={palette.id} style={styles.column}>
                <PaletteCard
                  onPress={() => router.push(`/palette/${palette.id}`)}
                  palette={palette}
                />
              </View>
            ))}
          </View>
        )}
      </Gutter>
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
  header: {
    paddingTop: space.cardGap,
  },
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
    paddingTop: space.md,
    gap: space.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: space.md,
    // The 14pt card gap from SYSTEM F, applied as a negative-margin gutter so
    // the two columns still reach the screen edges.
    marginHorizontal: -space.cardGap / 2,
  },
  column: {
    width: '50%',
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
