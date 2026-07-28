import { spacing } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { usePreferences } from '@/providers/PreferencesProvider';

export function LocalOnlyBanner() {
  const { colors, t } = usePreferences();
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <View style={[styles.mark, { backgroundColor: colors.success }]} />
      <AppText style={styles.copy} tone="muted" variant="caption">
        {t('common.privateDevice')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  mark: {
    width: 8,
    height: 8,
    transform: [{ rotate: '45deg' }],
  },
  copy: {
    flexShrink: 1,
  },
});
