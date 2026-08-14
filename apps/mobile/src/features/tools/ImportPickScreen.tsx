import { evenlyWeightedColors, type Color } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useImageSampler } from '@/hooks';
import { hapticsService } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers';
import {
  Button,
  Card,
  Chip,
  Gutter,
  NavBar,
  Pressable,
  Screen,
  Slider,
  Text,
  useStyles,
} from '@/ui';

const MODES = ['AUTO', 'MANUAL', 'EDGES'] as const;
const MAX_POINTS = 8;

type Point = { x: number; y: number; hex: string };

/**
 * G2 · PICK POINTS — the refinement, not the way in.
 *
 * This screen used to be the import path: it launched the system picker from an
 * effect on mount, and cancelling that picker left an empty canvas above a
 * radius slider and three mode chips that could do nothing without a photo. It
 * was also titled for its advanced case — the automatic whole-image read had
 * already produced a palette before anyone tapped anything.
 *
 * So it takes the photograph as a prop now. It is reached from a palette that
 * exists, by someone who has seen the colours it found and wants different
 * ones. There is no picker to cancel and nothing to be stranded by.
 */
export function ImportPickScreen({
  uri,
  colors: found,
  onCancel,
  onPick,
}: {
  /** The photograph, already local and already decodable. */
  uri: string;
  /** What the automatic read found — what these points are an argument with. */
  colors: readonly Color[];
  onCancel: () => void;
  /** The hand-placed colours, replacing the ones the palette carries. */
  onPick: (colors: readonly Color[]) => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const [points, setPoints] = useState<readonly Point[]>([]);
  const [radius, setRadius] = useState(12);
  const [mode, setMode] = useState<(typeof MODES)[number]>('AUTO');
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const { sampleAt, dimensions, ready, failed } = useImageSampler(uri);

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
   * The three modes are three ways of deciding which colours the photo yields.
   *
   * AUTO is the whole-image read and needs no points at all. MANUAL clears them
   * so the user places their own. EDGES samples the border, where the ground and
   * frame colours live and where a subject-weighted read under-represents them.
   */
  const applyMode = (next: (typeof MODES)[number]) => {
    setMode(next);
    if (next !== 'EDGES') {
      setPoints([]);
      return;
    }

    const { width, height } = layout;
    if (width === 0 || height === 0) return;

    const placed = (
      [
        [width / 2, height * 0.08],
        [width * 0.92, height / 2],
        [width / 2, height * 0.92],
        [width * 0.08, height / 2],
        [width / 2, height / 2],
      ] as const
    )
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

  /**
   * Two points is the floor. Below that this screen has nothing to say that the
   * palette does not already say better, so the action stays off rather than
   * quietly replacing five measured colours with one tapped one.
   */
  const usingPoints = points.length >= 2;

  const pick = () => {
    if (!usingPoints) return;
    // A tapped point is a deliberate choice, so the points split the palette
    // evenly and take their roles from the order they were placed in.
    onPick(evenlyWeightedColors(points.map((point) => point.hex)));
  };

  /** What the swatch row shows: the placed points, or what is being replaced. */
  const preview: readonly string[] = usingPoints
    ? points.map((point) => point.hex)
    : found.map((color) => color.hex);

  return (
    <Screen>
      {/*
        No trailing action.

        `NavBar` draws its trailing label as a link whatever it is handed, so an
        `onTrailing` that is conditionally undefined leaves an EXTRACT that
        looks live and does nothing until two points exist. The button at the
        bottom was already the same action in the same condition — one action in
        one place, and it appears only when it can be taken.
      */}
      <NavBar leading={t('import.cancel')} onLeading={onCancel} title={t('import.title')} />

      <View style={styles.canvasWrap}>
        <Pressable
          accessibilityHint={t('import.tapHint')}
          accessibilityLabel={t('import.tapLabel')}
          accessibilityRole="button"
          onLayout={(event) => setLayout(event.nativeEvent.layout)}
          onPress={(event) => addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY)}
          style={styles.canvas}
        >
          <Image contentFit="cover" source={{ uri }} style={StyleSheet.absoluteFill} />
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
              {failed
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
              label={t(`import.mode.${entry.toLowerCase() as Lowercase<typeof entry>}`)}
              onPress={() => applyMode(entry)}
              tone={mode === entry ? 'pro' : 'default'}
            />
          ))}
        </View>
      </View>

      <View style={styles.preview}>
        {Array.from({ length: 5 }, (_, index) => {
          const hex = preview[index];
          return hex ? (
            <View key={`${hex}-${index}`} style={[styles.swatch, { backgroundColor: hex }]}>
              <Text style={styles.swatchLabel} variant="monoSmall">
                {hex.slice(1)}
              </Text>
            </View>
          ) : (
            <View key={`empty-${index}`} style={[styles.swatch, styles.swatchEmpty]} />
          );
        })}
      </View>

      {usingPoints ? (
        <Gutter style={styles.cinematic}>
          <Button label={t('import.extract')} onPress={pick} size="lg" variant="contrast" />
        </Gutter>
      ) : (
        <Card style={styles.hint}>
          <Text tone="secondary" variant="body">
            {t('import.hint')}
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    canvasWrap: { paddingHorizontal: space.gutter, paddingTop: space.md },
    canvas: {
      height: 400,
      borderRadius: skin.round.media,
      backgroundColor: skin.ui.bg.media,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    point: { position: 'absolute', borderWidth: 3, borderColor: '#FFFFFF' },
    canvasHint: {
      position: 'absolute',
      right: space.cardGap,
      bottom: space.cardGap,
      backgroundColor: skin.ui.scrim.strong,
      borderRadius: skin.round.chip,
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
      borderRadius: skin.round.control,
      justifyContent: 'flex-end',
      padding: space.xs,
    },
    swatchLabel: { color: 'rgba(255,255,255,.9)' },
    swatchEmpty: {
      backgroundColor: skin.ui.fill.chipGhost,
      borderWidth: 1,
      borderColor: skin.ui.border.control,
      borderStyle: 'dashed',
    },
    cinematic: { paddingTop: space.md },
    hint: { marginHorizontal: space.gutter, marginTop: space.md },
  });
