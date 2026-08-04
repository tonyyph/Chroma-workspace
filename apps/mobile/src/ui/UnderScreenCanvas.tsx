import { brandBands, ui } from '@chromawave/design-tokens';
import { Blur, Canvas, Group, Paint, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * The drifting colour field that sits under every screen.
 *
 * It is the brand's three bands at very low opacity, blurred past the point of
 * being readable as shapes, moving slowly enough that it registers as depth
 * rather than motion. Screens paint their own opaque grounds on top; this only
 * shows through the app background.
 *
 * **Why Skia and not a looping image.** The bands are the same sine geometry the
 * mark is built from, so they stay in the family at any screen size, and one
 * shader-backed canvas costs less than a full-screen video or a stack of
 * animated views.
 *
 * Three separate guards can switch it off: the OS reduce-motion setting, the
 * user's own preference, and the parent not rendering it at all. The first is
 * not overridable by the second — a system-level accessibility choice wins.
 */
export function UnderScreenCanvas({ enabled = true }: { enabled?: boolean }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);

  // Honours the kit's reduced-motion rule: the field is still drawn, so the
  // ground keeps its depth, but nothing moves.
  const animate = enabled && !reduced;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(drift);
      drift.value = 0;
      return;
    }
    drift.value = withRepeat(
      // 24 seconds end to end. Fast enough to notice if you look, slow enough
      // that you do not.
      withTiming(1, { duration: 24_000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(drift);
  }, [animate, drift]);

  const paths = useMemo(
    () => brandBands.map((_, index) => bandPath(width, height, index)),
    [width, height],
  );

  // One derived value per band, each offset in phase so they separate and
  // regroup rather than sliding as a block.
  const transforms = [
    useDerivedValue(() => [
      { translateY: drift.value * 46 - 23 },
      { translateX: drift.value * 18 },
    ]),
    useDerivedValue(() => [
      { translateY: -drift.value * 38 + 19 },
      { translateX: -drift.value * 24 },
    ]),
    useDerivedValue(() => [
      { translateY: drift.value * 30 - 15 },
      { translateX: drift.value * 30 },
    ]),
  ];

  if (!enabled) return null;

  return (
    <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, styles.canvas]}>
      <Group
        layer={
          <Paint>
            {/* Blurred well past legibility: this is a wash, not a graphic. */}
            <Blur blur={64} />
          </Paint>
        }
      >
        {paths.map((path, index) => (
          <Group key={index} transform={transforms[index] ?? IDENTITY}>
            <Path
              color={brandBands[index] ?? brandBands[0]}
              opacity={0.12}
              path={path}
              style="fill"
            />
          </Group>
        ))}
      </Group>
    </Canvas>
  );
}

/** Used when a transform is somehow missing, so the band still draws in place. */
const IDENTITY = [{ translateY: 0 }, { translateX: 0 }];

/**
 * A soft horizontal band across the screen, one per brand colour, spaced down
 * the height. Built from the same sine the mark's waves use so the backdrop and
 * the logo share a hand.
 */
function bandPath(width: number, height: number, index: number): SkPath {
  const path = Skia.Path.Make();
  const centre = height * (0.28 + index * 0.22);
  const amplitude = height * 0.06;
  const thickness = height * 0.16;
  const steps = 24;

  path.moveTo(-width * 0.2, centre);
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const x = -width * 0.2 + t * width * 1.4;
    path.lineTo(x, centre + Math.sin(t * Math.PI * 2 + index) * amplitude);
  }
  for (let step = steps; step >= 0; step--) {
    const t = step / steps;
    const x = -width * 0.2 + t * width * 1.4;
    path.lineTo(x, centre + Math.sin(t * Math.PI * 2 + index) * amplitude + thickness);
  }
  path.close();
  return path;
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: ui.bg.base },
});
