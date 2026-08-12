import {
  readAtmosphere,
  type Color,
  type MusicRecommendation,
  type MusicTrackReference,
} from '@cw/domain';
import { size, space } from '@cw/tokens';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useChromaticMemory, usePaletteParam } from '@/hooks';
import { hapticsService, musicProvider } from '@/infrastructure/dependencies';
import { usePreferences, useSkin } from '@/providers';
import { usePairingStore } from '@/store';
import {
  Button,
  Card,
  EmptyGlyph,
  Gutter,
  Icon,
  Meta,
  Pressable,
  Screen,
  ScreenHeader,
  Text,
} from '@/ui';
import { composeMatchCopy, formatClock, strongestReasons } from './matchCopy';
import { usePreviewPlayback } from './usePreviewPlayback';

/**
 * The screen the product is for: colour on the left of the arrow, music on the
 * right, and a stated reason in between.
 *
 * Reached from a saved palette rather than only from capture, because pairing a
 * moment now and pairing it six months later are the same act — and building
 * them twice is how they drift. It is also what makes the flow reachable on a
 * simulator, where the camera is not.
 *
 * Three rules this screen exists to keep:
 *
 * 1. **Nothing autoplays.** The first preview needs "Hear it". Unexpected audio
 *    in a quiet room is the fastest way to lose someone's trust.
 * 2. **Every card carries its store link.** That is a licence condition of using
 *    the provider's previews and artwork, not a nicety — see docs/07.
 * 3. **A failure says what failed.** No endless spinner; every dead end offers
 *    saving the colours alone, which is a complete memory.
 */
export default function PairScreen() {
  const router = useRouter();
  const { t, preferences } = usePreferences();
  const skin = useSkin();
  // Reads `?id=` itself, and falls back to the most recent palette — the same
  // contract every colour tool uses, so the route is deep-linkable.
  const { palette } = usePaletteParam();
  // The same record, reached through the aggregate: the palette view can carry
  // the colours but has nowhere to put a track.
  const { pairTrack, saving } = useChromaticMemory(palette?.id);

  const status = usePairingStore((store) => store.status);
  const stage = usePairingStore((store) => store.stage);
  const completed = usePairingStore((store) => store.completed);
  const recommendations = usePairingStore((store) => store.recommendations);
  const previewAvailable = usePairingStore((store) => store.previewAvailable);
  const selectedTrackId = usePairingStore((store) => store.selectedTrackId);
  const error = usePairingStore((store) => store.error);
  const start = usePairingStore((store) => store.start);
  const retry = usePairingStore((store) => store.retry);
  const select = usePairingStore((store) => store.select);
  const reject = usePairingStore((store) => store.reject);
  const reset = usePairingStore((store) => store.reset);

  const atmosphere = useMemo(
    () => (palette ? readAtmosphere(palette.colors, palette.deltaE) : null),
    [palette],
  );

  useEffect(() => {
    if (!atmosphere) return;
    // The market comes from the app's language rather than from a locale API:
    // it is the only regional signal the product already holds, and a Vietnamese
    // user should see the Vietnamese catalogue.
    void start({ atmosphere, market: preferences.language === 'vi' ? 'VN' : null });
    return () => reset();
  }, [atmosphere, preferences.language, reset, start]);

  /**
   * Choosing writes the pairing and leaves.
   *
   * One action rather than select-then-save: at this point the user has already
   * heard the track and pressed a button that says "Choose this one", so a
   * second confirmation step would be asking the same question twice. The
   * feedback gathered this session rides along on the same write.
   */
  const choose = useCallback(
    async (track: MusicTrackReference) => {
      select(track.providerTrackId);
      const saved = await pairTrack(track, usePairingStore.getState().toPairing());
      if (saved) {
        void hapticsService.fire('paletteSaved');
        // Replace rather than go back: this screen is reached both from a saved
        // memory and from a capture whose result screen has already discarded
        // its pending state, and `back()` means two different things there.
        router.replace(`/palette/${palette?.id ?? ''}`);
      }
    },
    [pairTrack, palette?.id, router, select],
  );

  if (!palette || !atmosphere) {
    return (
      <Screen>
        <Gutter>
          <ScreenHeader title={t('pair.title')} />
          <EmptyGlyph kind="no-library" />
        </Gutter>
      </Screen>
    );
  }

  return (
    <Screen>
      <Gutter>
        <ScreenHeader meta={t('pair.subtitle')} title={t('pair.title')} />
      </Gutter>

      {/* The palette, at true area weights: the thing the music was chosen from
          stays on screen while the user chooses. */}
      <Ribbon colors={palette.colors} />

      {status === 'running' ? (
        <Stages completed={completed} stage={stage} />
      ) : status === 'failed' ? (
        <Failure error={error} onRetry={() => void retry()} />
      ) : (
        <Gutter>
          {recommendations.length === 0 ? (
            <Text tone="secondary" variant="body">
              {t('pair.empty')}
            </Text>
          ) : (
            recommendations.map((recommendation, index) => (
              <TrackCard
                atmosphere={atmosphere}
                busy={saving}
                key={recommendation.track.providerTrackId}
                onReject={() => reject(recommendation.track.providerTrackId)}
                onSelect={() => void choose(recommendation.track)}
                playable={previewAvailable.has(recommendation.track.providerTrackId)}
                position={index + 1}
                recommendation={recommendation}
                selected={selectedTrackId === recommendation.track.providerTrackId}
                total={recommendations.length}
              />
            ))
          )}
        </Gutter>
      )}

      <Gutter style={styles.footer}>
        <Button label={t('pair.again')} onPress={() => void retry()} variant="ghost" />
        <Button
          label={t('pair.skip')}
          onPress={() => router.replace(`/palette/${palette.id}`)}
          variant="ghost"
        />
      </Gutter>
      <View style={{ height: skin.chrome.rules ? space.xl : space.xl }} />
    </Screen>
  );
}

/* -------------------------------------------------------------------- parts */

function Ribbon({ colors }: { colors: readonly Color[] }) {
  const skin = useSkin();
  const cap = skin.round.full;
  const last = colors.length - 1;
  return (
    <View style={styles.ribbon}>
      {colors.map((color, index) => (
        <View
          key={`${index}:${color.hex}`}
          style={{
            flex: color.weight,
            backgroundColor: color.hex,
            borderTopLeftRadius: index === 0 ? cap : 0,
            borderBottomLeftRadius: index === 0 ? cap : 0,
            borderTopRightRadius: index === last ? cap : 0,
            borderBottomRightRadius: index === last ? cap : 0,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Named stages, ticked off as they finish.
 *
 * Four labelled steps rather than one spinner, because the user is waiting on
 * four different things and at least one of them can fail on its own. A generic
 * spinner would make a provider outage look identical to a slow network.
 */
function Stages({ stage, completed }: { stage: string; completed: readonly string[] }) {
  const { t } = usePreferences();
  const skin = useSkin();
  const rows = [
    { key: 'reading-colour', label: t('pair.stage.colour') },
    { key: 'reading-atmosphere', label: t('pair.stage.atmosphere') },
    { key: 'finding-music', label: t('pair.stage.music') },
    { key: 'preparing-previews', label: t('pair.stage.previews') },
  ] as const;

  return (
    <Gutter>
      {rows.map((row) => {
        const done = completed.includes(row.key);
        const active = stage === row.key;
        return (
          <View key={row.key} style={styles.stageRow}>
            <Text tone={done || active ? 'primary' : 'secondary'} variant="chip">
              {row.label}
            </Text>
            {done ? (
              <Icon color={skin.ui.text.primary} name="pinned" scale="inline" />
            ) : active ? (
              <ActivityIndicator color={skin.ui.text.secondary} size="small" />
            ) : null}
          </View>
        );
      })}
    </Gutter>
  );
}

function Failure({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const { t } = usePreferences();
  const message =
    error === 'offline'
      ? t('pair.error.offline')
      : error === 'no-results'
        ? t('pair.error.empty')
        : error === 'not-configured'
          ? t('pair.error.notConfigured')
          : t('pair.error.provider');

  return (
    <Gutter>
      <Text tone="secondary" variant="body">
        {message}
      </Text>
      <Button label={t('pair.again')} onPress={onRetry} size="xs" />
    </Gutter>
  );
}

function TrackCard({
  recommendation,
  atmosphere,
  busy,
  playable,
  selected,
  position,
  total,
  onSelect,
  onReject,
}: {
  recommendation: MusicRecommendation;
  atmosphere: ReturnType<typeof readAtmosphere>;
  /** A write is in flight. Choosing twice would pair the same memory twice. */
  busy: boolean;
  playable: boolean;
  selected: boolean;
  position: number;
  total: number;
  onSelect: () => void;
  onReject: () => void;
}) {
  const { t } = usePreferences();
  const skin = useSkin();
  const { state, toggle, isActive, progress } = usePreviewPlayback();
  const track = recommendation.track;

  const active = isActive(track.providerTrackId);
  const playing = active && state.kind === 'playing';
  const loading = active && state.kind === 'loading';
  const unavailable = (active && state.kind === 'unavailable') || !playable;

  const copy = composeMatchCopy(
    atmosphere,
    // The stored intent is not carried per card; pace is recoverable from the
    // ranking's own pace reason, which is what the sentence needs.
    {
      pace:
        recommendation.reasons.find((reason) => reason.kind === 'pace')?.weight === 1
          ? 'fast'
          : recommendation.reasons.find((reason) => reason.kind === 'pace')?.weight === -1
            ? 'slow'
            : 'medium',
    } as never,
    t,
    track.genres[0] ?? null,
  );

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        {track.artworkUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            contentFit="cover"
            source={{ uri: track.artworkUrl }}
            style={[styles.artwork, { borderRadius: skin.round.card }]}
            transition={160}
          />
        ) : (
          // Missing artwork is common and must not collapse the layout.
          <View
            style={[
              styles.artwork,
              { borderRadius: skin.round.card, backgroundColor: skin.ui.bg.media },
            ]}
          />
        )}
        <View style={styles.cardMeta}>
          <Meta>{t('pair.position', { current: position, total })}</Meta>
          <Text numberOfLines={2} variant="section">
            {track.title}
          </Text>
          <Text numberOfLines={1} tone="secondary" variant="body">
            {track.artist}
          </Text>
          {track.album ? <Meta numberOfLines={1}>{track.album}</Meta> : null}
        </View>
      </View>

      {/* Playback. The progress hairline is real data — position over duration
          from the player — and is drawn only while something is playing. */}
      <View style={styles.playRow}>
        <Pressable
          accessibilityLabel={playing ? t('pair.pause') : t('pair.hear')}
          accessibilityRole="button"
          accessibilityState={{ busy: loading, disabled: unavailable, selected: playing }}
          disabled={unavailable}
          onPress={() => void toggle(track)}
          style={[
            styles.playButton,
            {
              borderRadius: skin.round.full,
              backgroundColor: skin.ui.scrim.control,
              opacity: unavailable ? 0.5 : 1,
            },
          ]}
        >
          <Icon
            color={skin.ui.text.primary}
            name={playing ? 'collapse' : 'forward'}
            scale="inline"
          />
          <Text variant="chip">
            {unavailable
              ? t('pair.noPreview')
              : loading
                ? t('pair.loading')
                : playing
                  ? t('pair.pause')
                  : t('pair.hear')}
          </Text>
        </Pressable>
        <Meta>
          {active && (state.kind === 'playing' || state.kind === 'paused')
            ? `${formatClock(state.positionMs)} / ${formatClock(state.durationMs)}`
            : t('pair.previewLength')}
        </Meta>
      </View>

      {active && (playing || state.kind === 'paused') ? (
        <View style={[styles.progressTrack, { backgroundColor: skin.ui.border.control }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: skin.ui.text.primary },
            ]}
          />
        </View>
      ) : null}

      {/* Why this matches — specific, measured, and localised as a template. */}
      <Meta>{t('pair.why')}</Meta>
      <Text tone="secondary" variant="body">
        {recommendation.explanation || t(copy.key, copy.params)}
      </Text>

      <View style={styles.reasons}>
        {strongestReasons(recommendation).map((reason) => (
          <View key={reason.key} style={styles.reason}>
            {/* A count as well as a colour, so the indicator survives colour
                blindness and greyscale. */}
            <Text variant="chip">{'·'.repeat(reason.strength)}</Text>
            <Meta>{t(reason.key)}</Meta>
          </View>
        ))}
      </View>

      <View style={styles.cardActions}>
        <Button
          disabled={busy}
          label={selected ? t('pair.chosen') : t('pair.choose')}
          onPress={onSelect}
          size="xs"
          variant={selected ? 'contrast' : 'primary'}
        />
        <Button
          disabled={busy}
          label={t('pair.reject')}
          onPress={onReject}
          size="xs"
          variant="ghost"
        />
      </View>

      {/* The store link. A licence condition of using these previews and this
          artwork — see docs/07 — so it is rendered from the model's own
          attribution rather than written by the screen. */}
      <Pressable
        accessibilityLabel={t('pair.openIn')}
        accessibilityRole="link"
        onPress={() => void musicProvider.openExternal(track)}
        style={styles.attribution}
      >
        <Text variant="chip">{t('pair.openIn')}</Text>
        <Meta>{track.attribution}</Meta>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    height: size.bandStripMin + 4,
    marginVertical: space.md,
    marginHorizontal: space.gutter,
    overflow: 'hidden',
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  card: { gap: space.sm, marginBottom: space.md },
  cardTop: { flexDirection: 'row', gap: space.md },
  artwork: { width: 88, height: 88 },
  cardMeta: { flex: 1, gap: 2, justifyContent: 'center' },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  progressTrack: { height: 2, overflow: 'hidden' },
  progressFill: { height: 2 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  cardActions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  attribution: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  footer: { gap: space.sm, marginTop: space.lg },
});
