import { brandBands, space, type Skin } from '@chromawave/design-tokens';
import { shortAge, type Palette } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Card, Chip, Gutter, Meta, Screen, ScreenHeader, SwatchStrip, Text, useStyles } from '@/ui';
import { unreadActivity } from './activity';

/**
 * G9 · ACTIVITY · "collaboration feed + monthly colour recap".
 *
 * The feed needs a sync backend, so it is absent rather than faked. The recap is
 * real: it bins the user's own palettes by dominant hue and names the leader,
 * which is what the design's copy actually reports.
 */
export function ActivityScreen({
  palettes,
  refreshing = false,
  onRefresh,
}: {
  palettes: readonly Palette[];
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { t, preferences, markActivityRead } = usePreferences();
  const router = useRouter();
  const recap = useMemo(() => buildRecap(palettes), [palettes]);
  const unread = useMemo(
    () => unreadActivity(palettes, preferences.activityReadAt),
    [palettes, preferences.activityReadAt],
  );

  return (
    <Screen onRefresh={onRefresh} refreshing={refreshing} tabBarInset>
      <Gutter style={styles.head}>
        <ScreenHeader
          title={t('activity.title')}
          trailing={
            unread.length ? (
              <Chip label={t('activity.markRead')} onPress={() => void markActivityRead()} />
            ) : (
              <Chip label={t('activity.allRead')} />
            )
          }
        />
      </Gutter>

      {/* There is no collaboration feed without a server, but there is a real
          local one: the captures made since this screen was last cleared. */}
      <Gutter style={styles.notice}>
        {unread.length ? (
          <View style={styles.feed}>
            {unread.map((palette) => (
              <Card
                accessibilityLabel={palette.name}
                key={palette.id}
                onPress={() => router.push(`/palette/${palette.id}`)}
                style={styles.feedRow}
              >
                <SwatchStrip
                  colors={palette.colors.slice(0, 3)}
                  height={34}
                  radius={9}
                  style={styles.feedStrip}
                />
                <View style={styles.feedCopy}>
                  <Text variant="cardTitle">{palette.name}</Text>
                  <Meta style={styles.feedMeta}>
                    {t('activity.captured', { age: shortAge(palette.capturedAt) })}
                  </Meta>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Card style={styles.noticeCard}>
            <Text variant="cardTitle">{t('activity.none.title')}</Text>
            <Text tone="secondary" variant="body">
              {t('activity.none.body')}
            </Text>
          </Card>
        )}
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

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    head: { paddingTop: space.cardGap },
    notice: { paddingTop: space.md + 2 },
    noticeCard: { gap: space.xs },
    feed: { gap: 10 },
    feedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    feedStrip: { width: 56 },
    feedCopy: { flex: 1, gap: 3 },
    feedMeta: { fontSize: 9, letterSpacing: 1 },
    sectionLabel: { paddingTop: space.sectionGap },
    recapWrap: { paddingTop: space.cardGap },
    recap: { gap: space.cardGap, padding: 18 },
    recapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 78 },
    bar: {
      flex: 1,
      borderRadius: skin.round.swatch,
      minHeight: 8,
      backgroundColor: skin.ui.fill.track,
    },
  });
