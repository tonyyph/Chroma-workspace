import type { HapticsService } from '@chromawave/domain';
import * as Haptics from 'expo-haptics';

export class ExpoHapticsService implements HapticsService {
  selection(): Promise<void> {
    return Haptics.selectionAsync();
  }

  success(): Promise<void> {
    return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}
