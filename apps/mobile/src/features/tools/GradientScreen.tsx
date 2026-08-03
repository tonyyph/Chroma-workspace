import { round, space, ui } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { gradientSvg, renderGradientPng, shareFile } from '@/lib/export';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  Card,
  Chip,
  GradientCanvas,
  InlineError,
  NavBar,
  Screen,
  Slider,
  Text,
  Toggle,
  type GradientKind,
  type Interpolation,
} from '@/ui';

const KINDS = ['LINEAR', 'RADIAL', 'CONIC', 'MESH'] as const;
const INTERPOLATIONS = ['OKLAB', 'SRGB', 'HSL'] as const;

/**
 * G5 · GRADIENT STUDIO · "OKLab by default, grain optional".
 *
 * All four modes render on the GPU: linear and radial are Skia gradients, conic
 * is a sweep, and mesh is a four-corner SkSL shader.
 */
export function GradientScreen({
  palette,
  onClose,
  onSave,
}: {
  palette: Palette;
  onClose: () => void;
  onSave: () => void;
}) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { t } = usePreferences();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('LINEAR');
  const [interpolation, setInterpolation] = useState<(typeof INTERPOLATIONS)[number]>('OKLAB');
  const [angle, setAngle] = useState(152);
  const [grain, setGrain] = useState(true);

  const [busy, setBusy] = useState<'png' | 'svg' | null>(null);
  const [exportFailed, setExportFailed] = useState(false);

  const copyCss = useCallback(() => {
    const stops = palette.colors.map((color) => color.hex.toLowerCase()).join(', ');
    const css =
      kind === 'LINEAR'
        ? `background: linear-gradient(${Math.round(angle)}deg, ${stops});`
        : kind === 'RADIAL'
          ? `background: radial-gradient(circle at 50% 50%, ${stops});`
          : `background: conic-gradient(from ${Math.round(angle)}deg, ${stops});`;
    void Clipboard.setStringAsync(css);
  }, [palette.colors, kind, angle]);

  const stops = palette.colors.map((color) => color.hex);
  const canvasWidth = width - space.gutter * 2;
  const slug = palette.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-');

  const shape = {
    colors: stops,
    kind: kind.toLowerCase() as GradientKind,
    angle,
    interpolation: interpolation.toLowerCase() as Interpolation,
  };

  /**
   * Renders at 4K rather than snapshotting the on-screen canvas — the preview is
   * a few hundred points wide and upscaling it would not be a 4K wallpaper.
   */
  const exportPng = async () => {
    setBusy('png');
    setExportFailed(false);
    const bytes = renderGradientPng({ ...shape, width: 3840, height: 2160 });
    const outcome = bytes ? await shareFile(bytes, `${slug}-gradient.png`) : 'failed';
    if (outcome === 'failed') setExportFailed(true);
    setBusy(null);
  };

  const exportSvg = async () => {
    setBusy('svg');
    setExportFailed(false);
    const markup = gradientSvg({ ...shape, width: 1920, height: 1080 });
    const outcome = await shareFile(markup, `${slug}-gradient.svg`);
    if (outcome === 'failed') setExportFailed(true);
    setBusy(null);
  };

  return (
    <Screen>
      <NavBar
        leading={t('gradient.close')}
        onLeading={onClose}
        onTrailing={onSave}
        title={t('gradient.title')}
        trailing={t('gradient.save')}
      />

      <View style={styles.canvasWrap}>
        <View style={styles.canvas}>
          <GradientCanvas
            angle={angle}
            colors={stops}
            grain={grain}
            height={250}
            interpolation={interpolation.toLowerCase() as Interpolation}
            kind={kind.toLowerCase() as GradientKind}
            width={canvasWidth}
          />
          {stops.slice(0, 3).map((hex, index) => (
            <View
              key={hex}
              style={[
                styles.handle,
                { backgroundColor: hex, left: `${22 + index * 28}%`, top: `${24 + index * 28}%` },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.kinds}>
        {KINDS.map((entry) => (
          <Chip
            fill
            key={entry}
            label={entry}
            onPress={() => setKind(entry)}
            tone={kind === entry ? 'pro' : 'default'}
          />
        ))}
      </View>

      <Card style={styles.controls}>
        <View style={styles.control}>
          <View style={styles.controlHead}>
            <Text tone="secondary" variant="chip">
              {t('gradient.angle')}
            </Text>
            <Text variant="chip">{`${Math.round(angle)}°`}</Text>
          </View>
          <Slider
            label={t('gradient.angle')}
            maximumValue={360}
            onChange={setAngle}
            value={angle}
            valueText={`${Math.round(angle)} degrees`}
          />
        </View>

        <View style={styles.control}>
          <View style={styles.controlHead}>
            <Text tone="secondary" variant="chip">
              {t('gradient.interpolation')}
            </Text>
            <Text variant="chip">{interpolation}</Text>
          </View>
          <View style={styles.interpolations}>
            {INTERPOLATIONS.map((entry) => (
              <Chip
                fill
                key={entry}
                label={entry}
                onPress={() => setInterpolation(entry)}
                tone={interpolation === entry ? 'selected' : 'default'}
              />
            ))}
          </View>
        </View>

        <View style={styles.grainRow}>
          <Text style={styles.grainLabel}>{t('gradient.grain')}</Text>
          <Toggle label={t('gradient.grain')} onValueChange={setGrain} value={grain} />
        </View>
      </Card>

      {exportFailed ? (
        <View style={styles.error}>
          <InlineError
            detail={t('gradient.exportFailedDetail')}
            title={t('gradient.exportFailed')}
          />
        </View>
      ) : null}

      <View style={styles.exports}>
        <Chip fill label={t('common.css')} onPress={copyCss} />
        <Chip
          fill
          label={busy === 'png' ? t('common.working') : 'PNG 4K'}
          onPress={() => void exportPng()}
        />
        <Chip
          fill
          label={busy === 'svg' ? t('common.working') : t('common.svg')}
          onPress={() => void exportSvg()}
        />
        <Chip
          fill
          label={t('gradient.wallpaper')}
          onPress={() => router.push('/paywall?trigger=json-export')}
          tone="pro"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  canvasWrap: { paddingHorizontal: space.gutter, paddingTop: space.md },
  canvas: { height: 250, borderRadius: round.media, overflow: 'hidden' },
  handle: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  kinds: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.gutter,
    paddingTop: space.md + 2,
  },
  controls: {
    marginHorizontal: space.gutter,
    marginTop: space.md + 2,
    gap: space.md,
    paddingVertical: 18,
  },
  control: { gap: 2 },
  controlHead: { flexDirection: 'row', justifyContent: 'space-between' },
  interpolations: { flexDirection: 'row', gap: space.xs, paddingTop: space.xs },
  grainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grainLabel: { fontSize: 14, color: ui.text.primary },
  error: { paddingHorizontal: space.gutter, paddingTop: space.md },
  exports: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.gutter,
    paddingTop: space.gutter,
  },
});
