import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import SourceRoute from '@/app/source';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * Leaving the sheet.
 *
 * The source sheet used to be a native form sheet sized to its own contents.
 * Opening the grade from there handed the next screen that same fit-to-contents
 * container: the grade rendered *inside* the sheet, clipped at the sheet's
 * height, with its nav bar under the status bar.
 *
 * The route is now a full-screen transparent modal that draws its own bottom
 * sheet, and it exits with one dismiss-to-destination stack operation.
 */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
  dismissTo: jest.fn(),
  canDismiss: jest.fn(() => true),
  navigate: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
  Redirect: () => null,
}));

const mockImport = jest.fn();
jest.mock('@/features/capture/useImportPhoto', () => ({
  useImportPhoto: () => mockImport,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockImport.mockResolvedValue({ ok: true, palette: { id: 'palette-1' } });
  jest.mocked(MediaLibrary.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue({
    granted: true,
    canAskAgain: true,
    status: MediaLibrary.PermissionStatus.GRANTED,
    accessPrivileges: 'all',
    expires: 'never',
  } as MediaLibrary.PermissionResponse);
  jest
    .mocked(MediaLibrary.getAssetsAsync)
    .mockResolvedValue({ assets: [{ id: 'a', uri: 'ph://a' }] } as MediaLibrary.PagedInfo<never>);
});

const draw = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>
          <SourceRoute />
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );

it('dismisses itself to the grade, and never opens the grade inside its own sheet', async () => {
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('Frame 01')).toBeTruthy());
  await user.press(screen.getByLabelText('Frame 01'));

  await waitFor(() =>
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/tools/grade?id=palette-1'),
  );

  /**
   * The operation is the whole fix.
   *
   * A push issued from a modal can be presented *inside* it. `dismissTo` asks
   * the stack to leave the source route and land on the destination in one
   * operation, so no destination inherits the source presentation.
   */
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  // The original regression: `replace` is what put the grade inside the sheet.
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('leaves for the camera the same way it leaves for the grade', async () => {
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('CAMERA')).toBeTruthy());
  await user.press(screen.getByLabelText('CAMERA'));

  // The viewfinder is a full screen too, and inherited the same container when
  // the sheet opened it without closing first.
  await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/capture'));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('stays put and says so when the photograph does not become anything', async () => {
  mockImport.mockResolvedValue({ ok: false, reason: 'tooFewColours' });
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('Frame 01')).toBeTruthy());
  await user.press(screen.getByLabelText('Frame 01'));

  // Nothing was opened, so nothing should have been dismissed either — the
  // failure has to land on the sheet that is still up to report it.
  await waitFor(() => expect(screen.getByText('Too little colour to work with')).toBeTruthy());
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
});

it('opens scan the same way, so no exit can regress on its own', async () => {
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('SCAN')).toBeTruthy());
  await user.press(screen.getByLabelText('SCAN'));

  await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith('/tools/scan'));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
});
