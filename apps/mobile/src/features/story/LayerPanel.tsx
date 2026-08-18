import { describeElement, type StoryElement } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Chip, Pressable, Text, useStyles } from '@/ui';

/**
 * The layers, as a list you can actually operate.
 *
 * **This is the accessibility surface for the canvas, not a convenience.** The
 * scene is one recorded Skia picture: there are no per-element views, so a
 * screen reader has nothing to walk and no way to reach an element at all. Tap
 * hit-testing works for a sighted user with a finger; this list is how everyone
 * else selects, reorders, hides and locks. Losing it would make the editor
 * unusable rather than merely inconvenient.
 *
 * **Front-to-back order, deliberately.** `project.layers` is back-to-front — the
 * array *is* the z-order — but a layers list is universally read top-down as
 * front-to-back, and matching the array instead would mean the item at the top
 * of the list is the thing furthest away.
 */
export function LayerPanel({
  layers,
  selectedId,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onMove,
}: {
  /** Back-to-front, exactly as the document stores them. */
  layers: readonly StoryElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onToggleLocked: (id: string, locked: boolean) => void;
  /** `toIndex` is an index into the document's array, not into this list. */
  onMove: (id: string, toIndex: number) => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();

  if (layers.length === 0) {
    return (
      <View style={styles.empty}>
        <Text tone="secondary" variant="meta">
          {t('story.editor.empty')}
        </Text>
      </View>
    );
  }

  // Front-to-back for display; the document index is carried alongside so every
  // callback speaks the document's language rather than the list's.
  const rows = layers
    .map((layer, index) => ({ layer, index }))
    .slice()
    .reverse();

  return (
    <ScrollView
      accessibilityLabel={t('story.a11y.layers')}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.panel}
    >
      {rows.map(({ layer, index }) => {
        const selected = layer.id === selectedId;
        const name = describeElement(layer);

        return (
          <View key={layer.id} style={[styles.row, selected && styles.rowSelected]}>
            <Pressable
              accessibilityHint={t('story.a11y.selected', { name })}
              accessibilityLabel={name}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(layer.id)}
              style={styles.name}
            >
              <Text numberOfLines={1} variant="meta">
                {name}
              </Text>
            </Pressable>

            <View style={styles.actions}>
              {/* Labels rather than icons alone: `localization.test.ts` forbids
                  glyphs in strings, and an icon-only control is unnamed to a
                  screen reader unless it carries its own label anyway. */}
              <Chip
                label={layer.hidden ? t('story.layer.show') : t('story.layer.hide')}
                onPress={() => onToggleHidden(layer.id, !layer.hidden)}
                tone={layer.hidden ? 'info' : 'default'}
              />
              <Chip
                label={layer.locked ? t('story.editor.unlock') : t('story.editor.lock')}
                onPress={() => onToggleLocked(layer.id, !layer.locked)}
                tone={layer.locked ? 'info' : 'default'}
              />
              {/* Reorder by button, not by drag. A drag-to-reorder list is
                  unreachable with a screen reader, and this list exists for
                  exactly the people that would exclude. */}
              <Chip
                label={t('story.layer.forward')}
                onPress={() => onMove(layer.id, Math.min(layers.length - 1, index + 1))}
              />
              <Chip
                label={t('story.layer.backward')}
                onPress={() => onMove(layer.id, Math.max(0, index - 1))}
              />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    panel: {
      maxHeight: 260,
    },
    list: {
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingVertical: space.sm,
    },
    empty: {
      paddingHorizontal: space.gutter,
      paddingVertical: space.sm,
    },
    row: {
      gap: space.xs,
      paddingVertical: space.xs,
      // Swiss separates with a rule; chroma can rely on its surfaces.
      borderBottomWidth: skin.chrome.rules ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: skin.ui.border.hairline,
    },
    rowSelected: {
      // A border, not only a tint: selection must not be signalled by colour
      // alone, and this reads in both skins.
      borderLeftWidth: 2,
      borderLeftColor: skin.ui.action.primary,
      paddingLeft: space.xs,
    },
    name: {
      minHeight: 48,
      justifyContent: 'center',
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.xs,
    },
  });
