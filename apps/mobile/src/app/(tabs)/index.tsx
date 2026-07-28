import { deriveMemoryInsights } from '@chromawave/domain';
import { spacing } from '@chromawave/design-tokens';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { analytics } from '@/infrastructure/dependencies';
import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { ChromaticArtwork } from '@/components/ChromaticArtwork';
import { EditorialSection } from '@/components/EditorialSection';
import { LocalOnlyBanner } from '@/components/LocalOnlyBanner';
import { MemoryCard } from '@/components/MemoryCard';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { useMemoryLibrary } from '@/hooks/useMemoryLibrary';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function TodayScreen() {
  const { memories, status, reload, setFavorite } = useMemoryLibrary();
  const { colors, preferences, t } = usePreferences();
  const insights = useMemo(() => deriveMemoryInsights(memories), [memories]);
  const latest = memories[0];
  const date = new Intl.DateTimeFormat(preferences.language === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const toggleFavorite = async () => {
    if (!latest) return;
    const updated = await setFavorite(latest, !latest.isFavorite);
    if (updated) {
      analytics.track('memory_favorite_changed', {
        memoryId: updated.id,
        isFavorite: updated.isFavorite,
      });
    }
  };

  return (
    <Screen>
      <View style={styles.masthead}>
        <BrandMark size={42} />
        <View style={styles.mastheadCopy}>
          <AppText tone="accent" variant="caption">
            {t('today.edition')}
          </AppText>
          <AppText tone="subtle" variant="caption">
            {date.toLocaleUpperCase()}
          </AppText>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <AppText italic tone="muted" variant="heading">
          {t('today.kicker')}
        </AppText>
        <AppText variant="display">{t('today.title')}</AppText>
        <AppText tone="muted">{t('today.body')}</AppText>
      </View>

      {status === 'loading' ? (
        <StateView body={t('today.loadingBody')} busy title={t('today.loadingTitle')} />
      ) : null}
      {status === 'error' ? (
        <StateView
          actionLabel={t('common.tryAgain')}
          body={t('today.errorBody')}
          onAction={reload}
          title={t('today.errorTitle')}
        />
      ) : null}

      {status === 'ready' && memories.length === 0 ? (
        <>
          <ChromaticArtwork caption={t('today.firstCaption')} />
          <View style={styles.emptyCopy}>
            <LocalOnlyBanner />
            <Button label={t('today.firstAction')} onPress={() => router.push('/(tabs)/capture')} />
          </View>
        </>
      ) : null}

      {status === 'ready' && latest ? (
        <>
          <ChromaticArtwork
            caption={t('today.leadingCaption', {
              mood: insights.dominantMood ?? latest.palette.mood,
            })}
            colors={insights.recentColors}
          />

          <View
            accessibilityLabel={`${insights.total} Memories, ${insights.moodDiversity} moods, ${insights.favoriteCount} favorites`}
            style={[styles.insights, { borderColor: colors.border }]}
          >
            <Insight label={t('today.memories')} value={String(insights.total).padStart(2, '0')} />
            <Insight
              label={t('today.moods')}
              value={String(insights.moodDiversity).padStart(2, '0')}
            />
            <Insight
              label={t('common.collected')}
              value={String(insights.favoriteCount).padStart(2, '0')}
            />
          </View>

          <EditorialSection index="01" title={t('today.latest')} />
          <MemoryCard
            memory={latest}
            onPress={() => router.push({ pathname: '/memory/[id]', params: { id: latest.id } })}
            onToggleFavorite={() => void toggleFavorite()}
          />

          <EditorialSection index="02" title={t('today.continue')} />
          <View style={styles.continue}>
            <AppText tone="muted">{t('today.continueBody')}</AppText>
            <Button
              label={t('today.continueAction')}
              onPress={() => router.push('/(tabs)/capture')}
              variant="secondary"
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insight}>
      <AppText variant="title">{value}</AppText>
      <AppText tone="subtle" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  mastheadCopy: {
    flex: 1,
    gap: spacing.xxs,
    alignItems: 'flex-end',
  },
  heroCopy: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  emptyCopy: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  insights: {
    flexDirection: 'row',
    marginVertical: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  insight: {
    flex: 1,
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  continue: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
});
