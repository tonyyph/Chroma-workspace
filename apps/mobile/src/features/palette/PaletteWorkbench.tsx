import { space } from '@cw/tokens';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import { CardGroup, Gutter, Icon, Pressable, Text } from '@/ui';

/**
 * The four tools that transform a palette, in the order someone reaches for
 * them: check it, see it used, make a surface of it, measure it against another.
 */
const TOOLS = [
  // Grading leads: it is the only one that changes the photograph itself, and
  // the rest operate on what the photograph already gave up. The performance
  // follows it, because it plays the graded frame.
  { route: 'grade', labelKey: 'grade.title' },
  { route: 'living', labelKey: 'living.title' },
  { route: 'contrast', labelKey: 'contrast.title' },
  { route: 'theme', labelKey: 'theme.title' },
  { route: 'gradient', labelKey: 'gradient.title' },
  { route: 'compare', labelKey: 'compare.title' },
  // Last: it argues with the automatic read rather than building on it, and
  // most palettes never need it. It used to be the import screen — the way into
  // the app — which is why it opened a picker nobody had asked for.
  { route: 'pick', labelKey: 'import.title' },
] as const;

/**
 * THE WORKBENCH.
 *
 * Seven destinations as two grouped lists rather than a 2x2 grid of chips. The
 * grid gave them all identical weight and no order; a list has a reading
 * direction, room for the name to breathe, and a shape the eye already knows how
 * to scan. The split is real: four transform the palette, three take it out of
 * the app.
 */
export function PaletteWorkbench({
  paletteId,
  accentColor,
}: {
  paletteId: string;
  /** The palette's own voice for the section headings, when it has one. */
  accentColor?: string | undefined;
}) {
  const router = useRouter();
  const { t } = usePreferences();
  const headingStyle = accentColor ? { color: accentColor } : undefined;

  return (
    <>
      <Gutter style={styles.sectionHead}>
        <Text style={headingStyle} tone="tertiary" variant="eyebrow">
          {t('palette.tools')}
        </Text>
      </Gutter>
      <Gutter>
        <CardGroup>
          {TOOLS.map((tool) => (
            <ToolRow
              key={tool.route}
              label={t(tool.labelKey)}
              onPress={() => router.push(`/tools/${tool.route}?id=${paletteId}`)}
            />
          ))}
        </CardGroup>
      </Gutter>

      {/* And the three that take it out of the app. */}
      <Gutter style={styles.sectionHead}>
        <Text style={headingStyle} tone="tertiary" variant="eyebrow">
          {t('export.title')}
        </Text>
      </Gutter>
      <Gutter>
        <CardGroup>
          <ToolRow
            label={t('export.title')}
            onPress={() => router.push(`/tools/export?id=${paletteId}`)}
          />
          <ToolRow
            label={t('palette.widgets')}
            onPress={() => router.push(`/tools/widgets?id=${paletteId}`)}
          />
          <ToolRow
            label={t('common.proJson')}
            locked
            onPress={() => router.push('/paywall?trigger=json-export')}
          />
        </CardGroup>
      </Gutter>
    </>
  );
}

/** One row of a grouped list: name, an optional Pro mark, and a chevron. */
function ToolRow({
  label,
  onPress,
  locked = false,
}: {
  label: string;
  onPress: () => void;
  locked?: boolean;
}) {
  const skin = useSkin();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.toolRow}
    >
      <Text style={styles.toolLabel} variant="rowTitle">
        {label}
      </Text>
      {locked ? (
        <View style={[styles.pro, skin.tint.pro, { borderRadius: skin.round.chip }]}>
          <Text style={{ color: skin.tint.pro.color }} variant="chip">
            PRO
          </Text>
        </View>
      ) : null}
      <Icon color={skin.ui.text.tertiary} name="forward" scale="inline" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionHead: { paddingTop: space.sectionGap, paddingBottom: space.xs },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toolLabel: { flex: 1 },
  pro: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
});
