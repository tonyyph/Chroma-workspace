import { size, space } from '@cw/tokens';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSkin } from '@/providers';
import { Icon } from './Icon';

/**
 * SYSTEM F search field: 46pt tall, fully rounded, `fill/chip` ground. The
 * focused state swaps the hairline for a violet border, which is the only
 * focus treatment in the system.
 */
export function Field({
  value,
  onChangeText,
  placeholder,
  label,
  onSubmit,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  label: string;
  onSubmit?: () => void;
}) {
  const skin = useSkin();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.field,
        {
          borderColor: focused ? skin.ui.action.primary : skin.ui.border.hairlineStrong,
          borderRadius: skin.round.full,
          backgroundColor: skin.ui.fill.chip,
        },
      ]}
    >
      <Icon color={skin.ui.text.tertiary} name="search" />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={skin.ui.text.tertiary}
        returnKeyType="search"
        style={[styles.input, { color: skin.ui.text.primary, ...skin.type.button }]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: size.field,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    gap: 10,
  },
  input: {
    flex: 1,
    padding: 0,
    fontSize: 14,
  },
});
