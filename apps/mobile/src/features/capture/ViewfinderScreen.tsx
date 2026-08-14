import { size, space, uiMotion, type Skin } from '@cw/tokens';
import { useRouter, useIsFocused } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
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
import { usePreferences } from '@/providers';
import { Chip, Icon, Pressable, ScanSweep, Text, useStyles } from '@/ui';
import { LiveReadPanel } from './LiveReadPanel';
import { PermissionGate } from './PermissionGate';
import { useCaptureSession } from './useCaptureSession';

/** The four capture paths, each with its own message key. */
const MODES = [
  { key: 'live', labelKey: 'capture.mode.live' },
  { key: 'studio', labelKey: 'studio.mode' },
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
 * What the shutter writes to disk.
 *
 * **JPEG, not the platform default.** Vision Camera's `containerFormat` defaults
 * to `'native'`, which on iOS means HEIC — and the Skia build shipped by
 * `@shopify/react-native-skia` has no HEIF codec, so `MakeImageFromEncoded`
 * returned null for every shot and the read reported COULD NOT READ THAT FRAME.
 * A simulator has no camera, which is why this only appeared on hardware.
 *
 * Hoisted out of the component because `usePhotoOutput` memoises on the identity
 * of what it is handed: an object literal in the render body builds a new photo
 * output, and reconfigures the capture session, on every render.
 */
const PHOTO_OUTPUT = { containerFormat: 'jpeg' } as const;

/**
 * B1 · VIEWFINDER · "shutter is the mark, 84px target".
 *
 * This file is the viewfinder's chrome and the settings that chrome changes.
 * What a press of the shutter actually does lives in `useCaptureSession`, which
 * is where the two-clock rule that makes a capture complete is written down.
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

  const [mode, setMode] = useState<Mode>('live');
  const [flash, setFlash] = useState<Flash>('off');
  const [ratioIndex, setRatioIndex] = useState(0);
  const ratio = RATIOS[ratioIndex] ?? RATIOS[0];

  const { sequence, shoot, capturing, captureError, colors, deltaE, confidence, reading } =
    useCaptureSession({ photoOutput, flash, setId });

  /**
   * Each mode is a different capture path, so selecting one routes to it. LIVE
   * is this screen, which is why it alone stays put.
   */
  const selectMode = useCallback(
    (next: Mode) => {
      setMode(next);
      if (next === 'studio') router.push('/capture/studio');
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

  return (
    <View style={styles.root}>
      {device ? (
        <Camera
          device={device}
          isActive={focused}
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
          <LiveReadPanel
            colors={colors}
            confidence={confidence}
            deltaE={deltaE}
            failed={captureError}
            swatchStyle={sequence.swatchStyle}
          />

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
      // Rounded where the skin rounds, square where it does not.
      borderRadius: skin.round.media > 0 ? 64 : 0,
      borderWidth: 2,
      /* appearance-exempt: see below. */
      /**
       * Fixed, and not a skin leak.
       *
       * Every other surface sits on a ground the skin owns; this one sits on a
       * live camera frame, which is an unknown scene. A high-luminance stroke
       * stays visible over both a dark room and a white wall, which is why
       * camera apps draw their guides this way whatever their theme.
       */
      borderColor: 'rgba(237,234,227,.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reticleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
    bottom: { paddingHorizontal: space.gutter, gap: space.cardGap },
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
      // Same reason as the reticle: chrome over an unknown photographic scene.
      backgroundColor: 'rgba(237,234,227,.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modes: { flexDirection: 'row', gap: 18, justifyContent: 'center' },
    mode: { paddingBottom: 5 },
    modeActive: { borderBottomWidth: 2, borderBottomColor: skin.ui.action.primary },
  });

export const shutterPressScale = uiMotion.shutterPress.scale;
