import { duration, size, space } from '@cw/tokens';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSkin } from '@/providers';
import { useHeroStore } from '@/store/heroStore';

/**
 * The palette's own bands, flying from the card to the screen it opens.
 *
 * **Why the destination is computed rather than measured.** Measuring it would
 * mean the incoming screen reporting its layout back across the navigator, and
 * the flight could not start until it had — which is one or two frames after
 * the push, by which time the transition it is meant to be part of has begun
 * without it. Palette detail's hero is deterministic (full width, fixed height,
 * directly under the nav row), so the destination is known before the screen
 * that owns it exists.
 *
 * The overlay fades out over the last third of the flight, which is also what
 * covers any disagreement between the computed destination and the real one:
 * by the time the two could be compared, only the real one is opaque.
 */

/** Must match `styles.hero` in `PaletteDetailScreen`. */
export const HERO_HEIGHT = 380;

/** The nav row above it: one 44pt hit target plus its padding. */
const NAV_BLOCK = size.hitTarget + space.sm * 2;

export function HeroOverlay() {
  const { colors, from } = useHeroStore();
  const end = useHeroStore((state) => state.end);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const skin = useSkin();

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!from || !colors) return;
    if (reduced) {
      // No flight. The push itself still happens; this simply does not add a
      // second moving thing to a screen change someone asked to hold still.
      end();
      return;
    }
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: duration.scene * 0.72, easing: Easing.out(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(end)();
      },
    );
  }, [from, colors, reduced, progress, end]);

  const destination = {
    x: 0,
    y: insets.top + NAV_BLOCK,
    width,
    height: HERO_HEIGHT,
  };

  const style = useAnimatedStyle(() => {
    const t = progress.value;
    const lerp = (a: number, b: number) => a + (b - a) * t;
    return {
      left: lerp(from?.x ?? 0, destination.x),
      top: lerp(from?.y ?? 0, destination.y),
      width: lerp(from?.width ?? 0, destination.width),
      height: lerp(from?.height ?? 0, destination.height),
      // Held opaque while it is doing the work, gone before it could be
      // compared against the hero it hands over to.
      opacity: t < 0.66 ? 1 : 1 - (t - 0.66) / 0.34,
      // Squares off as it arrives: the card is rounded, the hero is not.
      borderRadius: lerp(10, 0),
    };
  });

  if (!from || !colors || reduced) return null;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.overlay, { backgroundColor: skin.ui.bg.media }, style]}
    >
      {colors.map((color, index) => (
        <View
          key={`${index}:${color.hex}`}
          style={{ flex: color.weight, backgroundColor: color.hex }}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    flexDirection: 'row',
    overflow: 'hidden',
    zIndex: 40,
  },
});
