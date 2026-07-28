import { radius, spacing } from '@chromawave/design-tokens';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { Button } from './Button';
import { usePreferences } from '@/providers/PreferencesProvider';

type StateViewProps = {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
};

export function StateView({ title, body, actionLabel, onAction, busy = false }: StateViewProps) {
  const { colors } = usePreferences();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.container, { backgroundColor: colors.surfaceSubtle }]}
    >
      {busy ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <View style={[styles.orb, { backgroundColor: colors.accent }]} />
      )}
      <AppText style={styles.center} variant="heading">
        {title}
      </AppText>
      <AppText style={styles.center} tone="muted">
        {body}
      </AppText>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 280,
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  orb: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    marginBottom: spacing.xs,
  },
  action: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
});
