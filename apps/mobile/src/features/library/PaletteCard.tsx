import { round, space, ui, uiMotion } from '@chromawave/design-tokens';
import { shortAge, type Palette } from '@chromawave/domain';
import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Meta, Pressable, SwatchStrip, Text } from '@/ui';
import { PalettePhoto } from './PalettePhoto';

/**
 * FLOW C · "Cards are photo + band strip + metadata — the same three-zone grid
 * as the social templates, so a shared card and a library card are the same
 * object." The strip is proportional, so the card previews the composition.
 */
export const PaletteCard = memo(function PaletteCard({
  palette,
  onOpen,
}: {
  palette: Palette;
  /**
   * Handed the palette back rather than closing over it, so the grid can pass
   * one handler to every card. A per-card arrow function would be a new prop on
   * each render of the list and defeat the `memo` above.
   */
  onOpen: (palette: Palette) => void;
}) {
  const { t } = usePreferences();
  const open = useCallback(() => onOpen(palette), [onOpen, palette]);
  return (
    <Pressable
      accessibilityHint={t('library.card.hint')}
      accessibilityLabel={`${palette.name}, ${t('palette.colourCount', { count: palette.colors.length })}`}
      accessibilityRole="button"
      onPress={open}
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
});

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
