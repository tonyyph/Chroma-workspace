import {
  NEUTRAL_GRADE,
  sceneAt,
  sceneProgress,
  storyboardFor,
  type ChromaticMemory,
  type SceneKind,
} from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGradeImage } from '@/features/grading/GradePreview';
import { usePreviewPlayback } from '@/features/pairing/usePreviewPlayback';
import { hapticsService } from '@/infrastructure/dependencies';
import { usePreferences, useSkin } from '@/providers';
import { Button, Gradient, Gutter, Icon, Meta, Pressable, Text, useStyles } from '@/ui';
import { LivingBands, LivingStage } from './LivingStage';
import { useMemoryClock } from './useMemoryClock';

/**
 * A memory, performed.
 *
 * The four parts the product is made of, in time rather than in a list: the
 * graded photograph drifting, the palette breathing at the rate its own colour
 * asked for, what the moment felt like in words, and the track underneath it.
 *
 * **It does not pretend to export a video.** No encoder in this dependency set
 * can write one, so there is no save button that would fail — the screen says
 * what is missing instead. That is the difference between a limitation and a
 * broken promise.
 */
export function LivingMemoryScreen({ memory }: { memory: ChromaticMemory }) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();
  const { width, height } = useWindowDimensions();

  const storyboard = useMemo(() => storyboardFor(memory), [memory]);
  const [playing, setPlaying] = useState(false);

  const { state, toggle } = usePreviewPlayback();
  const track = memory.musicPairing.selectedTrack;

  // The audio leads whenever it is actually running; otherwise the clock does.
  const audioPositionMs =
    state.kind === 'playing' && track && state.providerTrackId === track.providerTrackId
      ? state.positionMs
      : null;

  const { elapsedMs, finished } = useMemoryClock({ storyboard, playing, audioPositionMs });
  const scene = sceneAt(storyboard, elapsedMs);
  const progress = sceneProgress(scene, elapsedMs);

  const { image, status } = useGradeImage(memory.image.localUri);

  /**
   * Every caption is a fact the memory already holds. Nothing on screen during
   * the performance is written for the performance — that is what separates this
   * from a montage template.
   */
  const caption = ((kind: SceneKind): string => {
    if (kind === 'title')
      return memory.personalContext.title ?? memory.personalContext.location?.name ?? '';
    if (kind === 'palette')
      return memory.palette.colors.map((color) => color.hex.slice(1)).join('  ');
    if (kind === 'atmosphere') return t(`atmosphere.mood.${memory.atmosphere.mood}`);
    if (kind === 'track' && memory.musicPairing.selectedTrack)
      return `${memory.musicPairing.selectedTrack.title} · ${memory.musicPairing.selectedTrack.artist}`;
    return memory.personalContext.title ?? '';
  })(scene.kind);

  const start = () => {
    setPlaying(true);
    void hapticsService.fire('extractionComplete');
    if (track) void toggle(track);
  };

  const stop = () => {
    setPlaying(false);
    if (track && state.kind === 'playing') void toggle(track);
  };

  return (
    <View style={styles.root}>
      {status === 'ready' && image ? (
        <LivingStage
          grade={memory.image.grade ?? NEUTRAL_GRADE}
          height={height}
          image={image}
          playing={playing}
          storyboard={storyboard}
          width={width}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          {status === 'loading' ? <ActivityIndicator color={skin.ui.text.tertiary} /> : null}
          {status === 'failed' || status === 'absent' ? (
            <Meta style={styles.centred}>{t('living.noPhoto')}</Meta>
          ) : null}
        </View>
      )}

      {/* The scrim is what makes typography legible over an unknown photograph;
          without it every caption is a gamble on the picture underneath. */}
      <Gradient role={skin.effects.scrimBottom('strong')} />

      <View style={[styles.chrome, { paddingTop: insets.top + space.sm }]}>
        <Gutter style={styles.topRow}>
          <Pressable
            accessibilityLabel={t('living.close')}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              stop();
              router.back();
            }}
          >
            <Icon name="close" scale="action" />
          </Pressable>
          <Meta>{t('living.title')}</Meta>
        </Gutter>

        <View style={styles.spacer} />

        {/* One caption at a time, cross-fading. Each is a fact the memory
            already holds — nothing here is generated for the performance. */}
        <Gutter>
          <Animated.View
            entering={FadeIn.duration(420)}
            exiting={FadeOut.duration(280)}
            key={scene.kind}
          >
            <Meta>{t(`living.scene.${scene.kind}`)}</Meta>
            <Text style={styles.caption} variant="headline">
              {caption}
            </Text>
          </Animated.View>
        </Gutter>

        <Gutter style={styles.bandsRow}>
          <LivingBands
            colors={memory.palette.colors}
            playing={playing}
            pulseMs={storyboard.pulseMs}
          />
        </Gutter>

        {/* A real progress bar, driven by the same clock the scenes are, so what
            it reports is what is actually playing. */}
        <Gutter>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                { width: `${Math.round((elapsedMs / storyboard.totalMs) * 100)}%` },
              ]}
            />
          </View>
        </Gutter>

        <Gutter style={styles.actions}>
          {!storyboard.hasAudio ? (
            <Pressable
              accessibilityLabel={t('living.pair')}
              accessibilityRole="button"
              onPress={() => router.push(`/pair?id=${memory.id}`)}
            >
              <Meta>{t('living.silent')}</Meta>
            </Pressable>
          ) : null}

          <Button
            disabled={status !== 'ready'}
            label={finished ? t('living.replay') : playing ? t('living.pause') : t('living.play')}
            onPress={() => (playing && !finished ? stop() : start())}
            size="lg"
            variant="contrast"
          />
          <Meta style={styles.centred}>{t('living.export')}</Meta>
        </Gutter>
      </View>

      {/* Scene progress, as the thinnest possible line under the caption. It is
          the only thing on screen that reports the shape of the performance. */}
      <View pointerEvents="none" style={[styles.sceneTick, { opacity: playing ? 1 : 0 }]}>
        <View style={[styles.sceneTickFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: skin.ui.bg.media },
    placeholder: { alignItems: 'center', justifyContent: 'center' },
    centred: { textAlign: 'center' },
    chrome: { flex: 1 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    spacer: { flex: 1 },
    caption: { paddingTop: 4 },
    bandsRow: { paddingTop: space.md },
    track: {
      height: 2,
      marginTop: space.sm,
      backgroundColor: skin.ui.fill.track,
      borderRadius: 1,
      overflow: 'hidden',
    },
    trackFill: { height: 2, backgroundColor: skin.ui.text.primary },
    actions: { paddingTop: space.md, paddingBottom: space.xl, gap: space.xs },
    sceneTick: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 1 },
    sceneTickFill: { height: 1, backgroundColor: skin.ui.action.primary },
  });
