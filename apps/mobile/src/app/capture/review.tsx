import { radius, spacing } from '@chromawave/design-tokens';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { useCaptureStore } from '@/store/captureStore';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function ReviewScreen() {
  const photo = useCaptureStore((state) => state.photo);
  const { colors, t } = usePreferences();

  if (!photo) {
    return (
      <Screen>
        <StateView
          actionLabel={t('review.missingAction')}
          body={t('review.missingBody')}
          onAction={() => router.replace('/(tabs)/capture')}
          title={t('review.missingTitle')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          accessibilityHint={t('review.confirmHint')}
          label={t('review.confirm')}
          onPress={() => router.push('/capture/palette')}
        />
      }
    >
      <PageHeader body={t('review.body')} eyebrow={t('review.eyebrow')} title={t('review.title')} />
      <Image
        accessibilityLabel={t('review.imageLabel')}
        contentFit="cover"
        source={{ uri: photo.uri }}
        style={[styles.image, { backgroundColor: colors.surface }]}
        transition={180}
      />
      <View style={styles.meta}>
        <AppText tone="muted" variant="caption">
          {photo.width} × {photo.height} · {photo.mediaType.replace('image/', '').toUpperCase()}
        </AppText>
        <Button
          label={t('review.change')}
          onPress={() => router.replace('/(tabs)/capture')}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    aspectRatio: 0.84,
    maxHeight: 560,
    borderRadius: radius.xl,
  },
  meta: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
