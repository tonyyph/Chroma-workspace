import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as MediaLibrary from 'expo-media-library';
import { useRecentPhotos } from './useRecentPhotos';

/**
 * Which strip the source sheet draws, and when it is allowed to ask.
 *
 * The states are asserted separately because each one gets a different strip,
 * and because the sheet must survive every one of them: the system picker
 * needs no permission at all, so a refusal may cost the convenience of the
 * strip and nothing else.
 *
 * The last test is the one that matters most. A permission dialog that appears
 * because a sheet opened is a dialog the user cannot connect to anything they
 * did, and they refuse it — permanently — on that basis.
 */

const answer = (over: Partial<MediaLibrary.PermissionResponse>) =>
  ({
    granted: false,
    canAskAgain: true,
    status: MediaLibrary.PermissionStatus.UNDETERMINED,
    accessPrivileges: 'none',
    expires: 'never',
    ...over,
  }) as MediaLibrary.PermissionResponse;

const asset = (id: string) =>
  ({ id, uri: `ph://${id}`, mediaType: 'photo' }) as unknown as MediaLibrary.Asset;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(MediaLibrary.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(answer({}));
  jest
    .mocked(MediaLibrary.getAssetsAsync)
    .mockResolvedValue({ assets: [asset('a'), asset('b')] } as MediaLibrary.PagedInfo<never>);
});

it('starts unasked, and asks nobody', async () => {
  const { result } = renderHook(() => useRecentPhotos());

  await waitFor(() => expect(result.current.state).toBe('unasked'));
  // Checking is not asking: `getPermissionsAsync` shows no dialog.
  expect(MediaLibrary.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(result.current.photos).toHaveLength(0);
});

it('asks only when told to, and loads the strip on a yes', async () => {
  jest.mocked(MediaLibrary.requestPermissionsAsync).mockResolvedValue(
    answer({
      granted: true,
      status: MediaLibrary.PermissionStatus.GRANTED,
      accessPrivileges: 'all',
    }),
  );

  const { result } = renderHook(() => useRecentPhotos(12));
  await waitFor(() => expect(result.current.state).toBe('unasked'));

  await act(async () => result.current.ask());

  await waitFor(() => expect(result.current.state).toBe('granted'));
  expect(result.current.photos).toEqual([
    { id: 'a', uri: 'ph://a' },
    { id: 'b', uri: 'ph://b' },
  ]);
  expect(MediaLibrary.getAssetsAsync).toHaveBeenCalledWith(
    expect.objectContaining({ first: 12, mediaType: ['photo'] }),
  );
});

it('reports limited access as its own state, not as granted', async () => {
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(
    answer({
      granted: true,
      status: MediaLibrary.PermissionStatus.GRANTED,
      accessPrivileges: 'limited',
    }),
  );

  const { result } = renderHook(() => useRecentPhotos());

  // Limited still loads a strip — of the shared assets — but it also needs the
  // "choose more" affordance that a full grant has no use for.
  await waitFor(() => expect(result.current.state).toBe('limited'));
  expect(result.current.photos).toHaveLength(2);
});

it('reloads the strip after the user picks more photos', async () => {
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(
    answer({
      granted: true,
      status: MediaLibrary.PermissionStatus.GRANTED,
      accessPrivileges: 'limited',
    }),
  );

  const { result } = renderHook(() => useRecentPhotos());
  await waitFor(() => expect(result.current.state).toBe('limited'));

  jest
    .mocked(MediaLibrary.getAssetsAsync)
    .mockResolvedValue({ assets: [asset('c')] } as MediaLibrary.PagedInfo<never>);
  await act(async () => result.current.chooseMore());

  expect(MediaLibrary.presentPermissionsPickerAsync).toHaveBeenCalled();
  // iOS does not tell us what changed, so the strip is refetched rather than
  // left showing the selection the user just edited.
  await waitFor(() => expect(result.current.photos).toEqual([{ id: 'c', uri: 'ph://c' }]));
});

it('goes to denied when the system will not ask again', async () => {
  jest
    .mocked(MediaLibrary.getPermissionsAsync)
    .mockResolvedValue(
      answer({ granted: false, canAskAgain: false, status: MediaLibrary.PermissionStatus.DENIED }),
    );

  const { result } = renderHook(() => useRecentPhotos());

  await waitFor(() => expect(result.current.state).toBe('denied'));
  expect(result.current.photos).toHaveLength(0);
});

it('goes to denied rather than stalling when the ask is refused', async () => {
  jest
    .mocked(MediaLibrary.requestPermissionsAsync)
    .mockResolvedValue(
      answer({ granted: false, canAskAgain: false, status: MediaLibrary.PermissionStatus.DENIED }),
    );

  const { result } = renderHook(() => useRecentPhotos());
  await waitFor(() => expect(result.current.state).toBe('unasked'));

  await act(async () => result.current.ask());

  await waitFor(() => expect(result.current.state).toBe('denied'));
});

it('reports an unavailable library rather than an empty one', async () => {
  jest.mocked(MediaLibrary.isAvailableAsync).mockResolvedValue(false);

  const { result } = renderHook(() => useRecentPhotos());

  // "No photo library on this device" and "no photos in it" are different
  // sentences, and only one of them is worth offering a grant for.
  await waitFor(() => expect(result.current.state).toBe('unavailable'));
  expect(MediaLibrary.getPermissionsAsync).not.toHaveBeenCalled();
});

it('survives a library that throws while listing', async () => {
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue(
    answer({
      granted: true,
      status: MediaLibrary.PermissionStatus.GRANTED,
      accessPrivileges: 'all',
    }),
  );
  jest.mocked(MediaLibrary.getAssetsAsync).mockRejectedValue(new Error('nope'));

  const { result } = renderHook(() => useRecentPhotos());

  // The grant is real, so the state stays truthful; the strip is simply empty.
  // The sheet's other rows do not depend on any of this.
  await waitFor(() => expect(result.current.state).toBe('granted'));
  expect(result.current.photos).toHaveLength(0);
});
