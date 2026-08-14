import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';
import { ViewfinderScreen } from '@/features/capture/ViewfinderScreen';
import { ScanScreen } from '@/features/tools/ScanScreen';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * Modes that are modes, and a screen that asks for what it needs.
 *
 * The row under the shutter used to be four labels that pushed routes while
 * also setting local state, so coming back from one left the underline on a
 * mode the screen was not in — and the camera it had pushed over kept running.
 * `replace` is what makes the route the state; these assert it stays that way.
 */

// `mock`-prefixed so Jest's hoisted factory may close over it.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  Redirect: () => null,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const wrap = (children: React.ReactNode) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>{children}</EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

it('replaces the screen rather than stacking a second camera on it', async () => {
  const user = userEvent.setup();
  wrap(<ViewfinderScreen />);

  await waitFor(() => expect(screen.getByLabelText('SCAN')).toBeTruthy());
  await user.press(screen.getByLabelText('SCAN'));

  expect(mockReplace).toHaveBeenCalledWith('/tools/scan');
});

it('does nothing when the mode already showing is chosen again', async () => {
  const user = userEvent.setup();
  wrap(<ViewfinderScreen />);

  await waitFor(() => expect(screen.getByLabelText('LIVE')).toBeTruthy());
  await user.press(screen.getByLabelText('LIVE'));

  // Replacing this screen with itself would tear down and rebuild the capture
  // session for no change at all.
  expect(mockReplace).not.toHaveBeenCalled();
});

it('no longer offers importing from a camera screen', async () => {
  wrap(<ViewfinderScreen />);

  await waitFor(() => expect(screen.getByLabelText('LIVE')).toBeTruthy());
  // Two controls used to lead to the import screen from here — a PHOTO mode and
  // an IMPORT button beside the shutter. Choosing a photograph belongs to the
  // source sheet now, and does not need a camera running to offer it.
  expect(screen.queryByLabelText('IMPORT')).toBeNull();
  expect(screen.queryByLabelText('PHOTO')).toBeNull();
});

it('lets scan ask for the camera instead of stating it is missing', async () => {
  jest.mocked(useCameraPermission).mockReturnValue({
    hasPermission: false,
    requestPermission: jest.fn(async () => true),
    canRequestPermission: true,
    status: 'not-determined',
  });
  wrap(<ScanScreen onBuild={jest.fn()} onExit={jest.fn()} />);

  // It used to print "CAMERA ACCESS NEEDED" over a black rectangle and offer
  // nothing to press — a screen that could never become useful.
  await waitFor(() => expect(screen.getByLabelText('Allow camera')).toBeTruthy());
});
