import {
  availableRecaps,
  onThisDay,
  readStyleDna,
  smartCollections,
  type SmartCollection,
} from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useMemories } from '@/hooks';
import { usePreferences, useSkin } from '@/providers';
import {
  Button,
  Card,
  CardGroup,
  Gutter,
  Icon,
  InlineError,
  Meta,
  Pressable,
  Screen,
  ScreenHeader,
  SectionHead,
  Text,
  useStyles,
} from '@/ui';

/**
 * The library, read as a library.
 *
 * Three things a pile of captures earns and a single memory cannot show: what
 * happened a year ago today, the collections the app forms without being asked,
 * and what someone's eye keeps choosing.
 *
 * **Nothing here is stored.** Every grouping and every number is recomputed from
 * the records on screen, so deleting a memory removes it from all of this at
 * once and no profile can drift out of step with the library it describes.
 */
export function RewindScreen() {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const router = useRouter();
  const { t } = usePreferences();
  const { memories, loading, failed, reload } = useMemories();

  const { today, collections, recaps, dna } = useMemo(() => {
    const now = new Date();
    return {
      today: onThisDay(memories, now),
      collections: smartCollections(memories),
      recaps: availableRecaps(memories, now),
      dna: readStyleDna(memories, now),
    };
  }, [memories]);

  if (loading) {
    return (
      <Screen tabBarInset>
        <ScreenHeader title={t('rewind.title')} />
        <Gutter style={styles.centred}>
          <ActivityIndicator color={skin.ui.text.tertiary} />
        </Gutter>
      </Screen>
    );
  }

  if (failed) {
    return (
      <Screen tabBarInset>
        <ScreenHeader title={t('rewind.title')} />
        <Gutter style={styles.centred}>
          <InlineError detail={t('rewind.failed')} title={t('rewind.title')} />
          <Button label={t('rewind.retry')} onPress={reload} size="xs" variant="ghost" />
        </Gutter>
      </Screen>
    );
  }

  const nothingYet = today.length === 0 && collections.length === 0 && recaps.length === 0;

  return (
    <Screen tabBarInset>
      <ScreenHeader meta={t('rewind.subtitle')} title={t('rewind.title')} />

      {nothingYet ? (
        <Gutter style={styles.centred}>
          <Text style={styles.centredCopy} tone="secondary" variant="body">
            {t('rewind.empty')}
          </Text>
        </Gutter>
      ) : null}

      {today.length ? (
        <>
          <Gutter style={styles.sectionHead}>
            <SectionHead
              meta={t('rewind.onThisDay.meta', { count: today.length })}
              title={t('rewind.onThisDay')}
            />
          </Gutter>
          <ScrollView
            contentContainerStyle={styles.rail}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {today.map((memory) => (
              <Pressable
                accessibilityLabel={memory.personalContext.title ?? memory.facets.dominantHex}
                accessibilityRole="button"
                key={memory.id}
                onPress={() => router.push(`/palette/${memory.id}`)}
                style={[styles.tile, { backgroundColor: memory.facets.dominantHex }]}
              >
                <View style={styles.tileFoot}>
                  <Meta>{memory.capturedAt.slice(0, 4)}</Meta>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {collections.length ? (
        <>
          <Gutter style={styles.sectionHead}>
            <SectionHead title={t('rewind.collections')} />
          </Gutter>
          <Gutter style={styles.grid}>
            {collections.slice(0, 12).map((collection) => (
              <CollectionTile
                collection={collection}
                key={`${collection.kind}:${collection.key}`}
              />
            ))}
          </Gutter>
        </>
      ) : null}

      {recaps.length ? (
        <>
          <Gutter style={styles.sectionHead}>
            <SectionHead title={t('rewind.recaps')} />
          </Gutter>
          <Gutter>
            <CardGroup>
              {recaps.slice(0, 8).map((recap) => (
                <View key={`${recap.period}:${recap.key}`} style={styles.row}>
                  <View style={styles.rowSwatches}>
                    {recap.signature.slice(0, 4).map((hex) => (
                      <View key={hex} style={[styles.rowSwatch, { backgroundColor: hex }]} />
                    ))}
                  </View>
                  <View style={styles.rowCopy}>
                    <Text variant="rowTitle">
                      {t(`rewind.recap.${recap.period}`, {
                        key: recap.key,
                        count: recap.memoryIds.length,
                      })}
                    </Text>
                    {recap.leadMood ? <Meta>{t(`atmosphere.mood.${recap.leadMood}`)}</Meta> : null}
                  </View>
                </View>
              ))}
            </CardGroup>
          </Gutter>
        </>
      ) : null}

      {dna.memoryCount ? (
        <>
          <Gutter style={styles.sectionHead}>
            <SectionHead title={t('rewind.dna')} />
          </Gutter>
          <Gutter>
            <Card style={styles.dnaCard}>
              <View style={styles.dnaStrip}>
                {dna.signature.map((hex) => (
                  <View key={hex} style={[styles.dnaSwatch, { backgroundColor: hex }]} />
                ))}
              </View>
              <Text variant="rowTitle">
                {t(
                  dna.warmth === null || Math.abs(dna.warmth) < 0.15
                    ? 'rewind.dna.neutral'
                    : dna.warmth > 0
                      ? 'rewind.dna.warm'
                      : 'rewind.dna.cool',
                )}
              </Text>
              {dna.moods[0] ? <Meta>{t(`atmosphere.mood.${dna.moods[0].value}`)}</Meta> : null}
              <Meta>{t('rewind.dna.paired', { percent: Math.round(dna.pairedShare * 100) })}</Meta>
              {/* The count is the honesty line: a profile read from four
                  memories should not be presented as a verdict on a person. */}
              <Meta tone="tertiary">{t('rewind.dna.memories', { count: dna.memoryCount })}</Meta>
            </Card>
          </Gutter>
        </>
      ) : null}
    </Screen>
  );
}

/** One collection, drawn in the colour of its newest member. */
function CollectionTile({ collection }: { collection: SmartCollection }) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const router = useRouter();
  const { t } = usePreferences();

  const label = t(`rewind.collection.${collection.kind}`, { key: collection.key });

  return (
    <Pressable
      accessibilityLabel={`${label}, ${collection.memoryIds.length}`}
      accessibilityRole="button"
      onPress={() => router.navigate({ pathname: '/(tabs)', params: {} })}
      style={styles.cell}
    >
      <View style={[styles.cellSwatch, { backgroundColor: collection.coverHex }]} />
      <Text numberOfLines={1} variant="chip">
        {label}
      </Text>
      <View style={styles.cellFoot}>
        <Meta>{t('rewind.count', { count: collection.memoryIds.length })}</Meta>
        <Icon color={skin.ui.text.tertiary} name="forward" scale="inline" />
      </View>
    </Pressable>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    centred: { alignItems: 'center', gap: space.sm, paddingTop: space.xl },
    centredCopy: { textAlign: 'center' },
    sectionHead: { paddingTop: space.sectionGap },
    rail: { paddingHorizontal: space.gutter, gap: space.xs, paddingTop: space.sm },
    tile: {
      width: 108,
      height: 140,
      borderRadius: skin.round.media,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    tileFoot: { padding: space.xs, backgroundColor: skin.ui.scrim.strong },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: space.sm },
    cell: {
      width: '48%',
      gap: 6,
      padding: space.sm,
      borderRadius: skin.round.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: skin.ui.border.hairline,
      backgroundColor: skin.ui.fill.chipGhost,
    },
    cellSwatch: { height: 44, borderRadius: skin.round.swatch },
    cellFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowSwatches: { flexDirection: 'row', gap: 2 },
    rowSwatch: { width: 10, height: 34, borderRadius: 2 },
    rowCopy: { flex: 1, gap: 2 },
    dnaCard: { gap: space.xs, marginTop: space.sm },
    dnaStrip: { flexDirection: 'row', gap: 3 },
    dnaSwatch: { flex: 1, height: 30, borderRadius: skin.round.swatch },
  });
