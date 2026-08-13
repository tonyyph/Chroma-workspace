import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * The import screen's second intent.
 *
 * EXTRACT produces a palette to work with; MAKE CINEMATIC produces a photograph
 * to grade. Both hand back the same two things, and this asserts the cinematic
 * one is wired to the automatic read rather than requiring sample points — the
 * whole claim of the feature is that picking a photo is enough.
 */

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/picked.heic' }],
  })),
}));

jest.mock('@/lib/decodable', () => ({
  isDecodable: () => true,
  toDecodableUri: jest.fn(async () => 'file:///tmp/picked.jpg'),
}));

jest.mock('@/lib/readPalette', () => ({
  decodeImage: jest.fn(async () => null),
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

it('hands the automatic read and the photo to the cinematic action', async () => {
  const user = userEvent.setup();
  const onCinematic = jest.fn();

  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>
          <ImportPickScreen onCancel={jest.fn()} onCinematic={onCinematic} onExtract={jest.fn()} />
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );

  // The picker runs on mount and the whole-image read follows it, so the action
  // becomes available without a single tap on the canvas.
  await waitFor(() => expect(screen.getByText('Make cinematic')).toBeTruthy());
  await user.press(screen.getByText('Make cinematic'));

  expect(onCinematic).toHaveBeenCalledTimes(1);
  const [colors, photoUri] = onCinematic.mock.calls[0]!;
  expect(colors).toHaveLength(2);
  expect(photoUri).toBe('file:///tmp/picked.jpg');
});
