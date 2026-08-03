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

      {/* The surface chips change what is previewed, not just which chip is lit:
          a palette that carries a dashboard can still fail as a poster, and the
          only way to see that is to render both. */}
      <Gutter style={styles.previewWrap}>
        <View style={[styles.preview, { backgroundColor: roles.surface }]}>
          {surface === 'APP UI' ? <AppUiPreview roles={roles} /> : null}
          {surface === 'WEB' ? <WebPreview roles={roles} /> : null}
          {surface === 'POSTER' ? <PosterPreview roles={roles} /> : null}
          {surface === 'SLIDE' ? <SlidePreview roles={roles} /> : null}
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

type Roles = {
  surface: string;
  onSurface: string;
  primary: string;
  support: string;
  accent: string;
};

/** The design's own preview: header, stat tiles, a chart and an action row. */
function AppUiPreview({ roles }: { roles: Roles }) {
  const { t } = usePreferences();
  return (
    <>
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
          <Text style={{ color: safeForegroundFor(roles.accent), fontSize: 13, fontWeight: '600' }}>
            {t('theme.primaryAction')}
          </Text>
        </View>
        <View style={[styles.previewGhost, { borderColor: roles.onSurface }]} />
      </View>
    </>
  );
}

/** A marketing page: nav, headline, body, call to action — long-form text on the ground. */
function WebPreview({ roles }: { roles: Roles }) {
  const { t } = usePreferences();
  return (
    <>
      <View style={styles.webNav}>
        <View style={[styles.webLogo, { backgroundColor: roles.primary }]} />
        {[52, 40, 46].map((width, index) => (
          <View
            key={index}
            style={[styles.webNavItem, { width, backgroundColor: roles.onSurface }]}
          />
        ))}
      </View>
      <Text style={[styles.webHeadline, { color: roles.onSurface }]}>{t('theme.webHeadline')}</Text>
      {[100, 92, 74].map((width, index) => (
        <View
          key={index}
          style={[styles.webLine, { width: `${width}%`, backgroundColor: roles.support }]}
        />
      ))}
      <View style={[styles.webCta, { backgroundColor: roles.accent }]}>
        <Text style={{ color: safeForegroundFor(roles.accent), fontSize: 12, fontWeight: '600' }}>
          {t('theme.primaryAction')}
        </Text>
      </View>
    </>
  );
}

/** Type at poster scale on a full bleed — the hardest test of a palette's contrast. */
function PosterPreview({ roles }: { roles: Roles }) {
  const { t } = usePreferences();
  return (
    <View style={styles.poster}>
      <View style={[styles.posterBleed, { backgroundColor: roles.primary }]} />
      <Text style={[styles.posterTitle, { color: roles.onSurface }]}>{t('theme.posterTitle')}</Text>
      <View style={styles.posterRule}>
        <View style={[styles.posterRuleLine, { backgroundColor: roles.accent }]} />
      </View>
      <Text style={[styles.posterMeta, { color: roles.support }]}>{t('theme.posterMeta')}</Text>
    </View>
  );
}

/** A presentation slide: eyebrow, title, and a swatch row as the footer. */
function SlidePreview({ roles }: { roles: Roles }) {
  const { t } = usePreferences();
  return (
    <View style={styles.slide}>
      <Text style={[styles.slideEyebrow, { color: roles.accent }]}>{t('theme.slideEyebrow')}</Text>
      <Text style={[styles.slideTitle, { color: roles.onSurface }]}>{t('theme.slideTitle')}</Text>
      <View style={styles.slideFooter}>
        {[roles.primary, roles.support, roles.accent].map((hex) => (
          <View key={hex} style={[styles.slideChip, { backgroundColor: hex }]} />
        ))}
      </View>
    </View>
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
  webNav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  webLogo: { width: 22, height: 22, borderRadius: 7 },
  webNavItem: { height: 6, borderRadius: 3, opacity: 0.55 },
  webHeadline: { fontSize: 24, lineHeight: 28, fontWeight: '600', letterSpacing: -0.4 },
  webLine: { height: 7, borderRadius: 4, opacity: 0.5 },
  webCta: {
    alignSelf: 'flex-start',
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  poster: { gap: space.sm, minHeight: 232 },
  posterBleed: { height: 74, borderRadius: round.control },
  posterTitle: { fontSize: 34, lineHeight: 36, fontWeight: '700', letterSpacing: -1 },
  posterRule: { flexDirection: 'row' },
  posterRuleLine: { height: 4, flex: 1, borderRadius: 2 },
  posterMeta: { fontSize: 11, letterSpacing: 2 },
  slide: { gap: space.sm, minHeight: 232, justifyContent: 'center' },
  slideEyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '600' },
  slideTitle: { fontSize: 28, lineHeight: 32, fontWeight: '600', letterSpacing: -0.6 },
  slideFooter: { flexDirection: 'row', gap: 8, marginTop: 'auto' },
  slideChip: { flex: 1, height: 12, borderRadius: 6 },
  mappingWrap: { paddingTop: space.md + 2 },
  mapping: { gap: 10 },
  mappingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { paddingTop: space.gutter },
});
