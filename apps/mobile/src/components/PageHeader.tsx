import { spacing } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { BrandMark } from './BrandMark';

export function PageHeader({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.topline}>
        <BrandMark />
        {eyebrow ? (
          <AppText tone="accent" variant="caption">
            {eyebrow.toLocaleUpperCase()}
          </AppText>
        ) : null}
      </View>
      <AppText variant="title">{title}</AppText>
      {body ? <AppText tone="muted">{body}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  topline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
