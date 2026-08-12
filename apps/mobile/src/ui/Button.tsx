import { size, uiMotion, type Skin } from '@cw/tokens';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSkin } from '@/providers';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'contrast' | 'ghost' | 'destructive';

/**
 * SYSTEM F · BUTTONS · ALL STATES. Six appearances off one component; the
 * disabled look is a state of `primary` rather than a seventh variant, which is
 * how the sheet draws it.
 */
const looksOf = (
  skin: Skin,
): Record<ButtonVariant, { container: ViewStyle; pressed: ViewStyle; color: string }> => ({
  primary: {
    container: { backgroundColor: skin.ui.action.primary },
    pressed: { backgroundColor: skin.ui.action.primaryActive },
    color: skin.ui.action.onPrimary,
  },
  secondary: {
    container: { borderWidth: 1, borderColor: skin.ui.border.control },
    pressed: { backgroundColor: skin.ui.fill.chip },
    color: skin.ui.text.primary,
  },
  contrast: {
    container: { backgroundColor: skin.ui.action.contrast },
    pressed: { backgroundColor: skin.ui.action.contrastHover },
    color: skin.ui.action.onContrast,
  },
  ghost: {
    container: {},
    pressed: { opacity: uiMotion.listPress.opacity },
    color: skin.ui.action.link,
  },
  destructive: {
    container: {
      borderWidth: 1,
      borderColor: skin.tint.danger.borderColor,
      backgroundColor: skin.tint.danger.backgroundColor,
    },
    pressed: { backgroundColor: skin.tint.danger.borderColor },
    color: skin.ui.status.dangerText,
  },
});

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
  /** lg 56 · md 54 · sm 50 · xs 46 · xxs 32 — the four heights used across the screens. */
  size?: 'lg' | 'md' | 'sm' | 'xs' | 'xxs';
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const heights = {
    lg: size.buttonLg,
    md: size.buttonMd,
    sm: size.button,
    xs: size.buttonSm,
    xxs: size.buttonXXS,
  };
  const skin = useSkin();
  const box = heights[height];
  const look = looksOf(skin)[variant];

  /**
   * A pill in `chroma`, a rectangle in `swiss`.
   *
   * The radius used to be hardcoded as half the height, which is what made the
   * pill — and what made a button the one control a skin could not reshape.
   * `round.pill` is 27 in chroma and 0 in swiss, so the half-height rule only
   * applies where the skin asks for a pill at all.
   */
  const shape = { height: box, borderRadius: skin.round.pill > 0 ? box / 2 : skin.round.control };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress ?? null}
      style={({ pressed }) => [
        styles.base,
        shape,
        look.container,
        pressed && !disabled && look.pressed,
        disabled && { backgroundColor: skin.ui.action.primaryDisabled, borderWidth: 0 },
        style,
      ]}
    >
      <Text
        style={{
          color: disabled ? skin.ui.action.onPrimaryDisabled : look.color,
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
