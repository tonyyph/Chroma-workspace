import { round, space, ui } from '@chromawave/design-tokens';
import { contrastRatio, safeForegroundFor, type Palette } from '@chromawave/domain';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, Card, Chip, Gutter, Screen, ScreenHeader, Text } from '@/ui';

const SURFACES = ['APP UI', 'WEB', 'POSTER', 'SLIDE'] as const;

/**
 * G6 · APPLY THEME · "palette mapped to real UI roles".
 *
 * The role mapping is computed, not authored: `surface` is the darkest colour,
 * `on-surface` the lightest, and `primary`/`accent` come from the named roles.
 * That is what makes the preview honest — if a palette cannot carry a readable
 * UI, the preview shows it.
 */
export function ApplyThemeScreen({
  palette,
  onExport,
}: {
  palette: Palette;
  onExport: () => void;
}) {
  const { t } = usePreferences();
  const [surface, setSurface] = useState<(typeof SURFACES)[number]>('APP UI');

  const roles = useMemo(() => {
    const sorted = [...palette.colors].sort((a, b) => a.oklch.lightness - b.oklch.lightness);
    const darkest = sorted[0]?.hex ?? '#1A1630';
    const lightest = sorted[sorted.length - 1]?.hex ?? '#F1E7D6';
    const primary = palette.colors.find((c) => c.role === 'dominant')?.hex ?? darkest;
    const support = palette.colors.find((c) => c.role === 'support')?.hex ?? primary;
    const accent = palette.colors.find((c) => c.role === 'signal')?.hex ?? lightest;
    return { surface: darkest, onSurface: lightest, primary, support, accent };
  }, [palette.colors]);

  const readable = contrastRatio(roles.onSurface, roles.surface) >= 4.5;

  return (
    <Screen>
      <Gutter style={styles.head}>
        <ScreenHeader meta={t('theme.meta', { name: palette.name })} title={t('theme.title')} />
      </Gutter>

      <Gutter style={styles.surfaces}>
        {SURFACES.map((entry) => (
          <Chip
            fill
            key={entry}
            label={entry}
            onPress={() => setSurface(entry)}
            tone={surface === entry ? 'selected' : 'default'}
          />
        ))}
      </Gutter>

      <Gutter style={styles.previewWrap}>
        <View style={[styles.preview, { backgroundColor: roles.surface }]}>
          <View style={styles.previewHead}>
            <Text style={[styles.previewTitle, { color: roles.onSurface }]}>
              {t('theme.dashboard')}
            </Text>
            <View style={[styles.previewGlyph, { backgroundColor: roles.primary }]} />
          </View>

          <View style={styles.stats}>
            <Stat background={roles.primary} label={t('theme.uptime')} value="82%" />
            <Stat background={roles.accent} label={t('theme.sessions')} value="1.4K" />
            <Stat
              background="transparent"
              border={roles.onSurface}
              label={t('theme.alerts')}
              textColor={roles.onSurface}
              value="36"
            />
          </View>

          <View style={styles.chart}>
            {[40, 66, 52, 88, 72, 58, 34].map((height, index) => (
              <View
                key={index}
                style={[
                  styles.bar,
                  {
                    height: `${height}%`,
                    backgroundColor: height === 88 ? roles.primary : roles.support,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.previewActions}>
            <View style={[styles.previewButton, { backgroundColor: roles.accent }]}>
              <Text
                style={{ color: safeForegroundFor(roles.accent), fontSize: 13, fontWeight: '600' }}
              >
                {t('theme.primaryAction')}
              </Text>
            </View>
            <View style={[styles.previewGhost, { borderColor: roles.onSurface }]} />
          </View>
        </View>
      </Gutter>

      <Gutter style={styles.mappingWrap}>
        <Card style={styles.mapping}>
          <Text tone="secondary" variant="eyebrow">
            {t('theme.roleMapping')}
          </Text>
          {Object.entries(roles).map(([role, hex]) => (
            <View key={role} style={styles.mappingRow}>
              <Text tone="secondary" variant="mono">
                {role.replace(/([A-Z])/g, '-$1').toLowerCase()}
              </Text>
              <Text tone="secondary" variant="mono">
                {hex}
              </Text>
            </View>
          ))}
          {readable ? null : (
            <Text tone="danger" variant="monoSmall">
              {t('theme.unreadable')}
            </Text>
          )}
        </Card>
      </Gutter>

      <Gutter style={styles.action}>
        <Button label={t('theme.export')} onPress={onExport} />
      </Gutter>
    </Screen>
  );
}

function Stat({
  value,
  label,
  background,
  border,
  textColor,
}: {
  value: string;
  label: string;
  background: string;
  border?: string;
  textColor?: string;
}) {
  const color = textColor ?? safeForegroundFor(background);
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: background },
        border ? { borderWidth: 1, borderColor: border } : null,
      ]}
    >
      <Text style={{ color, fontSize: 19, fontWeight: '600' }}>{value}</Text>
      <Text style={{ color, fontSize: 8.5, opacity: 0.75, letterSpacing: 1 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.cardGap },
  surfaces: { paddingTop: space.md, flexDirection: 'row', gap: space.xs },
  previewWrap: { paddingTop: space.md + 2 },
  preview: {
    borderRadius: round.media,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    padding: 18,
    gap: space.cardGap,
  },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { fontSize: 17, fontWeight: '600' },
  previewGlyph: { width: 30, height: 30, borderRadius: 10 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: round.control, padding: space.sm, gap: 5 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 },
  bar: { flex: 1, borderRadius: 5 },
  previewActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  previewButton: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGhost: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, opacity: 0.3 },
  mappingWrap: { paddingTop: space.md + 2 },
  mapping: { gap: 10 },
  mappingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { paddingTop: space.gutter },
});
