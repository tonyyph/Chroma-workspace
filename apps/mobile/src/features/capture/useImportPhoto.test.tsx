import { renderHook } from '@testing-library/react-native';
import { toDecodableUri } from '@/lib/decodable';
import { readPalette } from '@/lib/readPalette';
import { useCaptureStore } from '@/store';
import { useImportPhoto } from './useImportPhoto';

/**
 * The one path a chosen photograph takes.
 *
 * Two callers reach it — a tap on the recents strip and a pick from the system
 * sheet — and they must not be able to drift into two behaviours for one job.
 * The failures are asserted separately because each of them wants a different
 * sentence on screen: a photo that will not decode is not a photo with too
 * little colour in it, and neither is a record that would not write.
 */

jest.mock('@/lib/decodable', () => ({
  isDecodable: () => false,
  toDecodableUri: jest.fn(async () => 'file:///tmp/picked.jpg'),
}));

jest.mock('@/lib/readPalette', () => ({
  decodeImage: jest.fn(async () => null),
  readPalette: jest.fn(),
}));

// `mock`-prefixed so Jest's hoisted factory is allowed to close over it.
const mockCommit = jest.fn();
jest.mock('./useCaptureCommit', () => ({
  useCaptureCommit: () => mockCommit,
}));

const twoColours = {
  ok: true as const,
  result: {
    colors: [
      { hex: '#7C5CFF', weight: 0.6, role: 'dominant' },
      { hex: '#22D3EE', weight: 0.4, role: 'support' },
    ],
    deltaE: 2.4,
    confidence: 0.94,
  },
};

const importer = () => renderHook(() => useImportPhoto()).result.current;

beforeEach(() => {
  jest.clearAllMocks();
  useCaptureStore.getState().discard();
  mockCommit.mockResolvedValue({ id: 'palette-1' });
});

it('transcodes the photo before reading it', async () => {
  jest.mocked(readPalette).mockResolvedValue(twoColours);

  await importer()('file:///tmp/picked.heic');

  // An iPhone library is mostly HEIC and the shipped Skia has no HEIF codec, so
  // reading the picked uri directly fails for most of a real user's photos.
  expect(toDecodableUri).toHaveBeenCalledWith('file:///tmp/picked.heic');
  expect(readPalette).toHaveBeenCalledWith('file:///tmp/picked.jpg', 5);
});

it('returns the written palette', async () => {
  jest.mocked(readPalette).mockResolvedValue(twoColours);

  const outcome = await importer()('file:///tmp/picked.heic');

  expect(outcome).toEqual({ ok: true, palette: { id: 'palette-1' } });
});

it('reports a photo it could not decode, and writes nothing', async () => {
  jest.mocked(readPalette).mockResolvedValue({ ok: false, reason: 'decode' });

  const outcome = await importer()('file:///tmp/picked.heic');

  expect(outcome).toEqual({ ok: false, reason: 'decode' });
  expect(mockCommit).not.toHaveBeenCalled();
});

it('separates a photo with too little colour from one that would not open', async () => {
  // A palette needs two colours; `toPalette` returns null below that, which the
  // old route swallowed with a bare `return` — a tap that did nothing at all.
  jest.mocked(readPalette).mockResolvedValue({
    ok: true,
    result: { ...twoColours.result, colors: twoColours.result.colors.slice(0, 1) },
  });

  const outcome = await importer()('file:///tmp/picked.heic');

  expect(outcome).toEqual({ ok: false, reason: 'tooFewColours' });
  expect(mockCommit).not.toHaveBeenCalled();
});

it('reports a record that would not write', async () => {
  jest.mocked(readPalette).mockResolvedValue(twoColours);
  mockCommit.mockResolvedValue(null);

  const outcome = await importer()('file:///tmp/picked.heic');

  expect(outcome).toEqual({ ok: false, reason: 'write' });
});

it('leaves no pending capture behind when the write fails', async () => {
  jest.mocked(readPalette).mockResolvedValue(twoColours);
  mockCommit.mockResolvedValue(null);

  await importer()('file:///tmp/picked.heic');

  /**
   * The failure that actually strands state.
   *
   * A read that fails never reaches `begin`, so nothing is left over. A write
   * that fails has already begun a capture and `commit` only discards on
   * success — leave it and the next screen to read the store shows a
   * photograph nobody chose.
   */
  expect(useCaptureStore.getState().pending).toBeNull();
});
