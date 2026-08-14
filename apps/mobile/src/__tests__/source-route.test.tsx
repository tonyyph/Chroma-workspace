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

it('closes itself before opening the grade, and never replaces into its own sheet', async () => {
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('Frame 01')).toBeTruthy());
  await user.press(screen.getByLabelText('Frame 01'));

  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/tools/grade?id=palette-1'));

  /**
   * The order is the whole fix.
   *
   * A push issued while the sheet is still presented is presented *inside* it,
   * so closing has to come first. Jest cannot see the native dismissal this
   * waits on — `runAfterInteractions` fires at once when nothing is animating —
   * but it can see which call was made first, and that is the contract.
   */
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockRouter.back.mock.invocationCallOrder[0]).toBeLessThan(
    mockRouter.push.mock.invocationCallOrder[0]!,
  );
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
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/capture'));
  expect(mockRouter.back.mock.invocationCallOrder[0]).toBeLessThan(
    mockRouter.push.mock.invocationCallOrder[0]!,
  );
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
});

it('opens scan the same way, so no exit can regress on its own', async () => {
  const user = userEvent.setup();
  draw();

  await waitFor(() => expect(screen.getByLabelText('SCAN')).toBeTruthy());
  await user.press(screen.getByLabelText('SCAN'));

  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/tools/scan'));
  expect(mockRouter.back.mock.invocationCallOrder[0]).toBeLessThan(
    mockRouter.push.mock.invocationCallOrder[0]!,
  );
});
