import type { Memory } from '@chromawave/domain';
import { opacity, radius, spacing, touchTarget } from '@chromawave/design-tokens';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EditorialSection } from '@/components/EditorialSection';
import { FavoriteButton } from '@/components/FavoriteButton';
import { LocalOnlyBanner } from '@/components/LocalOnlyBanner';
import { PaletteStrip } from '@/components/PaletteStrip';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { analytics, memoryRepository } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function MemoryDetailScreen() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const [memory, setMemory] = useState<Memory | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const { colors, preferences, t } = usePreferences();

  useEffect(() => {
    let active = true;
    if (!id) {
      setStatus('missing');
      return;
    }
    memoryRepository
      .getById(id)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setStatus('missing');
          return;
        }
        setMemory(result);
        setStatus('ready');
        analytics.track('memory_detail_opened', { memoryId: result.id });
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [id]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/archive');
  };

  const toggleFavorite = async () => {
    if (!memory || favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      const updated = await memoryRepository.setFavorite(memory.id, !memory.isFavorite);
      if (!updated) return;
      setMemory(updated);
      analytics.track('memory_favorite_changed', {
        memoryId: updated.id,
        isFavorite: updated.isFavorite,
      });
    } finally {
      setFavoriteBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <StateView body={t('detail.openingBody')} busy title={t('detail.opening')} />
      </Screen>
    );
  }

  if (status !== 'ready' || !memory) {
    return (
      <Screen scroll={false}>
        <StateView
          actionLabel={t('detail.return')}
          body={status === 'missing' ? t('detail.notFoundBody') : t('detail.unavailableBody')}
          onAction={() => router.replace('/(tabs)/archive')}
          title={status === 'missing' ? t('detail.notFound') : t('detail.unavailable')}
        />
      </Screen>
    );
  }

  const date = new Intl.DateTimeFormat(preferences.language === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(memory.capturedAt));
  const title = memory.note || t('common.memoryFallback');
  const metrics = [
    ['LIGHT', memory.palette.metrics.brightness / 100],
    ['CHROMA', memory.palette.metrics.saturation],
    ['WARMTH', (memory.palette.metrics.temperature + 1) / 2],
    ['CONTRAST', memory.palette.metrics.contrast / 100],
  ] as const;

  return (
    <Screen>
      <View style={styles.navigation}>
        <Pressable
          accessibilityLabel={t('common.back')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={goBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <View style={[styles.backRule, { backgroundColor: colors.accent }]} />
          <AppText variant="caption">{t('detail.back')}</AppText>
        </Pressable>
        <FavoriteButton active={memory.isFavorite} onPress={() => void toggleFavorite()} />
      </View>

      {saved === '1' ? (
        <View
          accessibilityLiveRegion="polite"
          style={[styles.saved, { borderColor: colors.border }]}
        >
          <View style={[styles.savedMark, { backgroundColor: colors.success }]} />
          <AppText variant="label">{t('detail.saved')}</AppText>
        </View>
      ) : null}

      <View style={[styles.imageFrame, { backgroundColor: colors.surface }]}>
        <Image
          accessibilityLabel={`Photo from ${date}`}
          contentFit="cover"
          source={{ uri: memory.asset.localUri }}
          style={styles.image}
          transition={260}
        />
        <View style={[styles.imageIndex, { backgroundColor: colors.scrim }]}>
          <AppText variant="caption">{t('detail.imageLabel')}</AppText>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <AppText tone="accent" variant="caption">
          {t('detail.privateStudy', { mood: memory.palette.mood.toLocaleUpperCase() })}
        </AppText>
        <AppText italic={memory.note === null} variant="display">
          {title}
        </AppText>
        <AppText tone="muted">{date}</AppText>
      </View>

      <EditorialSection index="01" title={t('detail.spectrum')} />
      <PaletteStrip height={88} palette={memory.palette} />
      <View style={styles.metrics}>
        {metrics.map(([label, value]) => (
          <Metric key={label} label={label} value={value} />
        ))}
      </View>

      <EditorialSection index="02" title={t('detail.resonance')} />
      <View style={[styles.sound, { borderColor: colors.border }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.disc,
            {
              borderColor: memory.palette.colors[0]?.hex ?? colors.accent,
              backgroundColor: colors.surfaceSubtle,
            },
          ]}
        >
          <View style={[styles.discCore, { backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.soundCopy}>
          <AppText tone="subtle" variant="caption">
            {t('detail.curated')}
          </AppText>
          <AppText variant="heading">
            {memory.musicPairing?.track.title ?? t('detail.noTrack')}
          </AppText>
          <AppText tone="muted">{memory.musicPairing?.track.artist ?? '—'}</AppText>
          {memory.musicPairing ? (
            <AppText tone="subtle" variant="caption">
              {memory.musicPairing.explanation}
            </AppText>
          ) : null}
        </View>
      </View>

      <EditorialSection index="03" title={t('detail.custody')} />
      <LocalOnlyBanner />
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const { colors } = usePreferences();
  const width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` as `${number}%`;

  return (
    <View
      accessibilityLabel={`${label.toLocaleLowerCase()} ${Math.round(value * 100)} percent`}
      style={styles.metric}
    >
      <View style={styles.metricLabel}>
        <AppText tone="muted" variant="caption">
          {label}
        </AppText>
        <AppText variant="caption">{Math.round(value * 100)}</AppText>
      </View>
      <View style={[styles.metricTrack, { backgroundColor: colors.surfaceRaised }]}>
        <View style={[styles.metricFill, { width, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    minHeight: touchTarget.comfortable,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  back: {
    minHeight: touchTarget.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backRule: {
    width: 28,
    height: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  savedMark: {
    width: 9,
    height: 9,
    transform: [{ rotate: '45deg' }],
  },
  imageFrame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 0.82,
    maxHeight: 650,
  },
  imageIndex: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  titleBlock: {
    gap: spacing.sm,
    marginVertical: spacing.xxl,
  },
  metrics: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
    gap: spacing.md,
  },
  metric: {
    gap: spacing.xs,
  },
  metricLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricTrack: {
    height: 3,
  },
  metricFill: {
    height: 3,
  },
  sound: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginVertical: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disc: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 18,
  },
  discCore: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
  },
  soundCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
