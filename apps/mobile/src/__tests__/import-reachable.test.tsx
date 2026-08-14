import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';
import { SourceSheet } from '@/features/capture/SourceSheet';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * Choosing a photograph must not depend on the camera.
 *
 * This is a shipped bug written down. `/tools/import` had exactly one entry —
 * a button on the viewfinder — and that screen opens
 * `if (!hasPermission) return <PermissionGate/>`, so the button was never
 * rendered. Anyone who tapped "Don't Allow" on the camera lost the ability to
 * import a photo permanently, and iOS asks once.
 *
 * The two have nothing to do with each other. Expo's own documentation states
 * that `launchImageLibraryAsync` needs no permission at all; it runs out of
 * process. So the test refuses *both* — camera and photo library — and asserts
 * that a photograph can still be chosen.
 */

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/picked.heic' }],
  })),
}));

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
  useIsFocused: () => true,
  Redirect: () => null,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

it('lets someone who refused the camera still choose a photo', async () => {
  // Refused, and the system will not ask again — the worst case, and the one
  // the old build made permanent.
  jest.mocked(useCameraPermission).mockReturnValue({
    hasPermission: false,
    canRequestPermission: false,
    requestPermission: jest.fn(async () => false),
    status: 'denied',
  });
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue({
    granted: false,
    canAskAgain: false,
    status: MediaLibrary.PermissionStatus.DENIED,
    accessPrivileges: 'none',
    expires: 'never',
  } as MediaLibrary.PermissionResponse);

  const user = userEvent.setup();
  const onPhoto = jest.fn(async () => null);
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>
          <SourceSheet
            onCamera={jest.fn()}
            onCancel={jest.fn()}
            onPhoto={onPhoto}
            onScan={jest.fn()}
          />
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.getByLabelText('All photos')).toBeTruthy());
  await user.press(screen.getByLabelText('All photos'));

  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
  await waitFor(() => expect(onPhoto).toHaveBeenCalledWith('file:///tmp/picked.heic'));
});
