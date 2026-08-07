import { round, space, ui, uiMotion } from '@chromawave/design-tokens';
import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { type TrendingItem } from '@/data';
import { usePreferences } from '@/providers';
import { Card, Chip, Meta, Pressable, SwatchStrip, Text } from '@/ui';

/**
 * A feed entry, in the two densities it is read at.
 *
 * `tile` is the home rail: artwork first, because the rail is browsed by
 * glancing. `row` is the full feed: metadata first, because that list is
 * searched and compared. Both are the same component so the two surfaces cannot
 * drift into showing different facts about the same palette.
 *
 * The thumbnail is generated from the entry's own weighted colours rather than
 * from a bundled image. That is not a shortcut — the proportions *are* the
 * content here, so a thumbnail drawn from them cannot be out of date, and a
 * palette whose bands are 60/25/15 previews as 60/25/15.
 */
export const TrendingCard = memo(function TrendingCard({
  item,
  onPress,
  onSave,
  saved,
  variant = 'tile',
  width,
}: {
  item: TrendingItem;
  /**
   * Handed the entry back rather than closing over it.
   *
   * This is what makes the `memo` above hold: a caller that wrote
   * `onPress={() => open(item)}` would pass a new function on every keystroke
   * in the search field above the feed, and every card in it would re-render to
   * receive a handler that does the same thing as the last one.
   */
  onPress: (item: TrendingItem) => void;
  /** Omit for surfaces where saving is not offered — the whole card still opens. */
  onSave?: ((item: TrendingItem) => void) | undefined;
  saved: boolean;
  variant?: 'tile' | 'row';
  /** Fixed width for the horizontal rail; omitted the card fills its column. */
  width?: number;
}) {
  const { t } = usePreferences();
  const open = useCallback(() => onPress(item), [onPress, item]);
  const save = useCallback(() => onSave?.(item), [onSave, item]);
  const meta = t('trending.meta', {
    count: (item.saves / 1000).toFixed(1),
    author: item.author,
  });

  if (variant === 'row') {
    return (
      <Card
        accessibilityHint={item.blurb}
        accessibilityLabel={item.name}
        onPress={open}
        style={styles.row}
      >
        <View style={styles.rowArt}>
          <SwatchStrip colors={item.colors} height={52} radius={round.swatch} />
        </View>
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} variant="cardTitle">
            {item.name}
          </Text>
          <Text numberOfLines={1} tone="tertiary" variant="monoSmall">
            {meta}
          </Text>
          <Text numberOfLines={1} style={styles.blurb} tone="secondary" variant="body">
            {item.blurb}
          </Text>
        </View>
        {onSave ? (
          <Chip
            label={t(saved ? 'trending.saved' : 'trending.save')}
            onPress={save}
            tone={saved ? 'selected' : 'default'}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <Pressable
      accessibilityHint={item.blurb}
      accessibilityLabel={item.name}
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [
        styles.tile,
        width === undefined ? styles.tileFlex : { width },
        pressed && { opacity: uiMotion.listPress.opacity },
      ]}
    >
      <View style={styles.tileArt}>
        {item.colors.map((color, index) => (
          <View
            // Position is part of the identity: a palette may legitimately carry
            // the same hex twice, and keying on the value alone drops the second.
            key={`${index}:${color.hex}`}
            style={{ flex: color.weight, backgroundColor: color.hex }}
          />
        ))}
        <View style={styles.tileCategory}>
          <Text style={styles.categoryLabel} variant="chip">
            {t(`trending.category.${item.category}`)}
          </Text>
        </View>
        {saved ? (
          <View style={styles.tileSaved}>
            <Text style={styles.savedLabel} variant="chip">
              {t('trending.saved')}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tileCopy}>
        <Text numberOfLines={1} variant="cardTitle">
          {item.name}
        </Text>
        <Meta style={styles.tileMeta}>{meta}</Meta>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  rowArt: {
    width: 72,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  blurb: {
    fontSize: 12,
    lineHeight: 17,
  },

  tile: {
    borderRadius: round.card,
    overflow: 'hidden',
    backgroundColor: ui.fill.card,
    borderWidth: 1,
    borderColor: ui.border.hairline,
  },
  tileFlex: {
    flex: 1,
  },
  tileArt: {
    height: 104,
    flexDirection: 'row',
    backgroundColor: ui.bg.media,
  },
  tileCategory: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: round.chip,
    backgroundColor: ui.scrim.panel,
  },
  categoryLabel: {
    color: ui.text.primary,
  },
  tileSaved: {
    position: 'absolute',
    right: 8,
    top: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: round.chip,
    backgroundColor: ui.action.contrast,
  },
  savedLabel: {
    color: ui.action.onContrast,
  },
  tileCopy: {
    paddingHorizontal: space.sm,
    paddingVertical: 11,
    gap: 3,
  },
  tileMeta: {
    fontSize: 9,
    letterSpacing: 1,
  },
});
