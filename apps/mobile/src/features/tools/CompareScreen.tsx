import { space, type Skin } from '@chromawave/design-tokens';
import { hexDeltaE00, type Palette } from '@chromawave/domain';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import {
  ActionSheet,
  Button,
  ButtonRow,
  Card,
  Gutter,
  Icon,
  Meta,
  Pressable,
  Screen,
  ScreenHeader,
  SwatchStrip,
  Text,
  useStyles,
  type MenuAction,
} from '@/ui';

/**
 * G3 · COMPARE · "ΔE00 matrix, closest-pair suggestion".
 *
 * Every number here is computed, not stored: the matrix is real CIEDE2000
 * between each pair, which is why the closest pair can be named rather than
 * guessed.
 */
export function CompareScreen({
  first,
  second,
  candidates = [],
  onPick,
  onSwap,
  onMerge,
}: {
  first: Palette;
  second: Palette;
  /** Everything else in the library, offered when choosing what to compare against. */
  candidates?: readonly Palette[];
  onPick: (paletteId: string) => void;
  onSwap: () => void;
  onMerge: () => void;
}) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const [picking, setPicking] = useState(false);
  const rows = first.colors.slice(0, 3);
  const columns = second.colors.slice(0, 3);

  const pickActions: readonly MenuAction[] = candidates.map((palette) => ({
    label: palette.name,
    onPress: () => onPick(palette.id),
  }));

  const matrix = useMemo(
    () => rows.map((row) => columns.map((column) => hexDeltaE00(row.hex, column.hex))),
    [rows, columns],
  );

  const closest = useMemo(() => {
    let best = { rowIndex: 0, columnIndex: 0, distance: Number.POSITIVE_INFINITY };
    matrix.forEach((row, rowIndex) =>
      row.forEach((distance, columnIndex) => {
        if (distance < best.distance) best = { rowIndex, columnIndex, distance };
      }),
    );
    return best;
  }, [matrix]);

  const closestRow = rows[closest.rowIndex];
  const closestColumn = columns[closest.columnIndex];

  return (
    <Screen
      action={
        <ButtonRow>
          <Button
            disabled={pickActions.length === 0}
            label={t('compare.addThird')}
            onPress={() => setPicking(true)}
            style={styles.flex}
            variant="secondary"
          />
          <Button label={t('compare.merge')} onPress={onMerge} style={styles.wide} />
        </ButtonRow>
      }
    >
      <Gutter style={styles.head}>
        <ScreenHeader meta={t('compare.meta')} title={t('compare.title')} />
      </Gutter>

      {/* Tapping either tile is how the comparison changes — A becomes B on swap,
          B opens the picker. Without those the screen only ever shows the two
          palettes the route happened to resolve. */}
      <Gutter style={styles.cards}>
        <PaletteTile
          label={t('compare.swapSides')}
          letter="A"
          onPress={onSwap}
          palette={first}
          selected
        />
        <PaletteTile
          label={t('compare.choose')}
          letter="B"
          onPress={pickActions.length ? () => setPicking(true) : undefined}
          palette={second}
        />
      </Gutter>

      <Gutter style={styles.matrixWrap}>
        <Card style={styles.matrix}>
          <Text tone="secondary" variant="eyebrow">
            {t('compare.matrixLabel')}
          </Text>
          <View style={styles.matrixHeader}>
            <View style={styles.matrixCorner} />
            {columns.map((column) => (
              <View
                key={column.hex}
                style={[styles.matrixSwatch, { backgroundColor: column.hex }]}
              />
            ))}
          </View>
          {rows.map((row, rowIndex) => (
            <View key={row.hex} style={styles.matrixRow}>
              <View
                style={[styles.matrixSwatch, styles.matrixCorner, { backgroundColor: row.hex }]}
              />
              {columns.map((column, columnIndex) => {
                const distance = matrix[rowIndex]?.[columnIndex] ?? 0;
                const isClosest =
                  rowIndex === closest.rowIndex && columnIndex === closest.columnIndex;
                return (
                  <View key={column.hex} style={styles.matrixCell}>
                    <Text
                      accessibilityLabel={t('compare.cellLabel', {
                        from: row.hex,
                        to: column.hex,
                        value: Math.round(distance),
                      })}
                      tone={isClosest ? 'info' : 'primary'}
                      variant="mono"
                    >
                      {Math.round(distance)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </Card>
      </Gutter>

      {closestRow && closestColumn ? (
        <Gutter style={styles.findings}>
          <Card style={[styles.finding, skin.tint.infoSubtle]}>
            <View style={styles.findingCopy}>
              <Text style={{ color: skin.tint.infoSubtle.color }} variant="cardTitle">
                {t('compare.closest')}
              </Text>
              {/* The card's own title already says these two are a pair, so the
                  separator is the same middot every other meta line uses rather
                  than a ↔ that Feather has no equivalent for. */}
              <Meta>{`${closestRow.hex} · ${closestColumn.hex} · ΔE ${Math.round(closest.distance)}`}</Meta>
            </View>
            <Pressable
              accessibilityLabel={t('compare.swapSides')}
              accessibilityRole="button"
              hitSlop={10}
              onPress={onSwap}
              style={styles.swap}
            >
              <Text tone="secondary" variant="chip">
                {t('compare.swap')}
              </Text>
              <Icon color={skin.ui.text.secondary} name="swap" scale="inline" />
            </Pressable>
          </Card>
          <Card style={styles.finding}>
            <View style={styles.findingCopy}>
              <Text variant="cardTitle">{t('compare.temperature')}</Text>
              <Meta>{`a ${describeTemperature(first)} · b ${describeTemperature(second)}`}</Meta>
            </View>
          </Card>
        </Gutter>
      ) : null}

      <ActionSheet
        actions={pickActions}
        cancelLabel={t('common.cancel')}
        onDismiss={() => setPicking(false)}
        title={t('compare.choose')}
        visible={picking}
      />
    </Screen>
  );
}

function PaletteTile({
  palette,
  letter,
  selected = false,
  label,
  onPress,
}: {
  palette: Palette;
  letter: string;
  selected?: boolean;
  label: string;
  onPress?: (() => void) | undefined;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Card
      accessibilityLabel={onPress ? `${palette.name}. ${label}` : palette.name}
      padded={false}
      style={[styles.tile, selected && styles.tileSelected]}
      // Spread rather than pass `undefined`: `exactOptionalPropertyTypes` treats
      // an explicit undefined as a different thing from an absent prop, and Card
      // switches between View and Pressable on the prop's presence.
      {...(onPress ? { onPress } : {})}
    >
      <SwatchStrip colors={palette.colors.slice(0, 3)} height={74} />
      <View style={styles.tileCopy}>
        <Text variant="cardTitle">{palette.name}</Text>
        <Meta style={styles.tileMeta}>{`${letter} · ${palette.colors.length} colours`}</Meta>
      </View>
    </Card>
  );
}

/** Warmth from the dominant colour's OKLCh hue, expressed as an approximate CCT. */
function describeTemperature(palette: Palette): string {
  const dominant = palette.colors.find((color) => color.role === 'dominant') ?? palette.colors[0];
  if (!dominant) return 'unknown';
  const hue = dominant.oklch.hue;
  const warm = hue < 110 || hue >= 330;
  return warm ? 'warm 2700K' : 'cool 4200K';
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    head: { paddingTop: space.cardGap },
    cards: { paddingTop: space.md + 2, flexDirection: 'row', gap: space.sm },
    tile: { flex: 1, overflow: 'hidden' },
    tileSelected: { borderWidth: 1.5, borderColor: skin.ui.action.primary },
    tileCopy: { paddingHorizontal: space.sm, paddingVertical: 11, gap: 3 },
    tileMeta: { fontSize: 9, letterSpacing: 1 },
    matrixWrap: { paddingTop: space.gutter },
    matrix: { gap: space.sm },
    matrixHeader: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    matrixRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
    matrixCorner: { width: 34 },
    matrixSwatch: { flex: 1, height: 22, borderRadius: skin.round.swatch },
    matrixCell: { flex: 1, alignItems: 'center' },
    findings: { paddingTop: space.md, gap: 10 },
    finding: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.cardGap,
      paddingVertical: space.cardGap,
    },
    findingCopy: { gap: 3 },
    swap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    flex: { flex: 1 },
    wide: { flex: 1.3 },
  });
