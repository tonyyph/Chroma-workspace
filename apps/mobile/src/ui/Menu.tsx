import { space, uiMotion } from '@chromawave/design-tokens';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSkin } from '@/providers';
import { Button } from './Button';
import { Pressable } from './Pressable';
import { SheetGrabber } from './Sheet';
import { Text } from './Text';

export type MenuAction = {
  label: string;
  onPress: () => void;
  /** Destructive actions are drawn in the danger tone, per SYSTEM F. */
  destructive?: boolean;
};

/**
 * Shared modal shell for every in-app sheet. It keeps presentation, safe-area,
 * backdrop and keyboard behaviour consistent instead of recreating a slightly
 * different platform-looking modal at every call site.
 */
export function ModalSheet({
  visible,
  title,
  dismissLabel,
  onDismiss,
  children,
  keyboardAware = false,
}: {
  visible: boolean;
  title: string;
  dismissLabel: string;
  onDismiss: () => void;
  children: React.ReactNode;
  keyboardAware?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const skin = useSkin();
  const dismiss = () => {
    Keyboard.dismiss();
    onDismiss();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={keyboardAware ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined}
        style={styles.modalRoot}
      >
        <Pressable
          accessibilityLabel={dismissLabel}
          onPress={dismiss}
          style={[StyleSheet.absoluteFill, { backgroundColor: skin.ui.scrim.strong }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, space.md),
              backgroundColor: skin.ui.bg.media,
              borderTopLeftRadius: skin.round.sheet,
              borderTopRightRadius: skin.round.sheet,
              borderTopColor: skin.ui.border.control,
              ...skin.shadow.sheet,
            },
          ]}
        >
          <SheetGrabber />
          <View style={styles.heading}>
            <View style={styles.headingRule} />
            <Text accessibilityRole="header" style={styles.title} variant="section">
              {title}
            </Text>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The overflow menu behind a more-options control. */
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
  const skin = useSkin();
  return (
    <ModalSheet dismissLabel={cancelLabel} onDismiss={onDismiss} title={title} visible={visible}>
      <View style={styles.actionGroup}>
        {actions.map((action, index) => (
          <Pressable
            accessibilityLabel={action.label}
            accessibilityRole="button"
            key={action.label}
            onPress={() => {
              onDismiss();
              action.onPress();
            }}
            style={({ pressed }) => [
              styles.row,
              index < actions.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: skin.ui.border.hairline,
              },
              pressed && { opacity: uiMotion.listPress.opacity },
            ]}
          >
            <Text tone={action.destructive ? 'danger' : 'primary'} variant="rowTitle">
              {action.label}
            </Text>
            <View
              accessibilityElementsHidden
              style={[
                styles.actionMark,
                {
                  borderRadius: skin.round.full,
                  backgroundColor: action.destructive
                    ? skin.ui.status.danger
                    : skin.ui.action.primary,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <Button label={cancelLabel} onPress={onDismiss} size="xs" variant="secondary" />
    </ModalSheet>
  );
}

/** A keyboard-safe one-field prompt for rename and tag actions. */
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
  const skin = useSkin();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const submit = () => {
    if (!trimmed) return;
    Keyboard.dismiss();
    onConfirm(trimmed);
    onDismiss();
  };

  return (
    <ModalSheet
      dismissLabel={cancelLabel}
      keyboardAware
      onDismiss={onDismiss}
      title={title}
      visible={visible}
    >
      <ScrollView
        contentContainerStyle={styles.promptContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          accessibilityLabel={title}
          autoCapitalize="sentences"
          autoFocus
          onChangeText={setValue}
          onSubmitEditing={submit}
          placeholder={placeholder}
          placeholderTextColor={skin.ui.text.tertiary}
          returnKeyType="done"
          selectTextOnFocus
          style={[
            styles.input,
            {
              borderRadius: skin.round.control,
              backgroundColor: skin.ui.fill.chip,
              borderColor: skin.ui.border.control,
              color: skin.ui.text.primary,
              fontFamily: skin.type.button.fontFamily,
              fontSize: skin.type.button.fontSize,
            },
          ]}
          value={value}
        />
        <View style={styles.promptActions}>
          <Button
            label={cancelLabel}
            onPress={onDismiss}
            size="xs"
            style={styles.promptButton}
            variant="secondary"
          />
          <Button
            disabled={trimmed.length === 0}
            label={confirmLabel}
            onPress={submit}
            size="xs"
            style={styles.promptButton}
          />
        </View>
      </ScrollView>
    </ModalSheet>
  );
}

/** Branded destructive confirmation, replacing platform `Alert.alert`. */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <ModalSheet dismissLabel={cancelLabel} onDismiss={onDismiss} title={title} visible={visible}>
      <Text tone="secondary" variant="body">
        {body}
      </Text>
      <View style={styles.promptActions}>
        <Button
          label={cancelLabel}
          onPress={onDismiss}
          size="xs"
          style={styles.promptButton}
          variant="secondary"
        />
        <Button
          label={confirmLabel}
          onPress={() => {
            onDismiss();
            onConfirm();
          }}
          size="xs"
          style={styles.promptButton}
          variant="destructive"
        />
      </View>
    </ModalSheet>
  );
}

/** Branded informational acknowledgement, replacing one-button alerts. */
export function NoticeSheet({
  visible,
  title,
  body,
  confirmLabel,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onDismiss: () => void;
}) {
  return (
    <ModalSheet dismissLabel={confirmLabel} onDismiss={onDismiss} title={title} visible={visible}>
      <Text tone="secondary" variant="body">
        {body}
      </Text>
      <Button label={confirmLabel} onPress={onDismiss} size="xs" />
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    paddingTop: space.sm,
    paddingHorizontal: space.sectionGap,
    gap: space.md,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headingRule: {
    width: 5,
    height: 28,
  },
  title: { flex: 1 },
  actionGroup: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  row: {
    minHeight: 54,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  actionMark: {
    width: 6,
    height: 6,
  },
  promptContent: { gap: space.md },
  input: {
    minHeight: 52,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  promptActions: { flexDirection: 'row', gap: space.xs },
  promptButton: { flex: 1 },
});
