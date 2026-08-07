import { elevation, round, space, ui } from '@chromawave/design-tokens';
import {
  contrastRatio,
  paletteGaps,
  type Color,
  type Palette,
  type PaletteSet,
} from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { PalettePhoto } from '@/features/library/PalettePhoto';
import { useAccent, useChromaticSurface } from '@/hooks';
import { usePreferences } from '@/providers';
import {
  Button,
  Card,
  Chip,
  ConfirmSheet,
  Gutter,
  Icon,
  Meta,
  NavBar,
  NoticeSheet,
  Pressable,
  PromptSheet,
  Screen,
  Text,
} from '@/ui';

/**
 * C3 · COLLECTION — the set as a working system rather than a folder.
 *
 * **What changed and why.** This screen used to be a list of rows with a locked
 * "MERGED SET · PRO" teaser stapled to the bottom. Everything on it described
 * what the set *contained*; nothing said what the set could be *used for*, and
 * the one thing that would have — the merged palette — was a picture of a
 * feature rather than the feature.
 *
 * A set of twenty captures of the same kitchen is not twenty palettes. It is one
 * palette measured twenty times. So the merged system is computed on every
 * membership change (`libraryStore`) and leads the screen:
 *
 *  1. the system itself, full width, at the proportions the merge actually
 *     produced — not a strip of equal chips;
 *  2. what it can and cannot do, as real rendered pairings rather than a matrix
 *     of numbers, because "these two can hold text" is a thing to be shown;
 *  3. the one gap worth answering, with the one action that answers it;
 *  4. and only then the members, which are the raw material, not the product.
 *
 * The merge is no longer a Pro teaser. Selling a locked picture of a palette the
 * app could compute for free was the weakest thing on this screen.
 */
export function CollectionScreen({
  set,
  palettes,
  onBack,
  onCaptureForGap,
  onOpenPalette,
  onRename,
  onRemovePalette,
  onDelete,
}: {
  set: PaletteSet;
  palettes: readonly Palette[];
  onBack: () => void;
  onCaptureForGap: () => void;
  onOpenPalette: (paletteId: string) => void;
  onRename: (name: string) => void;
  onRemovePalette: (paletteId: string) => void;
  onDelete: () => void;
}) {
  const { t, feedback } = usePreferences();
  const members = set.members.length;
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [inviteNoticeOpen, setInviteNoticeOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Memoised because the `?? []` fallback is a fresh array on every render, and
  // an unstable identity here would re-run the gap analysis — and re-render the
  // pairings — on every keystroke in the rename sheet.
  const system = useMemo(() => set.merged ?? [], [set.merged]);
  // A project's field is the system it has built so far.
  useChromaticSurface(system.length ? system : null);
  // The project's own accent, used on the two labels that name its parts.
  const accent = useAccent(system.length ? system : null);
  // Only the first gap is shown. Three sentences of criticism about someone's
  // own work reads as a scolding; one reads as a next step.
  const gap = useMemo(() => paletteGaps(system)[0] ?? null, [system]);

  /**
   * Exporting a set is the palettes it holds, as one CSS block namespaced per
   * palette — the format that survives being pasted into a stylesheet, which is
   * what someone exporting a whole collection is about to do.
   */
  const exportSet = () => {
    const blocks = palettes.map((palette) => {
      const slug = palette.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-');
      const lines = palette.colors.map(
        (color, index) =>
          `  --${slug}-${color.role === 'extra' ? `extra-${index}` : color.role}: ${color.hex.toLocaleLowerCase()};`,
      );
      return lines.join('\n');
    });
    void Clipboard.setStringAsync(`/* ${set.name} */\n:root {\n${blocks.join('\n')}\n}`);
    void feedback.success();
  };

  /**
   * There is no account system, so an invite is the deep link to this set. On a
   * second device the link only resolves once the set exists there — which the
   * copy says, rather than the button pretending to have sent something.
   */
  const invite = () => {
    void Clipboard.setStringAsync(Linking.createURL(`/set/${set.id}`));
    setInviteNoticeOpen(true);
  };

  return (
    <Screen>
      <NavBar
        leading={t('collection.back')}
        leadingIcon="back"
        onLeading={onBack}
        onTrailing={() => setEditing((current) => !current)}
        trailing={t(editing ? 'common.done' : 'collection.edit')}
      />

      <Gutter style={styles.head}>
        <Text variant="title">{set.name}</Text>
        <Meta>
          {members > 1
            ? t('collection.meta.shared', { count: set.paletteIds.length, people: members - 1 })
            : t('collection.meta.private', { count: set.paletteIds.length })}
        </Meta>
      </Gutter>

      {/* The system, at the proportions the merge produced. Adding a member
          re-weights these bands, and the layout transition is what makes that
          legible as a consequence of the capture rather than a new screen. */}
      <Gutter style={styles.systemWrap}>
        <Text
          style={[styles.eyebrow, accent ? { color: accent.color } : null]}
          tone="tertiary"
          variant="eyebrow"
        >
          {t('collection.system')}
        </Text>
        {system.length ? (
          <>
            <Animated.View
              accessibilityLabel={system.map((color) => color.hex).join(', ')}
              layout={LinearTransition.duration(320)}
              style={styles.system}
            >
              {system.map((color) => (
                <Animated.View
                  key={color.hex}
                  layout={LinearTransition.duration(320)}
                  style={{ flex: color.weight, backgroundColor: color.hex }}
                />
              ))}
            </Animated.View>
            <Meta style={styles.systemMeta}>
              {t('collection.system.meta', { count: palettes.length })}
            </Meta>
          </>
        ) : (
          <Card style={styles.systemEmpty}>
            <Text tone="secondary" variant="body">
              {t('collection.system.empty')}
            </Text>
          </Card>
        )}
      </Gutter>

      {/* One sentence, one action. A gap the user disagrees with is worse than
          no gap at all, so only the three measurable ones are ever raised. */}
      {system.length ? (
        <Gutter style={styles.gapWrap}>
          {gap ? (
            <Card style={styles.gap}>
              <Text style={styles.gapCopy} tone="secondary" variant="body">
                {t(`collection.gap.${gap.kind}`)}
              </Text>
              <Button
                label={t('collection.gap.action')}
                onPress={onCaptureForGap}
                size="xs"
                variant="secondary"
              />
            </Card>
          ) : (
            <Meta tone="info">{t('collection.gap.none')}</Meta>
          )}
        </Gutter>
      ) : null}

      {system.length > 1 ? <Pairings colors={system} /> : null}

      <Gutter style={styles.actions}>
        {editing ? (
          <>
            <Chip fill label={t('collection.rename')} onPress={() => setRenaming(true)} />
            <Chip
              fill
              label={t('collection.deleteSet')}
              onPress={() => setDeleteConfirmOpen(true)}
              tone="danger"
            />
          </>
        ) : (
          <>
            <Chip fill label={t('collection.exportSet')} onPress={exportSet} />
            <Chip fill label={t('collection.invite')} onPress={invite} />
          </>
        )}
      </Gutter>

      <Gutter style={styles.membersHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('collection.members')}
        </Text>
      </Gutter>

      <Gutter style={styles.rows}>
        {palettes.map((palette) => (
          <Card
            accessibilityLabel={palette.name}
            key={palette.id}
            // While editing, the row's job is the remove button beside it — a
            // tap that navigated away mid-edit would be a trap.
            {...(editing ? {} : { onPress: () => onOpenPalette(palette.id) })}
            style={styles.row}
          >
            <PalettePhoto palette={palette} style={styles.rowThumb} />
            <View style={styles.rowCopy}>
              <Text variant="cardTitle">{palette.name}</Text>
              <Meta style={styles.rowMeta}>{t('collection.addedByYou')}</Meta>
            </View>
            {editing ? (
              <Pressable
                accessibilityLabel={t('collection.removePalette', { name: palette.name })}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => onRemovePalette(palette.id)}
                style={styles.remove}
              >
                <Icon color={ui.status.dangerText} name="remove" scale="inline" />
              </Pressable>
            ) : null}
          </Card>
        ))}
      </Gutter>

      <PromptSheet
        cancelLabel={t('common.cancel')}
        confirmLabel={t('common.save')}
        initialValue={set.name}
        onConfirm={onRename}
        onDismiss={() => setRenaming(false)}
        placeholder={t('collection.renamePlaceholder')}
        title={t('collection.rename')}
        visible={renaming}
      />
      <ConfirmSheet
        body={t('collection.delete.body', { name: set.name })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('palette.delete.confirm')}
        onConfirm={onDelete}
        onDismiss={() => setDeleteConfirmOpen(false)}
        title={t('collection.delete.title')}
        visible={deleteConfirmOpen}
      />
      <NoticeSheet
        body={t('collection.inviteCopied')}
        confirmLabel={t('common.done')}
        onDismiss={() => setInviteNoticeOpen(false)}
        title={t('collection.invite')}
        visible={inviteNoticeOpen}
      />
    </Screen>
  );
}

/** WCAG 2.2 AA for normal text — the bar the contrast tool reports against. */
const AA = 4.5;

/**
 * What the system can actually do, shown rather than tabulated.
 *
 * A 5×5 matrix of ratios is 25 cells of arithmetic on a phone, and it answers a
 * question nobody asks. The question people have is "can I put text on this
 * one" — so each row *is* the pairing, rendered: the colour as ground, its
 * strongest partner as the type standing on it, and the ratio as the evidence.
 * A row that fails still renders, because seeing why it fails is the point.
 */
function Pairings({ colors }: { colors: readonly Color[] }) {
  const { t } = usePreferences();

  const rows = useMemo(
    () =>
      colors.map((background) => {
        let best = colors[0]!;
        let ratio = 0;
        for (const candidate of colors) {
          if (candidate.hex === background.hex) continue;
          const value = contrastRatio(candidate.hex, background.hex);
          if (value > ratio) {
            ratio = value;
            best = candidate;
          }
        }
        return { background, foreground: best, ratio: Math.round(ratio * 10) / 10 };
      }),
    [colors],
  );

  return (
    <>
      <Gutter style={styles.membersHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('collection.pairings')}
        </Text>
      </Gutter>
      <Gutter style={styles.pairings}>
        {rows.map((row) => (
          <View
            accessibilityLabel={t('collection.pairingLabel', {
              hex: row.foreground.hex,
              background: row.background.hex,
              ratio: row.ratio,
            })}
            key={row.background.hex}
            style={[styles.pairing, { backgroundColor: row.background.hex }]}
          >
            <Text style={[styles.pairingSample, { color: row.foreground.hex }]} variant="section">
              {t('collection.pairingSample')}
            </Text>
            <View style={styles.pairingMeta}>
              {/* The verdict is the ratio and the tone of the pill, never colour
                  alone — the swatch behind it is arbitrary by definition. */}
              <View style={[styles.ratio, row.ratio >= AA ? styles.ratioPass : styles.ratioFail]}>
                <Text style={styles.ratioText} variant="chip">
                  {t('collection.pairingRatio', { ratio: row.ratio })}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Gutter>
    </>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.md, gap: space.xs },
  eyebrow: { paddingBottom: space.xs },
  systemWrap: { paddingTop: space.sectionGap },
  system: {
    flexDirection: 'row',
    height: 132,
    borderRadius: round.media,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: elevation.raised.borderColor,
  },
  systemMeta: { paddingTop: space.xs, color: ui.text.tertiary },
  systemEmpty: { gap: space.xs },
  gapWrap: { paddingTop: space.cardGap },
  gap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  gapCopy: { flex: 1 },
  actions: { paddingTop: space.sectionGap, flexDirection: 'row', gap: space.xs },
  membersHead: { paddingTop: space.sectionGap },
  pairings: { paddingTop: space.xs, gap: 6 },
  pairing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: round.control,
  },
  pairingSample: { letterSpacing: 0 },
  pairingMeta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  ratio: { borderRadius: round.full, paddingHorizontal: 9, paddingVertical: 4 },
  ratioPass: { backgroundColor: ui.scrim.strong },
  ratioFail: { backgroundColor: ui.scrim.strong, borderWidth: 1, borderColor: ui.status.danger },
  ratioText: { color: ui.text.primary },
  rows: { paddingTop: space.xs, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  rowThumb: { width: 44, height: 44, borderRadius: round.control, backgroundColor: ui.bg.media },
  rowCopy: { flex: 1, gap: 3 },
  rowMeta: { fontSize: 9, letterSpacing: 1 },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,90,.16)',
  },
});
