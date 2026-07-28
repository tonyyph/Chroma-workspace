import { spacing } from '@chromawave/design-tokens';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePreferences } from '@/providers/PreferencesProvider';

type ScreenProps = PropsWithChildren<{
  footer?: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
}>;

export function Screen({ children, footer, scroll = true, contentContainerStyle }: ScreenProps) {
  const { colors } = usePreferences();
  const { width } = useWindowDimensions();
  const horizontalInset = width >= 768 ? spacing.xxxl : spacing.lg;
  const maxWidth = width >= 1024 ? 880 : undefined;
  const content = scroll ? (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: horizontalInset, maxWidth },
        width >= 1024 && styles.centered,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        styles.flex,
        { paddingHorizontal: horizontalInset, maxWidth },
        width >= 1024 && styles.centered,
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={[styles.safeArea, { backgroundColor: colors.canvas }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {content}
        {footer ? (
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.canvas, borderTopColor: colors.border },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  centered: {
    width: '100%',
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
