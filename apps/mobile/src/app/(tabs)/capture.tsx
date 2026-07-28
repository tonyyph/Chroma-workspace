import { analytics } from '@/infrastructure/dependencies';
import { useCaptureStore } from '@/store/captureStore';
import { toDraftPhoto } from '@/utils/photo';
import { spacing } from '@chromawave/design-tokens';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ChromaticArtwork } from '@/components/ChromaticArtwork';
import { LocalOnlyBanner } from '@/components/LocalOnlyBanner';
import { PageHeader } from '@/components/PageHeader';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { usePreferences } from '@/providers/PreferencesProvider';

type CaptureStatus = 'idle' | 'requesting' | 'denied' | 'error';
type CaptureSource = 'library' | 'camera';

export default function CaptureScreen() {
  const setPhoto = useCaptureStore((state) => state.setPhoto);
  const { preferences, t } = usePreferences();
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [deniedSource, setDeniedSource] = useState<CaptureSource>('library');

  const choosePhoto = async (source: CaptureSource) => {
    setStatus('requesting');
    setDeniedSource(source);
    const startedAt = Date.now();
    analytics.track('capture_started', { source });

    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setDeniedSource(source);
        setCanAskAgain(permission.canAskAgain);
        setStatus('denied');
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: false,
        exif: false,
        mediaTypes: ['images'],
        quality: 1,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync({
              ...options,
              allowsMultipleSelection: false,
              selectionLimit: 1,
            });
      if (result.canceled || !result.assets[0]) {
        setStatus('idle');
        return;
      }

      setPhoto(toDraftPhoto(result.assets[0]));
      analytics.track('capture_completed', {
        source,
        durationMs: Date.now() - startedAt,
      });
      setStatus('idle');
      router.push('/capture/review');
    } catch {
      setStatus('error');
    }
  };

  return (
    <Screen>
      <PageHeader
        body={t('capture.body')}
        eyebrow={t('capture.eyebrow')}
        title={t('capture.title')}
      />
      <LocalOnlyBanner />

      <ChromaticArtwork caption={t('capture.caption')} compact />

      {status === 'denied' ? (
        <StateView
          actionLabel={canAskAgain ? t('capture.askAgain') : t('common.openSettings')}
          body={t('capture.permissionBody', {
            sourceLower:
              deniedSource === 'camera'
                ? preferences.language === 'vi'
                  ? 'máy ảnh khi bạn chọn chụp một khoảnh khắc'
                  : 'camera when you choose to photograph a moment'
                : preferences.language === 'vi'
                  ? 'một bức ảnh bạn chọn'
                  : 'single photograph you select',
          })}
          onAction={
            canAskAgain ? () => void choosePhoto(deniedSource) : () => void Linking.openSettings()
          }
          title={t('capture.permissionTitle', {
            source:
              deniedSource === 'camera'
                ? preferences.language === 'vi'
                  ? 'Máy ảnh'
                  : 'Camera'
                : preferences.language === 'vi'
                  ? 'Ảnh'
                  : 'Photo',
          })}
        />
      ) : null}
      {status === 'error' ? (
        <StateView
          actionLabel={t('common.tryAgain')}
          body={t('capture.errorBody')}
          onAction={() => void choosePhoto(deniedSource)}
          title={t('capture.errorTitle')}
        />
      ) : null}
      {status === 'idle' || status === 'requesting' ? (
        <View style={styles.action}>
          <Button
            accessibilityHint={t('capture.cameraHint')}
            label={t('capture.camera')}
            loading={status === 'requesting' && deniedSource === 'camera'}
            onPress={() => void choosePhoto('camera')}
          />
          <Button
            accessibilityHint={t('capture.libraryHint')}
            disabled={status === 'requesting'}
            label={t('capture.library')}
            loading={status === 'requesting' && deniedSource === 'library'}
            onPress={() => void choosePhoto('library')}
            variant="secondary"
          />
          <AppText style={styles.center} tone="subtle" variant="caption">
            {t('capture.privacy')}
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  center: {
    textAlign: 'center',
  },
});
