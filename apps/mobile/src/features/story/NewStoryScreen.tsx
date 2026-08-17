import { addAsset, addElement, storyFormats, type StoryFormatId } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { analytics } from '@/infrastructure/dependencies';
import { importStoryAsset } from '@/infrastructure/story/StoryAssetManager';
import { usePreferences } from '@/providers';
import { useStoryStore } from '@/store/storyStore';
import { Button, Card, Chip, InlineError, NavBar, Screen, Text, useStyles } from '@/ui';
import { placePhotoOnSlide } from './placePhoto';

/**
 * Choosing what a story is made of, before there is a story.
 *
 * Two decisions and no more: which photographs, and what shape. Everything else
 * the brief lists for project setup — templates, AI, starting from a memory —
 * arrives in later phases, and offering them here as disabled controls would be
 * a menu of things that do not work.
 *
 * **The photographs are imported before the editor opens.** Each becomes a
 * durable master and a preview under `story-assets/`, which takes a moment for a
 * handful of frames; doing it here means the editor never opens onto a canvas
 * that is still filling in.
 */

/** The first slice's ceiling. Twenty is the schema's; five is what one screen of setup can hold. */
const MAX_PHOTOS = 5;

export function NewStoryScreen({
  onCreated,
  onClose,
}: {
  onCreated: (storyId: string) => void;
  onClose: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();

  const [picked, setPicked] = useState<readonly string[]>([]);
  const [format, setFormat] = useState<StoryFormatId>('portrait');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<'import' | 'create' | null>(null);

  const pick = useCallback(async () => {
    setFailed(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      // The originals, not the picker's compressed copy: the asset manager does
      // its own normalisation and needs the best input it can get.
      quality: 1,
    });
    if (result.canceled) return;
    setPicked(result.assets.map((asset) => asset.uri).slice(0, MAX_PHOTOS));
  }, []);

  const create = useCallback(async () => {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    setFailed(null);

    const storyId = Crypto.randomUUID();
    const now = new Date().toISOString();

    // One slide per photograph is the honest default for a carousel: it is what
    // someone choosing three pictures is asking for, and it is trivially
    // changed once the editor is open.
    const slideCount = picked.length;

    const imported = await Promise.all(
      picked.map(async (uri) => {
        const assetId = Crypto.randomUUID();
        const asset = await importStoryAsset(uri, storyId, assetId);
        return asset === null ? null : { assetId, asset };
      }),
    );

    const usable = imported.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    if (usable.length === 0) {
      setBusy(false);
      setFailed('import');
      return;
    }

    // Only as many slides as photographs that actually came in. An import that
    // partly failed must not leave a trailing blank slide nobody asked for.
    const usableSlides = usable.length;

    try {
      await useStoryStore.getState().create({ id: storyId, format, slideCount: usableSlides, now });

      // Each photograph, full-bleed on its own slide. Applied through `apply` so
      // the placement is one undoable step and one autosave, exactly like any
      // other edit — rather than a special path that bypasses the history.
      useStoryStore.getState().apply((project) => {
        let next = project;
        for (const [index, entry] of usable.entries()) {
          next = addAsset(
            next,
            {
              id: entry.assetId,
              uri: entry.asset.uri,
              width: entry.asset.width,
              height: entry.asset.height,
              previewUri: entry.asset.previewUri,
              createdAt: now,
            },
            now,
          );
          next = addElement(
            next,
            placePhotoOnSlide({
              elementId: Crypto.randomUUID(),
              assetId: entry.assetId,
              sourceWidth: entry.asset.width,
              sourceHeight: entry.asset.height,
              format,
              slideIndex: index,
            }),
            now,
          );
        }
        return next;
      });
      await useStoryStore.getState().flush();

      // Photographs enter here rather than in the editor, so this is where the
      // photo case of `element_added` belongs.
      for (const _entry of usable) analytics.track('element_added', { kind: 'photo' });
      analytics.track('project_created', {
        format,
        slideCount: usableSlides,
        photoCount: usable.length,
      });
      onCreated(storyId);
    } catch {
      setFailed('create');
    }
    setBusy(false);
  }, [busy, format, onCreated, picked]);

  return (
    <Screen>
      <NavBar onLeading={onClose} title={t('story.new')} />

      <View style={styles.body}>
        <Text variant="body">{t('story.new.subtitle')}</Text>

        <Card style={styles.section}>
          <Text variant="cardTitle">{t('story.new.pickPhotos')}</Text>
          <Text tone="secondary" variant="meta">
            {t('story.new.photoCount', { count: picked.length, max: MAX_PHOTOS })}
          </Text>
          <Button
            label={t('story.new.pickPhotos')}
            onPress={() => void pick()}
            variant="secondary"
          />
        </Card>

        <Card style={styles.section}>
          <Text variant="cardTitle">{t('story.new.format')}</Text>
          <View style={styles.formats}>
            {(Object.keys(storyFormats) as StoryFormatId[]).map((id) => (
              <Chip
                key={id}
                label={t(`story.format.${id}`)}
                onPress={() => setFormat(id)}
                // Tone rather than a border: `selected` is a defined meaning in
                // both skins, and Swiss expresses it without a radius or a glow.
                tone={format === id ? 'selected' : 'default'}
              />
            ))}
          </View>
        </Card>

        {failed === null ? null : (
          <InlineError
            detail={t(failed === 'import' ? 'story.error.import' : 'story.error.load')}
            title={t('story.new')}
          />
        )}

        <Button
          disabled={picked.length === 0 || busy}
          label={t('story.new.create')}
          onPress={() => void create()}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    body: {
      gap: space.md,
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
    },
    section: {
      gap: space.sm,
    },
    formats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.xs,
      // Swiss has no radii and no depth, so the row's structure has to come from
      // the gap and the rule the card already draws — not from rounded pills.
      marginTop: skin.chrome.rules ? space.xs : 0,
    },
  });
