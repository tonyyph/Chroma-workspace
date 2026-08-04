import { space } from '@chromawave/design-tokens';
import { makeColor, type PaletteSet } from '@chromawave/domain';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePalettes } from '@/hooks/usePalettes';
import { useSets } from '@/hooks/useSets';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  Button,
  Card,
  EmptyGlyph,
  InlineError,
  Gutter,
  Meta,
  Screen,
  ScreenHeader,
  SwatchStrip,
  Text,
} from '@/ui';

/** C3 entry · the list of collections. */
export default function SetsScreen() {
  const router = useRouter();
  const { t } = usePreferences();
  const { sets, refreshing, refresh, save } = useSets();
  const [createFailed, setCreateFailed] = useState(false);
  const { palettes } = usePalettes();

  const createSet = async () => {
    const now = new Date().toISOString();
    const set: PaletteSet = {
      schemaVersion: 1,
      id: Crypto.randomUUID(),
      name: t('sets.newName'),
      createdAt: now,
      updatedAt: now,
      // A new set starts with whatever is pinned; an empty set has nothing to show.
      paletteIds: palettes.filter((palette) => palette.isPinned).map((palette) => palette.id),
      members: ['you'],
      merged: null,
    };
    try {
      await save(set);
    } catch {
      // Nothing was persisted, so navigating into the set would 404.
      setCreateFailed(true);
      return;
    }
    analytics.track('collection_created', { collectionId: set.id });
    router.push(`/set/${set.id}`);
  };

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing} tabBarInset>
      <Gutter style={styles.head}>
        <ScreenHeader meta={t('sets.meta', { count: sets.length })} title={t('sets.title')} />
      </Gutter>

      {createFailed ? (
        <Gutter style={styles.error}>
          <InlineError detail={t('sets.createFailedDetail')} title={t('sets.createFailed')} />
        </Gutter>
      ) : null}

      {sets.length === 0 ? (
        <Gutter style={styles.body}>
          <EmptyGlyph kind="no-library" />
          <Text variant="section">{t('sets.empty.title')}</Text>
          <Text style={styles.copy} tone="secondary" variant="body">
            {t('sets.empty.body')}
          </Text>
          <Button label={t('sets.create')} onPress={() => void createSet()} size="xs" />
        </Gutter>
      ) : (
        <>
          <Gutter style={styles.rows}>
            {sets.map((set) => {
              const members = set.paletteIds
                .map((id) => palettes.find((palette) => palette.id === id))
                .filter(Boolean);
              const strip = members.flatMap((palette) => palette!.colors.slice(0, 2));
              return (
                <Card key={set.id} onPress={() => router.push(`/set/${set.id}`)} style={styles.row}>
                  <View style={styles.rowCopy}>
                    <Text variant="cardTitle">{set.name}</Text>
                    <Meta style={styles.rowMeta}>
                      {t('collection.meta.private', { count: set.paletteIds.length })}
                    </Meta>
                  </View>
                  {strip.length ? (
                    <SwatchStrip
                      colors={strip.length ? strip : [makeColor('#7C5CFF', 1)]}
                      height={26}
                      radius={8}
                      style={styles.rowStrip}
                    />
                  ) : null}
                </Card>
              );
            })}
          </Gutter>
          <Gutter style={styles.action}>
            <Button label={t('sets.create')} onPress={() => void createSet()} variant="secondary" />
          </Gutter>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.cardGap },
  error: { paddingTop: space.md },
  body: { alignItems: 'center', gap: space.md, paddingTop: space.xl },
  copy: { textAlign: 'center' },
  rows: { paddingTop: space.md, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowCopy: { flex: 1, gap: 3 },
  rowMeta: { fontSize: 9, letterSpacing: 1 },
  rowStrip: { width: 72 },
  action: { paddingTop: space.gutter },
});
