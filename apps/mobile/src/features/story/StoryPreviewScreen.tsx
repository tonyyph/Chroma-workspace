import { planSlicesFor } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { File } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences, useSkin } from '@/providers';
import { selectProject, useStoryStore } from '@/store/storyStore';
import { Button, InlineError, NavBar, Screen, Text, useStyles } from '@/ui';
import { StoryCanvas } from './canvas/StoryCanvas';
import { useStoryImages } from './canvas/useStoryImages';
import { exportStory, type ExportFailure } from './export/exportStory';
import { useStoryFonts } from './render/storyFonts';

/**
 * The story as it will actually be posted, and the way out of the app.
 *
 * **Swipeable, because a carousel is swiped.** Reviewing a seamless carousel one
 * slide at a time in a paging scroll view is the only preview that shows the
 * thing someone is about to publish — a grid of thumbnails hides exactly the
 * property the whole slicing argument is about.
 *
 * **The audio sentence is not a disclaimer, it is the truth.** A carousel is a
 * set of PNGs and PNGs carry no sound. The brief is explicit that the app must
 * not imply otherwise, and `music.ts` already refuses to persist an audio URL at
 * all, so the honest statement is made here where someone is deciding what to
 * post rather than buried in a settings screen.
 */
export function StoryPreviewScreen({ onClose }: { onClose: () => void }) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const { t } = usePreferences();
  const { width } = useWindowDimensions();

  const project = useStoryStore(selectProject);
  const { images } = useStoryImages(project);

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [files, setFiles] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<ExportFailure | null>(null);

  const plans = useMemo(() => (project === null ? [] : planSlicesFor(project)), [project]);
  const slideWidth = width - space.gutter * 2;
  const fonts = useStoryFonts(plans[0]?.width ?? 1080);

  const [cancelled, setCancelled] = useState(false);
  useEffect(() => () => setCancelled(true), []);

  const runExport = useCallback(async () => {
    if (project === null || progress !== null || fonts === null) return;

    setFailure(null);
    setFiles([]);
    setProgress({ done: 0, total: project.slideCount });
    analytics.track('export_started', {
      format: project.format,
      slideCount: project.slideCount,
    });

    const startedAt = Date.now();
    const result = await exportStory({
      project,
      fonts,
      background: skin.ui.bg.base,
      onProgress: ({ completed, total }) => setProgress({ done: completed, total }),
      shouldCancel: () => cancelled,
    });

    setProgress(null);

    if (result.status === 'failed') {
      setFailure(result.reason);
      analytics.track('export_failed', { format: project.format, reason: result.reason });
      return;
    }

    setFiles(result.files);
    analytics.track('export_completed', {
      format: project.format,
      slideCount: result.files.length,
      ms: Date.now() - startedAt,
    });
  }, [cancelled, fonts, progress, project, skin.ui.bg.base]);

  /**
   * Saves every slide to the photo library, in order.
   *
   * This rather than the share sheet for the whole carousel, because React
   * Native's `Share` takes one url: offering "share" for a five-slide story
   * would hand over one image and look like the other four were lost. Sharing
   * one slide is still offered below, where it means what it says.
   */
  const saveAll = useCallback(async () => {
    if (files.length === 0) return;
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) {
      setFailure('write-failed');
      return;
    }
    for (const file of files) {
      await MediaLibrary.saveToLibraryAsync(file);
    }
  }, [files]);

  const shareSlide = useCallback(
    async (index: number) => {
      const file = files[index];
      if (file === undefined || project === null) return;
      analytics.track('share_started', {
        format: project.format,
        slideCount: project.slideCount,
      });
      try {
        await Share.share({ url: new File(file).uri });
      } catch {
        setFailure('write-failed');
      }
    },
    [files, project],
  );

  if (project === null) {
    return (
      <Screen>
        <NavBar onLeading={onClose} title={t('story.preview.title')} />
        <View style={styles.body}>
          <InlineError detail={t('story.error.missing')} title={t('story.preview.title')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar onLeading={onClose} title={t('story.preview.title')} />

      <ScrollView
        contentContainerStyle={styles.strip}
        horizontal
        keyboardShouldPersistTaps="handled"
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth + space.xs}
      >
        {plans.map((plan) => (
          <StoryCanvas
            background={skin.ui.bg.base}
            images={images}
            key={plan.index}
            project={project}
            slideIndex={plan.index}
            width={slideWidth}
          />
        ))}
      </ScrollView>

      <View style={styles.body}>
        {project.track === null ? null : (
          <Text tone="secondary" variant="meta">
            {t('story.preview.noAudio')}
          </Text>
        )}

        {progress === null ? null : (
          <Text variant="meta">
            {t('story.preview.exporting', { done: progress.done, total: progress.total })}
          </Text>
        )}

        {files.length === 0 ? null : (
          <Text variant="meta">{t('story.preview.exported', { count: files.length })}</Text>
        )}

        {failure === null ? null : (
          <InlineError detail={t(messageFor(failure))} title={t('story.preview.export')} />
        )}

        <Button
          disabled={progress !== null || fonts === null}
          label={t('story.preview.export')}
          onPress={() => void runExport()}
        />

        {files.length === 0 ? null : (
          <>
            <Button
              label={t('story.preview.share')}
              onPress={() => void shareSlide(0)}
              variant="secondary"
            />
            <Button
              label={t('story.preview.exported', { count: files.length })}
              onPress={() => void saveAll()}
              variant="ghost"
            />
          </>
        )}
      </View>
    </Screen>
  );
}

/**
 * Each failure gets its own sentence.
 *
 * A seam and a full disk are different problems with different answers, and a
 * single "export failed" would leave someone retrying the one that will never
 * succeed.
 */
const messageFor = (failure: ExportFailure) => {
  switch (failure) {
    case 'seam-detected':
      return 'story.error.seam' as const;
    case 'write-failed':
      return 'story.error.space' as const;
    case 'no-slides':
    case 'surface-unavailable':
    case 'encode-failed':
      return 'story.error.export' as const;
  }
};

const makeStyles = (_skin: Skin) =>
  StyleSheet.create({
    body: {
      gap: space.sm,
      paddingHorizontal: space.gutter,
      paddingVertical: space.md,
    },
    strip: {
      gap: space.xs,
      paddingHorizontal: space.gutter,
    },
  });
