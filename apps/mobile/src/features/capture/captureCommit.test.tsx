import { makeColor } from '@cw/domain';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ViewfinderScreen } from '@/features/capture/ViewfinderScreen';
import { EntitlementProvider, PreferencesProvider } from '@/providers';
import { useCaptureStore } from '@/store';

/**
 * What the shutter commits.
 *
 * The frame's path used to reach the commit through a ref written during render.
 * That is the one thing React Compiler assumes no component does, and the value
 * was never needed out of band: the shot is stored before the read is awaited, so
 * it has committed by the time the capture completes. This asserts the path
 * survives the round trip, which is what the ref was there to guarantee.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  Redirect: () => null,
}));

// Skia cannot decode anything under Jest, and this is not a test of the read.
jest.mock('@/lib/readPalette', () => ({
  readPalette: jest.fn(async () => ({
    ok: true,
    result: {
      colors: [
        { hex: '#7C5CFF', weight: 0.6, role: 'dominant' },
        { hex: '#22D3EE', weight: 0.4, role: 'support' },
      ],
      deltaE: 2.4,
      confidence: 0.94,
    },
  })),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

beforeEach(() => {
  useCaptureStore.setState({ pending: null });
});

it('commits the captured frame path alongside the colours', async () => {
  const user = userEvent.setup();
  const view = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>
          <ViewfinderScreen />
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(view.toJSON()).not.toBeNull());

  await user.press(screen.getByLabelText('Capture'));

  // `capturePhotoToFile` is mocked to write /tmp/mock.jpg; the screen adds the
  // scheme, because `filePath` is a path and every reader wants a URL.
  await waitFor(
    () => expect(useCaptureStore.getState().pending?.photoUri).toBe('file:///tmp/mock.jpg'),
    { timeout: 5000 },
  );

  const pending = useCaptureStore.getState().pending;
  expect(pending?.colors).toHaveLength(2);
  expect(pending?.source).toBe('photo');
});

/** Guards the store contract the assertion above leans on. */
it('defaults setId to null when a capture was not started from a set', () => {
  useCaptureStore.getState().begin({
    colors: [makeColor('#7C5CFF', 1, 'dominant')],
    photoUri: 'file:///tmp/mock.jpg',
    deltaE: 0,
    confidence: 1,
    source: 'photo',
  });
  expect(useCaptureStore.getState().pending?.setId).toBeNull();
});
