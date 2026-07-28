import { radius, spacing } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AppText } from './AppText';
import { usePreferences } from '@/providers/PreferencesProvider';

type ChromaticArtworkProps = {
  colors?: readonly string[];
  caption?: string;
  compact?: boolean;
};

export function ChromaticArtwork({
  caption = 'Light becomes feeling.',
  compact = false,
  ...props
}: ChromaticArtworkProps) {
  const { colors: theme } = usePreferences();
  const colors = props.colors ?? [theme.brandCoral, theme.brandViolet, theme.brandChartreuse];
  const fallbackColors = [theme.brandCoral, theme.brandViolet, theme.brandChartreuse];
  const reducedMotion = useReducedMotion();
  const resolved = [colors[0], colors[1], colors[2]].map(
    (item, index) => item ?? fallbackColors[index],
  );

  return (
    <View
      accessible
      accessibilityLabel={`Abstract chromatic composition. ${caption}`}
      accessibilityRole="image"
      style={[styles.frame, { backgroundColor: theme.surfaceSubtle }, compact && styles.compact]}
    >
      <View pointerEvents="none" style={[styles.ruleTop, { backgroundColor: theme.border }]} />
      {resolved.map((backgroundColor, index) => (
        <Animated.View
          key={`${backgroundColor}-${index}`}
          {...(!reducedMotion ? { entering: FadeIn.duration(360).delay(index * 70) } : {})}
          style={[
            styles.form,
            index === 0 && styles.formOne,
            index === 1 && styles.formTwo,
            index === 2 && styles.formThree,
            { backgroundColor },
          ]}
        />
      ))}
      <View style={styles.copy}>
        <AppText tone="subtle" variant="caption">
          CHROMATIC STUDY · 01
        </AppText>
        <AppText
          italic
          style={[styles.caption, { textShadowColor: theme.canvas }]}
          variant="heading"
        >
          {caption}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    minHeight: 390,
    padding: spacing.lg,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  compact: {
    minHeight: 290,
  },
  ruleTop: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    left: spacing.lg,
    height: StyleSheet.hairlineWidth,
  },
  form: {
    position: 'absolute',
  },
  formOne: {
    width: 250,
    height: 122,
    borderRadius: radius.pill,
    top: 70,
    right: -70,
    transform: [{ rotate: '-24deg' }],
  },
  formTwo: {
    width: 182,
    height: 250,
    borderRadius: radius.pill,
    top: 74,
    left: -74,
    transform: [{ rotate: '18deg' }],
  },
  formThree: {
    width: 230,
    height: 72,
    borderRadius: radius.pill,
    right: -8,
    bottom: 104,
    transform: [{ rotate: '9deg' }],
  },
  copy: {
    maxWidth: 280,
    gap: spacing.xs,
  },
  caption: {
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 14,
  },
});
