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

export interface HapticsService {
  selection(): Promise<void>;
  success(): Promise<void>;
}
