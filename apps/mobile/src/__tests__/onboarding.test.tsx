import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import OnboardingScreen from '@/app/onboarding';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
}));

jest.mock('@/infrastructure/dependencies', () => ({
  analytics: { track: jest.fn() },
}));

describe('onboarding navigation smoke test', () => {
  it('persists completion and enters the timeline', async () => {
    const screen = render(<OnboardingScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Enter CHROMAWAVE' }));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@chromawave/onboarding:v1', 'complete');
      expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });
});
