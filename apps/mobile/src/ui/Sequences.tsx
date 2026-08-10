import { brandBands, easing, motionRules, storyboard } from '@chromawave/design-tokens';
import { useEffect } from 'react';
import { RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BrandMark } from '@/components';
import { useSkin } from '@/providers';
import { BandCanvas } from './BandCanvas';
import { Text } from './Text';

/**
 * BUILD KIT · 02 · FRAME STORYBOARDS, implemented in Reanimated.
 *
 * The kit assigns the band blur to Skia; `react-native-skia` is not a dependency
 * yet, so the blurred bands come from `react-native-svg`'s Gaussian filter and
 * only the transforms run on the UI thread. That is the one gap against the
 * "60fps or it doesn't ship" gate, and it is why the launch sequence is offered
 * rather than forced — see `docs/24-build-kit.md`.
 */

const LAUNCH = storyboard.launch;

/**
 * Cold launch · 1480ms · "no logo hold".
 * seed dot → band 1 → bands 2-3 → glass clips in → wordmark → hand-off.
 */
export function LaunchSequence({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const dot = useSharedValue(0);
  const bands = useSharedValue(0);
  const glass = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      // Reduce-motion: durations drop to 0, opacity crosses at 120ms.
      dot.value = 1;
      bands.value = 1;
      glass.value = 1;
      wordmark.value = 1;
      fade.value = withDelay(
        400,
        withTiming(0, { duration: motionRules.reducedMotion.opacityDuration }, (finished) => {
          if (finished) runOnJS(onDone)();
        }),
      );
      return;
    }

    dot.value = withTiming(1, {
      duration: LAUNCH.seedDot.at + 180,
      easing: Easing.bezier(...easing.standard),
    });
    bands.value = withDelay(
      LAUNCH.band1.at,
      withTiming(1, { duration: 240, easing: Easing.bezier(...easing.sweep) }),
    );
    glass.value = withDelay(
      LAUNCH.glassClip.at,
      withTiming(1, {
        duration: LAUNCH.glassClip.duration,
        easing: Easing.bezier(...easing.standard),
      }),
    );
    wordmark.value = withDelay(LAUNCH.wordmark.at, withTiming(1, { duration: 220 }));
    fade.value = withDelay(
      LAUNCH.handoff.at - LAUNCH.handoff.crossFade,
      withTiming(0, { duration: LAUNCH.handoff.crossFade }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );

    return () => {
      for (const value of [dot, bands, glass, wordmark, fade]) cancelAnimation(value);
    };
  }, [reduced, onDone, dot, bands, glass, wordmark, fade]);

  const root = useAnimatedStyle(() => ({ opacity: fade.value }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: 1 - glass.value,
    transform: [{ scale: dot.value }],
  }));
  const bandStyle = useAnimatedStyle(() => ({
    opacity: bands.value * (1 - glass.value * 0.4),
    transform: [{ translateX: (-0.4 + bands.value * 0.4) * width }],
  }));
  const glassStyle = useAnimatedStyle(() => ({
    opacity: glass.value,
    transform: [{ scale: 0.7 + glass.value * 0.3 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * LAUNCH.wordmark.rise }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.launch, root]}>
      <View style={styles.launchCentre}>
        <Animated.View style={[styles.seedDot, dotStyle]} />
        <Animated.View style={[styles.launchBands, { width, height: 220 }, bandStyle]}>
          <BandCanvas blur={9} height={220} width={width} />
        </Animated.View>
        <Animated.View style={glassStyle}>
          <BrandMark size={156} />
        </Animated.View>
        <Animated.View style={[styles.wordmark, wordStyle]}>
          <Text style={styles.wordmarkText}>Chroma Wave</Text>
        </Animated.View>
      </View>
      <View style={[styles.launchFooter, { top: height - 100 }]}>
        <Text tone="quaternary" variant="chip">
          1480MS · NO HOLD
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * Capture → extraction → result · 1240ms · NATIVE ONLY.
 * Returns the animated styles the capture screen composes; the sequence is a
 * hook rather than a component because it drives elements on three layers.
 */
export function useCaptureSequence(active: boolean, onSettled: () => void) {
  const reduced = useReducedMotion();
  const shutter = useSharedValue(1);
  const flash = useSharedValue(0);
  const scan = useSharedValue(0);
  const swatches = useSharedValue(0);
  const sheet = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    const C = storyboard.capture;

    if (reduced) {
      swatches.value = 1;
      sheet.value = 1;
      onSettled();
      return;
    }

    shutter.value = withSequence(
      withTiming(C.shutter.scale, { duration: C.shutter.duration }),
      withTiming(1, { duration: C.shutter.duration }),
    );
    flash.value = withDelay(
      C.freeze.at,
      withSequence(
        withTiming(C.freeze.flashOpacity, { duration: 40 }),
        withTiming(0, { duration: C.freeze.duration }),
      ),
    );
    scan.value = withDelay(
      C.scanSweep.at,
      withTiming(1, { duration: C.scanSweep.duration, easing: Easing.bezier(...easing.sweep) }),
    );
    swatches.value = withDelay(C.swatchesDrop.at, withTiming(1, { duration: 240 }));
    sheet.value = withDelay(
      C.sheetRise.at,
      withTiming(
        1,
        { duration: C.sheetRise.duration, easing: Easing.bezier(...easing.standard) },
        (finished) => {
          if (finished) runOnJS(onSettled)();
        },
      ),
    );

    return () => {
      for (const value of [shutter, flash, scan, swatches, sheet]) cancelAnimation(value);
    };
  }, [active, reduced, onSettled, shutter, flash, scan, swatches, sheet]);

  return {
    /** Raw progress for the Skia scan sweep, which draws rather than transforms. */
    scanProgress: scan,
    shutterStyle: useAnimatedStyle(() => ({ transform: [{ scale: shutter.value }] })),
    flashStyle: useAnimatedStyle(() => ({ opacity: flash.value })),
    scanStyle: useAnimatedStyle(() => ({
      opacity: scan.value > 0 && scan.value < 1 ? 0.9 : 0,
      transform: [{ translateX: (scan.value - 0.5) * 500 }],
    })),
    swatchStyle: useAnimatedStyle(() => ({
      opacity: swatches.value,
      transform: [{ translateY: (1 - swatches.value) * 20 }],
    })),
    sheetStyle: useAnimatedStyle(() => ({
      transform: [{ translateY: (1 - sheet.value) * 400 }],
    })),
  };
}

/**
 * Pull to refresh · DRAG-DRIVEN. "0-40pt one band · 40-70pt two · 70pt three ·
 * haptic · release · loop 1100ms."
 *
 * Built on the platform `RefreshControl` so the gesture, threshold and release
 * come from the OS; the band count is derived from its own progress rather than
 * a second gesture recogniser competing with the scroll view.
 */
export function BandRefreshControl({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const skin = useSkin();
  return (
    <RefreshControl
      colors={[...brandBands]}
      onRefresh={onRefresh}
      progressBackgroundColor={skin.ui.bg.raised}
      refreshing={refreshing}
      tintColor={brandBands[0]}
    />
  );
}

const styles = StyleSheet.create({
  launch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07060D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchCentre: { alignItems: 'center', justifyContent: 'center' },
  seedDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  launchBands: { position: 'absolute', overflow: 'hidden' },
  wordmark: { position: 'absolute', top: 126 },
  wordmarkText: {
    fontSize: 21,
    letterSpacing: 3.4,
    fontFamily: 'SpaceGrotesk_500Medium',
  },
  launchFooter: { position: 'absolute' },
});
