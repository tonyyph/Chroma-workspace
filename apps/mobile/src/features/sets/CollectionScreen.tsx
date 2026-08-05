import { round, space, ui } from '@chromawave/design-tokens';
import type { Palette, PaletteSet } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PalettePhoto } from '@/features/library/PalettePhoto';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
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
  SwatchStrip,
  Text,
} from '@/ui';

/**
 * C3 · COLLECTION · "shared set, merge is the Pro hook".
 *
 * `members` beyond the owner and the "ADDED BY" attribution come from the set's
 * own record. In a local-first build the owner is the only member, so the
 * attribution reads "ADDED BY YOU" until a sync backend exists.
 */
export function CollectionScreen({
  set,
  palettes,
  isPro,
  onBack,
  onMerge,
  onRename,
  onRemovePalette,
  onDelete,
}: {
  set: PaletteSet;
  palettes: readonly Palette[];
  isPro: boolean;
  onBack: () => void;
  onMerge: () => void;
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

      {editing ? (
        <Gutter style={styles.actions}>
          <Chip fill label={t('collection.rename')} onPress={() => setRenaming(true)} />
          <Chip
            fill
            label={t('collection.deleteSet')}
            onPress={() => setDeleteConfirmOpen(true)}
            tone="danger"
          />
        </Gutter>
      ) : (
        <Gutter style={styles.actions}>
          <Chip fill label={t('collection.mergeAll')} onPress={onMerge} tone="pro" />
          <Chip fill label={t('collection.exportSet')} onPress={exportSet} />
          <Chip fill label={t('collection.invite')} onPress={invite} />
        </Gutter>
      )}

      <Gutter style={styles.rows}>
        {palettes.map((palette) => (
          <Card key={palette.id} style={styles.row}>
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
            ) : (
              <SwatchStrip
                colors={palette.colors.slice(0, 3)}
                height={26}
                radius={8}
                style={styles.rowStrip}
              />
            )}
          </Card>
        ))}
      </Gutter>

      {/* The merged strip is the Pro hook — shown locked rather than hidden. */}
      <Gutter style={styles.mergedWrap}>
        <LinearGradient
          colors={['rgba(124,92,255,.16)', 'rgba(34,211,238,.05)']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.merged}
        >
          <Text style={styles.mergedLabel} variant="eyebrow">
            {t(isPro ? 'collection.merged' : 'collection.mergedLocked')}
          </Text>
          {set.merged?.length ? (
            <SwatchStrip colors={set.merged} height={52} radius={12} />
          ) : (
            <View style={styles.mergedEmpty}>
              <Text tone="secondary" variant="body">
                {t(isPro ? 'collection.mergedBody' : 'collection.mergedLockedBody')}
              </Text>
            </View>
          )}
        </LinearGradient>
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

const styles = StyleSheet.create({
  head: { paddingTop: space.md, gap: space.xs },
  actions: { paddingTop: space.md + 2, flexDirection: 'row', gap: space.xs },
  rows: { paddingTop: space.md + 2, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  rowThumb: { width: 44, height: 44, borderRadius: round.control, backgroundColor: ui.bg.media },
  rowCopy: { flex: 1, gap: 3 },
  rowMeta: { fontSize: 9, letterSpacing: 1 },
  rowStrip: { width: 60 },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,90,.16)',
  },
  mergedWrap: { paddingTop: space.sectionGap },
  merged: {
    borderRadius: round.card,
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,.3)',
    padding: space.md,
    gap: space.xs,
  },
  mergedLabel: { color: '#B79CFF' },
  mergedEmpty: { paddingVertical: space.xs },
});
