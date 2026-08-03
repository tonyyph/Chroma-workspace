import { themeModes, themePalettes, type ThemePalette } from '@chromawave/design-tokens';
import {
  defaultUserPreferences,
  type ColorSpacePreference,
  type ExportTarget,
  type Language,
  type NotificationPermission,
  type ReminderTime,
  type ThemeId,
  type UserPreferences,
} from '@chromawave/domain';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  analytics,
  hapticsService,
  migrateStorage,
  notificationScheduler,
  preferencesRepository,
} from '@/infrastructure/dependencies';
import { translate, type MessageKey } from '@/localization/messages';

type PreferenceError = 'load' | 'save' | 'notification' | null;
type PreferenceAction =
  | 'haptics'
  | 'language'
  | 'theme'
  | 'notifications'
  | 'reminder'
  | 'colorSpace'
  | 'defaultExport'
  | 'activity'
  | null;

type PreferencesContextValue = {
  preferences: UserPreferences;
  colors: ThemePalette;
  mode: 'light' | 'dark';
  hydrated: boolean;
  busyAction: PreferenceAction;
  error: PreferenceError;
  notificationPermission: NotificationPermission;
  t: (key: MessageKey, parameters?: Readonly<Record<string, string | number>>) => string;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  setLanguage: (language: Language) => Promise<void>;
  setTheme: (theme: ThemeId) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setReminderTime: (time: ReminderTime) => Promise<void>;
  setColorSpace: (space: ColorSpacePreference) => Promise<void>;
  setDefaultExport: (target: ExportTarget) => Promise<void>;
  /** Clears the activity feed's unread count by stamping "read" at now. */
  markActivityRead: () => Promise<void>;
  refreshNotificationPermission: () => Promise<void>;
  clearError: () => void;
  feedback: {
    selection: () => Promise<void>;
    success: () => Promise<void>;
  };
};

const noop = async () => {};

const defaultContextValue: PreferencesContextValue = {
  preferences: defaultUserPreferences,
  colors: themePalettes[defaultUserPreferences.theme],
  mode: themeModes[defaultUserPreferences.theme],
  hydrated: false,
  busyAction: null,
  error: null,
  notificationPermission: 'undetermined',
  t: (key, parameters) => translate(defaultUserPreferences.language, key, parameters),
  setHapticsEnabled: noop,
  setLanguage: noop,
  setTheme: noop,
  setNotificationsEnabled: noop,
  setReminderTime: noop,
  setColorSpace: noop,
  setDefaultExport: noop,
  markActivityRead: noop,
  refreshNotificationPermission: noop,
  clearError: () => {},
  feedback: { selection: noop, success: noop },
};

const PreferencesContext = createContext<PreferencesContextValue>(defaultContextValue);

function parseReminderTime(time: ReminderTime): { hour: number; minute: number } {
  const [hour = 20, minute = 0] = time.split(':').map(Number);
  return { hour, minute };
}

export function PreferencesProvider({
  children,
  onReady,
}: PropsWithChildren<{ onReady?: () => void }>) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultUserPreferences);
  const [hydrated, setHydrated] = useState(false);
  const [busyAction, setBusyAction] = useState<PreferenceAction>(null);
  const [error, setError] = useState<PreferenceError>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('undetermined');

  useEffect(() => {
    let active = true;
    // The MMKV migration has to finish before the first read, or an upgrading
    // user sees defaults for one launch and then their real data on the next.
    migrateStorage()
      .catch(() => undefined)
      .then(() => Promise.all([preferencesRepository.get(), notificationScheduler.getPermission()]))
      .then(([stored, permission]) => {
        if (!active) return;
        setPreferences(stored);
        setNotificationPermission(permission);
      })
      .catch(() => {
        if (active) setError('load');
      })
      .finally(() => {
        if (!active) return;
        setHydrated(true);
        onReady?.();
      });
    return () => {
      active = false;
    };
  }, [onReady]);

  const save = useCallback(
    async (next: UserPreferences, action: Exclude<PreferenceAction, null>): Promise<boolean> => {
      const previous = preferences;
      setBusyAction(action);
      setError(null);
      setPreferences(next);
      try {
        await preferencesRepository.save(next);
        return true;
      } catch {
        setPreferences(previous);
        setError('save');
        return false;
      } finally {
        setBusyAction(null);
      }
    },
    [preferences],
  );

  const scheduleFor = useCallback(
    async (
      next: UserPreferences,
      action: 'language' | 'reminder' | 'notifications',
    ): Promise<boolean> => {
      const { hour, minute } = parseReminderTime(next.reminderTime);
      let newIdentifier: string | null = null;
      try {
        newIdentifier = await notificationScheduler.scheduleDaily({
          hour,
          minute,
          language: next.language,
        });
        const scheduled = { ...next, notificationIdentifier: newIdentifier };
        const didSave = await save(scheduled, action);
        if (!didSave) {
          await notificationScheduler.cancel(newIdentifier);
          return false;
        }
        if (
          preferences.notificationIdentifier &&
          preferences.notificationIdentifier !== newIdentifier
        ) {
          await notificationScheduler.cancel(preferences.notificationIdentifier);
        }
        return true;
      } catch {
        if (newIdentifier) await notificationScheduler.cancel(newIdentifier);
        setError('notification');
        setBusyAction(null);
        return false;
      }
    },
    [preferences.notificationIdentifier, save],
  );

  const setHapticsEnabled = useCallback(
    async (enabled: boolean) => {
      const didSave = await save({ ...preferences, hapticsEnabled: enabled }, 'haptics');
      if (!didSave) return;
      if (enabled) await hapticsService.selection();
      analytics.track('settings_haptics_changed', { enabled });
    },
    [preferences, save],
  );

  const setLanguage = useCallback(
    async (language: Language) => {
      const next = { ...preferences, language };
      const didSave = preferences.notificationsEnabled
        ? await scheduleFor(next, 'language')
        : await save(next, 'language');
      if (!didSave) return;
      if (preferences.hapticsEnabled) await hapticsService.selection();
      analytics.track('settings_language_changed', { language });
    },
    [preferences, save, scheduleFor],
  );

  const setTheme = useCallback(
    async (theme: ThemeId) => {
      const didSave = await save({ ...preferences, theme }, 'theme');
      if (!didSave) return;
      if (preferences.hapticsEnabled) await hapticsService.selection();
      analytics.track('settings_theme_changed', { theme });
    },
    [preferences, save],
  );

  const setNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      setBusyAction('notifications');
      setError(null);
      if (enabled) {
        const permission = await notificationScheduler.requestPermission();
        setNotificationPermission(permission);
        if (permission !== 'granted') {
          setBusyAction(null);
          analytics.track('settings_notifications_changed', {
            enabled: false,
            permission,
          });
          return;
        }
        const didSave = await scheduleFor(
          { ...preferences, notificationsEnabled: true },
          'notifications',
        );
        if (didSave) {
          if (preferences.hapticsEnabled) await hapticsService.success();
          analytics.track('settings_notifications_changed', {
            enabled: true,
            permission,
          });
        }
        return;
      }

      try {
        if (preferences.notificationIdentifier) {
          await notificationScheduler.cancel(preferences.notificationIdentifier);
        }
        const didSave = await save(
          {
            ...preferences,
            notificationsEnabled: false,
            notificationIdentifier: null,
          },
          'notifications',
        );
        if (didSave) {
          analytics.track('settings_notifications_changed', {
            enabled: false,
            permission: notificationPermission,
          });
        }
      } catch {
        setError('notification');
        setBusyAction(null);
      }
    },
    [notificationPermission, preferences, save, scheduleFor],
  );

  const setReminderTime = useCallback(
    async (reminderTime: ReminderTime) => {
      const next = { ...preferences, reminderTime };
      const didSave = preferences.notificationsEnabled
        ? await scheduleFor(next, 'reminder')
        : await save(next, 'reminder');
      if (!didSave) return;
      if (preferences.hapticsEnabled) await hapticsService.selection();
      analytics.track('settings_reminder_time_changed', { reminderTime });
    },
    [preferences, save, scheduleFor],
  );

  const setColorSpace = useCallback(
    async (colorSpace: ColorSpacePreference) => {
      const didSave = await save({ ...preferences, colorSpace }, 'colorSpace');
      if (!didSave) return;
      if (preferences.hapticsEnabled) await hapticsService.selection();
    },
    [preferences, save],
  );

  const setDefaultExport = useCallback(
    async (defaultExport: ExportTarget) => {
      const didSave = await save({ ...preferences, defaultExport }, 'defaultExport');
      if (!didSave) return;
      if (preferences.hapticsEnabled) await hapticsService.selection();
    },
    [preferences, save],
  );

  const markActivityRead = useCallback(async () => {
    const didSave = await save(
      { ...preferences, activityReadAt: new Date().toISOString() },
      'activity',
    );
    if (!didSave) return;
    if (preferences.hapticsEnabled) await hapticsService.success();
  }, [preferences, save]);

  const refreshNotificationPermission = useCallback(async () => {
    setNotificationPermission(await notificationScheduler.getPermission());
  }, []);

  const feedback = useMemo(
    () => ({
      selection: async () => {
        if (preferences.hapticsEnabled) await hapticsService.selection();
      },
      success: async () => {
        if (preferences.hapticsEnabled) await hapticsService.success();
      },
    }),
    [preferences.hapticsEnabled],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      colors: themePalettes[preferences.theme],
      mode: themeModes[preferences.theme],
      hydrated,
      busyAction,
      error,
      notificationPermission,
      t: (key, parameters) => translate(preferences.language, key, parameters),
      setHapticsEnabled,
      setLanguage,
      setTheme,
      setNotificationsEnabled,
      setReminderTime,
      setColorSpace,
      setDefaultExport,
      markActivityRead,
      refreshNotificationPermission,
      clearError: () => setError(null),
      feedback,
    }),
    [
      busyAction,
      error,
      feedback,
      hydrated,
      markActivityRead,
      notificationPermission,
      preferences,
      refreshNotificationPermission,
      setColorSpace,
      setDefaultExport,
      setHapticsEnabled,
      setLanguage,
      setNotificationsEnabled,
      setReminderTime,
      setTheme,
    ],
  );

  if (!hydrated) return null;

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
