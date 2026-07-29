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

/**
 * The two icon territories that shipped from the V1 identity exploration:
 * 01 Bandwave (recommended) and 07 Liquid Lens. Switching this swaps the home
 * screen icon, the launch sequence and every in-app brand surface.
 */
export const brandIdentitySchema = z.enum(['bandwave', 'liquid-lens']);

export const userPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  hapticsEnabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  notificationIdentifier: z.string().min(1).nullable(),
  reminderTime: reminderTimeSchema,
  language: languageSchema,
  theme: themeIdSchema,
  // Defaulted rather than required so preferences persisted before the identity
  // system landed still parse; schemaVersion stays at 1.
  brandIdentity: brandIdentitySchema.default('bandwave'),
});

export const defaultUserPreferences = userPreferencesSchema.parse({
  schemaVersion: 1,
  hapticsEnabled: true,
  notificationsEnabled: false,
  notificationIdentifier: null,
  reminderTime: '20:00',
  language: 'en',
  theme: 'obsidian',
  brandIdentity: 'bandwave',
});

export type Language = z.infer<typeof languageSchema>;
export type ReminderTime = z.infer<typeof reminderTimeSchema>;
export type ThemeId = z.infer<typeof themeIdSchema>;
export type BrandIdentityId = z.infer<typeof brandIdentitySchema>;
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

export interface HapticsService {
  selection(): Promise<void>;
  success(): Promise<void>;
}

/**
 * Swaps the home screen icon to match the chosen identity. Alternate icons are an
 * iOS/Android platform capability, so `supported` is false on web and on devices
 * that do not expose the API; callers must treat an unsupported platform as a
 * successful no-op rather than an error.
 */
export interface AppIconService {
  readonly supported: boolean;
  apply(identity: BrandIdentityId): Promise<void>;
}
