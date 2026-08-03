import { round, space, ui } from '@chromawave/design-tokens';
import { makeColor, type Color } from '@chromawave/domain';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useImageSampler } from '@/hooks/useImageSampler';
import { hapticsService } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Card, Chip, NavBar, Screen, Slider, Text } from '@/ui';

const MODES = ['MANUAL', 'AUTO 5', 'EDGES'] as const;
const MAX_POINTS = 8;

type Point = { x: number; y: number; hex: string };

/**
 * G2 · IMPORT & PICK · "manual sample points, adjustable radius".
 *
 * Sampling is real: Skia decodes the imported photo and `sampleAt` averages a
 * disc of pixels — in linear light — around the tapped point, which is what the
 * "SAMPLE RADIUS · AVERAGED" control adjusts.
 */
export function ImportPickScreen({
  onCancel,
  onExtract,
}: {
  onCancel: () => void;
  onExtract: (colors: readonly Color[]) => void;
}) {
  const { t } = usePreferences();
  const [uri, setUri] = useState<string | null>(null);
  const [points, setPoints] = useState<readonly Point[]>([]);
  const [radius, setRadius] = useState(12);
  const [mode, setMode] = useState<(typeof MODES)[number]>('MANUAL');
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [pickFailed, setPickFailed] = useState(false);
  const { sampleAt, dimensions, ready, failed } = useImageSampler(uri);

  /**
   * Opens the photo library. Exposed as an action as well as run on mount: if
   * the first pick is cancelled, or is simply the wrong photo, the screen would
   * otherwise be a dead end with no way back to the picker.
   */
  const pick = useCallback(async () => {
    setPickFailed(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 1 });
      // The picker can resolve to nothing at all when the sheet is dismissed by
      // the system rather than by the user, so the shape is checked, not assumed.
      const picked = result?.canceled === false ? result.assets?.[0]?.uri : undefined;
      if (!picked) return;
      setUri(picked);
      // Points are positions in the old photo; keeping them would label the new
      // one with colours it does not contain.
      setPoints([]);
      setMode('MANUAL');
    } catch {
      setPickFailed(true);
    }
  }, []);

  useEffect(() => {
    void pick();
  }, [pick]);

  /**
   * Samples one view coordinate. The photo is drawn with `cover`, so view
   * coordinates map to image coordinates through the same scale-and-crop the
   * renderer applied — sampling the raw view position would read the wrong pixel
   * on any photo whose aspect ratio differs from the frame.
   */
  const sampleView = (x: number, y: number): string | null => {
    if (!dimensions || layout.width === 0) return null;
    const scale = Math.max(dimensions.width / layout.width, dimensions.height / layout.height);
    const cropX = (dimensions.width - layout.width * scale) / 2;
    const cropY = (dimensions.height - layout.height * scale) / 2;
    return sampleAt(cropX + x * scale, cropY + y * scale, radius * scale);
  };

  const addPoint = (x: number, y: number) => {
    if (points.length >= MAX_POINTS) return;
    const hex = sampleView(x, y);
    if (!hex) return;

    setPoints((current) => [...current, { x, y, hex }]);
    // BUILD KIT · haptic map: "colour pinned (scan) → impact · light".
    void hapticsService.fire('colourPinned');
  };

  /**
   * AUTO 5 and EDGES are placements, not filters: each lays its own points down
   * and replaces whatever was there, which is what makes them worth tapping.
   * AUTO 5 takes the rule-of-thirds intersections plus the centre — where a
   * photograph's subject usually is. EDGES walks the border, where the ground
   * and the frame colours live.
   */
  const applyMode = (next: (typeof MODES)[number]) => {
    setMode(next);
    if (next === 'MANUAL') {
      setPoints([]);
      return;
    }

    const { width, height } = layout;
    if (width === 0 || height === 0) return;

    const targets: readonly [number, number][] =
      next === 'AUTO 5'
        ? [
            [width / 3, height / 3],
            [(width * 2) / 3, height / 3],
            [width / 2, height / 2],
            [width / 3, (height * 2) / 3],
            [(width * 2) / 3, (height * 2) / 3],
          ]
        : [
            [width / 2, height * 0.08],
            [width * 0.92, height / 2],
            [width / 2, height * 0.92],
            [width * 0.08, height / 2],
            [width / 2, height / 2],
          ];

    const placed = targets
      .map(([x, y]) => {
        const hex = sampleView(x, y);
        return hex ? { x, y, hex } : null;
      })
      .filter((point): point is Point => point !== null);

    if (!placed.length) return;
    setPoints(placed.slice(0, MAX_POINTS));
    void hapticsService.fire('colourPinned');
  };

  /** Tapping a placed point removes it — otherwise a misplaced tap is permanent. */
  const removePoint = (index: number) => {
    setPoints((current) => current.filter((_, entry) => entry !== index));
  };

  const extract = () => {
    const weight = Math.round((1 / points.length) * 1000) / 1000;
    const roles = ['dominant', 'support', 'signal'] as const;
    const colors = points.map((point, index) =>
      makeColor(point.hex, weight, roles[index] ?? 'extra'),
    );
    const drift = 1 - colors.reduce((sum, color) => sum + color.weight, 0);
    const first = colors[0];
    if (first) colors[0] = { ...first, weight: Math.round((first.weight + drift) * 1000) / 1000 };
    onExtract(colors);
  };

  return (
    <Screen>
      <NavBar
        leading={t('import.cancel')}
        onLeading={onCancel}
        onTrailing={points.length >= 2 ? extract : undefined}
        title={t('import.title')}
        trailing={t('import.extract')}
      />

      <View style={styles.canvasWrap}>
        <Pressable
          accessibilityHint={t('import.tapHint')}
          accessibilityLabel={t('import.tapLabel')}
          accessibilityRole="button"
          onLayout={(event) => setLayout(event.nativeEvent.layout)}
          onPress={(event) => addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY)}
          style={styles.canvas}
        >
          {uri ? (
            <Image contentFit="cover" source={{ uri }} style={StyleSheet.absoluteFill} />
          ) : (
            <Text tone="quaternary" variant="chip">
              {t('import.photo')}
            </Text>
          )}
          {points.map((point, index) => (
            <Pressable
              accessibilityLabel={t('import.removePoint', { hex: point.hex })}
              accessibilityRole="button"
              key={index}
              onPress={() => removePoint(index)}
              style={[
                styles.point,
                {
                  left: point.x - 15,
                  top: point.y - 15,
                  backgroundColor: point.hex,
                  width: Math.max(24, radius * 2.5),
                  height: Math.max(24, radius * 2.5),
                  borderRadius: Math.max(12, radius * 1.25),
                },
              ]}
            />
          ))}
          <View style={styles.canvasHint}>
            <Text tone="secondary" variant="chip">
              {failed || pickFailed
                ? t('import.failed')
                : ready
                  ? t('import.points', { count: points.length, max: MAX_POINTS })
                  : t('import.decoding')}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.controlHead}>
          <Text tone="secondary" variant="eyebrow">
            {t('import.radius')}
          </Text>
          <Text variant="chip">{t('import.radiusValue', { px: Math.round(radius) })}</Text>
        </View>
        <Slider
          label={t('import.radius')}
          maximumValue={40}
          minimumValue={2}
          onChange={setRadius}
          value={radius}
          valueText={`${Math.round(radius)} pixels`}
        />
        <View style={styles.modes}>
          {MODES.map((entry) => (
            <Chip
              fill
              key={entry}
              label={entry}
              onPress={() => applyMode(entry)}
              tone={mode === entry ? 'pro' : 'default'}
            />
          ))}
        </View>
        <Chip
          fill
          label={t(uri ? 'import.changePhoto' : 'import.choosePhoto')}
          onPress={() => void pick()}
        />
      </View>

      <View style={styles.preview}>
        {Array.from({ length: 4 }, (_, index) => {
          const point = points[index];
          return point ? (
            <View key={index} style={[styles.swatch, { backgroundColor: point.hex }]}>
              <Text style={styles.swatchLabel} variant="monoSmall">
                {point.hex.slice(1)}
              </Text>
            </View>
          ) : (
            <View key={`empty-${index}`} style={[styles.swatch, styles.swatchEmpty]} />
          );
        })}
      </View>

      {points.length < 2 ? (
        <Card style={styles.hint}>
          <Text tone="secondary" variant="body">
            {t('import.hint')}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvasWrap: { paddingHorizontal: space.gutter, paddingTop: space.md },
  canvas: {
    height: 400,
    borderRadius: round.media,
    backgroundColor: ui.bg.media,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  point: { position: 'absolute', borderWidth: 3, borderColor: '#FFFFFF' },
  canvasHint: {
    position: 'absolute',
    right: space.cardGap,
    bottom: space.cardGap,
    backgroundColor: ui.scrim.strong,
    borderRadius: 11,
    paddingHorizontal: space.xs,
    paddingVertical: 8,
  },
  controls: { paddingHorizontal: space.gutter, paddingTop: space.md + 2, gap: space.sm },
  controlHead: { flexDirection: 'row', justifyContent: 'space-between' },
  modes: { flexDirection: 'row', gap: space.xs },
  preview: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.gutter,
    paddingTop: space.gutter,
  },
  swatch: {
    flex: 1,
    height: 56,
    borderRadius: round.control,
    justifyContent: 'flex-end',
    padding: space.xs,
  },
  swatchLabel: { color: 'rgba(255,255,255,.9)' },
  swatchEmpty: {
    backgroundColor: 'rgba(237,234,227,.05)',
    borderWidth: 1,
    borderColor: 'rgba(237,234,227,.28)',
    borderStyle: 'dashed',
  },
  hint: { marginHorizontal: space.gutter, marginTop: space.md },
});
