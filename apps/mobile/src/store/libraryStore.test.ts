/* eslint-disable import/first -- the repository mock has to be registered
   before the store module is imported, or the store captures the real one. */
const mockListPalettes = jest.fn();
const mockListSets = jest.fn();
const mockSavePalette = jest.fn();
const mockRemovePalette = jest.fn();
const mockSaveSet = jest.fn();

jest.mock('@/infrastructure/dependencies', () => ({
  paletteRepository: {
    list: () => mockListPalettes(),
    save: (palette: unknown) => mockSavePalette(palette),
    remove: (id: string) => mockRemovePalette(id),
  },
  setRepository: {
    list: () => mockListSets(),
    save: (paletteSet: unknown) => mockSaveSet(paletteSet),
  },
}));

import { makeColor, type Palette, type PaletteSet } from '@chromawave/domain';
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

/**
 * The merged system is stored, not derived at render time — so the store is the
 * only thing standing between a set and a band drawn from palettes it no longer
 * holds. These cover the three events that can invalidate it.
 */
describe('libraryStore merged systems', () => {
  const palette = (id: string, hex: string): Palette => ({
    schemaVersion: 1,
    id,
    name: `Palette ${id}`,
    createdAt: '2026-08-01T00:00:00.000Z',
    capturedAt: '2026-08-01T00:00:00.000Z',
    source: 'photo',
    colors: [makeColor(hex, 0.6, 'dominant'), makeColor('#EDEAE3', 0.4, 'support')],
    tags: [],
    location: null,
    photoUri: null,
    deltaE: 2,
    confidence: 0.9,
    space: 'srgb',
    tuned: false,
    setIds: [],
    isPinned: false,
  });

  const first = palette('11111111-1111-4111-8111-111111111111', '#7C5CFF');
  const second = palette('22222222-2222-4222-8222-222222222222', '#FF7A5C');

  const project: PaletteSet = {
    schemaVersion: 1,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Kitchen',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    paletteIds: [first.id, second.id],
    members: ['you'],
    merged: null,
  };

  const savedSet = (): PaletteSet => mockSaveSet.mock.calls.at(-1)?.[0] as PaletteSet;

  beforeEach(() => {
    mockListPalettes.mockReset().mockResolvedValue([first, second]);
    mockListSets.mockReset().mockResolvedValue([project]);
    mockSavePalette.mockReset().mockResolvedValue(undefined);
    mockRemovePalette.mockReset().mockResolvedValue(undefined);
    mockSaveSet.mockReset().mockResolvedValue(undefined);
    useLibraryStore.setState({ palettes: [first, second], sets: [project] });
  });

  it('computes the merged system when a set is saved', async () => {
    await useLibraryStore.getState().saveSet(project);

    const merged = savedSet().merged ?? [];
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.map((color) => color.hex)).toContain('#7C5CFF');
    const total = merged.reduce((sum, color) => sum + color.weight, 0);
    expect(Math.abs(total - 1)).toBeLessThanOrEqual(0.02);
  });

  it('stores null rather than an empty system for a set holding nothing', async () => {
    await useLibraryStore.getState().saveSet({ ...project, paletteIds: [] });
    expect(savedSet().merged).toBeNull();
  });

  it('drops a deleted palette from every set that held it', async () => {
    mockListPalettes.mockResolvedValue([second]);

    await useLibraryStore.getState().removePalette(first.id);

    expect(savedSet().paletteIds).toEqual([second.id]);
    // The band must no longer carry the deleted palette's colour.
    expect((savedSet().merged ?? []).map((color) => color.hex)).not.toContain('#7C5CFF');
  });

  it('rewrites the system when a member is retuned', async () => {
    const retuned = {
      ...first,
      colors: [makeColor('#22D3EE', 0.6, 'dominant'), makeColor('#EDEAE3', 0.4, 'support')],
    };
    mockListPalettes.mockResolvedValue([retuned, second]);

    await useLibraryStore.getState().savePalette(retuned);

    expect((savedSet().merged ?? []).map((color) => color.hex)).toContain('#22D3EE');
  });

  it('leaves sets alone when the saved palette belongs to none of them', async () => {
    useLibraryStore.setState({ sets: [{ ...project, paletteIds: [] }] });

    await useLibraryStore.getState().savePalette(first);

    expect(mockSaveSet).not.toHaveBeenCalled();
  });
});
