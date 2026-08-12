import { resolveGrade, type Grade, type Storyboard } from '@cw/domain';
import { Canvas, Fill, ImageShader, Shader, Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { GRADE_SHADER, gradeUniforms } from '@/lib/grade';

/**
 * The photograph, graded and drifting, under everything else.
 *
 * **The drift runs on the UI thread and never reads the clock.** It is one
 * timing over the whole runtime, handed to Reanimated once; a transform driven
 * from React state would re-render the tree sixteen times a second to move a
 * picture by a pixel, and would stutter on exactly the devices this has to look
 * expensive on.
 *
 * The grade is the one the memory already carries, so the performance shows the
 * photograph as its owner graded it rather than as it came off the sensor.
 */
export function LivingStage({
  image,
  grade,
  storyboard,
  playing,
  width,
  height,
}: {
  image: SkImage;
  grade: Grade;
  storyboard: Storyboard;
  playing: boolean;
  width: number;
  height: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!playing) return;
    progress.value = withTiming(1, {
      duration: storyboard.totalMs,
      // Linear: the drift is a camera move, and a camera move that eases is a
      // camera move you notice.
      easing: Easing.linear,
    });
    return () => {
      progress.value = 0;
    };
  }, [playing, progress, storyboard.totalMs]);

  const style = useAnimatedStyle(() => {
    const { fromScale, toScale, panX, panY } = storyboard.drift;
    const scale = fromScale + (toScale - fromScale) * progress.value;
    return {
      transform: [
        { scale },
        { translateX: panX * width * progress.value },
        { translateY: panY * height * progress.value },
      ],
    };
  });

  const effect = useMemo(() => Skia.RuntimeEffect.Make(GRADE_SHADER), []);
  const uniforms = useMemo(
    () => gradeUniforms(resolveGrade(grade), width, height),
    [grade, width, height],
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {effect ? (
        <Canvas style={{ width, height }}>
          <Fill>
            <Shader source={effect} uniforms={uniforms}>
              <ImageShader
                fit="cover"
                height={height}
                image={image}
                rect={{ x: 0, y: 0, width, height }}
                width={width}
              />
            </Shader>
          </Fill>
        </Canvas>
      ) : null}
    </Animated.View>
  );
}

/**
 * The colour bands, breathing at the rate the reading asked for.
 *
 * Their proportions are the palette's own weights, so the band that is widest is
 * the colour the photograph is actually most made of — the same claim the library
 * card and the detail hero make, in motion.
 */
export function LivingBands({
  colors,
  pulseMs,
  playing,
}: {
  colors: readonly { hex: string; weight: number }[];
  pulseMs: number;
  playing: boolean;
}) {
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!playing) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: pulseMs, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [breath, playing, pulseMs]);

  return (
    <View pointerEvents="none" style={styles.bands}>
      {colors.map((color) => (
        <Band breath={breath} hex={color.hex} key={color.hex} weight={color.weight} />
      ))}
    </View>
  );
}

function Band({
  hex,
  weight,
  breath,
}: {
  hex: string;
  weight: number;
  breath: SharedValue<number>;
}) {
  // Each band takes its share of the width from the palette, and only its
  // opacity breathes — a band that changed width would change what the palette
  // claims about the photograph.
  const style = useAnimatedStyle(() => ({ opacity: 0.55 + breath.value * 0.45 }));
  return <Animated.View style={[{ flex: weight, backgroundColor: hex }, style]} />;
}

const styles = StyleSheet.create({
  bands: { flexDirection: 'row', height: 6, width: '100%' },
});
