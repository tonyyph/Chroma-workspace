import { shortAge, type Palette } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import { Card, Gutter, Icon, Meta, SectionHead, SwatchStrip, Text, useStyles } from '@/ui';

/**
 * The last few captures, as rows rather than as another grid.
 *
 * The library one tab away is the grid; repeating it here would be the same
 * screen twice. A row carries the name and the age, which is what "did I already
 * capture this?" actually asks.
 */
export function RecentCaptures({
  palettes,
  onSeeAll,
}: {
  palettes: readonly Palette[];
  onSeeAll: () => void;
}) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { t } = usePreferences();

  return (
    <>
      <Gutter style={styles.sectionHead}>
        <SectionHead
          action={palettes.length ? t('you.seeAll') : undefined}
          onAction={palettes.length ? onSeeAll : undefined}
          title={t('you.recent.title')}
        />
      </Gutter>
      <Gutter style={styles.recent}>
        {palettes.length ? (
          palettes.map((palette) => (
            <Card
              accessibilityLabel={palette.name}
              key={palette.id}
              onPress={() => router.push(`/palette/${palette.id}`)}
              style={styles.recentRow}
            >
              <SwatchStrip
                colors={palette.colors}
                height={38}
                radius={skin.round.swatch}
                style={styles.recentStrip}
              />
              <View style={styles.recentCopy}>
                <Text numberOfLines={1} variant="cardTitle">
                  {palette.name}
                </Text>
                <Meta style={styles.setMeta}>
                  {t('library.card.meta', {
                    count: palette.colors.length,
                    age: shortAge(palette.capturedAt),
                  })}
                </Meta>
              </View>
              <Icon color={skin.ui.text.tertiary} name="forward" scale="inline" />
            </Card>
          ))
        ) : (
          <Text tone="secondary" variant="body">
            {t('you.recent.empty')}
          </Text>
        )}
      </Gutter>
    </>
  );
}

const makeStyles = (_skin: Skin) =>
  StyleSheet.create({
    sectionHead: {
      paddingTop: space.sectionGap,
    },
    setMeta: {
      fontSize: 9,
      letterSpacing: 1,
    },
    recent: {
      paddingTop: space.sm,
      gap: 8,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    recentStrip: {
      width: 60,
    },
    recentCopy: {
      flex: 1,
      gap: 3,
    },
  });
