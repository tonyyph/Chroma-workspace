import { radius } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers/PreferencesProvider';

export function TabDot({ focused, shape }: { focused: boolean; shape: 'circle' | 'wave' }) {
  const { colors } = usePreferences();
  return (
    <View
      style={[
        styles.base,
        shape === 'wave' && styles.wave,
        { backgroundColor: focused ? colors.accent : colors.textSubtle },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
  },
  wave: {
    width: 22,
    height: 9,
    transform: [{ rotate: '-12deg' }],
  },
});
