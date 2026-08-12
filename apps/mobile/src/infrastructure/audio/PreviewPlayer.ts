import type { MusicPreview, MusicTrackReference } from '@cw/domain';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * The preview player.
 *
 * **One instance for the whole app, and that is the design.** "Only one preview
 * plays at a time" is not a rule screens are asked to follow — there is only one
 * player, and `play()` stops whatever it was doing before it starts anything
 * else, so two overlapping clips are unreachable rather than merely discouraged.
 * Every product that has got this wrong got it wrong by trusting call sites.
 *
 * Audio is streamed from the provider's URL. Nothing is downloaded, trimmed,
 * cached to disk or re-hosted — see docs/07.
 */

export type PreviewPlaybackState =
  | { kind: 'idle' }
  | { kind: 'loading'; providerTrackId: string }
  | { kind: 'playing'; providerTrackId: string; positionMs: number; durationMs: number }
  | { kind: 'paused'; providerTrackId: string; positionMs: number; durationMs: number }
  | { kind: 'unavailable'; providerTrackId: string }
  | { kind: 'error'; providerTrackId: string };

export interface PreviewPlaybackService {
  readonly state: PreviewPlaybackState;
  play(track: MusicTrackReference, preview: MusicPreview): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  markUnavailable(providerTrackId: string): void;
  subscribe(listener: (state: PreviewPlaybackState) => void): () => void;
}

/**
 * How long a clip may sit in `loading` before it is called an error.
 *
 * A ceiling rather than an indefinite spinner, because a control that spins
 * forever tells the user less than one that says it failed.
 */
const LOAD_TIMEOUT_MS = 8_000;

/** How often position is published while playing. 4/s is smooth for a 30s bar. */
const TICK_MS = 250;

export class PreviewPlayer implements PreviewPlaybackService {
  private current: AudioPlayer | null = null;
  private currentTrackId: string | null = null;
  private listeners = new Set<(state: PreviewPlaybackState) => void>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionReady = false;

  private currentState: PreviewPlaybackState = { kind: 'idle' };

  get state(): PreviewPlaybackState {
    return this.currentState;
  }

  async play(track: MusicTrackReference, preview: MusicPreview): Promise<void> {
    // Unconditionally, and first. Whatever was playing is over the moment the
    // user asks for something else — before any await, so a slow load cannot
    // leave the previous clip running underneath it.
    this.teardown();

    const providerTrackId = track.providerTrackId;
    this.currentTrackId = providerTrackId;
    this.publish({ kind: 'loading', providerTrackId });

    try {
      // The audio session is claimed on first playback rather than at launch:
      // an app that has not played anything has no business owning the session.
      if (!this.sessionReady) {
        await setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false });
        this.sessionReady = true;
      }

      const player = createAudioPlayer({ uri: preview.url });

      // A second `play()` may have arrived while the session was being set up.
      // If it did, this call is stale and must not take the player over.
      if (this.currentTrackId !== providerTrackId) {
        player.remove();
        return;
      }

      this.current = player;
      this.loadTimer = setTimeout(() => {
        if (this.currentTrackId === providerTrackId && this.currentState.kind === 'loading') {
          this.teardown();
          this.publish({ kind: 'error', providerTrackId });
        }
      }, LOAD_TIMEOUT_MS);

      player.play();
      this.startTicking(providerTrackId, preview.durationMs);
    } catch {
      this.teardown();
      this.publish({ kind: 'error', providerTrackId });
    }
  }

  pause(): void {
    if (this.current === null || this.currentTrackId === null) return;
    this.current.pause();
    this.stopTicking();
    const { positionMs, durationMs } = this.readPosition();
    this.publish({ kind: 'paused', providerTrackId: this.currentTrackId, positionMs, durationMs });
  }

  resume(): void {
    if (this.current === null || this.currentTrackId === null) return;
    this.current.play();
    this.startTicking(this.currentTrackId, this.readPosition().durationMs);
  }

  stop(): void {
    this.teardown();
    this.publish({ kind: 'idle' });
  }

  /**
   * Records that a track has no playable excerpt.
   *
   * A state rather than silence: the card must be able to say "preview
   * unavailable" and offer its store link, which is the compliant alternative
   * when a provider offers no clip.
   */
  markUnavailable(providerTrackId: string): void {
    this.teardown();
    this.currentTrackId = providerTrackId;
    this.publish({ kind: 'unavailable', providerTrackId });
  }

  subscribe(listener: (state: PreviewPlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private startTicking(providerTrackId: string, fallbackDurationMs: number): void {
    this.stopTicking();
    this.ticker = setInterval(() => {
      if (this.current === null || this.currentTrackId !== providerTrackId) return;

      const { positionMs, durationMs } = this.readPosition(fallbackDurationMs);

      /**
       * Loaded means *the asset* reports a duration — not the fallback the
       * provider told us to expect.
       *
       * Reading the merged value would clear the timeout on the first tick of
       * every clip, including one that never loads, because the fallback is
       * always non-zero. The timeout would be dead code that looked alive.
       */
      const loaded = (this.current.duration ?? 0) > 0;

      if (!loaded) {
        // Still buffering. Saying "playing" here would put a moving progress bar
        // over silence, which is the dishonest version of a loading state.
        this.publish({ kind: 'loading', providerTrackId });
        return;
      }

      if (this.loadTimer !== null) {
        clearTimeout(this.loadTimer);
        this.loadTimer = null;
      }

      // A preview that has run out stops rather than looping. Nothing about this
      // product wants a thirty-second clip on repeat.
      if (durationMs > 0 && positionMs >= durationMs - TICK_MS) {
        this.teardown();
        this.publish({ kind: 'idle' });
        return;
      }

      this.publish({ kind: 'playing', providerTrackId, positionMs, durationMs });
    }, TICK_MS);
  }

  private stopTicking(): void {
    if (this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private readPosition(fallbackDurationMs = 0): { positionMs: number; durationMs: number } {
    const player = this.current;
    if (player === null) return { positionMs: 0, durationMs: fallbackDurationMs };
    // `expo-audio` reports seconds; everything else in the domain is milliseconds.
    return {
      positionMs: Math.max(0, Math.round((player.currentTime ?? 0) * 1000)),
      durationMs: Math.max(0, Math.round((player.duration ?? 0) * 1000)) || fallbackDurationMs,
    };
  }

  /** Releases everything. Safe to call repeatedly and from any state. */
  private teardown(): void {
    this.stopTicking();
    if (this.loadTimer !== null) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    if (this.current !== null) {
      try {
        this.current.pause();
        this.current.remove();
      } catch {
        // Already released. Nothing to do, and nothing worth reporting.
      }
      this.current = null;
    }
    this.currentTrackId = null;
  }

  private publish(state: PreviewPlaybackState): void {
    this.currentState = state;
    for (const listener of this.listeners) listener(state);
  }
}
