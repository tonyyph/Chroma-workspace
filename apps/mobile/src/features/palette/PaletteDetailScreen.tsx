import { round, space, ui } from '@chromawave/design-tokens';
import { shortAge, type Palette } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ShareSheet, type ShareOptions } from '@/features/capture/ShareSheet';
import { paletteRepository } from '@/infrastructure/dependencies';
import { renderShareCard, shareFile } from '@/lib/export';
import { persistPhoto } from '@/lib/photos';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  ActionSheet,
  Button,
  Card,
  Chip,
  ColorRow,
  Gutter,
  Icon,
  InlineError,
  Meta,
  PromptSheet,
  Screen,
  Text,
  type MenuAction,
} from '@/ui';

/** Which of the two prompts the one modal is currently serving. */
type Prompt = 'rename' | 'tag' | null;

/** B4 · PALETTE DETAIL — proportional hero, tags, hex list, export row. */
export function PaletteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, feedback } = usePreferences();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>(null);
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

  useEffect(() => {
    if (!id) return;
    void paletteRepository.get(id).then(setPalette);
  }, [id]);

  /**
   * Every menu action is a write-then-reflect: persist first, and only update
   * the screen if the write landed. Updating state first would show a rename
   * that silently did not survive the next launch.
   */
  const commit = useCallback(async (next: Palette) => {
    setWriteFailed(false);
    try {
      await paletteRepository.save(next);
      setPalette(next);
    } catch {
      setWriteFailed(true);
    }
  }, []);

  const remove = useCallback(
    (target: Palette) => {
      Alert.alert(t('palette.delete.title'), t('palette.delete.body', { name: target.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('palette.delete.confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await paletteRepository.remove(target.id);
                router.back();
              } catch {
                setWriteFailed(true);
              }
            })();
          },
        },
      ]);
    },
    [router, t],
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
        await paletteRepository.save(copy);
        router.replace(`/palette/${copy.id}`);
      } catch {
        setWriteFailed(true);
      }
    },
    [router, t],
  );

  if (!palette) {
    return (
      <Screen>
        <Gutter style={styles.head}>
          <Meta>{t('palette.loading')}</Meta>
        </Gutter>
      </Screen>
    );
  }

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
    { label: t('palette.menu.delete'), onPress: () => remove(palette), destructive: true },
  ];

  return (
    <Screen>
      <Gutter style={styles.nav}>
        <Pressable
          accessibilityLabel={t('palette.back')}
          accessibilityRole="button"
          hitSlop={12}
          onPress={router.back}
          style={styles.navButton}
        >
          <Icon color={ui.text.secondary} name="back" scale="inline" />
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
          <Icon color={ui.text.secondary} name="more" />
        </Pressable>
      </Gutter>

      {writeFailed ? (
        <Gutter style={styles.error}>
          <InlineError detail={t('palette.writeFailedDetail')} title={t('palette.writeFailed')} />
        </Gutter>
      ) : null}

      {/* The hero is the palette at its true proportions — the composition, not a grid. */}
      <Gutter>
        <View accessibilityLabel={palette.colors.map((s) => s.hex).join(', ')} style={styles.hero}>
          {palette.colors.map((swatch) => (
            <View key={swatch.hex} style={{ flex: swatch.weight, backgroundColor: swatch.hex }} />
          ))}
        </View>
      </Gutter>

      <Gutter style={styles.title}>
        <Text variant="title">{palette.name}</Text>
        <Meta style={styles.meta}>{meta}</Meta>
      </Gutter>

      {/* A tag is a search term: tapping one runs it against the library rather
          than opening an editor, which is what people reach for a tag to do. */}
      <Gutter style={styles.tags}>
        {palette.tags.map((tag) => (
          <Chip
            key={tag}
            label={tag.toLocaleUpperCase()}
            onPress={() => router.push(`/explore?q=${encodeURIComponent(tag)}`)}
            tone="pro"
          />
        ))}
        <Chip
          icon="add"
          label={t('palette.addTag')}
          onPress={() => setPrompt('tag')}
          tone="add"
        />
      </Gutter>

      <Gutter style={styles.list}>
        <Card padded={false} style={styles.listCard}>
          {palette.colors.map((swatch, index) => (
            <View
              key={swatch.hex}
              style={[styles.listRow, index < palette.colors.length - 1 && styles.listDivider]}
            >
              <ColorRow color={swatch} dense />
            </View>
          ))}
        </Card>
      </Gutter>

      {/* The G-series tools all operate on one palette, so this is their entry. */}
      <Gutter style={styles.tools}>
        <Text tone="tertiary" variant="eyebrow">
          {t('palette.tools')}
        </Text>
        <View style={styles.toolRow}>
          <Chip
            fill
            label={t('contrast.title')}
            onPress={() => router.push(`/tools/contrast?id=${palette.id}`)}
          />
          <Chip
            fill
            label={t('theme.title')}
            onPress={() => router.push(`/tools/theme?id=${palette.id}`)}
          />
        </View>
        <View style={styles.toolRow}>
          <Chip
            fill
            label={t('gradient.title')}
            onPress={() => router.push(`/tools/gradient?id=${palette.id}`)}
          />
          <Chip
            fill
            label={t('compare.title')}
            onPress={() => router.push(`/tools/compare?id=${palette.id}`)}
          />
        </View>
      </Gutter>

      <Gutter style={styles.exports}>
        <Chip
          fill
          label={t('export.title')}
          onPress={() => router.push(`/tools/export?id=${palette.id}`)}
        />
        <Chip
          fill
          label={t('palette.widgets')}
          onPress={() => router.push(`/tools/widgets?id=${palette.id}`)}
        />
        <Chip
          fill
          label={t('common.proJson')}
          onPress={() => router.push('/paywall?trigger=json-export')}
          tone="pro"
        />
      </Gutter>

      <Gutter style={styles.action}>
        <Button label={t('palette.share')} onPress={() => setSharing(true)} variant="contrast" />
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
          style={styles.shareBackdrop}
        />
        <View style={styles.shareSheet}>
          <ShareSheet
            isPro={false}
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
    paddingBottom: space.cardGap,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  error: {
    paddingBottom: space.cardGap,
  },
  hero: {
    flexDirection: 'row',
    height: 180,
    borderRadius: round.media - 2,
    overflow: 'hidden',
  },
  title: {
    paddingTop: space.md + 2,
    gap: 4,
  },
  meta: {
    color: ui.text.tertiary,
  },
  tags: {
    paddingTop: space.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  list: {
    paddingTop: space.md + 2,
  },
  listCard: {
    overflow: 'hidden',
  },
  listRow: {
    paddingHorizontal: space.cardGap,
    paddingVertical: 13,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(237,234,227,.07)',
  },
  tools: {
    paddingTop: space.gutter,
    gap: space.xs,
  },
  toolRow: {
    flexDirection: 'row',
    gap: space.xs,
  },
  exports: {
    paddingTop: space.cardGap,
    flexDirection: 'row',
    gap: space.xs,
  },
  action: {
    paddingTop: space.sm,
  },
  shareBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ui.scrim.strong,
  },
  shareSheet: {
    marginTop: 'auto',
  },
});
