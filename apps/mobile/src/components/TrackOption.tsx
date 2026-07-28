import type { TrackRecommendation } from '@chromawave/domain';
import { radius, spacing, touchTarget } from '@chromawave/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { usePreferences } from '@/providers/PreferencesProvider';

export function TrackOption({
  recommendation,
  selected,
  onPress,
}: {
  recommendation: TrackRecommendation;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, t } = usePreferences();
  return (
    <Pressable
      accessibilityLabel={`${recommendation.track.title} by ${recommendation.track.artist}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        selected && { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.indicator, { borderColor: selected ? colors.accent : colors.textSubtle }]}
      >
        {selected ? (
          <View style={[styles.indicatorCore, { backgroundColor: colors.accent }]} />
        ) : null}
      </View>
      <View style={styles.copy}>
        <AppText variant="label">{recommendation.track.title}</AppText>
        <AppText tone="muted" variant="caption">
          {recommendation.track.artist} · {t('common.mockSession')}
        </AppText>
        <AppText tone="subtle" variant="caption">
          {recommendation.explanation}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: touchTarget.comfortable,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.8,
  },
  indicator: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorCore: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  copy: {
    flex: 1,
    gap: spacing.xxs,
  },
});
