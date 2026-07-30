import { size, ui, uiMotion } from '@chromawave/design-tokens';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'contrast' | 'ghost' | 'destructive';

/**
 * SYSTEM F · BUTTONS · ALL STATES. Six appearances off one component; the
 * disabled look is a state of `primary` rather than a seventh variant, which is
 * how the sheet draws it.
 */
const looks: Record<
  ButtonVariant,
  { container: ViewStyle; pressed: ViewStyle; color: string; weight: 'semibold' | 'medium' }
> = {
  primary: {
    container: { backgroundColor: ui.action.primary },
    pressed: { backgroundColor: ui.action.primaryActive },
    color: ui.action.onPrimary,
    weight: 'semibold',
  },
  secondary: {
    container: { borderWidth: 1, borderColor: ui.border.control },
    pressed: { backgroundColor: 'rgba(237,234,227,.07)' },
    color: ui.text.primary,
    weight: 'medium',
  },
  contrast: {
    container: { backgroundColor: ui.action.contrast },
    pressed: { backgroundColor: ui.action.contrastHover },
    color: ui.action.onContrast,
    weight: 'semibold',
  },
  ghost: {
    container: {},
    pressed: { opacity: uiMotion.listPress.opacity },
    color: ui.action.link,
    weight: 'medium',
  },
  destructive: {
    container: {
      borderWidth: 1,
      borderColor: 'rgba(255,107,90,.4)',
      backgroundColor: 'rgba(255,107,90,.1)',
    },
    pressed: { backgroundColor: 'rgba(255,107,90,.18)' },
    color: ui.status.dangerText,
    weight: 'medium',
  },
};

export function Button({
  label,
  variant = 'primary',
  size: height = 'md',
  disabled = false,
  onPress,
  style,
  accessibilityHint,
}: {
  label: string;
  variant?: ButtonVariant;
  /** lg 56 · md 54 · sm 50 · xs 46 — the four heights used across the screens. */
  size?: 'lg' | 'md' | 'sm' | 'xs';
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const heights = { lg: size.buttonLg, md: size.buttonMd, sm: size.button, xs: size.buttonSm };
  const box = heights[height];
  const look = looks[variant];

  // Radius is always half the height, which is what produces the pill in the sheet.
  const shape = { height: box, borderRadius: box / 2 };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        shape,
        look.container,
        pressed && !disabled && look.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={{
          color: disabled ? ui.action.onPrimaryDisabled : look.color,
        }}
        variant={height === 'lg' ? 'buttonLarge' : 'button'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of buttons that share the bar, with the emphasised one wider. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  disabled: {
    backgroundColor: ui.action.primaryDisabled,
    borderWidth: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
