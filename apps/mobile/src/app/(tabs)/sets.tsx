import { paletteGaps, type PaletteSet } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSets } from '@/hooks';
import { usePreferences } from '@/providers';
import {
  Button,
  Card,
  EmptyGlyph,
  Gutter,
  Meta,
  Screen,
  ScreenHeader,
  Text,
  useStyles,
} from '@/ui';

/**
 * C3 entry · the list of projects.
 *
 * Each row leads with the set's merged system rather than a 72pt strip of the
 * first few colours it happens to hold, because the system is the thing the set
 * produces and the strip was only ever evidence that it contained something. The
 * open-gap count is the row's real signal: it is what makes one set worth
 * opening today and another one finished.
 */
export default function SetsScreen() {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { t } = usePreferences();
  const { sets, refreshing, refresh } = useSets();

  // Nothing is written from here: the draft screen owns naming and saving, so a
  // set only ever reaches the list once someone has named it.
  const createSet = () => router.push('/set/new');

  return (
    <Screen onRefresh={() => void refresh()} refreshing={refreshing} tabBarInset>
      <Gutter style={styles.head}>
        <ScreenHeader meta={t('sets.meta', { count: sets.length })} title={t('sets.title')} />
      </Gutter>

      {sets.length === 0 ? (
        <Gutter style={styles.body}>
          <EmptyGlyph kind="no-library" />
          <Text variant="section">{t('sets.empty.title')}</Text>
          <Text style={styles.copy} tone="secondary" variant="body">
            {t('sets.empty.body')}
          </Text>
          <Button label={t('sets.create')} onPress={createSet} size="xs" />
        </Gutter>
      ) : (
        <>
          <Gutter style={styles.rows}>
            {sets.map((set) => (
              <ProjectRow key={set.id} onPress={() => router.push(`/set/${set.id}`)} set={set} />
            ))}
          </Gutter>
          <Gutter style={styles.action}>
            <Button label={t('sets.create')} onPress={createSet} variant="secondary" />
          </Gutter>
        </>
      )}
    </Screen>
  );
}

function ProjectRow({ set, onPress }: { set: PaletteSet; onPress: () => void }) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const system = set.merged ?? [];
  const gaps = paletteGaps(system);

  return (
    <Card accessibilityLabel={set.name} onPress={onPress} padded={false} style={styles.row}>
      {/* The merged system at its true proportions, as the row's own ground. */}
      {system.length ? (
        <View accessibilityLabel={system.map((color) => color.hex).join(', ')} style={styles.band}>
          {system.map((color) => (
            <View key={color.hex} style={{ flex: color.weight, backgroundColor: color.hex }} />
          ))}
        </View>
      ) : (
        <View style={[styles.band, styles.bandEmpty]} />
      )}

      <View style={styles.rowCopy}>
        <View style={styles.rowTitle}>
          <Text style={styles.name} variant="cardTitle">
            {set.name}
          </Text>
          {system.length ? (
            <Meta tone={gaps.length ? 'tertiary' : 'info'}>
              {gaps.length ? t('sets.openGaps', { count: gaps.length }) : t('sets.complete')}
            </Meta>
          ) : null}
        </View>
        <Meta style={styles.rowMeta}>
          {t('collection.meta.private', { count: set.paletteIds.length })}
        </Meta>
      </View>
    </Card>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    head: { paddingTop: space.cardGap },
    body: { alignItems: 'center', gap: space.md, paddingTop: space.xl },
    copy: { textAlign: 'center' },
    rows: { paddingTop: space.md, gap: space.cardGap },
    row: { overflow: 'hidden' },
    band: {
      flexDirection: 'row',
      height: 76,
      borderBottomWidth: 1,
      borderBottomColor: skin.elevation.raised.borderColor,
    },
    bandEmpty: { backgroundColor: skin.ui.bg.media },
    rowCopy: { padding: space.cardGap, gap: 3 },
    rowTitle: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    name: { flex: 1 },
    rowMeta: { fontSize: 9, letterSpacing: 1 },
    action: { paddingTop: space.gutter },
  });
