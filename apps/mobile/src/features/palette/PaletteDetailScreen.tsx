import { type Palette } from '@cw/domain';
import { space } from '@cw/tokens';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { ShareSheet } from '@/features/capture/ShareSheet';
import { TrackBlock } from '@/features/pairing/TrackBlock';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { useAccent, useChromaticMemory, useChromaticSurface, usePalettes } from '@/hooks';
import { useEntitlement, usePreferences, useSkin } from '@/providers';
import {
  ActionSheet,
  Button,
  ButtonRow,
  Chip,
  ColorRow,
  ConfirmSheet,
  Gutter,
  Icon,
  InlineError,
  Meta,
  Pressable,
  PromptSheet,
  Screen,
  Text,
  type MenuAction,
} from '@/ui';
import { PaletteHero } from './PaletteHero';
import { PaletteWorkbench } from './PaletteWorkbench';
import { usePaletteActions } from './usePaletteActions';

/** Which of the two prompts the one modal is currently serving. */
type Prompt = 'rename' | 'tag' | null;

/**
 * B4 · PALETTE DETAIL — proportional hero, tags, hex list, export row.
 *
 * The screen holds what the folds have to agree on: which palette, which sheet
 * is open. The subject, the workbench and the writes each live beside this file,
 * because none of them needs to know about the others.
 */
export function PaletteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, feedback } = usePreferences();
  const watermarkFree = useEntitlement('watermark_free_share');
  const skin = useSkin();
  const { palettes, loading } = usePalettes();
  const [menuOpen, setMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const { commit, remove, duplicate, exportCard, writeFailed } = usePaletteActions();

  // The palette comes from the shared store, so a rename here reaches the
  // library grid, the sets that contain it and Explore's search at once.
  const palette = palettes.find((entry) => entry.id === id) ?? null;

  // The whole app takes this palette's colour while the screen is in front.
  useChromaticSurface(palette?.colors ?? null);
  // One borrowed colour for this screen. Tags are the palette's own vocabulary,
  // so they are the thing worth saying in its own voice.
  const accent = useAccent(palette?.colors ?? null);
  // The aggregate behind the palette view. A `Palette` can carry the colours;
  // it has nowhere to put the track, so the music comes from the memory itself.
  const { memory } = useChromaticMemory(palette?.id);

  if (!palette) {
    // Once the store has loaded, a missing id means the palette was deleted —
    // which is a different thing from still loading, and "Loading" forever is
    // what a deep link to a deleted palette used to show.
    return loading ? (
      <Screen>
        <Gutter style={styles.head}>
          <Meta>{t('palette.loading')}</Meta>
        </Gutter>
      </Screen>
    ) : (
      <ToolFallback loading={false} title={t('palette.tools')} />
    );
  }

  const share = (target: Palette) => (options: Parameters<typeof exportCard>[1]) => {
    setSharing(false);
    void exportCard(target, options);
  };

  const menuActions: readonly MenuAction[] = [
    { label: t('palette.menu.rename'), onPress: () => setPrompt('rename') },
    {
      label: t(palette.isPinned ? 'palette.menu.unpin' : 'palette.menu.pin'),
      onPress: () => {
        void commit({ ...palette, isPinned: !palette.isPinned });
        void feedback.selection();
      },
    },
    { label: t('palette.menu.duplicate'), onPress: () => void duplicate(palette) },
    {
      label: t('palette.menu.delete'),
      onPress: () => setDeleteConfirmOpen(true),
      destructive: true,
    },
  ];

  return (
    <Screen
      action={
        <ButtonRow>
          {/* The pairing entry. A saved palette and a fresh capture reach the
              same screen, because attaching music now and attaching it six
              months later are the same act. */}
          <Button
            label={t('pair.title')}
            onPress={() => router.push(`/pair?id=${palette.id}`)}
            variant="primary"
          />
          <Button label={t('palette.share')} onPress={() => setSharing(true)} variant="contrast" />
        </ButtonRow>
      }
    >
      <Gutter style={styles.nav}>
        <Pressable
          accessibilityLabel={t('palette.back')}
          accessibilityRole="button"
          hitSlop={12}
          onPress={router.back}
          style={styles.navButton}
        >
          <Icon color={skin.ui.text.secondary} name="back" scale="inline" />
          <Text tone="secondary" variant="mono">
            {t('palette.back')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t('palette.more')}
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => setMenuOpen(true)}
        >
          <Icon color={skin.ui.text.secondary} name="more" />
        </Pressable>
      </Gutter>

      {writeFailed ? (
        <Gutter style={styles.error}>
          <InlineError detail={t('palette.writeFailedDetail')} title={t('palette.writeFailed')} />
        </Gutter>
      ) : null}

      <PaletteHero palette={palette} />

      {/* A tag is a search term: tapping one runs it against the library rather
          than opening an editor, which is what people reach for a tag to do. */}
      <Gutter style={styles.tags}>
        {palette.tags.map((tag) => (
          <Chip
            accent={accent?.tint}
            key={tag}
            label={tag.toLocaleUpperCase()}
            onPress={() => router.push(`/explore?q=${encodeURIComponent(tag)}`)}
            tone="pro"
          />
        ))}
        <Chip icon="add" label={t('palette.addTag')} onPress={() => setPrompt('tag')} tone="add" />
      </Gutter>

      {/* THE MUSIC.
          Above the colour spec deliberately. The spec is reference material a
          professional goes looking for; the track is the other half of what this
          memory *is*, and burying it under a table of OKLCh values would say the
          opposite. */}
      {memory ? (
        <Gutter style={styles.music}>
          <TrackBlock pairing={memory.musicPairing} paletteId={palette.id} />
        </Gutter>
      ) : null}

      {/* THE SPEC.
          Bare rows on the ground, not a card: this is a reference table, and
          wrapping it in a raised surface made it compete with the hero for the
          same job. */}
      <Gutter style={styles.list}>
        {palette.colors.map((swatch, index) => (
          <View
            key={`${index}:${swatch.hex}`}
            style={[styles.listRow, index < palette.colors.length - 1 && styles.listDivider]}
          >
            <ColorRow color={swatch} dense />
          </View>
        ))}
      </Gutter>

      <PaletteWorkbench accentColor={accent?.color} paletteId={palette.id} />

      {/* C4. The sheet is where the format and the card options live, so Share
          opens it rather than silently copying hexes to the clipboard. */}
      <Modal
        animationType="slide"
        onRequestClose={() => setSharing(false)}
        transparent
        visible={sharing}
      >
        <Pressable
          accessibilityLabel={t('common.cancel')}
          onPress={() => setSharing(false)}
          style={[styles.shareBackdrop, { backgroundColor: skin.ui.scrim.strong }]}
        />
        <View style={styles.shareSheet}>
          <ShareSheet
            isPro={watermarkFree}
            onSaveImage={share(palette)}
            onShare={share(palette)}
            palette={palette}
          />
        </View>
      </Modal>

      <ActionSheet
        actions={menuActions}
        cancelLabel={t('common.cancel')}
        onDismiss={() => setMenuOpen(false)}
        title={palette.name}
        visible={menuOpen}
      />

      <PromptSheet
        cancelLabel={t('common.cancel')}
        confirmLabel={t(prompt === 'tag' ? 'palette.addTag.confirm' : 'common.save')}
        initialValue={prompt === 'rename' ? palette.name : ''}
        onConfirm={(value) => {
          if (prompt === 'rename') {
            void commit({ ...palette, name: value });
            return;
          }
          const tag = value.toLocaleLowerCase();
          // Adding a tag that is already there would render a duplicate chip that
          // cannot be told apart from the original.
          if (palette.tags.includes(tag)) return;
          void commit({ ...palette, tags: [...palette.tags, tag] });
        }}
        onDismiss={() => setPrompt(null)}
        placeholder={t(
          prompt === 'tag' ? 'palette.addTag.placeholder' : 'palette.rename.placeholder',
        )}
        title={t(prompt === 'tag' ? 'palette.addTag' : 'palette.menu.rename')}
        visible={prompt !== null}
      />
      <ConfirmSheet
        body={t('palette.delete.body', { name: palette.name })}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('palette.delete.confirm')}
        onConfirm={() => void remove(palette)}
        onDismiss={() => setDeleteConfirmOpen(false)}
        title={t('palette.delete.title')}
        visible={deleteConfirmOpen}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: space.md,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  error: {
    paddingBottom: space.cardGap,
  },
  tags: {
    paddingTop: space.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  /** A reference table on the ground, not a raised card competing with the hero. */
  music: { marginTop: space.sectionGap },
  list: { paddingTop: space.sectionGap },
  listRow: { paddingVertical: 13 },
  listDivider: { borderBottomWidth: 1 },
  shareBackdrop: StyleSheet.absoluteFillObject,
  shareSheet: {
    marginTop: 'auto',
  },
});
