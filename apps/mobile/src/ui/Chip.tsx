import { round, tint, ui, uiMotion } from '@chromawave/design-tokens';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

export type ChipTone = 'default' | 'selected' | 'pro' | 'add' | 'info' | 'danger';

/** SYSTEM F · CHIPS. Four base tones plus the two verdict pills used in G3/G4. */
const tones: Record<ChipTone, { container: ViewStyle; color: string }> = {
  default: {
    container: {
      backgroundColor: ui.fill.chip,
      borderWidth: 1,
      borderColor: ui.border.hairlineStrong,
    },
    color: 'rgba(237,234,227,.7)',
  },
  selected: {
    container: { backgroundColor: ui.action.contrast },
    color: ui.action.onContrast,
  },
  pro: {
    container: {
      backgroundColor: tint.pro.backgroundColor,
      borderWidth: 1,
      borderColor: tint.pro.borderColor,
    },
    color: tint.pro.color,
  },
  add: {
    container: {
      backgroundColor: ui.fill.chipGhost,
      borderWidth: 1,
      borderColor: ui.border.dashed,
      borderStyle: 'dashed',
    },
    color: ui.text.tertiary,
  },
  info: {
    container: {
      backgroundColor: tint.info.backgroundColor,
      borderWidth: 1,
      borderColor: tint.info.borderColor,
    },
    color: tint.info.color,
  },
  danger: {
    container: {
      backgroundColor: 'rgba(255,107,90,.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,107,90,.42)',
    },
    color: ui.status.dangerText,
  },
};

export function Chip({
  label,
  tone = 'default',
  onPress,
  /** Drawn before the label at the chip's mono size. */
  icon,
  /** Stretch to share a row equally — the "MERGE ALL / EXPORT SET / INVITE" pattern. */
  fill = false,
  style,
}: {
  label: string;
  tone?: ChipTone;
  onPress?: () => void;
  icon?: IconName;
  fill?: boolean;
  style?: ViewStyle;
}) {
  const look = tones[tone];
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
  const box = [styles.chip, look.container, fill && styles.fill, style];

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
    borderRadius: round.chip,
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
