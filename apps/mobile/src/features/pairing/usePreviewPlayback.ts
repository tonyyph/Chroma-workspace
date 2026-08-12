import type { MusicTrackReference } from '@cw/domain';
import { useCallback, useEffect, useState } from 'react';
import type { PreviewPlaybackState } from '@/infrastructure/audio/PreviewPlayer';
import { musicProvider, previewPlayer } from '@/infrastructure/dependencies';
import { usePairingStore } from '@/store';

/**
 * The screen's view of the one player.
 *
 * Subscribes rather than owning: the player is a singleton, so a screen that
 * held its own would be the second one and the "only one preview at a time"
 * guarantee would be a comment rather than a fact.
 *
 * The unmount stop is the important line. Audio that outlives the screen that
 * started it is the failure everyone has experienced from some other app, and it
 * is prevented here rather than in each caller.
 */
export function usePreviewPlayback() {
  const [state, setState] = useState<PreviewPlaybackState>(previewPlayer.state);
  const noteListening = usePairingStore((store) => store.noteListening);

  useEffect(() => previewPlayer.subscribe(setState), []);

  useEffect(
    () => () => {
      previewPlayer.stop();
    },
    [],
  );

  const toggle = useCallback(
    async (track: MusicTrackReference) => {
      const id = track.providerTrackId;

      if (state.kind === 'playing' && state.providerTrackId === id) {
        // Skipping within the first few seconds is a judgment about the track,
        // not an accident. Later than that, pausing means nothing in particular.
        if (state.positionMs < 5_000) noteListening(id, 'skipped-early');
        previewPlayer.pause();
        return;
      }

      if (state.kind === 'paused' && state.providerTrackId === id) {
        previewPlayer.resume();
        return;
      }

      const controller = new AbortController();
      const preview = await musicProvider.getPreview(track, controller.signal).catch(() => null);

      if (preview === null) {
        // An honest state with a store link beside it, rather than a control
        // that looks live and does nothing.
        previewPlayer.markUnavailable(id);
        return;
      }

      await previewPlayer.play(track, preview);
    },
    [noteListening, state],
  );

  const isActive = (providerTrackId: string) =>
    'providerTrackId' in state && state.providerTrackId === providerTrackId;

  return {
    state,
    toggle,
    isActive,
    stop: useCallback(() => previewPlayer.stop(), []),
    /** 0–1 across the clip, for the ribbon playhead. */
    progress:
      state.kind === 'playing' || state.kind === 'paused'
        ? state.durationMs > 0
          ? Math.min(1, state.positionMs / state.durationMs)
          : 0
        : 0,
  };
}
