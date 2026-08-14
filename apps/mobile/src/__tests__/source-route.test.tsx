import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import SourceRoute from '@/app/source';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * Leaving the sheet.
 *
 * The source sheet is presented as a form sheet sized to its own contents, and
 * it used to `replace` itself with whatever it opened. Replacing hands the next
 * screen that same container: the grade rendered *inside* the sheet, clipped at
 * the height the detent had measured, with its nav bar under the status bar —
 * a sheet reports no top inset, because it believes something else already
 * covers that strip.
 *
 * Dismissing first is also what the flow means. A question should not be
 * sitting behind its own answer.
 */

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  dismiss: jest.fn(),
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
  mockRouter.canDismiss.mockReturnValue(true);
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

it('dismisses itself before opening the grade, rather than replacing into its own sheet', async () => {
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('Frame 01')).toBeTruthy());
  await user.press(screen.getByLabelText('Frame 01'));

  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/tools/grade?id=palette-1'));
  expect(mockRouter.dismiss).toHaveBeenCalledTimes(1);
  // The regression: `replace` is what put the grade inside the sheet.
  expect(mockRouter.replace).not.toHaveBeenCalled();
});

it('leaves for the camera the same way it leaves for the grade', async () => {
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('CAMERA')).toBeTruthy());
  await user.press(screen.getByLabelText('CAMERA'));

  // The viewfinder is a full screen too, and inherited the same clipped
  // container when the sheet replaced itself with it.
  expect(mockRouter.dismiss).toHaveBeenCalledTimes(1);
  expect(mockRouter.push).toHaveBeenCalledWith('/capture');
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
  expect(mockRouter.dismiss).not.toHaveBeenCalled();
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('still opens the target when there is no sheet to dismiss', async () => {
  // A deep link can land straight on this route with nothing beneath it.
  mockRouter.canDismiss.mockReturnValue(false);
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('SCAN')).toBeTruthy());
  await user.press(screen.getByLabelText('SCAN'));

  expect(mockRouter.dismiss).not.toHaveBeenCalled();
  expect(mockRouter.push).toHaveBeenCalledWith('/tools/scan');
});
