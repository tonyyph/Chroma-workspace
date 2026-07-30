import { z } from 'zod';

export const languageSchema = z.enum(['en', 'vi']);
export const themeIdSchema = z.enum([
  'obsidian',
  'ivory',
  'oxblood',
  'cobalt',
  'moss',
  'aubergine',
]);
export const reminderTimeSchema = z.enum(['18:00', '20:00', '21:30']);

export const userPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  hapticsEnabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  notificationIdentifier: z.string().min(1).nullable(),
  reminderTime: reminderTimeSchema,
  language: languageSchema,
  theme: themeIdSchema,
});

export const defaultUserPreferences = userPreferencesSchema.parse({
  schemaVersion: 1,
  hapticsEnabled: true,
  notificationsEnabled: false,
  notificationIdentifier: null,
  reminderTime: '20:00',
  language: 'en',
  theme: 'obsidian',
});

export type Language = z.infer<typeof languageSchema>;
export type ReminderTime = z.infer<typeof reminderTimeSchema>;
export type ThemeId = z.infer<typeof themeIdSchema>;
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
