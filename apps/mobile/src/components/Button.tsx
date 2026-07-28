import { opacity, radius, spacing, touchTarget, typography } from '@chromawave/design-tokens';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type AccessibilityRole,
} from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';

type ButtonProps = {
  label: string;
  onPress: () => void;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  disabled?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({
  label,
  onPress,
  accessibilityHint,
  accessibilityRole = 'button',
  disabled = false,
  loading = false,
  leading,
  variant = 'primary',
}: ButtonProps) {
  const { colors } = usePreferences();
  const darkText = variant === 'primary' || variant === 'danger';
  const variantStyle = {
    primary: { backgroundColor: colors.accent },
    secondary: {
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.danger },
  }[variant];

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ busy: loading, disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={darkText ? colors.accentInk : colors.text} />
      ) : (
        <>
          {leading}
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.7}
            style={[styles.label, { color: darkText ? colors.accentInk : colors.text }]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget.comfortable,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    fontSize: 15,
    letterSpacing: 0.45,
  },
  pressed: {
    opacity: opacity.pressed,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: opacity.disabled,
  },
});
