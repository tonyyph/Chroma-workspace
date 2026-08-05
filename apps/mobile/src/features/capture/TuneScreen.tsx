import { brandBands, brandColors, round, space, tint, ui } from '@chromawave/design-tokens';
import { contrastRatio, makeColor, type ColorRole, type Palette } from '@chromawave/domain';
import { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { hapticsService } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { BandCanvas, Card, Chip, Meta, NavBar, Screen, Slider, Text } from '@/ui';

/** Only the three named roles are tunable — 'extra' has no band. */
const ROLES = ['dominant', 'support', 'signal'] as const satisfies readonly ColorRole[];

type Adjust = { hue: number; saturation: number; luminance: number };
const NEUTRAL: Adjust = { hue: 0, saturation: 0, luminance: 0 };

/**
 * B3 · TUNE · "per-band HSL, live contrast verdict".
 *
 * "tuning happens on the three bands — never on individual swatches", so the
 * selector is the role, not the swatch. The contrast verdict recomputes from the
 * adjusted colour on every frame the slider settles.
 */
export function TuneScreen({
  palette,
  onCancel,
  onApply,
}: {
  palette: Palette;
  onCancel: () => void;
  onApply: (next: Palette) => void;
}) {
  const { width } = useWindowDimensions();
  const { t } = usePreferences();
  const [role, setRole] = useState<ColorRole>('dominant');
  const [adjust, setAdjust] = useState<Record<string, Adjust>>({});
  const [showing, setShowing] = useState<'before' | 'after'>('after');
  const current = adjust[role] ?? NEUTRAL;

  const tunedColors = useMemo(
    () =>
      palette.colors.map((color) => {
        const delta = adjust[color.role];
        if (!delta || color.locked) return color;
        return makeColor(applyAdjust(color.hex, delta), color.weight, color.role, color.locked);
      }),
    [palette.colors, adjust],
  );

  // BEFORE shows the capture as it came off the extractor, so the two chips are
  // an A/B of the edit rather than a pair of labels.
  const previewColors = showing === 'before' ? palette.colors : tunedColors;
  const bandColors = previewColors
    .filter((color) => color.role !== 'extra')
    .map((color) => color.hex);
  const signal = tunedColors.find((color) => color.role === 'signal');
  const ratio = signal ? contrastRatio(signal.hex, brandColors.surface) : 0;
  const verdict = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'FAIL';

  const update = (key: keyof Adjust, value: number) => {
    setAdjust((previous) => ({ ...previous, [role]: { ...current, [key]: value } }));
  };

  return (
    <Screen scroll={false}>
      <NavBar
        leading={t('tune.cancel')}
        onLeading={onCancel}
        onTrailing={() => onApply({ ...palette, colors: tunedColors, tuned: true })}
        title={t('tune.title')}
        trailing={t('tune.apply')}
      />

      <View style={styles.preview}>
        <BandCanvas
          background={ui.bg.media}
          blur={13}
          colors={bandColors.length >= 3 ? bandColors : brandBands}
          height={190}
          width={width - space.gutter * 2}
        />
        <View style={styles.previewChips}>
          <Chip
            label={t('tune.before')}
            onPress={() => setShowing('before')}
            tone={showing === 'before' ? 'selected' : 'default'}
          />
          <Chip
            label={t('tune.after')}
            onPress={() => setShowing('after')}
            tone={showing === 'after' ? 'selected' : 'default'}
          />
        </View>
      </View>

      <View style={styles.roleRow}>
        {ROLES.map((key) => (
          <Chip
            fill
            key={key}
            label={t(`onboarding.role.${key}`).toLocaleUpperCase()}
            onPress={() => setRole(key)}
            tone={role === key ? 'pro' : 'default'}
          />
        ))}
      </View>

      <Card style={styles.sliders}>
        <Labelled label={t('tune.hue')} value={`${Math.round(current.hue)}°`}>
          <Slider
            gradient={['#FF7A5C', '#FFC24A', '#22D3EE', '#7C5CFF', '#FF7A5C']}
            label={`${role} hue`}
            maximumValue={180}
            minimumValue={-180}
            onChange={(value) => update('hue', value)}
            value={current.hue}
            valueText={`${Math.round(current.hue)} degrees`}
          />
        </Labelled>
        <Labelled label={t('tune.saturation')} value={signed(current.saturation)}>
          <Slider
            gradient={['#3A3A44', '#7C5CFF']}
            label={`${role} saturation`}
            maximumValue={50}
            minimumValue={-50}
            onChange={(value) => update('saturation', value)}
            value={current.saturation}
          />
        </Labelled>
        <Labelled label={t('tune.luminance')} value={signed(current.luminance)}>
          <Slider
            gradient={['#0C0B18', '#EDEAE3']}
            label={`${role} luminance`}
            maximumValue={50}
            minimumValue={-50}
            onChange={(value) => update('luminance', value)}
            value={current.luminance}
          />
        </Labelled>
      </Card>

      <View style={styles.presets}>
        <Chip label={t('tune.preset.neutralise')} onPress={() => update('saturation', -30)} />
        <Chip label={t('tune.preset.warm')} onPress={() => update('hue', 15)} />
        <Chip label={t('tune.preset.cinema')} onPress={() => update('luminance', -12)} />
        <Chip
          label={t('tune.preset.reset')}
          onPress={() => {
            setAdjust({});
            void hapticsService.selection();
          }}
          tone="danger"
        />
      </View>

      <Card style={styles.contrast}>
        <View style={styles.contrastCopy}>
          <Text variant="cardTitle">{t('tune.contrast.title')}</Text>
          <Meta>{`signal on ink · ${ratio.toFixed(1)}:1 · ${verdict}`}</Meta>
        </View>
        <View style={[styles.verdict, verdict === 'FAIL' ? tint.danger : tint.info]}>
          <Text
            style={{ color: verdict === 'FAIL' ? tint.danger.color : tint.info.color }}
            variant="chip"
          >
            {t(verdict === 'FAIL' ? 'tune.contrast.fail' : 'tune.contrast.pass')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

function Labelled({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.labelled}>
      <View style={styles.labelledHead}>
        <Text tone="secondary" variant="chip">
          {label}
        </Text>
        <Text variant="chip">{value}</Text>
      </View>
      {children}
    </View>
  );
}

const signed = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value)}`;

/**
 * Applies an HSL delta to a hex. Hue rotates, saturation and luminance shift by
 * percentage points. The motion rule "never animate hue and luminance at once"
 * governs transitions, not this maths — a tune commits both at once on Apply.
 */
function applyAdjust(hex: string, adjust: Adjust): string {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  const h2 = (((h + adjust.hue) % 360) + 360) % 360;
  const s2 = Math.min(1, Math.max(0, s + adjust.saturation / 100));
  const l2 = Math.min(1, Math.max(0, l + adjust.luminance / 100));

  const c = (1 - Math.abs(2 * l2 - 1)) * s2;
  const x = c * (1 - Math.abs(((h2 / 60) % 2) - 1));
  const m = l2 - c / 2;
  const sector = Math.floor(h2 / 60) % 6;
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

const styles = StyleSheet.create({
  preview: {
    marginHorizontal: space.gutter,
    marginTop: space.md,
    height: 190,
    borderRadius: round.media,
    overflow: 'hidden',
    backgroundColor: ui.bg.media,
  },
  previewChips: {
    position: 'absolute',
    right: space.cardGap,
    top: space.sm,
    flexDirection: 'row',
    gap: 6,
  },
  roleRow: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.gutter,
    paddingTop: space.gutter,
  },
  sliders: {
    marginHorizontal: space.gutter,
    marginTop: space.cardGap,
    gap: space.md,
    paddingVertical: 18,
  },
  labelled: { gap: 2 },
  labelledHead: { flexDirection: 'row', justifyContent: 'space-between' },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    paddingHorizontal: space.gutter,
    paddingTop: space.cardGap,
  },
  contrast: {
    marginHorizontal: space.gutter,
    marginTop: 'auto',
    marginBottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contrastCopy: { gap: 3 },
  verdict: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
});
