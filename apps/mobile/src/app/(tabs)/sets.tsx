import { space } from '@chromawave/design-tokens';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, EmptyGlyph, Gutter, Screen, ScreenHeader, Text } from '@/ui';

/**
 * C3 · SETS — collections of palettes.
 *
 * The collection model and the shared-set screen are not built yet, so this
 * shows the empty state from FLOW E rather than a stubbed list. Tracked in
 * docs/23-app-redesign.md.
 */
export default function SetsScreen() {
  const router = useRouter();
  const { t } = usePreferences();
  return (
    <Screen tabBarInset>
      <Gutter style={styles.head}>
        <ScreenHeader meta={t('sets.meta', { count: 0 })} title={t('sets.title')} />
      </Gutter>
      <Gutter style={styles.body}>
        <EmptyGlyph kind="no-library" />
        <Text variant="section">{t('sets.empty.title')}</Text>
        <Text style={styles.copy} tone="secondary" variant="body">
          {t('sets.empty.body')}
        </Text>
        <Button
          label={t('sets.empty.action')}
          onPress={() => router.navigate('/(tabs)')}
          size="xs"
        />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.cardGap },
  body: { alignItems: 'center', gap: space.md, paddingTop: space.xl },
  copy: { textAlign: 'center' },
});
