import { round, size, space, typeExtra, ui } from '@chromawave/design-tokens';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Text } from './Text';

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
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.field,
        { borderColor: focused ? ui.action.primary : ui.border.hairlineStrong },
      ]}
    >
      <Text tone="tertiary" variant="body">
        ⌕
      </Text>
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
        placeholderTextColor={ui.text.tertiary}
        returnKeyType="search"
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: size.field,
    borderRadius: round.full,
    backgroundColor: ui.fill.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    gap: 10,
  },
  input: {
    flex: 1,
    padding: 0,
    color: ui.text.primary,
    fontFamily: typeExtra.button.fontFamily,
    fontSize: 14,
  },
});
