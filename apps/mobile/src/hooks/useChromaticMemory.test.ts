import {
  paletteToMemory,
  makeColor,
  unpairedPairing,
  type ChromaticMemory,
  type MusicFeedback,
  type MusicPairing,
  type MusicTrackReference,
  type Palette,
} from '@cw/domain';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useChromaticMemory } from './useChromaticMemory';

const mockGet = jest.fn();
const mockSave = jest.fn();
const mockRefresh = jest.fn(async () => undefined);

jest.mock('@/infrastructure/dependencies', () => ({
  memoryRepository: {
    get: (id: string) => mockGet(id),
    save: (memory: unknown) => mockSave(memory),
  },
}));

jest.mock('@/store/libraryStore', () => ({
  useLibraryStore: (selector: (store: { refresh: () => Promise<void> }) => unknown) =>
    selector({ refresh: mockRefresh }),
}));

const ID = 'a0000000-0000-4000-8000-000000000001';

const palette: Palette = {
  grade: null,
  schemaVersion: 1,
  id: ID,
  name: 'Harbour dusk',
  createdAt: '2026-08-01T00:00:00.000Z',
  capturedAt: '2026-08-01T00:00:00.000Z',
  source: 'photo',
  colors: [makeColor('#0B1230', 0.6, 'dominant'), makeColor('#C9A227', 0.4, 'support')],
  tags: [],
  location: null,
  photoUri: 'file:///photos/a.jpg',
  deltaE: 2.4,
  confidence: 0.9,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
};

const track: MusicTrackReference = {
  provider: 'itunes',
  providerTrackId: '77',
  title: 'Tour de France, Étape 3',
  artist: 'Kraftwerk',
  album: 'Tour de France',
  artworkUrl: 'https://example.test/art.jpg',
  durationMs: 250_000,
  isrc: null,
  genres: ['Electronic'],
  releaseYear: 2003,
  externalUrl: 'https://music.apple.com/track/77',
  attribution: 'Preview via Apple Music',
};

const feedback = (id: string, signal: MusicFeedback['signal']): MusicFeedback => ({
  providerTrackId: id,
  signal,
  at: '2026-08-11T12:00:00.000Z',
  genres: ['Electronic'],
});

const sessionPairing = (overrides: Partial<MusicPairing> = {}): MusicPairing => ({
  ...unpairedPairing,
  status: 'suggested',
  recommendationVersion: '1.1.itunes',
  feedback: [feedback('99', 'rejected')],
  ...overrides,
});

beforeEach(() => {
  mockGet.mockReset();
  mockSave.mockReset();
  mockRefresh.mockClear();
  mockGet.mockResolvedValue(paletteToMemory(palette));
  mockSave.mockResolvedValue(undefined);
});

describe('useChromaticMemory', () => {
  it('loads the memory behind an id', async () => {
    const { result } = renderHook(() => useChromaticMemory(ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.memory?.id).toBe(ID);
  });

  it('is idle for no id', async () => {
    const { result } = renderHook(() => useChromaticMemory(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.memory).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('writes the track, the status and the facets together', async () => {
    const { result } = renderHook(() => useChromaticMemory(ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.pairTrack(track, sessionPairing());
    });

    const saved = mockSave.mock.calls[0]![0] as ChromaticMemory;
    expect(saved.musicPairing.status).toBe('paired');
    expect(saved.musicPairing.selectedTrack).toEqual(track);
    // The facet is what the archive filters on; forgetting it is the silent bug.
    expect(saved.facets.paired).toBe(true);
    expect(saved.facets.genres).toEqual(['Electronic']);
  });

  it('carries the session version and feedback onto the record', async () => {
    const { result } = renderHook(() => useChromaticMemory(ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.pairTrack(track, sessionPairing());
    });

    const saved = mockSave.mock.calls[0]![0] as ChromaticMemory;
    expect(saved.musicPairing.recommendationVersion).toBe('1.1.itunes');
    // The rejection that led to this choice is kept — it is what biases the
    // next run on this device.
    expect(saved.musicPairing.feedback.map((entry) => entry.providerTrackId)).toContain('99');
  });

  it('caps stored feedback at the schema limit, keeping the newest', async () => {
    const { result } = renderHook(() => useChromaticMemory(ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const many = Array.from({ length: 60 }, (_, index) => feedback(`t${index}`, 'rejected'));
    await act(async () => {
      await result.current.pairTrack(track, sessionPairing({ feedback: many }));
    });

    const saved = mockSave.mock.calls[0]![0] as ChromaticMemory;
    expect(saved.musicPairing.feedback).toHaveLength(50);
    expect(saved.musicPairing.feedback[49]!.providerTrackId).toBe('t59');
  });

  it('refreshes the shared library so the archive is not stale', async () => {
    const { result } = renderHook(() => useChromaticMemory(ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.pairTrack(track, sessionPairing());
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('reports a failed write rather than pretending it landed', async () => {
    mockSave.mockRejectedValueOnce(new Error('disk full'));
    const { result } = renderHook(() => useChromaticMemory(ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome = true;
    await act(async () => {
      outcome = await result.current.pairTrack(track, sessionPairing());
    });

    expect(outcome).toBe(false);
    expect(result.current.error).toBe(true);
    // The screen must not navigate away on a write that did not happen.
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it('does nothing when there is no memory to pair', async () => {
    mockGet.mockResolvedValue(null);
    const { result } = renderHook(() => useChromaticMemory(ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome = true;
    await act(async () => {
      outcome = await result.current.pairTrack(track, sessionPairing());
    });

    expect(outcome).toBe(false);
    expect(mockSave).not.toHaveBeenCalled();
  });
});
