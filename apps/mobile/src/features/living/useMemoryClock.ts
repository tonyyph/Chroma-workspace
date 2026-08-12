import type { Storyboard } from '@cw/domain';
import { useEffect, useRef, useState } from 'react';

/**
 * The clock the performance runs on.
 *
 * **The audio is the clock when there is audio.** A picture driven by its own
 * timer and music driven by the audio device disagree within a few seconds —
 * every device schedules them differently, and a cut that lands off the music is
 * the thing that makes a montage feel cheap. So when a preview is playing, the
 * player's reported position *is* the elapsed time; the JavaScript timer only
 * runs when there is nothing to follow.
 *
 * Ticking at 60ms rather than every frame is deliberate: this drives which scene
 * is on screen, which changes four or five times in half a minute. The motion
 * that has to be smooth — the drift and the pulse — runs on the UI thread from
 * the storyboard's own numbers and never reads this at all.
 */
const TICK_MS = 60;

export function useMemoryClock({
  storyboard,
  playing,
  audioPositionMs,
}: {
  storyboard: Storyboard;
  playing: boolean;
  /** The preview's own position, or null when nothing is playing. */
  audioPositionMs: number | null;
}): { elapsedMs: number; finished: boolean } {
  const [elapsedMs, setElapsedMs] = useState(0);

  // Kept in a ref as well so the interval can advance from the last value
  // without re-subscribing every tick.
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsedMs;

  const following = audioPositionMs !== null;

  useEffect(() => {
    if (!playing || following) return;
    const started = Date.now() - elapsedRef.current;
    const timer = setInterval(() => {
      setElapsedMs(Math.min(storyboard.totalMs, Date.now() - started));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [following, playing, storyboard.totalMs]);

  useEffect(() => {
    if (audioPositionMs === null) return;
    setElapsedMs(Math.min(storyboard.totalMs, audioPositionMs));
  }, [audioPositionMs, storyboard.totalMs]);

  // Restarting is what `elapsed === 0` means, so a new storyboard rewinds rather
  // than dropping the viewer into the middle of a different memory.
  useEffect(() => {
    setElapsedMs(0);
  }, [storyboard]);

  return { elapsedMs, finished: elapsedMs >= storyboard.totalMs };
}
