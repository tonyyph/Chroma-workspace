import { filterMemories, type Memory, type PaletteMood } from '@chromawave/domain';
import { spacing } from '@chromawave/design-tokens';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { analytics } from '@/infrastructure/dependencies';
import { AppText } from '@/components/AppText';
import { EditorialSection } from '@/components/EditorialSection';
import { FilterChip } from '@/components/FilterChip';
import { MemoryCard } from '@/components/MemoryCard';
import { PageHeader } from '@/components/PageHeader';
import { Screen } from '@/components/Screen';
import { SearchField } from '@/components/SearchField';
import { StateView } from '@/components/StateView';
import { useMemoryLibrary } from '@/hooks/useMemoryLibrary';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function ArchiveScreen() {
  const { memories, status, reload, setFavorite } = useMemoryLibrary();
  const { colors, t } = usePreferences();
  const [query, setQuery] = useState('');
  const [mood, setMood] = useState<PaletteMood | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const moods = useMemo(
    () => Array.from(new Set(memories.map((memory) => memory.palette.mood))),
    [memories],
  );
  const filtered = useMemo(
    () => filterMemories(memories, { query, mood, favoritesOnly }),
    [favoritesOnly, memories, mood, query],
  );

  const trackFilter = (next: {
    mood?: PaletteMood | null;
    favoritesOnly?: boolean;
    query?: string;
  }) => {
    analytics.track('library_filter_changed', {
      mood: next.mood === undefined ? mood : next.mood,
      favoritesOnly: next.favoritesOnly === undefined ? favoritesOnly : next.favoritesOnly,
      hasQuery: (next.query === undefined ? query : next.query).trim().length > 0,
    });
  };

  const toggleFavorite = async (memory: Memory) => {
    const updated = await setFavorite(memory, !memory.isFavorite);
    if (updated) {
      analytics.track('memory_favorite_changed', {
        memoryId: updated.id,
        isFavorite: updated.isFavorite,
      });
    }
  };

  return (
    <Screen>
      <PageHeader
        body={t('archive.body')}
        eyebrow={t('archive.eyebrow')}
        title={t('archive.title')}
      />

      {status === 'loading' ? (
        <StateView body={t('today.loadingBody')} busy title={t('archive.loadingTitle')} />
      ) : null}
      {status === 'error' ? (
        <StateView
          actionLabel={t('common.tryAgain')}
          body={t('today.errorBody')}
          onAction={reload}
          title={t('archive.errorTitle')}
        />
      ) : null}
      {status === 'ready' && memories.length === 0 ? (
        <StateView
          actionLabel={t('archive.emptyAction')}
          body={t('archive.emptyBody')}
          onAction={() => router.push('/(tabs)/capture')}
          title={t('archive.emptyTitle')}
        />
      ) : null}

      {status === 'ready' && memories.length > 0 ? (
        <>
          <View style={styles.controls}>
            <SearchField
              onChangeText={setQuery}
              onSubmit={() => trackFilter({ query })}
              value={query}
            />
            <ScrollView
              contentContainerStyle={styles.chips}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <FilterChip
                label={t('archive.all')}
                onPress={() => {
                  setMood(null);
                  setFavoritesOnly(false);
                  trackFilter({ mood: null, favoritesOnly: false });
                }}
                selected={mood === null && !favoritesOnly}
              />
              <FilterChip
                label={t('common.collected')}
                onPress={() => {
                  const next = !favoritesOnly;
                  setFavoritesOnly(next);
                  trackFilter({ favoritesOnly: next });
                }}
                selected={favoritesOnly}
              />
              {moods.map((item) => (
                <FilterChip
                  key={item}
                  label={item}
                  onPress={() => {
                    const next = mood === item ? null : item;
                    setMood(next);
                    trackFilter({ mood: next });
                  }}
                  selected={mood === item}
                />
              ))}
            </ScrollView>
          </View>

          <EditorialSection
            action={
              <AppText tone="subtle" variant="caption">
                {t('archive.shown', { count: String(filtered.length).padStart(2, '0') })}
              </AppText>
            }
            index="INDEX"
            title={t('archive.memoryStudies')}
          />

          {filtered.length === 0 ? (
            <View style={styles.noResults}>
              <View style={[styles.noResultsMark, { borderColor: colors.accent }]} />
              <AppText variant="heading">{t('archive.noResults')}</AppText>
              <AppText tone="muted">{t('archive.noResultsBody')}</AppText>
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((memory, index) => (
                <MemoryCard
                  index={index}
                  key={memory.id}
                  memory={memory}
                  onPress={() =>
                    router.push({ pathname: '/memory/[id]', params: { id: memory.id } })
                  }
                  onToggleFavorite={() => void toggleFavorite(memory)}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  chips: {
    gap: spacing.xs,
    paddingRight: spacing.lg,
  },
  list: {
    gap: spacing.xxl,
    marginTop: spacing.lg,
  },
  noResults: {
    minHeight: 280,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  noResultsMark: {
    width: 36,
    height: 36,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '45deg' }],
  },
});
