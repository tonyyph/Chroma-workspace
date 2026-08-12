import type { MusicPairing } from '@cw/domain';
import { space } from '@cw/tokens';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { musicProvider } from '@/infrastructure/dependencies';
import { usePreferences, useSkin } from '@/providers';
import { Button, Card, Icon, Meta, Pressable, Text } from '@/ui';
import { formatClock } from './matchCopy';
import { usePreviewPlayback } from './usePreviewPlayback';

/**
 * The music half of a Chromatic Memory, on the screen that holds it.
 *
 * Three states, and the second two are as designed as the first:
 *
 * - **paired** — the track, playable, with its reason and its store link.
 * - **unpaired** — an invitation, not an empty slot. A memory without music is
 *   complete; it simply has not been given a song yet.
 * - **unavailable** — the saved metadata, marked. A track disappearing from a
 *   catalogue must never delete what the user chose; we own the metadata and it
 *   reads offline, so the memory survives the provider.
 */
export function TrackBlock({ pairing, paletteId }: { pairing: MusicPairing; paletteId: string }) {
  const { t } = usePreferences();
  const skin = useSkin();
  const router = useRouter();
  const { state, toggle, isActive } = usePreviewPlayback();

  const track = pairing.selectedTrack;

  if (track === null) {
    return (
      <Card style={styles.card}>
        <Meta>{t('memory.music')}</Meta>
        <Text tone="secondary" variant="body">
          {t('memory.unpaired')}
        </Text>
        <Button
          label={t('memory.findMusic')}
          onPress={() => router.push(`/pair?id=${paletteId}`)}
          size="xs"
        />
      </Card>
    );
  }

  const active = isActive(track.providerTrackId);
  const playing = active && state.kind === 'playing';
  const loading = active && state.kind === 'loading';
  const unavailable = pairing.status === 'unavailable' || (active && state.kind === 'unavailable');

  return (
    <Card style={styles.card}>
      <Meta>{t('memory.music')}</Meta>

      <View style={styles.row}>
        {track.artworkUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            contentFit="cover"
            source={{ uri: track.artworkUrl }}
            style={[styles.artwork, { borderRadius: skin.round.card }]}
            transition={160}
          />
        ) : (
          <View
            style={[
              styles.artwork,
              { borderRadius: skin.round.card, backgroundColor: skin.ui.bg.media },
            ]}
          />
        )}
        <View style={styles.meta}>
          <Text numberOfLines={2} variant="section">
            {track.title}
          </Text>
          <Text numberOfLines={1} tone="secondary" variant="body">
            {track.artist}
          </Text>
          {track.album ? <Meta numberOfLines={1}>{track.album}</Meta> : null}
        </View>
      </View>

      <View style={styles.playRow}>
        <Pressable
          accessibilityLabel={playing ? t('pair.pause') : t('pair.hear')}
          accessibilityRole="button"
          accessibilityState={{ busy: loading, disabled: unavailable, selected: playing }}
          disabled={unavailable}
          onPress={() => void toggle(track)}
          style={[
            styles.play,
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
              ? t('memory.trackUnavailable')
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

      <View style={styles.actions}>
        <Button
          label={t('memory.replaceTrack')}
          onPress={() => router.push(`/pair?id=${paletteId}`)}
          size="xs"
          variant="ghost"
        />
      </View>

      {/* The store link, again from the model's own attribution. Every surface
          that shows a provider's artwork carries it — see docs/07. */}
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
  card: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  artwork: { width: 72, height: 72 },
  meta: { flex: 1, gap: 2, justifyContent: 'center' },
  playRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  actions: { flexDirection: 'row', gap: space.sm },
  attribution: { flexDirection: 'row', justifyContent: 'space-between' },
});
