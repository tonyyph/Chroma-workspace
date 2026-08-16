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
 * A hundred and ten looks, eight at a time.
 *
 * **The collection rail is a performance decision as much as an editorial one.**
 * Every tile is a Skia canvas compiling the grade shader, and a hundred of those
 * in one scroll view is exactly the stutter `bakeGrade.ts` already documents for
 * the library grid — it is also, at that length, a catalogue nobody reads to the
 * end of. Showing one collection at a time caps it at eight live canvases, and
 * those eight share a single decoded `SkImage` handed down from the screen — one
 * decode for the whole grid, and no file read per tile.
 *
 * **Without a photograph it becomes a rail of names.** The collection rail still
 * carries it, for the same reason: a hundred and ten chips wrapped down the
 * screen is a wall, and a wall is what someone scrolls past.
 */
export function LookGrid({
  image,
  current,
  onChoose,
  isLocked,
  onLocked,
}: {
  /** Null until the photograph decodes — see the name-rail fallback below. */
  image: SkImage | null;
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
          // A locked look still responds. One that does nothing when tapped
          // teaches someone the app is broken; one that opens the paywall
          // teaches them what it costs.
          const press = () => (locked ? onLocked() : onChoose(look.grade));
          const selected = gradesEqual(current, look.grade);

          return image ? (
            <LookTile
              image={image}
              key={look.id}
              locked={locked}
              look={look}
              onPress={press}
              selected={selected}
              size={TILE}
            />
          ) : (
            <Chip
              key={look.id}
              label={look.name}
              onPress={press}
              tone={locked ? 'pro' : selected ? 'selected' : 'default'}
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
