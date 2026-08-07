import { space } from '@chromawave/design-tokens';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Button, EmptyGlyph, Screen, Text } from '@/ui';

export default function NotFound() {
  const router = useRouter();
  const { t } = usePreferences();
  return (
    <Screen>
      <View style={styles.body}>
        <EmptyGlyph kind="no-results" />
        <Text variant="section">{t('state.nothing.title')}</Text>
        <Text style={styles.copy} tone="secondary" variant="body">
          {t('state.nothing.body')}
        </Text>
        <Button
          label={t('state.nothing.action')}
          onPress={() => router.replace('/(tabs)')}
          size="xs"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: space.md, paddingTop: space.xl, paddingHorizontal: space.lg },
  copy: { textAlign: 'center' },
});
