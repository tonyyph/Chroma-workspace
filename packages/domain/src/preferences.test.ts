import { describe, expect, it } from 'vitest';

import {
  defaultUserPreferences,
  reminderTimeSchema,
  themeIdSchema,
  userPreferencesSchema,
} from './preferences';

describe('UserPreferences', () => {
  it('defines a private, quiet default experience', () => {
    expect(defaultUserPreferences).toEqual({
      schemaVersion: 1,
      hapticsEnabled: true,
      notificationsEnabled: false,
      notificationIdentifier: null,
      reminderTime: '20:00',
      language: 'en',
      theme: 'obsidian',
    });
  });

  it('rejects unsupported themes, times, and partial persisted data', () => {
    expect(themeIdSchema.safeParse('neon').success).toBe(false);
    expect(reminderTimeSchema.safeParse('25:00').success).toBe(false);
    expect(userPreferencesSchema.safeParse({ language: 'vi' }).success).toBe(false);
  });
});
