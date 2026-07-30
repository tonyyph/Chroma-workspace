import { round, size, space, ui, uiMotion } from '@chromawave/design-tokens';
import { readStability, type Color } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';

import { BrandMark } from '@/components/BrandMark';
import { useLiveRead } from '@/hooks/useLiveRead';
import { hapticsService, soundService } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useCaptureStore } from '@/store/captureStore';
import { Button, Card, Chip, LiveReadPulse, Meta, ScanSweep, Text, useCaptureSequence } from '@/ui';

type Mode = 'LIVE' | 'PHOTO' | 'SCAN';

/**
 * B1 · VIEWFINDER · "shutter is the mark, 84px target".
 *
 * The live read is real: a Vision Camera frame processor subsamples each frame
 * and the extractor runs on that, so the strip below shows the actual colours in
 * front of the lens. The 620ms scan sweep is the Skia layer the kit specifies.
 */
export function ViewfinderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const camera = useRef<CameraRef>(null);
  const { t } = usePreferences();

  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const [mode, setMode] = useState<Mode>('LIVE');
  const [capturing, setCapturing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const { frameOutput, colors, deltaE, confidence } = useLiveRead({
    enabled: hasPermission && !capturing,
  });

  // The sequence callback fires from a worklet completion, so it reads the latest
  // values through refs rather than closing over a stale render.
  const colorsRef = useRef<readonly Color[]>([]);
  const photoRef = useRef<string | null>(null);
  const metricsRef = useRef({ deltaE: 0, confidence: 0 });
  colorsRef.current = colors;
  photoRef.current = photoUri;
  metricsRef.current = { deltaE, confidence };

  const begin = useCaptureStore((state) => state.begin);

  const onSettled = useCallback(() => {
    void hapticsService.fire('extractionComplete');
    void soundService.play('extractDone');
    setCapturing(false);
    if (!colorsRef.current.length) return;
    begin({
      colors: colorsRef.current,
      photoUri: photoRef.current,
      deltaE: metricsRef.current.deltaE,
      confidence: metricsRef.current.confidence,
      source: photoRef.current ? 'photo' : 'live',
    });
    router.push('/capture/result');
  }, [begin, router]);

  const sequence = useCaptureSequence(capturing, onSettled);

  const shoot = useCallback(async () => {
    void hapticsService.fire('shutterPress');
    void soundService.play('shutter');
    setCapturing(true);
    try {
      const file = await photoOutput.capturePhotoToFile({}, {});
      // `filePath` is a filesystem path, not a file:// URL — Image needs the scheme.
      setPhotoUri(`file://${file.filePath}`);
    } catch {
      // A failed shot still runs the sequence — the live read already has colours,
      // so the user gets a palette even without a stored frame.
    }
  }, [photoOutput]);

  if (!hasPermission) {
    return (
      <PermissionGate
        canRequest={canRequestPermission}
        onCancel={router.back}
        onRequest={() => void requestPermission()}
      />
    );
  }

  const readColors = colors.length ? colors : [];
  const stability = readStability(deltaE);

  return (
    <View style={styles.root}>
      {device ? (
        <Camera
          device={device}
          isActive
          outputs={[photoOutput, frameOutput]}
          ref={camera}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noDevice]}>
          <Text tone="tertiary" variant="chip">
            {t('capture.noDevice')}
          </Text>
        </View>
      )}

      {/* Frame freeze flash — 8% white for 100ms, per the storyboard. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.flash, sequence.flashStyle]}
      />

      {/* The Skia scan sweep the kit assigns to `scan-sweep · SKIA · NATIVE`. */}
      <View pointerEvents="none" style={styles.sweepLayer}>
        <ScanSweep height={220} progress={sequence.scanProgress} width={width} />
      </View>

      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel={t('capture.close')}
            accessibilityRole="button"
            onPress={router.back}
            style={styles.close}
          >
            <Text variant="chip">✕</Text>
          </Pressable>
          <View style={styles.topChips}>
            <Chip label={t('capture.flash')} onPress={() => {}} />
            <Chip label={t('capture.ratio')} onPress={() => {}} />
            <Chip label={t('capture.autoWb')} tone="pro" />
          </View>
        </View>

        <View style={styles.reticleWrap}>
          <View style={styles.reticle}>
            <View style={styles.reticleDot} />
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.readPanel}>
            <View style={styles.readHead}>
              <Text tone="tertiary" variant="eyebrow">
                {t('capture.liveRead')}
              </Text>
              <Meta tone={stability === 'stable' ? 'info' : 'tertiary'}>
                {readColors.length
                  ? `ΔE ${deltaE} · ${t(`common.stability.${stability}`)} · ${Math.round(confidence * 100)}%`
                  : t('capture.reading')}
              </Meta>
            </View>
            {readColors.length ? (
              <Animated.View style={[styles.readRow, sequence.swatchStyle]}>
                {readColors.map((color: Color) => (
                  <View key={color.hex} style={styles.readItem}>
                    <View style={[styles.readSwatch, { backgroundColor: color.hex }]} />
                    <Text tone="secondary" variant="monoSmall">
                      {color.hex.slice(1)}
                    </Text>
                  </View>
                ))}
              </Animated.View>
            ) : (
              <LiveReadPulse />
            )}
          </View>

          <View style={styles.shutterRow}>
            <Pressable
              accessibilityLabel={t('capture.import')}
              accessibilityRole="button"
              onPress={() => router.push('/tools/import')}
              style={styles.sideButton}
            >
              <Text tone="secondary" variant="monoSmall">
                {t('capture.import')}
              </Text>
            </Pressable>

            <Animated.View style={sequence.shutterStyle}>
              <Pressable
                accessibilityHint={t('capture.shutterHint')}
                accessibilityLabel={t('capture.shutter')}
                accessibilityRole="button"
                disabled={capturing}
                onPress={() => void shoot()}
                style={styles.shutter}
              >
                <BrandMark size={64} />
              </Pressable>
            </Animated.View>

            <Pressable
              accessibilityLabel={t('capture.scan')}
              accessibilityRole="button"
              onPress={() => router.push('/tools/scan')}
              style={styles.sideButton}
            >
              <Text tone="secondary" variant="monoSmall">
                {t('capture.scan')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.modes}>
            {(['LIVE', 'PHOTO', 'SCAN'] as const).map((entry) => (
              <Pressable
                accessibilityLabel={entry}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === entry }}
                hitSlop={10}
                key={entry}
                onPress={() => setMode(entry)}
              >
                <Text
                  style={[styles.mode, mode === entry && styles.modeActive]}
                  tone={mode === entry ? 'primary' : 'tertiary'}
                  variant="chip"
                >
                  {t(`capture.mode.${entry.toLowerCase()}` as never)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/** A4's copy, reused when the permission was never granted or was revoked. */
function PermissionGate({
  canRequest,
  onRequest,
  onCancel,
}: {
  canRequest: boolean;
  onRequest: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();
  return (
    <View style={[styles.root, styles.gate, { paddingTop: insets.top + space.xl }]}>
      <BrandMark size={76} />
      <Text style={styles.gateTitle} variant="headline">
        {t('onboarding.permission.title')}
      </Text>
      <Text style={styles.gateBody} tone="secondary" variant="body">
        {t('onboarding.permission.body')}
      </Text>
      <Card style={styles.gateCard}>
        <Text tone="secondary" variant="body">
          {t(canRequest ? 'capture.permission.allowBody' : 'capture.permission.deniedBody')}
        </Text>
      </Card>
      {canRequest ? (
        <Button label={t('onboarding.allowCamera')} onPress={onRequest} size="lg" />
      ) : null}
      <Button label={t('capture.notNow')} onPress={onCancel} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg.media },
  noDevice: { alignItems: 'center', justifyContent: 'center' },
  flash: { backgroundColor: '#FFFFFF' },
  sweepLayer: { position: 'absolute', left: 0, right: 0, top: '30%' },
  chrome: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    paddingTop: space.cardGap,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ui.scrim.control,
    borderWidth: 1,
    borderColor: ui.border.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topChips: { flexDirection: 'row', gap: space.xs },
  reticleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: 236,
    height: 236,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: 'rgba(237,234,227,.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  bottom: { paddingHorizontal: space.gutter, gap: space.cardGap },
  readPanel: {
    backgroundColor: ui.scrim.panel,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    borderRadius: round.media - 2,
    padding: space.cardGap,
    gap: space.sm,
    minHeight: 108,
  },
  readHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readRow: { flexDirection: 'row', gap: space.xs },
  readItem: { flex: 1, gap: 6 },
  readSwatch: { height: 44, borderRadius: 10 },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: round.control,
    backgroundColor: ui.scrim.control,
    borderWidth: 1,
    borderColor: ui.border.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: size.shutter,
    height: size.shutter,
    borderRadius: size.shutter / 2,
    borderWidth: 3,
    borderColor: ui.text.primary,
    backgroundColor: 'rgba(237,234,227,.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modes: { flexDirection: 'row', gap: 18, justifyContent: 'center' },
  mode: { paddingBottom: 5 },
  modeActive: { borderBottomWidth: 2, borderBottomColor: ui.action.primary },
  gate: { alignItems: 'center', gap: space.md, paddingHorizontal: space.sectionGap },
  gateTitle: { textAlign: 'center' },
  gateBody: { textAlign: 'center' },
  gateCard: { alignSelf: 'stretch' },
});

export const shutterPressScale = uiMotion.shutterPress.scale;
