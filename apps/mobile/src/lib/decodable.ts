import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * The formats the shipped Skia binary has a codec for.
 *
 * `nm libskia.a` on `@shopify/react-native-skia`'s iOS XCFramework lists
 * SkJpegCodec, SkPngCodec, SkWebpCodec, SkBmpCodec, SkIcoCodec, SkWbmpCodec and
 * SkWuffsCodec (GIF). There is no HEIF codec — and HEIC is precisely what an
 * iPhone stores its photos as, so `expo-image-picker` hands back `.heic` raw
 * data for most of a real user's library (see `ImageUtils.swift`, which returns
 * the untouched bytes for `UTType.heic` whatever `quality` is set to).
 */
const DECODABLE = /\.(jpe?g|png|webp|bmp|gif|ico|wbmp)(\?.*)?$/i;

/** Whether Skia can decode this file as it stands. */
export const isDecodable = (uri: string): boolean => DECODABLE.test(uri);

/**
 * Returns a URI Skia can decode, transcoding the photo to JPEG if it cannot.
 *
 * The manipulator decodes through the platform's own image stack — ImageIO on
 * iOS — which does read HEIC, so it can hand back a container Skia understands.
 * Anything already decodable is returned untouched rather than paying a
 * re-encode of a twelve-megapixel frame for nothing.
 *
 * A failed transcode returns the original URI: the caller already reports a read
 * it could not make, and that is a truer message than one about a conversion the
 * user never asked for.
 */
export async function toDecodableUri(uri: string): Promise<string> {
  if (isDecodable(uri)) return uri;

  try {
    const image = await ImageManipulator.manipulate(uri).renderAsync();
    // Quality 1: this is the input to a colour extraction, and JPEG artefacts
    // are exactly the kind of invented colour a palette must not contain.
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
    return saved.uri;
  } catch {
    return uri;
  }
}
