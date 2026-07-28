import { spacing } from '@chromawave/design-tokens';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { usePreferences } from '@/providers/PreferencesProvider';

export function EditorialSection({
  index,
  title,
  action,
}: {
  index: string;
  title: string;
  action?: ReactNode;
}) {
  const { colors } = usePreferences();
  return (
    <View style={styles.container}>
      <View style={[styles.rule, { backgroundColor: colors.border }]} />
      <View style={styles.row}>
        <AppText tone="subtle" variant="caption">
          {index}
        </AppText>
        <AppText style={styles.title} variant="heading">
          {title}
        </AppText>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
  },
});
