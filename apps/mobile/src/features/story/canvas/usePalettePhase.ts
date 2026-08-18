import { livingPalettePresets, type LivingPaletteConfig } from '@cw/domain';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The clock a Living Palette runs on.
 *
 * **Why this is React state and not a shared value.** The palette is drawn
 * inside the Skia picture, so advancing it means re-recording the scene — there
 * is no transform on the UI thread that can move colour bands. That puts a
 * ceiling on how fast this may tick, so it ticks at a deliberately modest rate
 * rather than per frame. A palette breathing at 12fps reads as breathing; a
 * canvas re-recording at 60fps reads as a hot phone.
 *
 * The honest consequence is written down rather than hidden: this is a *preview*
 * of the motion, at a lower frame rate than the motion itself implies. Smooth
 * playback needs the palette lifted out of the picture into its own layer, which
 * is a renderer change and not this phase's work.
 *
 * **Reduced motion stops the clock entirely** — no timer, no re-records, and
 * `drawScene` draws the palette at full strength. The setting is read once and
 * watched, the same way `ui/Carousel.tsx` does it, which is the app's only other
 * reduced-motion implementation.
 */

/** Re-records per second while a palette is animating. */
const PREVIEW_FPS = 12;

export function usePalettePhase(config: LivingPaletteConfig | null): {
  phase: number;
  reduceMotion: boolean;
} {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (config === null || reduceMotion) {
      setPhase(0);
      return;
    }

    const startedAt = Date.now();
    const timer = setInterval(() => {
      // Derived from elapsed time rather than incremented, so a dropped tick
      // costs smoothness and never accumulates drift — the palette is always
      // where the clock says it should be.
      setPhase(((Date.now() - startedAt) / config.periodMs) % 1);
    }, 1000 / PREVIEW_FPS);

    return () => clearInterval(timer);
  }, [config, reduceMotion]);

  return { phase, reduceMotion };
}

/** The presets, for a control row. Ordered slowest to fastest. */
export const livingPaletteOrder = livingPalettePresets;
