import { makeColor } from '@cw/domain';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * The sampler, off the main path.
 *
 * It used to be the way into the app: it launched the system picker from an
 * effect on mount, and dismissing that picker left an empty canvas above a
 * radius slider and three mode chips that could not do anything without a
 * photo. It is opened from a palette now, so the photograph is a precondition
 * rather than something the screen has to go and get.
 */

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const found = [
  makeColor('#7C5CFF', 0.6, 'dominant'),
  makeColor('#22D3EE', 0.4, 'support'),
] as const;

const draw = (onPick = jest.fn()) => {
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>
          <ImportPickScreen
            colors={found}
            onCancel={jest.fn()}
            onPick={onPick}
            uri="file:///tmp/photo.jpg"
          />
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );
  return onPick;
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('opens onto the photograph it was given, asking for nothing', async () => {
  draw();

  await waitFor(() => expect(screen.getByLabelText('Photo, tap to sample')).toBeTruthy());
  // The regression. A screen that opens a modal on mount cannot be dismissed
  // back to anything useful, and this one had no other way to get a photo.
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});

it('withholds the action until there are enough points to mean something', async () => {
  draw();

  await waitFor(() => expect(screen.getByLabelText('Photo, tap to sample')).toBeTruthy());
  // Below two points this screen has nothing to say that the palette does not
  // already say better, so it must not offer to replace it.
  expect(screen.queryByText('Extract')).toBeNull();
  expect(screen.getByText(/at least two sample points/)).toBeTruthy();
});
