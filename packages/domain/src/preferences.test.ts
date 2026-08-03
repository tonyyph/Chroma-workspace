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
      colorSpace: 'srgb',
      defaultExport: 'css',
      activityReadAt: null,
    });
  });

  it('fills in the settings added after v1 for a record written before they existed', () => {
    // Colour space, default export and the activity read marker arrived with the
    // D2 settings rows. A device that saved preferences before then has none of
    // them on disk, and rejecting that record would reset every other choice the
    // user had made.
    const storedBeforeTheSettingsRows = {
      schemaVersion: 1,
      hapticsEnabled: false,
      notificationsEnabled: true,
      notificationIdentifier: 'daily-reminder',
      reminderTime: '18:00',
      language: 'vi',
      theme: 'moss',
    };

    const parsed = userPreferencesSchema.parse(storedBeforeTheSettingsRows);

    expect(parsed.colorSpace).toBe('srgb');
    expect(parsed.defaultExport).toBe('css');
    expect(parsed.activityReadAt).toBeNull();
    // The choices that were on disk survive rather than reverting to defaults.
    expect(parsed.theme).toBe('moss');
    expect(parsed.hapticsEnabled).toBe(false);
  });

  it('rejects unsupported themes, times, and partial persisted data', () => {
    expect(themeIdSchema.safeParse('neon').success).toBe(false);
    expect(reminderTimeSchema.safeParse('25:00').success).toBe(false);
    expect(userPreferencesSchema.safeParse({ language: 'vi' }).success).toBe(false);
  });

  it('drops the brandIdentity of preferences persisted while the icon was switchable', () => {
    // The identity switcher shipped a `brandIdentity` key. The final concept is a
    // single locked mark, so the key is gone — but devices that ran the earlier
    // build still have it on disk, and it must parse away rather than fail.
    const storedByTheIdentitySwitcher = {
      ...defaultUserPreferences,
      brandIdentity: 'liquid-lens',
    };

    const parsed = userPreferencesSchema.parse(storedByTheIdentitySwitcher);

    expect(parsed).toEqual(defaultUserPreferences);
    expect(parsed).not.toHaveProperty('brandIdentity');
  });
});
