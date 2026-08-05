import { brandBands, motionRules, round, ui, uiMotion } from '@chromawave/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { BandSweepCanvas } from './BandCanvas';
import { SwatchStrip } from './Swatch';

/**
 * BUILD KIT · 03 · LIVE LOOPS.
 *
 * All four honour the reduce-motion rule: "every sweep becomes a static
 * three-band bar; durations drop to 0 except opacity at 120ms." Each component
 * therefore has a real static fallback, not a frozen animation.
 */

/**
 * LOADING · BAND SWEEP — "1100ms · alternate · replaces every spinner".
 *
 * There is no spinner anywhere in this product; this is what stands in for one.
 */
export function BandSweep({
  height = 120,
  colors = brandBands,
}: {
  height?: number;
  colors?: readonly string[];
}) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  // Reduce-motion: "every sweep becomes a static three-band bar".
  if (reduced) {
    return (
      <View accessibilityLabel="Loading" style={[styles.clip, { height }]}>
        <StaticBands colors={colors} height={Math.max(12, height * 0.14)} />
      </View>
    );
  }

  return (
    <View accessibilityLabel="Loading" style={[styles.clip, { height }]}>
      <BandSweepCanvas colors={colors} height={height} width={width - 40} />
    </View>
  );
}

/**
 * SKELETON · SHIMMER — "1400ms · linear · violet at 22%, never white".
 * The white shimmer every other app uses would read as a highlight on the glass.
 */
export function Shimmer({ children, height }: { children?: React.ReactNode; height?: number }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withRepeat(
      withTiming(1, { duration: uiMotion.shimmer.duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [reduced, progress]);

  const band = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + progress.value * (width * 3.2) }],
  }));

  return (
    <View accessibilityLabel="Loading" style={[styles.shimmerRoot, height ? { height } : null]}>
      {children}
      {reduced ? null : (
        <Animated.View
          pointerEvents="none"
          style={[styles.shimmerBand, { width: width * 0.4 }, band]}
        >
          <LinearGradient
            colors={['transparent', uiMotion.shimmer.tint, 'transparent']}
            end={{ x: 1, y: 0 }}
            start={{ x: 0, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * LIVE READ · PULSE — "1200ms · 200ms stagger · viewfinder confidence".
 * Three dots, one per band, breathing out of phase.
 */
export function LiveReadPulse({ colors = brandBands }: { colors?: readonly string[] }) {
  const reduced = useReducedMotion();
  return (
    <View accessibilityLabel="Reading light" style={styles.pulseRow}>
      {colors.slice(0, 3).map((hex, index) => (
        <PulseDot color={hex} index={index} key={hex} reduced={reduced} />
      ))}
    </View>
  );
}

function PulseDot({ color, index, reduced }: { color: string; index: number; reduced: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    const start = setTimeout(() => {
      progress.value = withRepeat(
        withTiming(1, {
          duration: uiMotion.livePulse.duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    }, index * uiMotion.livePulse.stagger);
    return () => {
      clearTimeout(start);
      cancelAnimation(progress);
    };
  }, [index, reduced, progress]);

  const style = useAnimatedStyle(() => {
    const { minOpacity, minScale } = uiMotion.livePulse;
    return {
      opacity: minOpacity + progress.value * (1 - minOpacity),
      transform: [{ scale: minScale + progress.value * (1 - minScale) }],
    };
  });

  return (
    <Animated.View style={[styles.pulseDot, { backgroundColor: color }, reduced ? null : style]} />
  );
}

/**
 * SYNC · ORBIT — "1600ms · linear · the only rotating element in the app".
 * The DO NOT list forbids rotating the mark; these are bare arcs, not the mark.
 */
export function SyncOrbit({
  size = 72,
  colors = brandBands,
}: {
  size?: number;
  colors?: readonly string[];
}) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(
      withTiming(1, { duration: uiMotion.syncOrbit.duration, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(spin);
  }, [reduced, spin]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  return (
    <Animated.View
      accessibilityLabel="Syncing"
      style={[{ width: size, height: size }, reduced ? null : style]}
    >
      <Svg height={size} viewBox="0 0 200 200" width={size}>
        {colors.slice(0, 3).map((hex, index) => (
          <Circle
            cx={100}
            cy={100}
            fill="none"
            key={hex}
            opacity={0.9}
            r={40 + index * 13}
            stroke={hex}
            strokeDasharray={`${60 + index * 30} 400`}
            strokeLinecap="round"
            strokeWidth={8}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** The reduce-motion substitute the kit prescribes: a static three-band bar. */
export function StaticBands({
  colors = brandBands,
  height = 12,
}: {
  colors?: readonly string[];
  height?: number;
}) {
  return (
    <SwatchStrip
      colors={colors.slice(0, 3).map((hex) => ({ hex, weight: 1 }))}
      height={height}
      radius={height / 2}
    />
  );
}

/**
 * Announces a long-running operation to assistive tech. The loops are decorative
 * once a label exists, so this keeps the announcement separate from the visuals.
 */
export function announceBusy(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

/** The stagger helper the motion rules define: 60ms apart, chain capped at 5. */
export function staggerDelay(index: number): number {
  return Math.min(index, motionRules.staggerCap - 1) * motionRules.stagger;
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderRadius: round.control,
    backgroundColor: ui.bg.media,
    justifyContent: 'center',
  },
  sweepLayer: { position: 'absolute', left: '-35%' },
  shimmerRoot: { overflow: 'hidden', position: 'relative' },
  shimmerBand: { position: 'absolute', top: 0, bottom: 0 },
  pulseRow: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  pulseDot: { width: 34, height: 34, borderRadius: 17 },
});
