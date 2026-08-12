import { space, type Skin } from '@cw/tokens';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Gutter, Meta, Pressable, Text, useStyles } from '@/ui';

/**
 * Four counts in one rail rather than four tiles down a fold.
 *
 * Three of them are a query the library can answer, so they are buttons; the
 * colour count is not, so it is not. A tile that looks pressable and is not is
 * the same lie as a chevron on a row that goes nowhere.
 */
export function StatsRail({
  palettes,
  pinned,
  colours,
  thisMonth,
  onOpenLibrary,
}: {
  palettes: number;
  pinned: number;
  colours: number;
  thisMonth: number;
  onOpenLibrary: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();

  return (
    <Gutter style={styles.statsSection}>
      <View style={styles.statsRail}>
        <CompactStat
          accent
          label={t('you.stat.palettes')}
          onPress={onOpenLibrary}
          value={String(palettes)}
        />
        <CompactStat
          divided
          label={t('you.stat.pinned')}
          onPress={onOpenLibrary}
          value={String(pinned)}
        />
        <CompactStat divided label={t('you.stat.colours')} value={String(colours)} />
        <CompactStat
          divided
          label={t('you.stat.thisMonth')}
          onPress={onOpenLibrary}
          value={String(thisMonth)}
        />
      </View>
    </Gutter>
  );
}

function CompactStat({
  label,
  value,
  onPress,
  accent = false,
  divided = false,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  accent?: boolean;
  divided?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const body = (
    <>
      <Text
        style={[styles.compactStatValue, accent && styles.compactStatValueAccent]}
        variant="section"
      >
        {value}
      </Text>
      <Meta
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        numberOfLines={1}
        style={styles.compactStatLabel}
      >
        {label}
      </Meta>
    </>
  );

  if (!onPress) {
    return <View style={[styles.compactStat, divided && styles.compactStatDivided]}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityHint={t('you.stat.hint')}
      accessibilityLabel={`${value} ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactStat,
        divided && styles.compactStatDivided,
        pressed && styles.tilePressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    statsSection: {
      paddingTop: space.xs,
      borderRadius: skin.round.card,
    },
    statsRail: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: skin.round.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: skin.ui.border.hairline,
      backgroundColor: skin.ui.fill.chipGhost,
    },
    compactStat: {
      flex: 1,
      minWidth: 0,
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.xxs,
      paddingVertical: space.xs,
      gap: 2,
    },
    compactStatDivided: {
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderColor: skin.ui.border.hairline,
    },
    compactStatValue: {
      color: skin.ui.text.primary,
    },
    compactStatValueAccent: {
      color: skin.ui.action.link,
    },
    compactStatLabel: {
      color: skin.ui.text.tertiary,
      fontSize: 8.5,
      letterSpacing: 0.8,
      textAlign: 'center',
    },
    tilePressed: {
      opacity: 0.75,
    },
  });
