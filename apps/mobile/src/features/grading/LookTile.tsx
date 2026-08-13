import type { Look } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import type { SkImage } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import { Meta, Pressable, Text, useStyles } from '@/ui';
import { GradePreview } from './GradePreview';

/**
 * One look, previewed on the photograph it would be applied to.
 *
 * A swatch of somebody else's photograph is a decoration. The point of a tile is
 * that it answers "what would this do to *mine*", which is a question a name like
 * "Cross process" cannot answer on its own.
 *
 * The decoded image arrives as a prop and is shared with every other tile on
 * screen — see `LookGrid` for why that sharing is the only reason a grid of
 * live previews is affordable here at all.
 */
export function LookTile({
  look,
  image,
  size,
  selected,
  locked,
  onPress,
}: {
  look: Look;
  image: SkImage;
  size: number;
  selected: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const { t } = usePreferences();

  return (
    <Pressable
      accessibilityLabel={t('look.select', { name: look.name })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tile, { width: size }]}
    >
      <View
        style={[
          styles.frame,
          { height: size },
          // The same token the selected chip uses, so the grid and the rail
          // above it agree about what "chosen" looks like.
          selected && { borderColor: skin.ui.action.contrast },
        ]}
      >
        <GradePreview grade={look.grade} height={size} image={image} width={size} />
        {locked ? (
          <View style={styles.lock}>
            <Meta>{t('look.locked')}</Meta>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} tone={selected ? 'primary' : 'secondary'} variant="chip">
        {look.name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    tile: { gap: 6 },
    frame: {
      borderRadius: skin.round.control,
      overflow: 'hidden',
      backgroundColor: skin.ui.bg.media,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    lock: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      backgroundColor: skin.ui.scrim.strong,
      borderRadius: skin.round.chip,
      paddingHorizontal: space.xs,
      paddingVertical: 2,
    },
  });
