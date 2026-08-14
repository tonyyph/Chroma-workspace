import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { SourceSheet } from '@/features/capture/SourceSheet';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * The door.
 *
 * Four permission states, four strips — and the same three rows underneath all
 * of them. The last of these is the one that matters: the system picker runs
 * out of process and needs no grant, so refusing the photo library must cost
 * the convenience of the strip and nothing more.
 */

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/picked.heic' }],
  })),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const permission = (
  over: Partial<MediaLibrary.PermissionResponse>,
): MediaLibrary.PermissionResponse =>
  ({
    granted: false,
    canAskAgain: true,
    status: MediaLibrary.PermissionStatus.UNDETERMINED,
    accessPrivileges: 'none',
    expires: 'never',
    ...over,
  }) as MediaLibrary.PermissionResponse;

const draw = (over: Partial<Parameters<typeof SourceSheet>[0]> = {}) => {
  const props = {
    onCamera: jest.fn(),
    onCancel: jest.fn(),
    onPhoto: jest.fn(async () => null),
    onScan: jest.fn(),
    ...over,
  };
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>
          <SourceSheet {...props} />
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );
  return props;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(MediaLibrary.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(permission({}));
  jest.mocked(MediaLibrary.getAssetsAsync).mockResolvedValue({
    assets: [{ id: 'a', uri: 'ph://a' }],
  } as MediaLibrary.PagedInfo<never>);
});

const granted = () =>
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(
    permission({
      granted: true,
      status: MediaLibrary.PermissionStatus.GRANTED,
      accessPrivileges: 'all',
    }),
  );

it('offers the grant as a readout rather than raising it on open', async () => {
  draw();

  await waitFor(() => expect(screen.getByLabelText('Show recent')).toBeTruthy());
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
});

it('sends a tapped photo to the importer', async () => {
  granted();
  const user = userEvent.setup();
  const props = draw();

  await waitFor(() => expect(screen.getByLabelText('Frame 01')).toBeTruthy());
  await user.press(screen.getByLabelText('Frame 01'));

  expect(props.onPhoto).toHaveBeenCalledWith('ph://a');
});

it('offers a way to share more photos only under limited access', async () => {
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(
    permission({
      granted: true,
      status: MediaLibrary.PermissionStatus.GRANTED,
      accessPrivileges: 'limited',
    }),
  );
  draw();

  await waitFor(() => expect(screen.getByLabelText('Choose more')).toBeTruthy());
});

it('hides the choose-more affordance when access is already complete', async () => {
  granted();
  draw();

  await waitFor(() => expect(screen.getByLabelText('Frame 01')).toBeTruthy());
  expect(screen.queryByLabelText('Choose more')).toBeNull();
});

it('keeps every row working when the photo library is refused outright', async () => {
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(
    permission({
      granted: false,
      canAskAgain: false,
      status: MediaLibrary.PermissionStatus.DENIED,
    }),
  );
  const user = userEvent.setup();
  const props = draw();

  // The strip is gone — there is nothing to draw and nothing left to ask for.
  await waitFor(() => expect(screen.queryByLabelText('Show recent')).toBeNull());
  expect(screen.queryByLabelText('Frame 01')).toBeNull();

  // And the way in survives it, because the system picker never needed a grant.
  await user.press(screen.getByLabelText('LIBRARY'));
  await waitFor(() => expect(props.onPhoto).toHaveBeenCalledWith('file:///tmp/picked.heic'));
});

it('says which failure happened rather than pooling them', async () => {
  granted();
  const user = userEvent.setup();
  draw({ onPhoto: jest.fn(async () => 'tooFewColours' as const) });

  await waitFor(() => expect(screen.getByLabelText('Frame 01')).toBeTruthy());
  await user.press(screen.getByLabelText('Frame 01'));

  // Not "could not open that photo" — the file opened perfectly well.
  await waitFor(() => expect(screen.getByText('Too little colour to work with')).toBeTruthy());
});

it('says nothing about a picker the user simply dismissed', async () => {
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  const user = userEvent.setup();
  const props = draw();

  await waitFor(() => expect(screen.getByLabelText('LIBRARY')).toBeTruthy());
  await user.press(screen.getByLabelText('LIBRARY'));

  // Cancelling is not a failure, and a screen that reports it as one teaches
  // people that backing out of anything breaks something.
  expect(props.onPhoto).not.toHaveBeenCalled();
  expect(screen.queryByText('Could not open that photo')).toBeNull();
});

it('routes the camera and scan rows where they claim to go', async () => {
  const user = userEvent.setup();
  const props = draw();

  await waitFor(() => expect(screen.getByLabelText('CAMERA')).toBeTruthy());
  await user.press(screen.getByLabelText('CAMERA'));
  await user.press(screen.getByLabelText('SCAN'));

  expect(props.onCamera).toHaveBeenCalledTimes(1);
  expect(props.onScan).toHaveBeenCalledTimes(1);
});

it('wears the newest photograph on the channel that would open it', async () => {
  granted();
  draw();

  // The signature is the argument for the tile: a channel showing the picture
  // it would hand you says what taking that route gets you, which an icon in a
  // box does not.
  await waitFor(() => expect(screen.getByTestId('channel-face')).toBeTruthy());
  // expo-image normalises `source` into an array of sources.
  expect(screen.getByTestId('channel-face').props.source).toEqual([{ uri: 'ph://a' }]);
});

it('says what the strip is doing in every state rather than collapsing', async () => {
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(
    permission({
      granted: false,
      canAskAgain: false,
      status: MediaLibrary.PermissionStatus.DENIED,
    }),
  );
  draw();

  // A strip that vanishes on refusal shortens the sheet, which moves the
  // channels under a thumb already on its way to one of them.
  await waitFor(() => expect(screen.getByText(/channel 01 still opens the picker/)).toBeTruthy());
});
