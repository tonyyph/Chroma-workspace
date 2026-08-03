import { round, space, typeExtra, ui, uiMotion } from '@chromawave/design-tokens';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';

export type MenuAction = {
  label: string;
  onPress: () => void;
  /** Destructive actions are drawn in the danger tone, per SYSTEM F. */
  destructive?: boolean;
};

/**
 * The overflow menu behind a "•••" control.
 *
 * Deliberately not `ActionSheetIOS`: the design's sheet radius, ground and type
 * are all specified, and the platform sheet honours none of them. The dismiss
 * affordances are the backdrop, the cancel row and the hardware back button, so
 * a menu can always be left without choosing something.
 */
export function ActionSheet({
  visible,
  title,
  actions,
  cancelLabel,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  actions: readonly MenuAction[];
  cancelLabel: string;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <Pressable accessibilityLabel={cancelLabel} onPress={onDismiss} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Text style={styles.title} tone="tertiary" variant="eyebrow">
          {title}
        </Text>
        {actions.map((action) => (
          <Pressable
            accessibilityLabel={action.label}
            accessibilityRole="button"
            key={action.label}
            onPress={() => {
              // Dismissing first keeps the menu from lingering over whatever the
              // action navigates to.
              onDismiss();
              action.onPress();
            }}
            style={({ pressed }) => [
              styles.row,
              pressed && { opacity: uiMotion.listPress.opacity },
            ]}
          >
            <Text tone={action.destructive ? 'danger' : 'primary'}>{action.label}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityLabel={cancelLabel}
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.row,
            styles.cancel,
            pressed && { opacity: uiMotion.listPress.opacity },
          ]}
        >
          <Text tone="secondary">{cancelLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/**
 * A one-field prompt — rename a palette, name a tag.
 *
 * `Alert.prompt` would be fewer lines but exists only on iOS, and a rename that
 * silently does nothing on Android is exactly the class of bug this screen set
 * is meant to be rid of.
 */
export function PromptSheet({
  visible,
  title,
  placeholder,
  initialValue = '',
  confirmLabel,
  cancelLabel,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  initialValue?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: (value: string) => void;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialValue);

  // Reopening the same prompt should start from the current value rather than
  // whatever was typed and abandoned last time.
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const submit = () => {
    if (!trimmed) return;
    onConfirm(trimmed);
    onDismiss();
  };

  return (
    <Modal animationType="fade" onRequestClose={onDismiss} transparent visible={visible}>
      <Pressable accessibilityLabel={cancelLabel} onPress={onDismiss} style={styles.backdrop} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <Text style={styles.title} tone="tertiary" variant="eyebrow">
          {title}
        </Text>
        <TextInput
          accessibilityLabel={title}
          autoFocus
          onChangeText={setValue}
          onSubmitEditing={submit}
          placeholder={placeholder}
          placeholderTextColor={ui.text.tertiary}
          returnKeyType="done"
          style={styles.input}
          value={value}
        />
        <View style={styles.promptActions}>
          <Pressable
            accessibilityLabel={cancelLabel}
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.promptButton,
              pressed && { opacity: uiMotion.listPress.opacity },
            ]}
          >
            <Text tone="secondary">{cancelLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={confirmLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: trimmed.length === 0 }}
            disabled={trimmed.length === 0}
            onPress={submit}
            style={({ pressed }) => [
              styles.promptButton,
              styles.promptConfirm,
              trimmed.length === 0 && styles.promptDisabled,
              pressed && { opacity: uiMotion.listPress.opacity },
            ]}
          >
            <Text style={styles.promptConfirmLabel}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: ui.scrim.strong },
  sheet: {
    marginTop: 'auto',
    backgroundColor: ui.bg.sheet,
    borderTopLeftRadius: round.sheet,
    borderTopRightRadius: round.sheet,
    borderTopWidth: 1,
    borderTopColor: ui.border.hairlineStrong,
    paddingTop: space.md,
    paddingHorizontal: space.sectionGap,
  },
  title: { paddingBottom: space.xs },
  row: {
    minHeight: 52,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: ui.border.hairline,
  },
  cancel: { marginTop: space.xs },
  input: {
    height: 46,
    borderRadius: round.control,
    backgroundColor: ui.fill.chip,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    paddingHorizontal: space.sm,
    color: ui.text.primary,
    fontFamily: typeExtra.button.fontFamily,
    fontSize: 14,
  },
  promptActions: { flexDirection: 'row', gap: space.xs, paddingTop: space.md },
  promptButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: round.control,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptConfirm: { backgroundColor: ui.action.primary, borderColor: ui.action.primary },
  promptDisabled: { opacity: 0.4 },
  promptConfirmLabel: { color: '#FFFFFF', fontWeight: '600' },
});
