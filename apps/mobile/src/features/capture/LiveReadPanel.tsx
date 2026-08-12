import { readStability, type Color } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePreferences } from '@/providers';
import { LiveReadPulse, Meta, Text, useCaptureSequence, useStyles } from '@/ui';

/** Taken from the storyboard rather than restated, so the two cannot drift. */
type SwatchStyle = ReturnType<typeof useCaptureSequence>['swatchStyle'];

/**
 * What the lens is currently reading, under the viewfinder.
 *
 * The panel keeps its height whether or not it has colours yet, because a strip
 * that appears and pushes the shutter down is a moving target for the thumb.
 */
export function LiveReadPanel({
  colors,
  deltaE,
  confidence,
  failed,
  swatchStyle,
}: {
  colors: readonly Color[];
  deltaE: number;
  confidence: number;
  /** The last shot could not be read; says so instead of showing stale colours. */
  failed: boolean;
  swatchStyle: SwatchStyle;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const stability = readStability(deltaE);

  return (
    <View style={styles.readPanel}>
      <View style={styles.readHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('capture.liveRead')}
        </Text>
        <Meta tone={failed ? 'danger' : stability === 'stable' ? 'info' : 'tertiary'}>
          {failed
            ? t('capture.readFailed')
            : colors.length
              ? `ΔE ${deltaE} · ${t(`common.stability.${stability}`)} · ${Math.round(confidence * 100)}%`
              : t('capture.reading')}
        </Meta>
      </View>
      {colors.length ? (
        <Animated.View style={[styles.readRow, swatchStyle]}>
          {colors.map((color) => (
            <View key={color.hex} style={styles.readItem}>
              <View style={[styles.readSwatch, { backgroundColor: color.hex }]} />
              <Text tone="secondary" variant="monoSmall">
                {color.hex.slice(1)}
              </Text>
            </View>
          ))}
        </Animated.View>
      ) : (
        <LiveReadPulse />
      )}
    </View>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    readPanel: {
      backgroundColor: skin.ui.scrim.panel,
      borderWidth: 1,
      borderColor: skin.ui.border.hairlineStrong,
      borderRadius: skin.round.media - 2,
      padding: space.cardGap,
      gap: space.sm,
      minHeight: 108,
    },
    readHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    readRow: { flexDirection: 'row', gap: space.xs },
    readItem: { flex: 1, gap: 6 },
    readSwatch: { height: 44, borderRadius: skin.round.swatch },
  });
