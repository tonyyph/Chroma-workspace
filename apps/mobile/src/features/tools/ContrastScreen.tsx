import { contrastRatio, simulateVisionHex, type Palette, type VisionSimulation } from '@cw/domain';
import { brandColors, space, type Skin } from '@cw/tokens';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import {
  Button,
  Card,
  Chip,
  Gutter,
  Icon,
  Meta,
  Screen,
  ScreenHeader,
  Text,
  useStyles,
} from '@/ui';

type Verdict = 'AAA' | 'AA' | 'FAIL';

const SIMULATIONS = ['DEUTER', 'PROTAN', 'TRITAN', 'GREY'] as const;
type Simulation = (typeof SIMULATIONS)[number] | null;

/** The chip labels map onto the domain's simulation names. */
const SIMULATION_KEYS: Record<(typeof SIMULATIONS)[number], VisionSimulation> = {
  DEUTER: 'deuter',
  PROTAN: 'protan',
  TRITAN: 'tritan',
  GREY: 'grey',
};

/**
 * G4 · CONTRAST · "verdicts as text, one-tap accessible fix".
 *
 * Ratios are computed with the real WCAG relative-luminance formula, and the
 * suggested fix is derived by walking luminance down while holding hue — the
 * design's own description of it ("Luminance −18, hue held").
 */
export function ContrastScreen({
  palette,
  onApplyFix,
}: {
  palette: Palette;
  /** Writes the suggested colour back onto the palette. Absent when read-only. */
  onApplyFix?: (from: string, to: string) => void;
}) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const [simulation, setSimulation] = useState<Simulation>(null);

  /**
   * Every colour drawn below goes through here, so selecting a simulation
   * repaints the samples rather than captioning them. Ratios stay on the true
   * colours: WCAG is defined for typical vision, and a dichromat's contrast is
   * not what the standard measures.
   */
  const shown = useCallback(
    (hex: string) => (simulation ? simulateVisionHex(hex, SIMULATION_KEYS[simulation]) : hex),
    [simulation],
  );

  const checks = useMemo(() => {
    const grounds: readonly { ground: string; label: string }[] = [
      { ground: palette.colors[0]?.hex ?? brandColors.violet, label: t('contrast.onDominant') },
      { ground: brandColors.surface, label: t('contrast.onSurface') },
      { ground: '#F1E7D6', label: t('contrast.onPaper') },
    ];
    return grounds.map(({ ground, label }, index) => {
      const foreground = index === 0 ? '#FFFFFF' : (palette.colors[index]?.hex ?? '#FFFFFF');
      const ratio = contrastRatio(foreground, ground);
      return { foreground, ground, label, ratio, verdict: verdictFor(ratio) };
    });
  }, [palette.colors, t]);

  const failing = checks.find((check) => check.verdict === 'FAIL');
  const fix = failing ? suggestFix(failing.foreground, failing.ground) : null;

  return (
    <Screen>
      <Gutter style={styles.head}>
        <ScreenHeader
          meta={t('contrast.meta', { name: palette.name })}
          title={t('contrast.title')}
        />
      </Gutter>

      <Gutter style={styles.samplesWrap}>
        <View style={styles.samples}>
          <View
            style={[styles.sample, { backgroundColor: shown(palette.colors[0]?.hex ?? '#000') }]}
          >
            <Text style={styles.sampleTitle}>{t('contrast.largeSample')}</Text>
            <Text style={styles.sampleBody}>{t('contrast.largeBody')}</Text>
          </View>
          <View style={[styles.sample, { backgroundColor: brandColors.surface }]}>
            <Text style={[styles.sampleTitle, { color: shown(palette.colors[2]?.hex ?? '#FFF') }]}>
              {t('contrast.signalOnInk')}
            </Text>
            <Text style={styles.sampleBodyMuted}>{t('contrast.signalBody')}</Text>
          </View>
        </View>
      </Gutter>

      <Gutter style={styles.checks}>
        {checks.map((check) => (
          <Card
            key={check.label}
            style={[styles.check, check.verdict === 'FAIL' && styles.checkFail]}
          >
            <View style={[styles.checkSwatch, { backgroundColor: shown(check.foreground) }]} />
            <Text tone="secondary" variant="mono">
              {check.label}
            </Text>
            <Text
              style={styles.ratio}
              tone={check.verdict === 'FAIL' ? 'danger' : 'primary'}
              variant="mono"
            >
              {`${check.ratio.toFixed(1)}:1`}
            </Text>
            {/* Verdicts are text, per the accessibility gate — never colour alone. */}
            <View
              style={[styles.verdict, check.verdict === 'FAIL' ? skin.tint.danger : skin.tint.info]}
            >
              <Text
                style={{
                  color: check.verdict === 'FAIL' ? skin.tint.danger.color : skin.tint.info.color,
                }}
                variant="chip"
              >
                {check.verdict}
              </Text>
            </View>
          </Card>
        ))}
      </Gutter>

      {failing && fix ? (
        <Gutter style={styles.fixWrap}>
          <Card style={styles.fix}>
            <Text tone="secondary" variant="eyebrow">
              {t('contrast.suggestedFix')}
            </Text>
            <View style={styles.fixRow}>
              <View style={[styles.fixSwatch, { backgroundColor: shown(failing.foreground) }]} />
              <Icon color={skin.ui.text.tertiary} name="arrowRight" />
              <View style={[styles.fixSwatch, { backgroundColor: shown(fix.hex) }]} />
              <View style={styles.fixCopy}>
                <Text tone="secondary" variant="mono">
                  {`${fix.hex} · ${fix.ratio.toFixed(1)}:1 · ${verdictFor(fix.ratio)}`}
                </Text>
                <Text tone="tertiary" variant="body">
                  {t('contrast.fixNote', { delta: fix.luminanceDelta })}
                </Text>
              </View>
            </View>
            {/* A suggestion the user cannot take is just a remark. Applying it
                writes the corrected colour back onto the palette. */}
            {onApplyFix && palette.colors.some((color) => color.hex === failing.foreground) ? (
              <Button
                label={t('contrast.applyFix')}
                onPress={() => onApplyFix(failing.foreground, fix.hex)}
                size="xs"
              />
            ) : null}
          </Card>
        </Gutter>
      ) : null}

      <Gutter style={styles.simulations}>
        {SIMULATIONS.map((name) => (
          <Chip
            fill
            key={name}
            label={name}
            onPress={() => setSimulation(simulation === name ? null : name)}
            tone={simulation === name ? 'selected' : 'default'}
          />
        ))}
      </Gutter>
      {simulation ? (
        <Gutter style={styles.simulationNote}>
          <Meta>{t('contrast.simulationNote', { name: simulation })}</Meta>
        </Gutter>
      ) : null}
    </Screen>
  );
}

function verdictFor(ratio: number): Verdict {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'FAIL';
}

/**
 * Walks luminance down in 2% steps, holding hue and saturation, until the pair
 * clears AA. Returns the first passing colour so the fix is the smallest change
 * that works rather than an arbitrary darker shade.
 */
function suggestFix(
  foreground: string,
  ground: string,
): { hex: string; ratio: number; luminanceDelta: string } | null {
  const value = Number.parseInt(foreground.replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
  }
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  for (let step = 1; step <= 40; step += 1) {
    const nextLightness = lightness - step * 0.02;
    if (nextLightness <= 0) break;
    const hex = hslToHex(hue, saturation, nextLightness);
    const ratio = contrastRatio(hex, ground);
    if (ratio >= 4.5) {
      return { hex, ratio, luminanceDelta: `−${Math.round(step * 2)}` };
    }
  }
  return null;
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  const sector = Math.floor((((hue % 360) + 360) % 360) / 60) % 6;
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector] ?? [0, 0, 0];
  return `#${rgb
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, (channel + m) * 255)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    head: { paddingTop: space.cardGap },
    samplesWrap: { paddingTop: space.md + 2 },
    samples: {
      borderRadius: skin.round.media - 2,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: skin.ui.border.hairlineStrong,
    },
    sample: { padding: space.gutter, gap: 4 },
    sampleTitle: { fontSize: 21, lineHeight: 25, fontWeight: '600', color: '#FFFFFF' },
    /* appearance-exempt: these are the measurement, not the chrome. */
    /**
     * Fixed, like the grounds beneath them: these lines sit *inside* the
     * contrast samples, demonstrating readable and unreadable copy against a
     * known surface. They are part of the measurement, not app chrome, and
     * following the skin would change what the screen claims to prove.
     */
    sampleBody: { fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,.9)' },
    sampleBodyMuted: { fontSize: 13.5, lineHeight: 20, color: 'rgba(237,234,227,.75)' },
    checks: { paddingTop: space.md + 2, gap: 9 },
    check: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.cardGap,
      paddingVertical: 12,
      borderRadius: skin.round.control,
    },
    checkFail: {
      backgroundColor: skin.tint.danger.backgroundColor,
      borderColor: skin.tint.danger.borderColor,
    },
    checkSwatch: { width: 24, height: 24, borderRadius: skin.round.swatch },
    ratio: { flex: 1, textAlign: 'right', fontSize: 13 },
    verdict: {
      borderWidth: 1,
      borderRadius: skin.round.chip,
      paddingHorizontal: 9,
      paddingVertical: 7,
    },
    fixWrap: { paddingTop: space.md + 2 },
    fix: { gap: space.sm },
    fixRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    fixSwatch: { width: 44, height: 44, borderRadius: skin.round.control - 2 },
    fixCopy: { flex: 1, gap: 3 },
    simulations: { paddingTop: space.md + 2, flexDirection: 'row', gap: space.xs },
    simulationNote: { paddingTop: space.xs },
  });
