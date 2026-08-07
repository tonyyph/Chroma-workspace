/* eslint-disable import/first -- the repository mock has to be registered
   before the store module is imported, or the store captures the real one. */
const mockListPalettes = jest.fn();
const mockListSets = jest.fn();

jest.mock('@/infrastructure/dependencies', () => ({
  paletteRepository: { list: () => mockListPalettes() },
  setRepository: { list: () => mockListSets() },
}));

import { useLibraryStore } from './libraryStore';

/**
 * `refreshing` drives a *controlled* native control. `RefreshControl` only tells
 * iOS to stop spinning when it re-renders and finds its prop disagreeing with
 * the last value it pushed — so a refresh that never observably sets the flag
 * true leaves the spinner the user's gesture started with nothing to end it.
 */
describe('libraryStore.refresh', () => {
  beforeEach(() => {
    mockListPalettes.mockReset().mockResolvedValue([]);
    mockListSets.mockReset().mockResolvedValue([]);
    useLibraryStore.setState({ palettes: [], sets: [], loading: true, refreshing: false });
  });

  it('holds refreshing true for the whole read', async () => {
    let release: (() => void) | undefined;
    mockListPalettes.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const pending = useLibraryStore.getState().refresh();
    // Observable *while the read is outstanding* — this is the assertion that
    // fails when the flag is flipped on and off inside one batch.
    expect(useLibraryStore.getState().refreshing).toBe(true);

    release?.();
    await pending;
    expect(useLibraryStore.getState().refreshing).toBe(false);
  });

  it('clears refreshing when the read fails', async () => {
    mockListPalettes.mockRejectedValue(new Error('storage unavailable'));

    await useLibraryStore.getState().refresh();

    expect(useLibraryStore.getState().refreshing).toBe(false);
    expect(useLibraryStore.getState().error).toBe(true);
  });

  it('ignores a second pull while one is already running', async () => {
    let release: (() => void) | undefined;
    mockListPalettes.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = useLibraryStore.getState().refresh();
    await useLibraryStore.getState().refresh();
    release?.();
    await first;

    // A second pull must not start a read that resolves later and clears the
    // flag out from under the first.
    expect(mockListPalettes).toHaveBeenCalledTimes(1);
    expect(useLibraryStore.getState().refreshing).toBe(false);
  });
});

/**
 * `usePalettes` loads on mount, and every screen uses it — so `load` runs on
 * every push. It has to answer from memory after the first read, including for
 * the user whose library is empty, which is every user on their first launch.
 * Guarding on "is there anything in `palettes`" made that case re-read storage
 * on the frame each transition started.
 */
describe('libraryStore.load', () => {
  beforeEach(() => {
    mockListPalettes.mockReset().mockResolvedValue([]);
    mockListSets.mockReset().mockResolvedValue([]);
    useLibraryStore.setState({
      palettes: [],
      sets: [],
      loading: true,
      loaded: false,
      reading: false,
      refreshing: false,
      error: false,
    });
  });

  it('reads storage once when the library is empty', async () => {
    await useLibraryStore.getState().load();
    await useLibraryStore.getState().load();
    await useLibraryStore.getState().load();

    expect(mockListPalettes).toHaveBeenCalledTimes(1);
    expect(useLibraryStore.getState().loaded).toBe(true);
    expect(useLibraryStore.getState().loading).toBe(false);
  });

  it('does not start a second read while the first is in flight', async () => {
    let release: (() => void) | undefined;
    mockListPalettes.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve([]);
      }),
    );

    const first = useLibraryStore.getState().load();
    const second = useLibraryStore.getState().load();
    release?.();
    await Promise.all([first, second]);

    expect(mockListPalettes).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed read rather than staying empty forever', async () => {
    mockListPalettes.mockRejectedValueOnce(new Error('storage unavailable'));
    await useLibraryStore.getState().load();
    expect(useLibraryStore.getState().error).toBe(true);

    mockListPalettes.mockResolvedValue([]);
    await useLibraryStore.getState().load();

    expect(mockListPalettes).toHaveBeenCalledTimes(2);
    expect(useLibraryStore.getState().error).toBe(false);
  });
});
