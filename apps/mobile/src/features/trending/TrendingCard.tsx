import { shortAge } from '@cw/domain';
import { space, uiMotion, type Skin } from '@cw/tokens';
import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { type TrendingItem } from '@/data';
import { usePreferences, useSkin } from '@/providers';
import { Card, Chip, Meta, Pressable, SwatchStrip, Text, useStyles } from '@/ui';

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
  variant?: 'tile' | 'row' | 'entry';
  /**
   * `tile` is the home rail, `row` is a search result, `entry` is a field note.
   *
   * Same data, three densities, and the difference is what the surface is for:
   * a rail is glanced at, a result list is scanned, and a weekly note is read.
   */
  /** Fixed width for the horizontal rail; omitted the card fills its column. */
  width?: number;
}) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const open = useCallback(() => onPress(item), [onPress, item]);
  const save = useCallback(() => onSave?.(item), [onSave, item]);
  // Where it was read and when it was published — the two facts about an entry
  // that are actually true. This line used to report a save count and a handle,
  // both of which were numbers and names typed into a fixture.
  const meta = t('trending.meta', {
    category: t(`trending.category.${item.category}`),
    age: shortAge(item.publishedAt),
  });

  if (variant === 'entry') {
    /**
     * An entry in the feed, as a note rather than a list row.
     *
     * This was a 72pt strip beside three lines of truncated text — the shape of
     * a search result, which is the right shape for scanning a hundred things
     * and the wrong one for reading seven. Field notes are written weekly by a
     * person and there are never many; the entry is now the width of the
     * screen, the artwork carries the palette at its real proportions, and the
     * blurb is set as body copy instead of a one-line caption clipped at the
     * gutter.
     */
    return (
      <Pressable
        accessibilityHint={item.blurb}
        accessibilityLabel={item.name}
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [styles.entry, pressed && { opacity: uiMotion.listPress.opacity }]}
      >
        <View
          accessibilityLabel={item.colors.map((color) => color.hex).join(', ')}
          style={styles.entryArt}
        >
          {item.colors.map((color, index) => (
            <View
              key={`${index}:${color.hex}`}
              style={{ flex: color.weight, backgroundColor: color.hex }}
            />
          ))}
        </View>

        <View style={styles.entryCopy}>
          <Meta style={styles.entryMeta}>{meta}</Meta>
          <Text variant="section">{item.name}</Text>
          <Text style={styles.entryBlurb} tone="secondary" variant="body">
            {item.blurb}
          </Text>
        </View>

        {onSave ? (
          <View style={styles.entryAction}>
            <Chip
              label={t(saved ? 'trending.saved' : 'trending.save')}
              onPress={save}
              tone={saved ? 'selected' : 'default'}
            />
          </View>
        ) : null}
      </Pressable>
    );
  }

  if (variant === 'row') {
    return (
      <Card
        accessibilityHint={item.blurb}
        accessibilityLabel={item.name}
        onPress={open}
        style={styles.row}
      >
        <View style={styles.rowArt}>
          <SwatchStrip colors={item.colors} height={52} radius={skin.round.swatch} />
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

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    rowArt: { width: 72 },
    rowCopy: { flex: 1, gap: 3 },
    blurb: { fontSize: 12, lineHeight: 17 },

    entry: { paddingBottom: space.lg },
    /** Full bleed and tall enough that a 6% signal is a band, not a line. */
    entryArt: { height: 190, flexDirection: 'row', backgroundColor: skin.ui.bg.media },
    entryCopy: { paddingHorizontal: space.gutter, paddingTop: space.cardGap, gap: 6 },
    entryMeta: { fontSize: 9, letterSpacing: 1.2 },
    /** A reading measure, not a caption: this is the only prose in the app. */
    entryBlurb: { fontSize: 15, lineHeight: 24, maxWidth: 520 },
    entryAction: { paddingHorizontal: space.gutter, paddingTop: space.sm, flexDirection: 'row' },

    tile: {
      borderRadius: skin.round.card,
      overflow: 'hidden',
      backgroundColor: skin.ui.fill.card,
      borderWidth: 1,
      borderColor: skin.ui.border.hairline,
    },
    tileFlex: {
      flex: 1,
    },
    tileArt: {
      height: 104,
      flexDirection: 'row',
      backgroundColor: skin.ui.bg.media,
    },
    tileCategory: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: skin.round.chip,
      backgroundColor: skin.ui.scrim.panel,
    },
    categoryLabel: {
      color: skin.ui.text.primary,
    },
    tileSaved: {
      position: 'absolute',
      right: 8,
      top: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: skin.round.chip,
      backgroundColor: skin.ui.action.contrast,
    },
    savedLabel: {
      color: skin.ui.action.onContrast,
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
