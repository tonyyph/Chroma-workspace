import { type ColorMood, type Palette, type VisualStyle } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import { Chip, Gutter, SectionHead, Text, useStyles } from '@/ui';
import { moodTaste, styleTaste } from './youInsights';

/**
 * Taste, read off the library.
 *
 * Each chip is a real query — tapping one lands on the library with that filter
 * already applied, which is the only reason a profile should show a preference
 * at all. A chip that merely states a fact about you is decoration.
 */
export function TasteSection({
  palettes,
  onPick,
}: {
  palettes: readonly Palette[];
  onPick: (params: { mood?: ColorMood; style?: VisualStyle }) => void;
}) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const moods = useMemo(() => moodTaste(palettes).slice(0, 3), [palettes]);
  const styleRanks = useMemo(() => styleTaste(palettes).slice(0, 3), [palettes]);
  const leader = moods[0];

  return (
    <>
      <Gutter style={styles.sectionHead}>
        <SectionHead meta={t('you.taste.meta')} title={t('you.taste.title')} />
      </Gutter>

      <Gutter style={styles.taste}>
        {leader ? (
          <>
            {/* The bar is drawn within the ranked set rather than against the
                whole library: a palette counts towards every mood it matches, so
                these shares deliberately do not sum to one. */}
            <View style={styles.tasteBar}>
              {moods.map((entry) => (
                <View
                  key={entry.value}
                  style={{
                    flex: entry.count,
                    backgroundColor: moodInk(skin)[entry.value],
                  }}
                />
              ))}
            </View>

            <View style={styles.tasteChips}>
              {moods.map((entry) => (
                <Chip
                  key={entry.value}
                  label={`${t(`library.mood.${entry.value}`)} ${entry.count}`}
                  onPress={() => onPick({ mood: entry.value })}
                  tone={entry.value === leader.value ? 'info' : 'default'}
                />
              ))}
              {styleRanks.map((entry) => (
                <Chip
                  key={entry.value}
                  label={`${t(`library.style.${entry.value}`)} ${entry.count}`}
                  onPress={() => onPick({ style: entry.value })}
                />
              ))}
            </View>
          </>
        ) : (
          <Text tone="secondary" variant="body">
            {t('you.taste.empty')}
          </Text>
        )}
      </Gutter>
    </>
  );
}

/**
 * A colour per mood, so the taste bar is legible without reading its labels.
 * They are the system's own accents rather than new values — warm is the warm
 * accent, cool is info, vibrant is the signal, and so on.
 */
const moodInk = (skin: Skin): Record<ColorMood, string> => ({
  warm: skin.ui.accent.warm,
  cool: skin.ui.accent.info,
  // Pastel and monochrome had no accent of their own and were written as a
  // bone tint and a bone at 45% — both of which describe chroma's ink and
  // nothing else. They take the skin's own quiet tones instead.
  pastel: skin.ui.text.secondary,
  monochrome: skin.ui.text.tertiary,
  vibrant: skin.ui.accent.signal,
});

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    sectionHead: {
      paddingTop: space.sectionGap,
    },
    taste: {
      paddingTop: space.sm,
      gap: space.sm,
    },
    tasteBar: {
      flexDirection: 'row',
      height: 8,
      borderRadius: skin.round.swatch,
      overflow: 'hidden',
      backgroundColor: skin.ui.fill.track,
    },
    tasteChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
  });
