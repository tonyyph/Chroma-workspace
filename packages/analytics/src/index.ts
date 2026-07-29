import type { PaletteMood } from '@chromawave/domain';
import type { Language, ReminderTime, ThemeId } from '@chromawave/domain';

export type AnalyticsEventMap = {
  onboarding_started: Record<string, never>;
  onboarding_completed: { stepCount: number };
  capture_started: { source: 'library' | 'camera' };
  capture_completed: { source: 'library' | 'camera'; durationMs: number };
  palette_extracted: { colorCount: number; durationMs: number; mood: PaletteMood };
  pairing_requested: { mood: PaletteMood; provider: 'mock' | 'spotify' };
  pairing_accepted: { provider: 'mock' | 'spotify'; trackId: string };
  memory_saved: { memoryId: string; mood: PaletteMood; hasNote: boolean };
  memory_detail_opened: { memoryId: string };
  memory_favorite_changed: { memoryId: string; isFavorite: boolean };
  library_filter_changed: {
    favoritesOnly: boolean;
    mood: PaletteMood | null;
    hasQuery: boolean;
  };
  settings_haptics_changed: { enabled: boolean };
  settings_language_changed: { language: Language };
  settings_theme_changed: { theme: ThemeId };
  /** `iconApplied` is false when the home screen swap was refused or unsupported. */
  settings_notifications_changed: {
    enabled: boolean;
    permission: 'granted' | 'denied' | 'undetermined';
  };
  settings_reminder_time_changed: { reminderTime: ReminderTime };
  atelier_opened: { memoryCount: number };
  collection_created: { collectionId: string };
  collection_memory_changed: { collectionId: string; included: boolean };
  recap_viewed: { monthKey: string };
  palette_lab_viewed: { memoryCount: number };
  memory_shared: { memoryId: string; format: 'text-board' };
  memory_remixed: { memoryId: string; trackId: string };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

export interface Analytics {
  track<EventName extends AnalyticsEventName>(
    name: EventName,
    properties: AnalyticsEventMap[EventName],
  ): void;
}

export class DevelopmentAnalytics implements Analytics {
  constructor(private readonly enabled = true) {}

  track<EventName extends AnalyticsEventName>(
    name: EventName,
    properties: AnalyticsEventMap[EventName],
  ): void {
    if (this.enabled) {
      // The typed contract intentionally excludes photos, URIs, notes, and location.
      console.info(`[analytics] ${name}`, properties);
    }
  }
}

export class NoopAnalytics implements Analytics {
  track<EventName extends AnalyticsEventName>(
    _name: EventName,
    _properties: AnalyticsEventMap[EventName],
  ): void {}
}
