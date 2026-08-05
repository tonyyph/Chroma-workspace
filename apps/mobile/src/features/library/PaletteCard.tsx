import { round, space, ui, uiMotion } from '@chromawave/design-tokens';
import { shortAge, type Palette } from '@chromawave/domain';
import { StyleSheet, View } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';
import { Meta, Pressable, SwatchStrip, Text } from '@/ui';

import { PalettePhoto } from './PalettePhoto';

/**
 * FLOW C · "Cards are photo + band strip + metadata — the same three-zone grid
 * as the social templates, so a shared card and a library card are the same
 * object." The strip is proportional, so the card previews the composition.
 */
export function PaletteCard({ palette, onPress }: { palette: Palette; onPress: () => void }) {
  const { t } = usePreferences();
  return (
    <Pressable
      accessibilityHint={t('library.card.hint')}
      accessibilityLabel={`${palette.name}, ${t('palette.colourCount', { count: palette.colors.length })}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: uiMotion.listPress.opacity }]}
    >
      <View style={styles.media}>
        <PalettePhoto palette={palette} style={StyleSheet.absoluteFill} />
      </View>
      <SwatchStrip colors={palette.colors} height={10} />
      <View style={styles.copy}>
        <Text numberOfLines={1} variant="cardTitle">
          {palette.name}
        </Text>
        <Meta style={styles.meta}>
          {t('library.card.meta', {
            count: palette.colors.length,
            age: shortAge(palette.capturedAt),
          })}
        </Meta>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: round.card,
    overflow: 'hidden',
    backgroundColor: ui.fill.card,
    borderWidth: 1,
    borderColor: ui.border.hairline,
  },
  media: {
    height: 112,
    backgroundColor: ui.bg.media,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    paddingHorizontal: space.sm,
    paddingVertical: 11,
    gap: 3,
  },
  meta: {
    fontSize: 9,
    letterSpacing: 1,
  },
});
