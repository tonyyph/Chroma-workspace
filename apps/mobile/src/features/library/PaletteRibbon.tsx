import { space, ui, uiMotion } from '@chromawave/design-tokens';
import { shortAge, type Palette } from '@chromawave/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { useHeroStore } from '@/store/heroStore';
import { Meta, Pressable, Text } from '@/ui';
import { PalettePhoto } from './PalettePhoto';

/**
 * One palette, as a length of the archive rather than a card.
 *
 * **What this replaced.** A two-column grid of bordered cards, each a colour
 * face over a name and a thumbnail. It worked, and it looked like every other
 * content app: a wall of tiles. At a column's width every palette got the same
 * 167 points whatever it was, and the grid's job — being scannable — was one
 * the app already has a whole Explore tab for.
 *
 * Full width instead, edge to edge, separated by a hairline rather than a gap,
 * so scrolling the library is scrolling a continuous ribbon of the colour
 * someone has actually stood in. The proportions are the real ones, and at 390
 * points across a 6% signal is 23 points wide — legible, where the same band in
 * a two-up grid was nine.
 *
 * The name sits on the band under a scrim confined to the lower third, so the
 * colour reads uninterrupted across the full width above it. A left-side scrim
 * would have covered whichever colour happened to be dominant.
 */
export const PaletteRibbon = memo(function PaletteRibbon({
  palette,
  onOpen,
}: {
  palette: Palette;
  /**
   * Handed the palette back rather than closed over, so the list passes one
   * handler to every row and the `memo` above holds.
   */
  onOpen: (palette: Palette) => void;
}) {
  const { t } = usePreferences();
  const band = useRef<View>(null);
  const begin = useHeroStore((state) => state.begin);

  const open = useCallback(() => {
    const node = band.current;
    if (!node) {
      onOpen(palette);
      return;
    }
    // Measured before opening so the hero flies from where the band actually
    // is; opening first would measure it mid-transition.
    node.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) begin({ x, y, width, height }, palette.colors);
      onOpen(palette);
    });
  }, [begin, onOpen, palette]);

  return (
    <Pressable
      accessibilityHint={t('library.card.hint')}
      accessibilityLabel={`${palette.name}, ${t('palette.colourCount', { count: palette.colors.length })}`}
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [styles.row, pressed && { opacity: uiMotion.listPress.opacity }]}
    >
      <View
        accessibilityLabel={palette.colors.map((color) => color.hex).join(', ')}
        ref={band}
        style={styles.band}
      >
        {palette.colors.map((color, index) => (
          <View
            // Position is part of the identity: a palette may legitimately carry
            // the same hex twice, and keying on the value alone drops the second.
            key={`${index}:${color.hex}`}
            style={{ flex: color.weight, backgroundColor: color.hex }}
          />
        ))}

        <LinearGradient
          colors={['rgba(8,7,14,0)', 'rgba(8,7,14,.78)']}
          locations={[0.42, 1]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.copy}>
          <View style={styles.thumb}>
            <PalettePhoto palette={palette} style={StyleSheet.absoluteFill} />
          </View>
          <View style={styles.label}>
            <Text numberOfLines={1} variant="rowTitle">
              {palette.name}
            </Text>
            <Meta style={styles.meta}>
              {t('library.card.meta', {
                count: palette.colors.length,
                age: shortAge(palette.capturedAt),
              })}
            </Meta>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  /** A hairline, not a gap: the ribbon is continuous and the rule is what
   *  separates one reading from the next without breaking the material. */
  row: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ui.border.hairlineStrong },
  band: {
    height: 116,
    flexDirection: 'row',
    backgroundColor: ui.bg.media,
    justifyContent: 'flex-end',
  },
  copy: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    bottom: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: ui.bg.media,
  },
  label: { flex: 1, gap: 1 },
  meta: { fontSize: 9, letterSpacing: 1 },
});
