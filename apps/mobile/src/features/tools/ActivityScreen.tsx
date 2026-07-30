import { brandBands, space, ui } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';
import { Card, Chip, Gutter, Meta, Screen, ScreenHeader, Text } from '@/ui';

/**
 * G9 · ACTIVITY · "collaboration feed + monthly colour recap".
 *
 * The feed needs a sync backend, so it is absent rather than faked. The recap is
 * real: it bins the user's own palettes by dominant hue and names the leader,
 * which is what the design's copy actually reports.
 */
export function ActivityScreen({ palettes }: { palettes: readonly Palette[] }) {
  const { t } = usePreferences();
  const recap = useMemo(() => buildRecap(palettes), [palettes]);

  return (
    <Screen tabBarInset>
      <Gutter style={styles.head}>
        <ScreenHeader
          title={t('activity.title')}
          trailing={<Chip label={t('activity.markRead')} onPress={() => {}} />}
        />
      </Gutter>

      {/* No collaboration feed without a server — say so rather than seed fake events. */}
      <Gutter style={styles.notice}>
        <Card style={styles.noticeCard}>
          <Text variant="cardTitle">{t('activity.none.title')}</Text>
          <Text tone="secondary" variant="body">
            {t('activity.none.body')}
          </Text>
        </Card>
      </Gutter>

      <Gutter style={styles.sectionLabel}>
        <Text tone="tertiary" variant="eyebrow">
          {t('activity.thisMonth')}
        </Text>
      </Gutter>

      <Gutter style={styles.recapWrap}>
        <Card style={styles.recap}>
          <View style={styles.recapHead}>
            <Text variant="rowTitle">{t('activity.recap')}</Text>
            <Meta>{recap.monthLabel}</Meta>
          </View>
          <View style={styles.chart}>
            {recap.bars.map((bar, index) => (
              <View
                key={index}
                accessibilityLabel={t('activity.barLabel', { label: bar.label, count: bar.count })}
                style={[styles.bar, { height: `${bar.height}%`, backgroundColor: bar.color }]}
              />
            ))}
          </View>
          <Text tone="secondary" variant="body">
            {recap.summary}
          </Text>
        </Card>
      </Gutter>
    </Screen>
  );
}

const BINS = [
  { label: 'red', max: 30, color: '#FF6B5A' },
  { label: 'orange', max: 70, color: brandBands[2] },
  { label: 'yellow', max: 110, color: '#FFC24A' },
  { label: 'green', max: 160, color: '#5BC48A' },
  { label: 'cyan', max: 220, color: brandBands[1] },
  { label: 'blue', max: 270, color: '#4A3AA8' },
  { label: 'violet', max: 320, color: brandBands[0] },
  { label: 'pink', max: 360, color: '#E86AA8' },
] as const;

function buildRecap(palettes: readonly Palette[]) {
  const counts = BINS.map(() => 0);
  for (const palette of palettes) {
    const dominant = palette.colors.find((c) => c.role === 'dominant') ?? palette.colors[0];
    if (!dominant) continue;
    const index = BINS.findIndex((bin) => dominant.oklch.hue < bin.max);
    const bin = index === -1 ? BINS.length - 1 : index;
    counts[bin] = (counts[bin] ?? 0) + 1;
  }

  const peak = Math.max(1, ...counts);
  const bars = BINS.map((bin, index) => ({
    label: bin.label,
    color: bin.color,
    count: counts[index] ?? 0,
    // Empty bins keep a visible stub so the chart reads as a scale, not a gap.
    height: Math.max(12, ((counts[index] ?? 0) / peak) * 100),
  }));

  const ranked = [...bars].sort((a, b) => b.count - a.count);
  const leader = ranked[0];
  const runnerUp = ranked[1];
  const total = palettes.length;

  const summary =
    total === 0
      ? 'Nothing captured yet this month.'
      : leader && runnerUp && leader.count > 0
        ? `You captured ${total} ${total === 1 ? 'palette' : 'palettes'}. ${cap(leader.label)} is winning — ${runnerUp.label} is closing.`
        : `You captured ${total} ${total === 1 ? 'palette' : 'palettes'}.`;

  return {
    bars,
    summary,
    monthLabel: new Date().toLocaleString('en', { month: 'long' }).toUpperCase(),
  };
}

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const styles = StyleSheet.create({
  head: { paddingTop: space.cardGap },
  notice: { paddingTop: space.md + 2 },
  noticeCard: { gap: space.xs },
  sectionLabel: { paddingTop: space.sectionGap },
  recapWrap: { paddingTop: space.cardGap },
  recap: { gap: space.cardGap, padding: 18 },
  recapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 78 },
  bar: { flex: 1, borderRadius: 5, minHeight: 8, backgroundColor: ui.fill.track },
});
