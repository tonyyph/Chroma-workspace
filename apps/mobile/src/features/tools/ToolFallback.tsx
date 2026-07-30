import { space } from '@chromawave/design-tokens';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, EmptyGlyph, Gutter, Meta, Screen, ScreenHeader, Text } from '@/ui';

/**
 * What a tool route shows when it has no palette to work on. Uses the FLOW E
 * empty pattern rather than an empty tool, so a deep link to a deleted palette
 * lands somewhere legible.
 */
export function ToolFallback({
  title,
  body,
  loading,
}: {
  title: string;
  body?: string;
  loading: boolean;
}) {
  const router = useRouter();
  const { t } = usePreferences();

  return (
    <Screen>
      <Gutter style={styles.head}>
        <ScreenHeader title={title} />
      </Gutter>
      <Gutter style={styles.body}>
        {loading ? (
          <Meta>{t('state.loading')}</Meta>
        ) : (
          <>
            <EmptyGlyph kind="no-library" />
            <Text variant="section">{t('state.tool.title')}</Text>
            <Text style={styles.copy} tone="secondary" variant="body">
              {body ?? t('state.tool.body')}
            </Text>
            <Button
              label={t('state.tool.action')}
              onPress={() => router.navigate('/(tabs)')}
              size="xs"
            />
          </>
        )}
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.cardGap },
  body: { alignItems: 'center', gap: space.md, paddingTop: space.xl },
  copy: { textAlign: 'center' },
});
