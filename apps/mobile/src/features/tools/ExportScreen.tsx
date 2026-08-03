import type { ExportFormat } from '@chromawave/analytics';
import { round, space, tint, ui } from '@chromawave/design-tokens';
import { rgbToDisplayP3, type Palette } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, Card, Chip, InlineError, NavBar, Screen, Text, Toggle } from '@/ui';

const TARGETS = ['CSS', 'TAILWIND', 'SWIFT', 'JSON'] as const;
type Target = (typeof TARGETS)[number];

/**
 * G7 · CODE EXPORT · "four targets, P3 fallbacks on by default".
 *
 * The code is generated from the palette rather than templated, so what the user
 * copies always matches what they see. Role names map onto the app's own
 * vocabulary; the semantic-naming variant is the Pro gate.
 */
export function ExportScreen({
  palette,
  isPro,
  onClose,
}: {
  palette: Palette;
  isPro: boolean;
  onClose: () => void;
}) {
  const { t, preferences } = usePreferences();
  // D2's "DEFAULT EXPORT" row decides which target this opens on — that setting
  // has no other effect, and a preference that changes nothing is not one.
  const [target, setTarget] = useState<Target>(
    preferences.defaultExport.toLocaleUpperCase() as Target,
  );
  const [includeTints, setIncludeTints] = useState(true);
  const [includeP3, setIncludeP3] = useState(preferences.colorSpace === 'p3');
  const [sendFailed, setSendFailed] = useState(false);

  const code = useMemo(
    () => generate(palette, target, { includeTints, includeP3 }),
    [palette, target, includeTints, includeP3],
  );

  const copy = () => {
    void Clipboard.setStringAsync(code);
    analytics.track('export_performed', {
      format: target.toLowerCase() as ExportFormat,
      isPro,
    });
  };

  const sendTo = async (url: string) => {
    setSendFailed(false);
    copy();
    try {
      await Linking.openURL(url);
    } catch {
      // The code is on the clipboard either way, so the copy still happened —
      // only the hand-off failed, and saying so is better than looking inert.
      setSendFailed(true);
    }
  };

  return (
    <Screen>
      <NavBar
        leading={t('export.close')}
        onLeading={onClose}
        onTrailing={copy}
        title={t('export.title')}
        trailing={t('export.copy')}
      />

      <View style={styles.targets}>
        {TARGETS.map((entry) => (
          <Chip
            key={entry}
            label={entry}
            onPress={() => setTarget(entry)}
            tone={target === entry ? 'selected' : 'default'}
          />
        ))}
      </View>

      <View style={styles.codeWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.code}>
          <Text selectable style={styles.codeText} variant="mono">
            {code}
          </Text>
        </ScrollView>
      </View>

      <View style={styles.options}>
        <Option label={t('export.includeTints')} onChange={setIncludeTints} value={includeTints} />
        <Option label={t('export.p3')} onChange={setIncludeP3} value={includeP3} />
        <Option label={t('export.semanticNames')} locked={!isPro} value={isPro} />
      </View>

      {/* Neither destination has an API to post to without an account, so each
          copies what it needs and opens the place it goes. That is one paste
          short of automatic, and it is honest about what it did. */}
      <View style={styles.destinations}>
        <Card
          accessibilityLabel={t('export.figma')}
          onPress={() => void sendTo('https://www.figma.com/')}
          style={styles.destination}
        >
          <Text tone="tertiary" variant="eyebrow">
            {t('export.sendTo')}
          </Text>
          <Text variant="cardTitle">{t('export.figma')}</Text>
        </Card>
        <Card
          accessibilityLabel={t('export.gist')}
          onPress={() => void sendTo('https://gist.github.com/')}
          style={styles.destination}
        >
          <Text tone="tertiary" variant="eyebrow">
            {t('export.sendTo')}
          </Text>
          <Text variant="cardTitle">{t('export.gist')}</Text>
        </Card>
      </View>

      {sendFailed ? (
        <View style={styles.error}>
          <InlineError detail={t('export.openFailedDetail')} title={t('export.openFailed')} />
        </View>
      ) : null}

      <View style={styles.action}>
        <Button label={t('export.copyToClipboard')} onPress={copy} variant="contrast" />
      </View>
    </Screen>
  );
}

function Option({
  label,
  value,
  onChange,
  locked = false,
}: {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  locked?: boolean;
}) {
  return (
    <Card style={styles.option}>
      <Text style={styles.optionLabel} tone={locked ? 'secondary' : 'primary'}>
        {label}
      </Text>
      {locked ? (
        <View style={[styles.pro, tint.pro]}>
          <Text style={{ color: tint.pro.color }} variant="chip">
            PRO
          </Text>
        </View>
      ) : (
        <Toggle label={label} onValueChange={onChange} value={value} />
      )}
    </Card>
  );
}

type Options = { includeTints: boolean; includeP3: boolean };

function generate(palette: Palette, target: Target, options: Options): string {
  const named = palette.colors.map((color, index) => ({
    name: color.role === 'extra' ? `extra-${index}` : color.role,
    color,
  }));

  if (target === 'JSON') {
    return JSON.stringify(
      {
        name: palette.name,
        space: palette.space,
        colors: named.map(({ name, color }) => ({
          name,
          hex: color.hex,
          weight: color.weight,
          oklch: color.oklch,
          ...(options.includeP3 ? { displayP3: rgbToDisplayP3(color.rgb) } : {}),
        })),
      },
      null,
      2,
    );
  }

  if (target === 'SWIFT') {
    const lines = named.map(
      ({ name, color }) =>
        `    static let ${camel(name)} = Color(red: ${(color.rgb.red / 255).toFixed(3)}, green: ${(color.rgb.green / 255).toFixed(3)}, blue: ${(color.rgb.blue / 255).toFixed(3)})`,
    );
    return `extension Color {\n${lines.join('\n')}\n}`;
  }

  if (target === 'TAILWIND') {
    const entries = named.map(({ name, color }) => `        '${name}': '${color.hex}',`);
    return `module.exports = {\n  theme: {\n    extend: {\n      colors: {\n${entries.join('\n')}\n      },\n    },\n  },\n};`;
  }

  // CSS — the default, and the one drawn in the design.
  const lines = named.flatMap(({ name, color }) => {
    const rows = [`  --${name}: ${color.hex.toLowerCase()};`];
    if (options.includeP3) {
      const p3 = rgbToDisplayP3(color.rgb);
      rows.push(
        `  --${name}-p3: color(display-p3 ${(p3.red / 255).toFixed(4)} ${(p3.green / 255).toFixed(4)} ${(p3.blue / 255).toFixed(4)});`,
      );
    }
    if (options.includeTints) {
      rows.push(`  --${name}-tint: oklch(from var(--${name}) calc(l + 0.12) c h);`);
      rows.push(`  --${name}-shade: oklch(from var(--${name}) calc(l - 0.12) c h);`);
    }
    return rows;
  });
  return `:root {\n${lines.join('\n')}\n}`;
}

const camel = (value: string) =>
  value.replace(/-([a-z0-9])/g, (_, character: string) => character.toUpperCase());

const styles = StyleSheet.create({
  targets: { flexDirection: 'row', gap: 7, paddingHorizontal: space.gutter, paddingTop: space.md },
  codeWrap: { paddingHorizontal: space.gutter, paddingTop: space.md },
  code: {
    backgroundColor: ui.bg.base === '#08070E' ? '#0C0B18' : ui.bg.base,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    borderRadius: round.card,
    maxHeight: 220,
  },
  codeText: { padding: space.md, lineHeight: 21, color: 'rgba(237,234,227,.82)' },
  options: { paddingHorizontal: space.gutter, paddingTop: space.md + 2, gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.cardGap,
    paddingVertical: 13,
    borderRadius: round.control,
  },
  optionLabel: { fontSize: 14 },
  pro: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  destinations: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: space.gutter,
    paddingTop: space.md + 2,
  },
  destination: { flex: 1, gap: space.xs },
  error: { paddingHorizontal: space.gutter, paddingTop: space.md },
  action: { paddingHorizontal: space.gutter, paddingTop: space.gutter },
});
