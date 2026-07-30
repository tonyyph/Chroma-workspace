import { round, space, ui } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';
import {
  Card,
  Chip,
  GradientCanvas,
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
  const { t } = usePreferences();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('LINEAR');
  const [interpolation, setInterpolation] = useState<(typeof INTERPOLATIONS)[number]>('OKLAB');
  const [angle, setAngle] = useState(152);
  const [grain, setGrain] = useState(true);

  const stops = palette.colors.map((color) => color.hex);
  const canvasWidth = width - space.gutter * 2;

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

      <View style={styles.exports}>
        <Chip fill label="CSS" onPress={() => {}} />
        <Chip fill label="PNG 4K" onPress={() => {}} />
        <Chip fill label="SVG" onPress={() => {}} />
        <Chip fill label={t('gradient.wallpaper')} tone="pro" />
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
  exports: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.gutter,
    paddingTop: space.gutter,
  },
});
