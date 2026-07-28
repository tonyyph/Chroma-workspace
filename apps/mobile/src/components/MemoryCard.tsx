import type { Memory } from '@chromawave/domain';
import { opacity, radius, spacing } from '@chromawave/design-tokens';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { FavoriteButton } from './FavoriteButton';
import { PaletteStrip } from './PaletteStrip';
import { usePreferences } from '@/providers/PreferencesProvider';

export function MemoryCard({
  memory,
  onPress,
  onToggleFavorite,
  index,
}: {
  memory: Memory;
  onPress: () => void;
  onToggleFavorite?: () => void;
  index?: number;
}) {
  const { colors, preferences, t } = usePreferences();
  const date = new Intl.DateTimeFormat(preferences.language === 'vi' ? 'vi-VN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(memory.capturedAt));

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityHint={t('common.openMemoryHint')}
        accessibilityLabel={t('common.memoryFrom', { mood: memory.palette.mood, date })}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.imageFrame,
          { backgroundColor: colors.surface },
          pressed && styles.pressed,
        ]}
      >
        <Image
          accessibilityLabel={t('common.photoForMemory', { mood: memory.palette.mood })}
          contentFit="cover"
          source={{ uri: memory.asset.localUri }}
          style={[styles.image, { backgroundColor: colors.surfaceRaised }]}
          transition={220}
        />
        {index !== undefined ? (
          <View style={[styles.index, { backgroundColor: colors.scrim }]}>
            <AppText variant="caption">{String(index + 1).padStart(2, '0')}</AppText>
          </View>
        ) : null}
      </Pressable>
      <View style={styles.content}>
        <View style={styles.metaRow}>
          <View style={styles.metaCopy}>
            <AppText tone="accent" variant="caption">
              {memory.palette.mood.toLocaleUpperCase()} · {date.toLocaleUpperCase()}
            </AppText>
            <AppText numberOfLines={2} variant="heading">
              {memory.note || t('common.memoryFallback')}
            </AppText>
          </View>
          {onToggleFavorite ? (
            <FavoriteButton active={memory.isFavorite} onPress={onToggleFavorite} />
          ) : null}
        </View>
        <PaletteStrip animated={false} height={12} palette={memory.palette} />
        {memory.musicPairing ? (
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {t('common.sound')} · {memory.musicPairing.track.title} —{' '}
            {memory.musicPairing.track.artist}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  imageFrame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1.02,
  },
  index: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  content: {
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  metaCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  pressed: {
    opacity: opacity.pressed,
    transform: [{ scale: 0.994 }],
  },
});
