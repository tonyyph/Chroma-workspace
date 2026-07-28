import { opacity, radius, spacing, touchTarget } from '@chromawave/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { usePreferences } from '@/providers/PreferencesProvider';

export function FavoriteButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  const { colors, t } = usePreferences();
  return (
    <Pressable
      accessibilityLabel={active ? 'Remove from favorites' : 'Add to favorites'}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.diamond,
          { borderColor: active ? colors.accent : colors.textMuted },
          active && { backgroundColor: colors.accent },
        ]}
      />
      <AppText tone={active ? 'accent' : 'muted'} variant="caption">
        {t(active ? 'common.collected' : 'common.collect')}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTarget.minimum,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  diamond: {
    width: 10,
    height: 10,
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
