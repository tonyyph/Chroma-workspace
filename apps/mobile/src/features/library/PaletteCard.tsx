import { round, space, ui, uiMotion } from '@chromawave/design-tokens';
import { shortAge, type Palette } from '@chromawave/domain';
import { memo, useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { useHeroStore } from '@/store/heroStore';
import { Meta, Pressable, Text } from '@/ui';
import { PalettePhoto } from './PalettePhoto';

/**
 * FLOW C · a library card.
 *
 * **What changed and why.** The card was a 112pt photograph over a 10pt band
 * strip: eleven parts photograph to one part palette, on the home screen of an
 * app whose library is a library of colour. Scrolling it read as a photo roll
 * with a coloured hairline under each frame, and two palettes read off similar
 * scenes were nearly impossible to tell apart at a glance — the thing that
 * actually distinguishes them was the hairline.
 *
 * Inverted. The palette is the card's face, at the proportions the extractor
 * measured, and the photograph becomes a thumbnail beside the name — enough to
 * say where the colour came from, which is all provenance has to do.
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
  const face = useRef<View>(null);
  const begin = useHeroStore((state) => state.begin);

  /**
   * Measures the card's face, then opens.
   *
   * `measureInWindow` is a callback rather than a value, so the push happens
   * inside it — a frame later than a bare handler, and imperceptibly so. Opening
   * first and measuring after would start the flight from wherever the card had
   * got to as the screen slid away.
   *
   * If the measurement never arrives the palette still opens; the transition is
   * the part that is allowed to fail.
   */
  const open = useCallback(() => {
    const node = face.current;
    if (!node) {
      onOpen(palette);
      return;
    }
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
      style={({ pressed }) => [styles.card, pressed && { opacity: uiMotion.listPress.opacity }]}
    >
      {/* The palette itself, and the rectangle the hero transition flies from. */}
      <View
        accessibilityLabel={palette.colors.map((color) => color.hex).join(', ')}
        ref={face}
        style={styles.face}
      >
        {palette.colors.map((color, index) => (
          <View
            // Position is part of the identity: a palette may legitimately carry
            // the same hex twice, and keying on the value alone drops the second.
            key={`${index}:${color.hex}`}
            style={{ flex: color.weight, backgroundColor: color.hex }}
          />
        ))}
      </View>

      <View style={styles.copy}>
        <View style={styles.thumb}>
          <PalettePhoto palette={palette} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.label}>
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
  /** Vertical, not horizontal: stacked bands hold their proportions at a
   *  column's width, where a 160pt-wide row would give a 6% signal 9 points. */
  face: { height: 148, backgroundColor: ui.bg.media },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
  },
  thumb: {
    width: 30,
    height: 30,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: ui.bg.media,
  },
  label: { flex: 1, gap: 2 },
  meta: {
    fontSize: 9,
    letterSpacing: 1,
  },
});
