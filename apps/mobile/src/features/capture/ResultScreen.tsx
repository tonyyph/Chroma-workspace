import { round, space, tint, ui } from '@chromawave/design-tokens';
import { readStability, type Color, type Palette } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Button, ButtonRow, Card, ColorRow, Icon, Meta, Sheet, Text } from '@/ui';

/**
 * B2 · RESULT SHEET · "drag to expand full hex list".
 *
 * The capture sits behind a sheet that overlaps it by 28pt. The three named
 * roles get full rows; the extras pair up in a two-up row, exactly as drawn.
 */
export function ResultScreen({
  palette,
  onSave,
  onTune,
  onRetake,
}: {
  palette: Palette;
  onSave: () => void;
  onTune: () => void;
  onRetake: () => void;
}) {
  const router = useRouter();
  const { t } = usePreferences();
  const named = palette.colors.filter((color) => color.role !== 'extra');
  const extras = palette.colors.filter((color) => color.role === 'extra');
  const stability = readStability(palette.deltaE);

  return (
    <View style={styles.root}>
      <View style={styles.capture}>
        <Text tone="quaternary" variant="chip">
          {t('result.capture')}
        </Text>
        <View style={styles.captureChrome}>
          <Card
            accessibilityLabel={t('result.close')}
            onPress={() => router.back()}
            style={styles.captureChip}
          >
            <Icon name="close" scale="inline" />
            <Text variant="chip">{t('result.close')}</Text>
          </Card>
          <Card
            accessibilityLabel={t('result.retake')}
            onPress={onRetake}
            style={styles.captureChip}
          >
            <Text variant="chip">{t('result.retake')}</Text>
          </Card>
        </View>
      </View>

      <Sheet overlap={28} style={styles.sheet}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text variant="section">{palette.name}</Text>
            <Meta>{`${palette.colors.length} colours · ΔE ${palette.deltaE} · ${palette.space === 'p3' ? 'P3' : 'sRGB'}`}</Meta>
          </View>
          <View style={[styles.confidence, tint.info]}>
            <Text style={{ color: tint.info.color }} variant="chip">
              {t('result.confidence', { percent: Math.round(palette.confidence * 100) })}
            </Text>
          </View>
        </View>

        {/* The stability verdict is text, per the accessibility gate — never colour alone. */}
        <Meta tone={stability === 'stable' ? 'info' : 'tertiary'}>
          {t('result.read', { stability: t(`common.stability.${stability}`) })}
        </Meta>

        <View style={styles.rows}>
          {named.map((color) => (
            <Card key={color.hex} style={styles.row}>
              <ColorRow color={roleLabelled(color)} onCopy={copy} />
            </Card>
          ))}
          {extras.length ? (
            <View style={styles.extras}>
              {/* The named rows copy on tap; the extras are the same kind of row
                  at half width and were the only swatches that did not. */}
              {extras.map((color) => (
                <Card
                  accessibilityLabel={t('result.copyLabel', { hex: color.hex })}
                  key={color.hex}
                  onPress={() => copy(color.hex)}
                  style={styles.extra}
                >
                  <View style={[styles.extraSwatch, { backgroundColor: color.hex }]} />
                  <Text tone="secondary" variant="monoSmall">
                    {`${color.hex.slice(1)}\n${Math.round(color.weight * 100)}%`}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <ButtonRow>
            <Button
              label={t('result.tune')}
              onPress={onTune}
              style={styles.tune}
              variant="secondary"
            />
            <Button label={t('result.save')} onPress={onSave} style={styles.save} />
          </ButtonRow>
        </View>
      </Sheet>
    </View>
  );
}

const copy = (hex: string) => {
  void Clipboard.setStringAsync(hex);
};

/** The row component takes a display role; capitalise the stored enum for it. */
function roleLabelled(color: Color) {
  const label = color.role.charAt(0).toUpperCase() + color.role.slice(1);
  return { hex: color.hex, weight: color.weight, role: label };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg.base },
  capture: {
    height: 392,
    backgroundColor: ui.bg.media,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureChrome: {
    position: 'absolute',
    top: 64,
    left: space.gutter,
    right: space.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  captureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ui.scrim.control,
    borderColor: ui.border.control,
    paddingHorizontal: space.sm,
    paddingVertical: 9,
    borderRadius: round.full,
  },
  sheet: { paddingHorizontal: space.sectionGap },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleCopy: { flex: 1, gap: 3 },
  confidence: {
    borderWidth: 1,
    borderRadius: round.control,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  rows: { gap: space.xs },
  row: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: round.control },
  extras: { flexDirection: 'row', gap: space.xs },
  extra: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderRadius: round.control,
  },
  extraSwatch: { width: 28, height: 28, borderRadius: 9 },
  actions: { marginTop: 'auto', paddingTop: space.md },
  tune: { flex: 1 },
  save: { flex: 1.4 },
});
