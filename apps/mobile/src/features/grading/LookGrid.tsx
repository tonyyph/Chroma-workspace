import {
  gradesEqual,
  lookCollectionIds,
  looksIn,
  type Grade,
  type LookCollectionId,
} from '@cw/domain';
import { space } from '@cw/tokens';
import type { SkImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Chip } from '@/ui';
import { LookTile } from './LookTile';

const TILE = 96;

/**
 * Thirty looks, six at a time.
 *
 * **The collection rail is a performance decision as much as an editorial one.**
 * Every tile is a Skia canvas compiling the grade shader, and thirty of those in
 * one scroll view is exactly the stutter `bakeGrade.ts` already documents for the
 * library grid. Showing one collection at a time caps it at six live canvases,
 * and those six share a single decoded `SkImage` handed down from the screen —
 * one decode for the whole grid, and no file read per tile.
 */
export function LookGrid({
  image,
  current,
  onChoose,
  isLocked,
  onLocked,
}: {
  image: SkImage;
  current: Grade;
  onChoose: (grade: Grade) => void;
  /** Asked per look, because the free one in each collection is not locked. */
  isLocked: (lookId: string) => boolean;
  onLocked: () => void;
}) {
  const { t } = usePreferences();
  const [collection, setCollection] = useState<LookCollectionId>('negative');

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={styles.rail}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {lookCollectionIds.map((id) => (
          <Chip
            key={id}
            label={t(`look.collection.${id}`)}
            onPress={() => setCollection(id)}
            tone={collection === id ? 'selected' : 'default'}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.tiles}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {looksIn(collection).map((look) => {
          const locked = isLocked(look.id);
          return (
            <LookTile
              image={image}
              key={look.id}
              locked={locked}
              look={look}
              // A locked tile still responds. One that does nothing when tapped
              // teaches someone the app is broken; one that opens the paywall
              // teaches them what it costs.
              onPress={() => (locked ? onLocked() : onChoose(look.grade))}
              selected={gradesEqual(current, look.grade)}
              size={TILE}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  rail: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.gutter },
  tiles: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.gutter },
});
