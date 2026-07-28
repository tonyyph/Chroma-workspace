import { radius, spacing, touchTarget, typography } from '@chromawave/design-tokens';
import { StyleSheet, TextInput, View } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';

export function SearchField({
  value,
  onChangeText,
  onSubmit,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
}) {
  const { colors, t } = usePreferences();
  return (
    <View
      style={[styles.frame, { borderColor: colors.border, backgroundColor: colors.surfaceSubtle }]}
    >
      <View style={[styles.mark, { borderColor: colors.accent }]} />
      <TextInput
        accessibilityLabel={t('archive.search')}
        allowFontScaling
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={100}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={t('archive.search')}
        placeholderTextColor={colors.textSubtle}
        returnKeyType="search"
        selectionColor={colors.accent}
        style={[styles.input, { color: colors.text }]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: touchTarget.comfortable,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  mark: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  input: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.sm,
  },
});
