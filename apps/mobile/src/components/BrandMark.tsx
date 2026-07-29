import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ICON_CORNER_RATIO, identityIcons } from '@/brand/identityAssets';
import { usePreferences } from '@/providers/PreferencesProvider';

/**
 * The mark, drawn from the same masters as the shipped app icon so the in-app
 * identity and the home screen icon can never drift apart.
 */
export function BrandMark({ size = 42 }: { size?: number }) {
  const { identity } = usePreferences();
  return (
    <View
      accessibilityLabel="CHROMAWAVE"
      accessibilityRole="image"
      style={[styles.frame, { width: size, height: size, borderRadius: size * ICON_CORNER_RATIO }]}
    >
      <Image
        contentFit="cover"
        source={identityIcons[identity.id]}
        style={StyleSheet.absoluteFill}
        transition={160}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
});
