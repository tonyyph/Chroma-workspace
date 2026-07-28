import { opacity, radius, spacing, touchTarget } from '@chromawave/design-tokens';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './AppText';
import { usePreferences } from '@/providers/PreferencesProvider';

export function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = usePreferences();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.surfaceRaised : colors.canvasElevated,
        },
        pressed && styles.pressed,
      ]}
    >
      <AppText tone={selected ? 'default' : 'muted'} variant="caption">
        {label.toLocaleUpperCase()}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.minimum,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
