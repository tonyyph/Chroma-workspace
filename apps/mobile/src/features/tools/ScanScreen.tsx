import { round, space, ui } from '@chromawave/design-tokens';
import { makeColor, type Color } from '@chromawave/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { usePhotoRead } from '@/hooks/usePhotoRead';
import { analytics, hapticsService } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, Card, Chip, Icon, LiveReadPulse, Pressable, Text } from '@/ui';

const MAX_PINS = 7;

/**
 * G1 · SCAN MODE · "pin colours as you move, batch into one palette".
 *
 * Each tap pins whatever the live read currently makes dominant, so walking and
 * tapping builds a palette from the real scene. Every pin fires the light impact
 * haptic from the kit's map; the batch converts to a palette with even weights.
 */
export function ScanScreen({
  onExit,
  onBuild,
}: {
  onExit: () => void;
  onBuild: (colors: readonly Color[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();
  const [pins, setPins] = useState<readonly string[]>([]);
  const [pinFailed, setPinFailed] = useState(false);
  const { hasPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput({ targetResolution: { width: 640, height: 480 } });
  const { read, colors, reading } = usePhotoRead();

  const dominant = colors.find((color) => color.role === 'dominant') ?? colors[0];

  /**
   * Each tap grabs a low-resolution frame and pins its dominant colour. A live
   * frame processor would be smoother, but its native dependency does not build
   * against this React Native version — see `usePhotoRead`.
   */
  const addPin = async () => {
    if (pins.length >= MAX_PINS || reading) return;
    setPinFailed(false);
    try {
      const file = await photoOutput.capturePhotoToFile({}, {});
      const outcome = await read(`file://${file.filePath}`, 3);
      const hex = outcome.ok
        ? (outcome.result.colors.find((color) => color.role === 'dominant')?.hex ??
          outcome.result.colors[0]?.hex)
        : undefined;
      if (!hex) {
        // A tap that pins nothing has to look different from one that worked,
        // or the user keeps tapping a scene that is never going to read.
        setPinFailed(true);
        return;
      }
      setPins((current) => [...current, hex]);
      // BUILD KIT · haptic map: "colour pinned (scan) → impact · light".
      void hapticsService.fire('colourPinned');
    } catch {
      setPinFailed(true);
    }
  };

  const build = () => {
    const weight = Math.round((1 / pins.length) * 1000) / 1000;
    const roles = ['dominant', 'support', 'signal'] as const;
    const colors = pins.map((hex, index) => makeColor(hex, weight, roles[index] ?? 'extra'));
    // Push rounding remainder onto the first so weights still sum to one.
    const drift = 1 - colors.reduce((sum, color) => sum + color.weight, 0);
    const first = colors[0];
    if (first) colors[0] = { ...first, weight: Math.round((first.weight + drift) * 1000) / 1000 };
    analytics.track('scan_pins_added', { count: pins.length });
    onBuild(colors);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {device && hasPermission ? (
        <Camera device={device} isActive outputs={[photoOutput]} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.sceneLabel}>
          <Text tone="quaternary" variant="chip">
            {t(hasPermission ? 'capture.noDevice' : 'capture.cameraNeeded')}
          </Text>
        </View>
      )}

      <View style={styles.topRow}>
        <Card accessibilityLabel={t('scan.exit')} onPress={onExit} style={styles.exitChip}>
          <Icon name="close" scale="inline" />
          <Text variant="chip">{t('scan.exit')}</Text>
        </Card>
        <Chip label={t('scan.pinned', { count: pins.length })} tone="pro" />
      </View>

      {/* Tapping the scene is what pins a colour, so the whole area is the target. */}
      <Pressable
        accessibilityHint={t('scan.pinHint')}
        accessibilityLabel={t('scan.pinLabel')}
        accessibilityRole="button"
        onPress={() => void addPin()}
        style={styles.scene}
      >
        {pins.slice(-4).map((hex, index) => (
          <View
            key={`${hex}-${index}`}
            style={[styles.marker, { left: 40 + index * 56, top: 60 + index * 96 }]}
          >
            <View style={[styles.markerDot, { backgroundColor: hex }]} />
            <View style={styles.markerLabel}>
              <Text variant="chip">{hex.slice(1)}</Text>
            </View>
          </View>
        ))}
      </Pressable>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.panel}>
          <View style={styles.panelHead}>
            <Text tone="secondary" variant="eyebrow">
              {t('scan.pinnedWhileWalking')}
            </Text>
            <Text tone={pinFailed ? 'danger' : 'secondary'} variant="eyebrow">
              {pinFailed
                ? t('capture.readFailed')
                : dominant
                  ? t('scan.now', { hex: dominant.hex.slice(1) })
                  : t('capture.reading')}
            </Text>
          </View>
          {dominant ? null : <LiveReadPulse />}
          <View style={styles.pinRow}>
            {Array.from({ length: MAX_PINS }, (_, index) => {
              const hex = pins[index];
              return hex ? (
                <Pressable
                  accessibilityLabel={t('scan.removePin', { hex })}
                  accessibilityRole="button"
                  key={`${hex}-${index}`}
                  onPress={() => setPins((current) => current.filter((_, i) => i !== index))}
                  style={[styles.pin, { backgroundColor: hex }]}
                />
              ) : (
                <View key={`empty-${index}`} style={[styles.pin, styles.pinEmpty]} />
              );
            })}
          </View>
        </View>

        <Button
          disabled={pins.length < 2}
          label={t('scan.build', { count: pins.length })}
          onPress={build}
          size="lg"
          variant="contrast"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg.media },
  sceneLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    paddingTop: space.cardGap,
  },
  exitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ui.scrim.control,
    borderColor: ui.border.control,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderRadius: round.full,
  },
  scene: { flex: 1 },
  marker: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 9 },
  markerDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerLabel: {
    backgroundColor: ui.scrim.strong,
    borderRadius: 9,
    paddingHorizontal: space.xs,
    paddingVertical: 6,
  },
  bottom: { paddingHorizontal: space.gutter, gap: space.cardGap },
  panel: {
    backgroundColor: 'rgba(8,7,14,.66)',
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    borderRadius: round.media - 2,
    padding: space.cardGap,
    gap: 11,
  },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between' },
  pinRow: { flexDirection: 'row', gap: 7 },
  pin: { flex: 1, height: 38, borderRadius: 10 },
  pinEmpty: {
    backgroundColor: 'rgba(237,234,227,.05)',
    borderWidth: 1,
    borderColor: 'rgba(237,234,227,.3)',
    borderStyle: 'dashed',
  },
});
