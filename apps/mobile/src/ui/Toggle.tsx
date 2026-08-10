import { size } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';
import { useSkin } from '@/providers';
import { Pressable } from './Pressable';

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
  const skin = useSkin();
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
        { backgroundColor: value ? skin.ui.action.primary : skin.ui.fill.toggleOff },
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.knob,
          value ? styles.knobOn : styles.knobOff,
          { backgroundColor: value ? skin.ui.action.onPrimary : skin.ui.text.primary },
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
