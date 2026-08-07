import { z } from 'zod';

// The working colour space is the same set a palette is tagged with, so the
// preference reuses that schema rather than declaring a parallel one that could
// drift from it.
import { colorSpaceSchema } from './palette';

export const languageSchema = z.enum(['en', 'vi']);
export const reminderTimeSchema = z.enum(['18:00', '20:00', '21:30']);

/** Which target G7 opens on, so the format someone always uses is one tap away. */
export const exportTargetSchema = z.enum(['css', 'tailwind', 'swift', 'json']);

export const userPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  hapticsEnabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  notificationIdentifier: z.string().min(1).nullable(),
  reminderTime: reminderTimeSchema,
  language: languageSchema,
  // The three below arrived after v1 shipped. They carry defaults so a stored
  // record written before they existed still parses instead of being rejected
  // as invalid and throwing the user back to factory preferences.
  colorSpace: colorSpaceSchema.default('srgb'),
  /** BUILD KIT · 05 · SOUND — "opt-in, off by default". */
  soundEnabled: z.boolean().default(false),
  /**
   * The drifting colour field behind every screen. On by default because it is
   * the app's surface, but a full-screen animation is exactly the thing some
   * people need to switch off — and the OS reduce-motion setting overrides it
   * regardless.
   */
  ambientBackdrop: z.boolean().default(true),
  defaultExport: exportTargetSchema.default('css'),
  /**
   * A stored v1 record without this field belongs to an existing installation,
   * so it defaults to complete during migration. A genuinely new installation
   * receives `defaultUserPreferences` below, where the explicit value is false.
   */
  onboardingCompleted: z.boolean().default(true),
  /**
   * When the activity feed was last cleared, as an ISO timestamp. Anything
   * captured after it counts as unread, which is what G9's "MARK ALL READ"
   * acts on and what the D2 row badges.
   */
  activityReadAt: z.string().datetime().nullable().default(null),
});

export const defaultUserPreferences = userPreferencesSchema.parse({
  schemaVersion: 1,
  hapticsEnabled: true,
  notificationsEnabled: false,
  notificationIdentifier: null,
  reminderTime: '20:00',
  language: 'en',
  colorSpace: 'srgb',
  soundEnabled: false,
  ambientBackdrop: true,
  defaultExport: 'css',
  onboardingCompleted: false,
  activityReadAt: null,
});

export type Language = z.infer<typeof languageSchema>;
export type ReminderTime = z.infer<typeof reminderTimeSchema>;
export type ColorSpacePreference = z.infer<typeof colorSpaceSchema>;
export type ExportTarget = z.infer<typeof exportTargetSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export interface PreferencesRepository {
  get(): Promise<UserPreferences>;
  save(preferences: UserPreferences): Promise<void>;
}

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface NotificationScheduler {
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  scheduleDaily(input: { hour: number; minute: number; language: Language }): Promise<string>;
  cancel(identifier: string): Promise<void>;
}

/**
 * BUILD KIT · 05 · HAPTIC MAP. Every haptic in the product is one of these eight
 * moments, named after the moment rather than the effect, so a screen cannot
 * invent a new buzz. The kit's rule — "Never haptic on scroll, tab switch, or
 * plain navigation" — is enforced by there being no key for those.
 */
export type HapticMoment =
  | 'shutterPress'
  | 'colourPinned'
  | 'extractionComplete'
  | 'paletteSaved'
  | 'sliderDetent'
  | 'refreshThreshold'
  | 'contrastFail'
  | 'deleteConfirmed';

export interface HapticsService {
  /** Fires the haptic mapped to a moment, or nothing if the user reduced them. */
  fire(moment: HapticMoment): Promise<void>;
  selection(): Promise<void>;
  success(): Promise<void>;
}

/**
 * BUILD KIT · 05 · SOUND · "opt-in, off by default". The three-note rise maps to
 * the three bands: violet → cyan → coral, a major triad.
 */
export type SoundCue = 'shutter' | 'extractDone' | 'save' | 'error';

export interface SoundService {
  readonly enabled: boolean;
  play(cue: SoundCue): Promise<void>;
}
