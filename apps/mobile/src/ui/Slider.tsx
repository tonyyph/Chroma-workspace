import { size, ui, uiShadow } from '@chromawave/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

/**
 * SYSTEM F slider: 10px track, 24px bone thumb with a soft drop shadow.
 *
 * Two track treatments appear in the design and both are supported here: a
 * `gradient` (hue, luminance, saturation ramps in B3) and a `fill` where a
 * violet bar grows from the left (sample radius in G2, angle in G5).
 */
export function Slider({
  value,
  onChange,
  gradient,
  label,
  valueText,
  minimumValue = 0,
  maximumValue = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  /** Two or more stops. When omitted the track shows a violet fill instead. */
  gradient?: readonly [string, string, ...string[]];
  label: string;
  /** Spoken value — "258 degrees" reads better than "0.72". */
  valueText?: string;
  minimumValue?: number;
  maximumValue?: number;
}) {
  const [width, setWidth] = useState(0);
  const fraction = useSharedValue(normalise(value, minimumValue, maximumValue));

  // Keep the thumb in step when the value changes from outside a drag.
  const external = normalise(value, minimumValue, maximumValue);
  if (Math.abs(external - fraction.value) > 0.001) fraction.value = external;

  const commit = (next: number) => {
    onChange(minimumValue + next * (maximumValue - minimumValue));
  };

  const pan = Gesture.Pan()
    .onBegin((event) => {
      if (width <= 0) return;
      fraction.value = clamp(event.x / width);
      runOnJS(commit)(fraction.value);
    })
    .onUpdate((event) => {
      if (width <= 0) return;
      fraction.value = clamp(event.x / width);
      runOnJS(commit)(fraction.value);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: fraction.value * width - size.sliderThumb / 2 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: fraction.value * width }));

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityValue={{
          min: minimumValue,
          max: maximumValue,
          now: value,
          ...(valueText ? { text: valueText } : {}),
        }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={styles.hitArea}
      >
        <View style={styles.track}>
          {gradient ? (
            <LinearGradient
              colors={[...gradient]}
              end={{ x: 1, y: 0 }}
              start={{ x: 0, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Animated.View style={[styles.fill, fillStyle]} />
          )}
        </View>
        <Animated.View style={[styles.thumb, uiShadow.thumb, thumbStyle]} />
      </View>
    </GestureDetector>
  );
}

const clamp = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

const normalise = (value: number, min: number, max: number) =>
  max === min ? 0 : Math.min(1, Math.max(0, (value - min) / (max - min)));

const styles = StyleSheet.create({
  hitArea: {
    // The track is 10px but the target must clear 44 (SYSTEM F hit target).
    height: size.hitTarget,
    justifyContent: 'center',
  },
  track: {
    height: size.sliderTrack,
    borderRadius: size.sliderTrack / 2,
    backgroundColor: ui.fill.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: size.sliderTrack / 2,
    backgroundColor: ui.action.primary,
  },
  thumb: {
    position: 'absolute',
    width: size.sliderThumb,
    height: size.sliderThumb,
    borderRadius: size.sliderThumb / 2,
    backgroundColor: ui.text.primary,
  },
});
