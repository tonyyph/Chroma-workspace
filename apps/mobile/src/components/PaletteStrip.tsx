import type { Palette } from '@chromawave/domain';
import { radius, spacing } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';

type PaletteStripProps = {
  palette: Palette;
  height?: number;
  animated?: boolean;
};

export function PaletteStrip({ palette, height = 64, animated = true }: PaletteStripProps) {
  const reducedMotion = useReducedMotion();

  return (
    <View
      accessibilityLabel={`Palette with ${palette.colors.length} colors. Mood: ${palette.mood}.`}
      accessibilityRole="image"
      style={[styles.container, { height }]}
    >
      {palette.colors.map((swatch, index) => (
        <Animated.View
          key={`${swatch.hex}-${index}`}
          {...(animated && !reducedMotion
            ? {
                entering: FadeInUp.duration(220)
                  .delay(index * 45)
                  .springify()
                  .damping(18),
              }
            : {})}
          style={[
            styles.swatch,
            {
              backgroundColor: swatch.hex,
              flex: Math.max(0.12, swatch.weight),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.lg,
    gap: spacing.xxs,
  },
  swatch: {
    minWidth: 14,
    borderRadius: radius.sm,
  },
});
