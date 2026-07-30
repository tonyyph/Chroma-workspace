import { size, ui } from '@chromawave/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';

/**
 * SYSTEM F toggle: 46×28 track, 22px knob inset 3. Deliberately not the
 * platform Switch — the design specifies exact geometry and the iOS control is
 * 51×31 with its own knob shadow.
 */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  label,
}: {
  value: boolean;
  onValueChange?: ((value: boolean) => void) | undefined;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled || !onValueChange}
      hitSlop={12}
      onPress={() => onValueChange?.(!value)}
      style={[
        styles.track,
        { backgroundColor: value ? ui.action.primary : ui.fill.toggleOff },
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.knob,
          value ? styles.knobOn : styles.knobOff,
          { backgroundColor: value ? '#FFFFFF' : ui.text.primary },
        ]}
      />
    </Pressable>
  );
}

const inset = 3;

const styles = StyleSheet.create({
  track: {
    width: size.toggleWidth,
    height: size.toggleHeight,
    borderRadius: size.toggleHeight / 2,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    width: size.toggleKnob,
    height: size.toggleKnob,
    borderRadius: size.toggleKnob / 2,
  },
  knobOn: {
    right: inset,
  },
  knobOff: {
    left: inset,
  },
  disabled: {
    opacity: 0.5,
  },
});
