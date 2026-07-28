import { radius } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';

export function BrandMark({ size = 42 }: { size?: number }) {
  const { colors } = usePreferences();
  return (
    <View
      accessibilityLabel="CHROMAWAVE"
      accessibilityRole="image"
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.text },
      ]}
    >
      <View style={[styles.wave, styles.waveOne, { backgroundColor: colors.brandCoral }]} />
      <View style={[styles.wave, styles.waveTwo, { backgroundColor: colors.brandViolet }]} />
      <View style={[styles.wave, styles.waveThree, { backgroundColor: colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  wave: {
    position: 'absolute',
    height: 7,
    width: '78%',
    left: '-8%',
    borderRadius: radius.pill,
    transform: [{ rotate: '-14deg' }],
  },
  waveOne: {
    top: '24%',
  },
  waveTwo: {
    top: '44%',
    left: '12%',
  },
  waveThree: {
    top: '64%',
    left: '30%',
  },
});
