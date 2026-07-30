import { round, space, ui } from '@chromawave/design-tokens';
import type { Palette, PaletteSet } from '@chromawave/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Card, Chip, Gutter, Meta, NavBar, Screen, SwatchStrip, Text } from '@/ui';

/**
 * C3 · COLLECTION · "shared set, merge is the Pro hook".
 *
 * `members` beyond the owner and the "ADDED BY" attribution come from the set's
 * own record. In a local-first build the owner is the only member, so the
 * attribution reads "ADDED BY YOU" until a sync backend exists.
 */
export function CollectionScreen({
  set,
  palettes,
  isPro,
  onBack,
  onMerge,
}: {
  set: PaletteSet;
  palettes: readonly Palette[];
  isPro: boolean;
  onBack: () => void;
  onMerge: () => void;
}) {
  const members = set.members.length;

  return (
    <Screen>
      <NavBar leading="‹ LIBRARY" onLeading={onBack} trailing="EDIT" />

      <Gutter style={styles.head}>
        <Text variant="title">{set.name}</Text>
        <Meta>
          {`${set.paletteIds.length} palettes${members > 1 ? ` · shared with ${members - 1} people` : ' · private'}`}
        </Meta>
      </Gutter>

      <Gutter style={styles.actions}>
        <Chip fill label="MERGE ALL" onPress={onMerge} tone="pro" />
        <Chip fill label="EXPORT SET" onPress={() => {}} />
        <Chip fill label="INVITE" onPress={() => {}} />
      </Gutter>

      <Gutter style={styles.rows}>
        {palettes.map((palette) => (
          <Card key={palette.id} style={styles.row}>
            <View style={styles.rowThumb} />
            <View style={styles.rowCopy}>
              <Text variant="cardTitle">{palette.name}</Text>
              <Meta style={styles.rowMeta}>added by you</Meta>
            </View>
            <SwatchStrip
              colors={palette.colors.slice(0, 3)}
              height={26}
              radius={8}
              style={styles.rowStrip}
            />
          </Card>
        ))}
      </Gutter>

      {/* The merged strip is the Pro hook — shown locked rather than hidden. */}
      <Gutter style={styles.mergedWrap}>
        <LinearGradient
          colors={['rgba(124,92,255,.16)', 'rgba(34,211,238,.05)']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.merged}
        >
          <Text style={styles.mergedLabel} variant="eyebrow">
            {isPro ? 'MERGED SET · PRO' : 'MERGED SET · PRO REQUIRED'}
          </Text>
          {set.merged?.length ? (
            <SwatchStrip colors={set.merged} height={52} radius={12} />
          ) : (
            <View style={styles.mergedEmpty}>
              <Text tone="secondary" variant="body">
                {isPro
                  ? 'Merge the set to build one palette from all of them.'
                  : 'Pro merges a whole set into one palette.'}
              </Text>
            </View>
          )}
        </LinearGradient>
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.md, gap: space.xs },
  actions: { paddingTop: space.md + 2, flexDirection: 'row', gap: space.xs },
  rows: { paddingTop: space.md + 2, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  rowThumb: { width: 44, height: 44, borderRadius: round.control, backgroundColor: ui.bg.media },
  rowCopy: { flex: 1, gap: 3 },
  rowMeta: { fontSize: 9, letterSpacing: 1 },
  rowStrip: { width: 60 },
  mergedWrap: { paddingTop: space.sectionGap },
  merged: {
    borderRadius: round.card,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,.3)',
    padding: space.md,
    gap: space.xs,
  },
  mergedLabel: { color: '#B79CFF' },
  mergedEmpty: { paddingVertical: space.xs },
});
