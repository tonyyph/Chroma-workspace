import type { Language, NotificationPermission, NotificationScheduler } from '@chromawave/domain';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const reminderCopy: Record<Language, { title: string; body: string }> = {
  en: {
    title: 'A moment is waiting in color.',
    body: 'Notice one image worth keeping in your private archive.',
  },
  vi: {
    title: 'Một khoảnh khắc đang chờ trong sắc màu.',
    body: 'Hãy nhận ra một hình ảnh đáng được giữ trong kho ký ức riêng tư.',
  },
};

function normalizePermission(status: Notifications.PermissionStatus): NotificationPermission {
  if (status === Notifications.PermissionStatus.GRANTED) return 'granted';
  if (status === Notifications.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

export class ExpoNotificationScheduler implements NotificationScheduler {
  async getPermission(): Promise<NotificationPermission> {
    const permission = await Notifications.getPermissionsAsync();
    return normalizePermission(permission.status);
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chromatic-reminder', {
        name: 'Chromatic reminder',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 180],
        lightColor: '#DCC28E',
      });
    }

    const permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      },
    });
    return normalizePermission(permission.status);
  }

  scheduleDaily({
    hour,
    minute,
    language,
  }: {
    hour: number;
    minute: number;
    language: Language;
  }): Promise<string> {
    return Notifications.scheduleNotificationAsync({
      content: {
        ...reminderCopy[language],
        sound: false,
        data: { route: '/(tabs)/capture' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        ...(Platform.OS === 'android' ? { channelId: 'chromatic-reminder' } : {}),
      },
    });
  }

  cancel(identifier: string): Promise<void> {
    return Notifications.cancelScheduledNotificationAsync(identifier);
  }
}
