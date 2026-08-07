import type {
  ColorRole,
  Language,
  LibraryFilter,
  PaletteSource,
  ReminderTime,
} from '@chromawave/domain';

/**
 * BUILD KIT · 07 · ANALYTICS EVENTS. The eight events the kit names are the
 * first block below, with their exact property shapes; the rest are this app's
 * own additions and are marked as such.
 */
export type AnalyticsEventMap = {
  capture_started: { source: PaletteSource };
  extraction_completed: { ms: number; confidence: number; colorCount: number };
  palette_saved: { tuned: boolean; source: PaletteSource };
  palette_tuned: { band: ColorRole; property: 'hue' | 'saturation' | 'luminance'; delta: number };
  export_performed: { format: ExportFormat; isPro: boolean };
  paywall_shown: { trigger: PaywallTrigger };
  paywall_converted: { plan: 'monthly' | 'yearly' };
  paywall_restore_requested: { trigger: PaywallTrigger };
  contrast_check_failed: { ratio: number };
  scan_pins_added: { count: number };

  /* --- beyond the kit's list, kept because existing surfaces emit them --- */
  onboarding_started: Record<string, never>;
  onboarding_completed: { stepCount: number };
  palette_detail_opened: { paletteId: string };
  palette_pinned_changed: { paletteId: string; isPinned: boolean };
  library_filter_changed: { filter: LibraryFilter };
  settings_haptics_changed: { enabled: boolean };
  settings_language_changed: { language: Language };
  /** `iconApplied` is false when the home screen swap was refused or unsupported. */
  settings_notifications_changed: {
    enabled: boolean;
    permission: 'granted' | 'denied' | 'undetermined';
  };
  settings_reminder_time_changed: { reminderTime: ReminderTime };
  explore_opened: Record<string, never>;
  collection_created: { collectionId: string };
  collection_palette_changed: { collectionId: string; included: boolean };
  recap_viewed: { monthKey: string };
  gradient_studio_opened: { paletteId: string };
  palette_shared: { paletteId: string; format: ShareRatio };
};

/** G7's four code targets, plus the palette formats from B4's export row. */
export type ExportFormat = 'css' | 'tailwind' | 'swift' | 'json' | 'svg' | 'ase' | 'png' | 'theme';

/**
 * Where the paywall was entered from, so conversion can be attributed.
 *
 * `merge-set` and `palette-limit` are gone. Merging a set is free — it is what
 * a set is *for* — and there is no palette limit to hit, because the Pro line
 * moved off quantity and onto export fidelity. Both were selling something the
 * app either gives away or never withheld.
 */
export type PaywallTrigger =
  'watermark' | 'json-export' | 'semantic-names' | 'auto-wb' | 'pro-tools' | 'unknown';

export type ShareRatio = '1x1' | '4x5' | '9x16' | '1.91x1';

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
