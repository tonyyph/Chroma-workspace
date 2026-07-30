import type { HapticMoment, HapticsService } from '@chromawave/domain';
import * as Haptics from 'expo-haptics';

/**
 * BUILD KIT · 05 · HAPTIC MAP, transcribed exactly:
 *
 *   shutter press        impact · medium
 *   colour pinned (scan) impact · light
 *   extraction complete  notification · success
 *   palette saved        notification · success
 *   band slider detent   selection · every 10°
 *   refresh threshold    impact · light
 *   contrast FAIL shown  notification · warning
 *   delete confirmed     impact · heavy
 */
const MAP: Record<HapticMoment, () => Promise<void>> = {
  shutterPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  colourPinned: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  extractionComplete: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  paletteSaved: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  sliderDetent: () => Haptics.selectionAsync(),
  refreshThreshold: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  contrastFail: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  deleteConfirmed: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

/** "band slider detent · selection · every 10°" — the interval, in degrees. */
export const SLIDER_DETENT_DEGREES = 10;

export class ExpoHapticsService implements HapticsService {
  /**
   * `enabled` reflects the app's own preference. The kit is explicit that this
   * "only reduces, never overrides upward": the OS setting is authoritative and
   * `expo-haptics` already returns silently when the system has them off, so this
   * flag can suppress but never force.
   */
  constructor(private enabled = true) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async fire(moment: HapticMoment): Promise<void> {
    if (!this.enabled) return;
    try {
      await MAP[moment]();
    } catch {
      // A device without a haptic engine is not an error worth surfacing.
    }
  }

  selection(): Promise<void> {
    return this.fire('sliderDetent');
  }

  success(): Promise<void> {
    return this.fire('paletteSaved');
  }
}
