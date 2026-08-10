import { brandBands, motionRules, uiMotion } from '@chromawave/design-tokens';
import {
  Blur,
  Canvas,
  Group,
  Paint,
  Path,
  Rect,
  Skia,
  type SkPath,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSkin } from '@/providers';
import { sine } from './BandField';

/**
 * A blurred offscreen layer.
 *
 * `Group.layer` takes a *Paint*; `Blur` is an image filter and has to sit inside
 * one. Passing the filter directly type-checks — the prop widens to any child
 * node — but produces an invalid layer at render time.
 */
const blurLayer = (sigma: number) => (
  <Paint>
    <Blur blur={sigma} />
  </Paint>
);

/**
 * The band field, rendered on the GPU.
 *
 * BUILD KIT · 08: "Run band blur on the GPU (Skia), never re-render SVG per
 * frame", and § 04: "band blur: one Skia layer, σ scales with size". This
 * replaces `BandField`'s `react-native-svg` Gaussian filter everywhere the field
 * animates. `BandField` is kept for static rendering — the asset pipeline and
 * anything that needs a plain SVG tree.
 *
 * σ is expressed relative to height so a 90pt strip and a 250pt hero blur alike.
 */
export function BandCanvas({
  width,
  height,
  colors = brandBands,
  background,
  /** Blur σ at this height. Defaults to the document's ratio, 13/200. */
  blur,
  strokeWidth,
  style,
}: {
  width: number;
  height: number;
  colors?: readonly string[];
  background?: string;
  blur?: number;
  strokeWidth?: number;
  style?: object;
}) {
  const sigma = blur ?? height * 0.065;
  const stroke = strokeWidth ?? height * 0.19;

  const paths = useMemo(
    () =>
      [0, 1, 2].map((i) =>
        Skia.Path.MakeFromSVGString(
          sine(height * (0.34 + i * 0.16), height * 0.1, 0.85, i * 1.1, -20, width + 20),
        ),
      ),
    [width, height],
  );

  return (
    <Canvas style={[{ width, height }, style]}>
      {background ? <Rect color={background} height={height} width={width} x={0} y={0} /> : null}
      {/* One Group carries the blur, so it is a single GPU layer for all three bands. */}
      <Group layer={blurLayer(sigma)} opacity={0.85}>
        {paths.map((path, i) =>
          path ? (
            <Path
              color={colors[i % colors.length] ?? brandBands[0]}
              key={i}
              path={path}
              strokeCap="round"
              strokeWidth={stroke}
              style="stroke"
            />
          ) : null,
        )}
      </Group>
    </Canvas>
  );
}

/**
 * LOADING · BAND SWEEP on the GPU — "1100ms · alternate · replaces every
 * spinner". The whole field translates inside one blurred layer, so the blur is
 * computed once per frame rather than per band.
 */
export function BandSweepCanvas({
  width,
  height,
  colors = brandBands,
}: {
  width: number;
  height: number;
  colors?: readonly string[];
}) {
  const skin = useSkin();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const travel = width * 0.38;

  useEffect(() => {
    if (reduced) return;
    progress.value = withRepeat(
      withTiming(1, {
        duration: uiMotion.bandSweep.duration,
        easing: Easing.bezier(...uiMotion.bandSweep.easing),
      }),
      -1,
      // "alternate" — the sweep reverses; a jump back would read as undo.
      true,
    );
    return () => cancelAnimation(progress);
  }, [reduced, progress]);

  const offset = useDerivedValue(() => (reduced ? 0 : -travel + progress.value * travel * 2));

  const paths = useMemo(
    () =>
      [0, 1, 2].map((i) =>
        Skia.Path.MakeFromSVGString(
          sine(
            height * (0.34 + i * 0.16),
            height * 0.1,
            0.9,
            i * 1.1,
            -travel - 40,
            width + travel + 40,
          ),
        ),
      ),
    [width, height, travel],
  );

  const transform = useDerivedValue(() => [{ translateX: offset.value }]);

  return (
    <Canvas style={{ width, height }}>
      <Rect color={skin.ui.bg.media} height={height} width={width} x={0} y={0} />
      <Group layer={blurLayer(height * 0.13)} opacity={0.85} transform={transform}>
        {paths.map((path, i) =>
          path ? (
            <Path
              color={colors[i % colors.length] ?? brandBands[0]}
              key={i}
              path={path}
              strokeCap="round"
              strokeWidth={height * 0.26}
              style="stroke"
            />
          ) : null,
        )}
      </Group>
    </Canvas>
  );
}

/**
 * The 620ms scan sweep from the capture storyboard, which the kit assigns to
 * Skia by name (`scan-sweep · SKIA · NATIVE`). A single cyan band crosses the
 * frame once; `progress` is driven by the capture sequence so the sweep stays in
 * step with the freeze and the swatch drop.
 */
export function ScanSweep({
  width,
  height,
  progress,
  color = brandBands[1],
}: {
  width: number;
  height: number;
  progress: { value: number };
  color?: string;
}) {
  const path = useMemo(
    () => Skia.Path.MakeFromSVGString(sine(height * 0.5, height * 0.05, 0.85, 0, -20, width + 20)),
    [width, height],
  );

  // Travels a full frame width plus its own blur radius, so it enters and exits
  // cleanly rather than fading in place.
  const transform = useDerivedValue(() => [{ translateX: -width + progress.value * width * 2 }]);
  const opacity = useDerivedValue(() => (progress.value <= 0 || progress.value >= 1 ? 0 : 0.9));

  if (!path) return null;

  return (
    <Canvas pointerEvents="none" style={{ width, height }}>
      <Group layer={blurLayer(height * 0.04)} opacity={opacity} transform={transform}>
        <Path
          color={color}
          path={path}
          strokeCap="round"
          strokeWidth={height * 0.09}
          style="stroke"
        />
      </Group>
    </Canvas>
  );
}

/** Shared helper so callers can pre-build a band path off the render path. */
export function bandPath(index: number, width: number, height: number): SkPath | null {
  return Skia.Path.MakeFromSVGString(
    sine(height * (0.34 + index * 0.16), height * 0.1, 0.85, index * 1.1, -20, width + 20),
  );
}

/** The reduce-motion substitute, drawn in Skia so it shares the same canvas. */
export const reducedMotionOpacityDuration = motionRules.reducedMotion.opacityDuration;
