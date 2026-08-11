import { space } from '@chromawave/design-tokens';
import { readableOn, roledColors, shortAge, type Palette } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { ShareSheet, type ShareOptions } from '@/features/capture/ShareSheet';
import { PalettePhoto } from '@/features/library/PalettePhoto';
import { TrackBlock } from '@/features/pairing/TrackBlock';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { useAccent, useChromaticMemory, useChromaticSurface, usePalettes } from '@/hooks';
import { persistPhoto, renderShareCard, shareFile } from '@/lib';
import { useEntitlement, usePreferences, useSkin } from '@/providers';
import {
  ActionSheet,
  Button,
  ButtonRow,
  CardGroup,
  Chip,
  ColorRow,
  ConfirmSheet,
  Gradient,
  Gutter,
  Icon,
  InlineError,
  Meta,
  Pressable,
  PromptSheet,
  Screen,
  Text,
  HERO_HEIGHT,
  type MenuAction,
} from '@/ui';

/** Which of the two prompts the one modal is currently serving. */
type Prompt = 'rename' | 'tag' | null;

/** B4 · PALETTE DETAIL — proportional hero, tags, hex list, export row. */
export function PaletteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, feedback } = usePreferences();
  const watermarkFree = useEntitlement('watermark_free_share');
  const skin = useSkin();
  const { palettes, loading, save: savePalette, remove: removePalette } = usePalettes();
  const [menuOpen, setMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);

  /**
   * Renders the card and hands it to the system share sheet, which is also where
   * "Save Image" lives on both platforms. Both sheet buttons land here because
   * the difference between them is a choice inside that sheet, not here.
   */
  const exportCard = useCallback(async (target: Palette, options: ShareOptions) => {
    setSharing(false);
    const bytes = renderShareCard({
      palette: target,
      format: options.format,
      showHex: options.showHex,
      watermark: options.watermark,
    });
    if (!bytes) {
      // No offscreen surface means no card; the hexes are still worth having.
      void Clipboard.setStringAsync(target.colors.map((color) => color.hex).join(', '));
      setWriteFailed(true);
      return;
    }
    const slug = target.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-');
    if ((await shareFile(bytes, `${slug}-${options.format}.png`)) === 'failed') {
      setWriteFailed(true);
    }
  }, []);

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

  /**
   * Every menu action is a write-then-reflect: persist first, and only update
   * the screen if the write landed. Updating state first would show a rename
   * that silently did not survive the next launch.
   */
  const commit = useCallback(
    async (next: Palette) => {
      setWriteFailed(false);
      try {
        await savePalette(next);
      } catch {
        setWriteFailed(true);
      }
    },
    [savePalette],
  );

  const remove = useCallback(
    async (target: Palette) => {
      try {
        await removePalette(target.id);
        router.back();
      } catch {
        setWriteFailed(true);
      }
    },
    [removePalette, router],
  );

  const duplicate = useCallback(
    async (source: Palette) => {
      const now = new Date().toISOString();
      const id = Crypto.randomUUID();
      const copy: Palette = {
        ...source,
        id,
        name: t('palette.copyName', { name: source.name }),
        createdAt: now,
        // The copy gets its own file. Sharing the original's would mean deleting
        // either palette took the other's photo with it.
        photoUri: persistPhoto(source.photoUri, id),
        // The copy is a new record but the light it was read from is not, so the
        // capture time is carried over rather than reset to now.
        isPinned: false,
        setIds: [],
      };
      setWriteFailed(false);
      try {
        await savePalette(copy);
        router.replace(`/palette/${copy.id}`);
      } catch {
        setWriteFailed(true);
      }
    },
    [router, savePalette, t],
  );

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

  /**
   * The name is written on the palette, so it has to be legible against it —
   * and the band it lands on is whatever the user photographed. `readableOn`
   * moves lightness only, so the title keeps the palette's own hue and still
   * clears AA against the darkest band the scrim leaves showing.
   */
  const titleInk = readableOn(
    roledColors(palette)[0]?.hex ?? skin.ui.text.primary,
    palette.colors[0]?.hex ?? skin.ui.bg.base,
    3,
  );
  const heroLabel = palette.colors.map((swatch) => swatch.hex).join(', ');

  const meta = [
    t('palette.saved', { age: shortAge(palette.capturedAt) }),
    palette.location,
    t('palette.colourCount', { count: palette.colors.length }),
    palette.space === 'p3' ? 'sRGB / P3' : 'sRGB',
  ]
    .filter(Boolean)
    .join(' · ');

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

      {/* THE SUBJECT.
          Full-bleed and edge to edge rather than a rounded card inset in a
          gutter: this palette is what the screen is about, and a 180pt tile
          floating in the middle of the ground made it one item among seven.
          The name sits *on* it, in a colour derived from the palette itself and
          held to AA against the band behind it, so the title and its subject
          are one object instead of a caption under a picture. */}
      <View
        accessibilityLabel={heroLabel}
        style={[styles.hero, { backgroundColor: skin.ui.bg.media }]}
      >
        {palette.photoUri ? (
          <PalettePhoto palette={palette} style={StyleSheet.absoluteFill} />
        ) : null}
        <View style={styles.heroBands}>
          {palette.colors.map((swatch) => (
            <View key={swatch.hex} style={{ flex: swatch.weight, backgroundColor: swatch.hex }} />
          ))}
        </View>
        <Gradient role={skin.effects.scrimBottom('strong')} />
        <View style={styles.heroCopy}>
          <Text numberOfLines={3} style={{ color: titleInk }} variant="hero">
            {palette.name}
          </Text>
          <Meta tone="secondary">{meta}</Meta>
        </View>
      </View>

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

      {/* THE WORKBENCH.
          Four tools that transform this palette, as a grouped list rather than a
          2x2 grid of chips. The grid gave eight destinations identical weight
          and no order; a list has a reading direction, room for the name to
          breathe, and a shape the eye already knows how to scan. */}
      <Gutter style={styles.sectionHead}>
        <Text
          style={accent ? { color: accent.color } : undefined}
          tone="tertiary"
          variant="eyebrow"
        >
          {t('palette.tools')}
        </Text>
      </Gutter>
      <Gutter>
        <CardGroup>
          {TOOLS.map((tool) => (
            <ToolRow
              key={tool.route}
              label={t(tool.labelKey)}
              onPress={() => router.push(`/tools/${tool.route}?id=${palette.id}`)}
            />
          ))}
        </CardGroup>
      </Gutter>

      {/* And the three that take it out of the app. */}
      <Gutter style={styles.sectionHead}>
        <Text
          style={accent ? { color: accent.color } : undefined}
          tone="tertiary"
          variant="eyebrow"
        >
          {t('export.title')}
        </Text>
      </Gutter>
      <Gutter>
        <CardGroup>
          <ToolRow
            label={t('export.title')}
            onPress={() => router.push(`/tools/export?id=${palette.id}`)}
          />
          <ToolRow
            label={t('palette.widgets')}
            onPress={() => router.push(`/tools/widgets?id=${palette.id}`)}
          />
          <ToolRow
            label={t('common.proJson')}
            locked
            onPress={() => router.push('/paywall?trigger=json-export')}
          />
        </CardGroup>
      </Gutter>

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
            onSaveImage={(options) => void exportCard(palette, options)}
            onShare={(options) => void exportCard(palette, options)}
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

/**
 * The four tools that transform a palette, in the order someone reaches for
 * them: check it, see it used, make a surface of it, measure it against another.
 */
const TOOLS = [
  { route: 'contrast', labelKey: 'contrast.title' },
  { route: 'theme', labelKey: 'theme.title' },
  { route: 'gradient', labelKey: 'gradient.title' },
  { route: 'compare', labelKey: 'compare.title' },
] as const;

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
  const skinFor = useSkin();
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
        <View style={[styles.pro, skinFor.tint.pro, { borderRadius: skinFor.round.chip }]}>
          <Text style={{ color: skinFor.tint.pro.color }} variant="chip">
            PRO
          </Text>
        </View>
      ) : null}
      <Icon color={skinFor.ui.text.tertiary} name="forward" scale="inline" />
    </Pressable>
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
  /** Edge to edge and tall: the subject, not a thumbnail of it. */
  hero: {
    // Shared with the flight overlay, which computes its destination rather
    // than measuring this — see `HeroTransition`.
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
  },
  /** Behind the scrim and over the photo — the palette as the ground it came from. */
  heroBands: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', opacity: 0.94 },
  heroCopy: { paddingHorizontal: space.gutter, paddingBottom: space.gutter, gap: space.xs },

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
  sectionHead: { paddingTop: space.sectionGap, paddingBottom: space.xs },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toolLabel: { flex: 1 },
  pro: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  shareBackdrop: StyleSheet.absoluteFillObject,
  shareSheet: {
    marginTop: 'auto',
  },
});
