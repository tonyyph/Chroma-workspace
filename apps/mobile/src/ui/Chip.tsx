import { uiMotion, type Skin } from '@chromawave/design-tokens';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSkin } from '@/providers';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ChipTone = 'default' | 'selected' | 'pro' | 'add' | 'info' | 'danger';

/** SYSTEM F · CHIPS. Four base tones plus the two verdict pills used in G3/G4. */
const tonesOf = (skin: Skin): Record<ChipTone, { container: ViewStyle; color: string }> => ({
  default: {
    container: {
      backgroundColor: skin.ui.fill.chip,
      borderWidth: 1,
      borderColor: skin.ui.border.hairlineStrong,
    },
    color: skin.ui.text.secondary,
  },
  selected: {
    container: { backgroundColor: skin.ui.action.contrast },
    color: skin.ui.action.onContrast,
  },
  pro: {
    container: {
      backgroundColor: skin.tint.pro.backgroundColor,
      borderWidth: 1,
      borderColor: skin.tint.pro.borderColor,
    },
    color: skin.tint.pro.color,
  },
  add: {
    container: {
      backgroundColor: skin.ui.fill.chipGhost,
      borderWidth: 1,
      borderColor: skin.ui.border.dashed,
      borderStyle: 'dashed',
    },
    color: skin.ui.text.tertiary,
  },
  info: {
    container: {
      backgroundColor: skin.tint.info.backgroundColor,
      borderWidth: 1,
      borderColor: skin.tint.info.borderColor,
    },
    color: skin.tint.info.color,
  },
  danger: {
    container: {
      backgroundColor: skin.tint.danger.backgroundColor,
      borderWidth: 1,
      borderColor: skin.tint.danger.borderColor,
    },
    color: skin.ui.status.dangerText,
  },
});

export function Chip({
  label,
  tone = 'default',
  onPress,
  /** Drawn before the label at the chip's mono size. */
  icon,
  /** Stretch to share a row equally — the "EXPORT SET / INVITE" pattern. */
  fill = false,
  /**
   * A recipe to use instead of the tone's own.
   *
   * The tones are fixed meanings — pro is violet, danger is coral — and none of
   * them can describe a colour the user has not photographed yet. A screen
   * tinting a chip from its own subject supplies the recipe rather than the app
   * growing a tone per palette. See `accentTint`.
   */
  accent,
  style,
}: {
  label: string;
  tone?: ChipTone;
  onPress?: () => void;
  icon?: IconName;
  fill?: boolean;
  accent?: { backgroundColor: string; borderColor: string; color: string } | undefined;
  style?: ViewStyle;
}) {
  const skin = useSkin();
  const base = tonesOf(skin)[tone];
  const look = accent
    ? {
        container: {
          backgroundColor: accent.backgroundColor,
          borderWidth: 1,
          borderColor: accent.borderColor,
        },
        color: accent.color,
      }
    : base;
  const content = icon ? (
    <View style={styles.withIcon}>
      <Icon color={look.color} name={icon} scale="inline" />
      <Text style={{ color: look.color }} variant="chip">
        {label}
      </Text>
    </View>
  ) : (
    <Text style={{ color: look.color }} variant="chip">
      {label}
    </Text>
  );
  const box = [
    styles.chip,
    { borderRadius: skin.round.chip },
    look.container,
    fill && styles.fill,
    style,
  ];

  if (!onPress) {
    return (
      <View accessibilityRole="text" style={box}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: tone === 'selected' }}
      onPress={onPress}
      style={({ pressed }) => [...box, pressed && { opacity: uiMotion.listPress.opacity }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: 13,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  withIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
});
