import {
  gradeForAtmosphere,
  gradesEqual,
  look,
  NEUTRAL_GRADE,
  readAtmosphere,
  type Grade,
} from '@cw/domain';
import { size, space, type Skin } from '@cw/tokens';
import { useRouter, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import { BrandMark } from '@/components';
import { PermissionGate } from '@/features/capture/PermissionGate';
import { GradePreview, useGradeImage } from '@/features/grading/GradePreview';
import { LookGrid } from '@/features/grading/LookGrid';
import { usePhotoRead } from '@/hooks';
import { hapticsService, soundService } from '@/infrastructure/dependencies';
import { useEntitlement, usePreferences, useSkin } from '@/providers';
import { useCaptureStore } from '@/store';
import { Button, Chip, Icon, Meta, Pressable, Slider, Text, Toggle, useStyles } from '@/ui';
import { useCameraControls } from './useCameraControls';

/** Same reason as the viewfinder: HEIC has no decoder in the shipped Skia. */
const PHOTO_OUTPUT = { containerFormat: 'jpeg' } as const;

/**
 * STUDIO — light on the lens, colour on the frame.
 *
 * **The honest shape of a camera with looks, on this platform.** A live filtered
 * preview is not possible here and the screen does not pretend otherwise: frame
 * processors need a worklets package that will not compile against React Native
 * 0.83, and `takeSnapshot()` throws `"takeSnapshot() is not available on iOS!"`.
 * There is no third door.
 *
 * So the two halves are split honestly. Before the shutter, everything that
 * changes what the *sensor records* is real and immediate — exposure, zoom,
 * focus, light. After it, the look is applied to the captured frame exactly, by
 * the same shader that is asserted pixel-for-pixel against its reference, and
 * you choose it while looking at the actual photograph rather than at a guess.
 *
 * A preview tinted to approximate a look, then contradicted by the shot, would
 * be the worse product even though it demos better.
 */
export function CameraStudioScreen() {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();
  const { width } = useWindowDimensions();

  const camera = useRef<CameraRef>(null);
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput(PHOTO_OUTPUT);
  /**
   * The camera runs only while this screen is the one on top.
   *
   * A screen pushed over this one does not unmount it, so a hard-coded
   * `isActive` keeps the capture session open underneath — two live cameras at
   * once, a battery draining for a preview nobody can see, and two claims on a
   * sensor that has one. Guarded by the `no-hot-cameras` source scan.
   */
  const focused = useIsFocused();

  const controls = useCameraControls(camera);

  const { read, colors, deltaE, confidence, reading } = usePhotoRead();
  const begin = useCaptureStore((state) => state.begin);

  const [shot, setShot] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [grade, setGrade] = useState<Grade>(NEUTRAL_GRADE);

  const { image, status } = useGradeImage(shot);
  const canAdjust = useEntitlement('advanced_grading');

  const automatic = useMemo(
    () => (colors.length ? gradeForAtmosphere(readAtmosphere(colors, deltaE)) : NEUTRAL_GRADE),
    [colors, deltaE],
  );

  const shoot = useCallback(async () => {
    void hapticsService.fire('shutterPress');
    void soundService.play('shutter');
    setFailed(false);
    try {
      const file = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
      const uri = `file://${file.filePath}`;
      setShot(uri);

      const outcome = await read(uri);
      if (!outcome.ok || outcome.result.colors.length === 0) {
        setFailed(true);
        return;
      }
      setGrade(gradeForAtmosphere(readAtmosphere(outcome.result.colors, outcome.result.deltaE)));
      void hapticsService.fire('extractionComplete');
    } catch {
      setFailed(true);
    }
  }, [photoOutput, read]);

  const keep = () => {
    if (!colors.length || !shot) return;
    begin({
      colors,
      photoUri: shot,
      deltaE,
      confidence,
      source: 'photo',
      setId: null,
    });
    router.push('/capture/result');
  };

  const retake = () => {
    setShot(null);
    setFailed(false);
    setGrade(NEUTRAL_GRADE);
  };

  if (!hasPermission) {
    return (
      <PermissionGate
        canRequest={canRequestPermission}
        onCancel={router.back}
        onRequest={() => void requestPermission()}
      />
    );
  }

  const framing = shot === null;
  const previewWidth = width;
  const previewHeight = Math.round(width * 1.33);

  return (
    <View style={styles.root}>
      <View style={[styles.stage, { height: previewHeight }]}>
        {framing ? (
          device ? (
            <Pressable
              accessibilityHint={t('studio.focusHint')}
              accessibilityLabel={t('studio.title')}
              accessibilityRole="button"
              onPress={(event) =>
                controls.focusAt(event.nativeEvent.locationX, event.nativeEvent.locationY)
              }
              style={StyleSheet.absoluteFill}
            >
              <Camera
                device={device}
                isActive={focused}
                outputs={[photoOutput]}
                ref={camera}
                style={StyleSheet.absoluteFill}
              />
            </Pressable>
          ) : (
            <View style={styles.stageState}>
              <Meta>{t('capture.noDevice')}</Meta>
            </View>
          )
        ) : status === 'ready' && image ? (
          <GradePreview grade={grade} height={previewHeight} image={image} width={previewWidth} />
        ) : (
          <View style={styles.stageState}>
            <ActivityIndicator color={skin.ui.text.tertiary} />
            <Meta>{t(reading ? 'studio.reading' : 'capture.reading')}</Meta>
          </View>
        )}

        <View style={[styles.topRow, { paddingTop: insets.top + space.sm }]}>
          <Pressable
            accessibilityLabel={t('capture.close')}
            accessibilityRole="button"
            hitSlop={12}
            onPress={router.back}
            style={styles.close}
          >
            <Icon name="close" scale="action" />
          </Pressable>
          <Meta>{t('studio.title')}</Meta>
        </View>
      </View>

      <View style={styles.panel}>
        {failed ? (
          <Meta tone="danger">{t('studio.failed')}</Meta>
        ) : (
          <Meta>{framing ? t('studio.subtitle') : t('studio.looks')}</Meta>
        )}

        {framing ? (
          <>
            {controls.ready ? (
              <>
                <Slider
                  label={t('studio.exposure')}
                  maximumValue={controls.maxExposure}
                  minimumValue={controls.minExposure}
                  onChange={controls.setExposure}
                  value={controls.exposure}
                  valueText={t('studio.stops', { value: controls.exposure.toFixed(1) })}
                />
                {controls.maxZoom > controls.minZoom ? (
                  <Slider
                    label={t('studio.zoom')}
                    maximumValue={controls.maxZoom}
                    minimumValue={controls.minZoom}
                    onChange={controls.setZoom}
                    value={controls.zoom}
                    valueText={t('studio.times', { value: controls.zoom.toFixed(1) })}
                  />
                ) : null}
                <View style={styles.torchRow}>
                  <Text variant="chip">{t('studio.torch')}</Text>
                  <Toggle
                    label={t('studio.torch')}
                    onValueChange={controls.setTorch}
                    value={controls.torch}
                  />
                </View>
              </>
            ) : (
              <View style={styles.waiting}>
                <ActivityIndicator color={skin.ui.text.tertiary} />
                <Meta>{t('studio.preparing')}</Meta>
              </View>
            )}

            <Meta tone="tertiary">{t('studio.liveNote')}</Meta>

            <View style={styles.shutterRow}>
              <Pressable
                accessibilityLabel={t('studio.shutter')}
                accessibilityRole="button"
                disabled={!device || reading}
                onPress={() => void shoot()}
                style={styles.shutter}
              >
                <BrandMark size={64} />
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.looks}>
              <Chip
                label={t('grade.auto')}
                onPress={() => setGrade(automatic)}
                tone={gradesEqual(grade, automatic) ? 'selected' : 'default'}
              />
              <Chip
                label={t('grade.original')}
                onPress={() => setGrade(NEUTRAL_GRADE)}
                tone={gradesEqual(grade, NEUTRAL_GRADE) ? 'selected' : 'default'}
              />
            </View>

            {/*
              The same grid the grade screen shows, on the frame just captured.
              It gates the same way too: this rail used to hand out every look
              for free, which made the paywall next door a formality.
            */}
            {status === 'ready' && image ? (
              <LookGrid
                current={grade}
                image={image}
                isLocked={(lookId) => !canAdjust && !(look(lookId)?.free ?? false)}
                onChoose={setGrade}
                onLocked={() => router.push('/paywall?trigger=advanced-grading')}
              />
            ) : null}

            <View style={styles.reviewActions}>
              <Button label={t('studio.retake')} onPress={retake} variant="ghost" />
              <Button
                disabled={!colors.length}
                label={t('studio.keep')}
                onPress={keep}
                size="lg"
                variant="contrast"
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: skin.ui.bg.media },
    stage: { backgroundColor: skin.ui.bg.media, overflow: 'hidden' },
    stageState: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.xs,
    },
    topRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.gutter,
    },
    close: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: skin.ui.scrim.control,
      borderWidth: 1,
      borderColor: skin.ui.border.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panel: { flex: 1, padding: space.gutter, gap: space.sm },
    waiting: { alignItems: 'center', gap: space.xs, paddingVertical: space.md },
    torchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    shutterRow: { alignItems: 'center', marginTop: 'auto', paddingTop: space.sm },
    shutter: {
      width: size.shutter,
      height: size.shutter,
      borderRadius: size.shutter / 2,
      borderWidth: 3,
      borderColor: skin.ui.text.primary,
      /* appearance-exempt: see below. */
      /**
       * Fixed, and not a skin leak — the same exemption the viewfinder's
       * shutter carries, for the same reason.
       *
       * Every other surface sits on a ground the skin owns; this one sits over a
       * live camera frame, which is an unknown scene. A high-luminance fill stays
       * visible over both a dark room and a white wall, whatever the theme.
       */
      backgroundColor: 'rgba(237,234,227,.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    looks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    reviewActions: { marginTop: 'auto', gap: space.xs },
  });
