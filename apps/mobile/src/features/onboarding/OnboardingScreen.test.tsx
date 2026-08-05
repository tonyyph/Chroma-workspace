import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { OnboardingScreen } from './OnboardingScreen';

const mockReplace = jest.fn();
const mockCompleteOnboarding = jest.fn(async () => true);

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
}));
jest.mock('@/infrastructure/dependencies', () => ({
  analytics: { track: jest.fn() },
}));
jest.mock('@/providers/PreferencesProvider', () => {
  const { translate } =
    jest.requireActual<typeof import('@/localization/messages')>('@/localization/messages');
  return {
    usePreferences: () => ({
      t: (key: Parameters<typeof translate>[1], parameters?: Parameters<typeof translate>[2]) =>
        translate('en', key, parameters),
      completeOnboarding: mockCompleteOnboarding,
    }),
  };
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompleteOnboarding.mockResolvedValue(true);
  });

  it('contains five slides and persists completion before leaving', async () => {
    const view = render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <OnboardingScreen />
      </SafeAreaProvider>,
    );

    expect(view.getByLabelText('Step 1 of 5')).toBeTruthy();
    for (let step = 2; step <= 5; step += 1) {
      fireEvent.press(view.getByRole('button', { name: 'Continue' }));
      expect(view.getByLabelText(`Step ${step} of 5`)).toBeTruthy();
    }

    fireEvent.press(view.getByRole('button', { name: 'Allow camera' }));

    await waitFor(() => expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  });
});
