/**
 * The rule that keeps an imported photo readable.
 *
 * Skia's iOS build has no HEIF codec, and an iPhone's library is mostly HEIC, so
 * a picked photo handed straight to `readPalette` decoded to nothing and the
 * screen reported a read it could not make. Everything below guards that.
 */
import { isDecodable, toDecodableUri } from './decodable';

const mockSaveAsync = jest.fn(async (_options: unknown): Promise<{ uri: string }> => ({
  uri: 'file:///cache/converted.jpg',
}));
const mockRenderAsync = jest.fn(async () => ({ saveAsync: mockSaveAsync }));
const mockManipulate = jest.fn((_uri: string) => ({ renderAsync: mockRenderAsync }));

jest.mock('expo-image-manipulator', () => ({
  ImageManipulator: { manipulate: (uri: string) => mockManipulate(uri) },
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

beforeEach(() => {
  mockManipulate.mockClear();
  mockRenderAsync.mockClear();
  mockSaveAsync.mockReset();
  mockSaveAsync.mockResolvedValue({ uri: 'file:///cache/converted.jpg' });
});

describe('isDecodable', () => {
  it.each(['file:///a/photo.jpg', 'file:///a/photo.JPEG', 'file:///a/b.png', 'file:///a/c.webp'])(
    'accepts %s',
    (uri) => {
      expect(isDecodable(uri)).toBe(true);
    },
  );

  it.each(['file:///a/photo.heic', 'file:///a/photo.HEIC', 'file:///a/raw.tiff', 'file:///a/x'])(
    'rejects %s',
    (uri) => {
      expect(isDecodable(uri)).toBe(false);
    },
  );
});

describe('toDecodableUri', () => {
  it('returns a decodable photo untouched, without a re-encode', async () => {
    await expect(toDecodableUri('file:///a/photo.jpg')).resolves.toBe('file:///a/photo.jpg');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('transcodes a HEIC photo to JPEG', async () => {
    await expect(toDecodableUri('file:///a/photo.heic')).resolves.toBe(
      'file:///cache/converted.jpg',
    );
    expect(mockManipulate).toHaveBeenCalledWith('file:///a/photo.heic');
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 1 });
  });

  it('falls back to the original when the transcode fails', async () => {
    mockSaveAsync.mockRejectedValueOnce(new Error('no encoder'));
    await expect(toDecodableUri('file:///a/photo.heic')).resolves.toBe('file:///a/photo.heic');
  });
});
