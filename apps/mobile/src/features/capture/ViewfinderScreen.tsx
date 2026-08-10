import { size, space, uiMotion, type Skin } from '@chromawave/design-tokens';
import { readStability, type Color } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import { BrandMark } from '@/components';
import { usePhotoRead } from '@/hooks';
import { hapticsService, soundService } from '@/infrastructure/dependencies';
import { usePreferences, useSkin } from '@/providers';
import { useCaptureStore } from '@/store';
import {
  Button,
  Card,
  Chip,
  Icon,
  LiveReadPulse,
  Meta,
  Pressable,
  ScanSweep,
  Text,
  useCaptureSequence,
  useStyles,
} from '@/ui';

/** The three viewfinder modes, each with its own message key. */
const MODES = [
  { key: 'live', labelKey: 'capture.mode.live' },
  { key: 'photo', labelKey: 'capture.mode.photo' },
  { key: 'scan', labelKey: 'capture.mode.scan' },
] as const;

type Mode = (typeof MODES)[number]['key'];

/** Flash cycles through these; AUTO leaves the decision to the capture. */
const FLASH_MODES = ['off', 'on', 'auto'] as const;
type Flash = (typeof FLASH_MODES)[number];

/**
 * The framed area for each aspect ratio, sized to hold roughly the same area so
 * cycling ratios reframes rather than zooms.
 */
const RATIOS = [
  { key: '4:3', width: 204, height: 272 },
  { key: '1:1', width: 236, height: 236 },
  { key: '16:9', width: 280, height: 158 },
] as const;

/**
 * B1 · VIEWFINDER · "shutter is the mark, 84px target".
 *
 * The live read is real: a Vision Camera frame processor subsamples each frame
 * and the extractor runs on that, so the strip below shows the actual colours in
 * front of the lens. The 620ms scan sweep is the Skia layer the kit specifies.
 */
export function ViewfinderScreen({ setId = null }: { setId?: string | null }) {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const camera = useRef<CameraRef>(null);
  const { t } = usePreferences();

  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const [mode, setMode] = useState<Mode>('live');
  const [capturing, setCapturing] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>('off');
  const [ratioIndex, setRatioIndex] = useState(0);
  const ratio = RATIOS[ratioIndex] ?? RATIOS[0];

  const { read, colors, deltaE, confidence, reading, latest } = usePhotoRead();

  const begin = useCaptureStore((state) => state.begin);

  /**
   * A capture finishes when two independent things have both finished: the
   * shutter storyboard, which runs on a fixed clock, and the decode-and-extract,
   * which takes as long as the photo takes.
   *
   * They used to be treated as one. `onSettled` fired when the animation ended
   * and gave up silently if the colours were not ready yet — which, for a
   * full-resolution frame, was most of the time. The shutter appeared to do
   * nothing at all. Tracking them separately and committing when the second one
   * lands is the whole fix.
   */
  const [sequenceDone, setSequenceDone] = useState(false);
  const [readDone, setReadDone] = useState(false);
  const [captureError, setCaptureError] = useState(false);
  const photoRef = useRef<string | null>(null);
  photoRef.current = photoUri;

  const onSettled = useCallback(() => {
    void hapticsService.fire('extractionComplete');
    void soundService.play('extractDone');
    setSequenceDone(true);
  }, []);

  const sequence = useCaptureSequence(capturing, onSettled);

  useEffect(() => {
    if (!capturing || !sequenceDone || !readDone) return;

    setCapturing(false);
    setSequenceDone(false);
    setReadDone(false);

    const outcome = latest.current;
    if (!outcome?.ok || outcome.result.colors.length === 0) {
      // Say so rather than stranding the user on a viewfinder that appears to
      // have ignored them.
      setCaptureError(true);
      return;
    }

    begin({
      colors: outcome.result.colors,
      photoUri: photoRef.current,
      deltaE: outcome.result.deltaE,
      confidence: outcome.result.confidence,
      source: 'photo',
      setId,
    });
    router.push('/capture/result');
  }, [begin, capturing, latest, readDone, router, sequenceDone, setId]);

  const shoot = useCallback(async () => {
    void hapticsService.fire('shutterPress');
    void soundService.play('shutter');
    setCaptureError(false);
    setSequenceDone(false);
    setReadDone(false);
    setCapturing(true);
    try {
      // The torch covers the LIVE reading; the flash fires for the frame the
      // extractor actually reads, which is the one that has to be lit.
      const file = await photoOutput.capturePhotoToFile({ flashMode: flash }, {});
      // `filePath` is a filesystem path, not a file:// URL — Image needs the scheme.
      const uri = `file://${file.filePath}`;
      setPhotoUri(uri);
      await read(uri);
    } catch {
      latest.current = { ok: false, reason: 'decode' };
    } finally {
      // Marked done on every path, or a failed shot would leave the capture
      // waiting forever with the shutter disabled.
      setReadDone(true);
    }
  }, [flash, latest, photoOutput, read]);

  /**
   * The three modes are three different capture paths, so selecting one routes
   * to it. LIVE is this screen, which is why it alone stays put.
   */
  const selectMode = useCallback(
    (next: Mode) => {
      setMode(next);
      if (next === 'photo') router.push('/tools/import');
      if (next === 'scan') router.push('/tools/scan');
    },
    [router],
  );

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
          outputs={[photoOutput]}
          ref={camera}
          style={StyleSheet.absoluteFill}
          // 'auto' has no torch equivalent — it is a shutter-time decision — so
          // the continuous light is only held on for the explicit ON setting.
          torchMode={flash === 'on' ? 'on' : 'off'}
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
            <Icon name="close" scale="action" />
          </Pressable>
          <View style={styles.topChips}>
            <Chip
              label={`${t('capture.flash')} ${t(`capture.flash.${flash}`)}`}
              onPress={() =>
                setFlash(
                  FLASH_MODES[(FLASH_MODES.indexOf(flash) + 1) % FLASH_MODES.length] ?? 'off',
                )
              }
              tone={flash === 'off' ? 'default' : 'selected'}
            />
            <Chip
              label={ratio.key}
              onPress={() => setRatioIndex((current) => (current + 1) % RATIOS.length)}
              tone={ratioIndex === 0 ? 'default' : 'selected'}
            />
            {/* Locking white balance keeps a walk's readings comparable — Pro. */}
            <Chip
              label={t('capture.autoWb')}
              onPress={() => router.push('/paywall?trigger=auto-wb')}
              tone="pro"
            />
          </View>
        </View>

        {/* The ratio chip crops the framed area, so what the reticle encloses is
            what the chosen ratio will contain. */}
        <View style={styles.reticleWrap}>
          <View style={[styles.reticle, { width: ratio.width, height: ratio.height }]}>
            <View style={styles.reticleDot} />
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.readPanel}>
            <View style={styles.readHead}>
              <Text tone="tertiary" variant="eyebrow">
                {t('capture.liveRead')}
              </Text>
              <Meta tone={captureError ? 'danger' : stability === 'stable' ? 'info' : 'tertiary'}>
                {captureError
                  ? t('capture.readFailed')
                  : readColors.length
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
                disabled={capturing || reading}
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
            {MODES.map((entry) => (
              <Pressable
                accessibilityLabel={t(entry.labelKey)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === entry.key }}
                hitSlop={10}
                key={entry.key}
                onPress={() => selectMode(entry.key)}
              >
                <Text
                  style={[styles.mode, mode === entry.key && styles.modeActive]}
                  tone={mode === entry.key ? 'primary' : 'tertiary'}
                  variant="chip"
                >
                  {t(entry.labelKey)}
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
  const styles = useStyles(makeStyles);
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

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: skin.ui.bg.media },
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
      backgroundColor: skin.ui.scrim.control,
      borderWidth: 1,
      borderColor: skin.ui.border.control,
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
      backgroundColor: skin.ui.scrim.panel,
      borderWidth: 1,
      borderColor: skin.ui.border.hairlineStrong,
      borderRadius: skin.round.media - 2,
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
      borderRadius: skin.round.control,
      backgroundColor: skin.ui.scrim.control,
      borderWidth: 1,
      borderColor: skin.ui.border.control,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutter: {
      width: size.shutter,
      height: size.shutter,
      borderRadius: size.shutter / 2,
      borderWidth: 3,
      borderColor: skin.ui.text.primary,
      backgroundColor: 'rgba(237,234,227,.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modes: { flexDirection: 'row', gap: 18, justifyContent: 'center' },
    mode: { paddingBottom: 5 },
    modeActive: { borderBottomWidth: 2, borderBottomColor: skin.ui.action.primary },
    gate: { alignItems: 'center', gap: space.md, paddingHorizontal: space.sectionGap },
    gateTitle: { textAlign: 'center' },
    gateBody: { textAlign: 'center' },
    gateCard: { alignSelf: 'stretch' },
  });

export const shutterPressScale = uiMotion.shutterPress.scale;
