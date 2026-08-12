import { extractPaletteFromRgba, type ExtractionResult } from '@cw/domain';
import { FilterMode, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';

/**
 * Side of the square the photo is reduced to before clustering.
 *
 * 128² = 16 384 samples, which is 64KB of RGBA. Small enough that the k-means
 * pass is instant, large enough that a signal colour occupying a few percent of
 * the frame still survives as its own cluster rather than being averaged into
 * its surroundings.
 */
const GRID = 128;

export type ReadFailure = 'decode' | 'pixels' | 'unsupported';
export type ReadOutcome =
  { ok: true; result: ExtractionResult } | { ok: false; reason: ReadFailure };

/**
 * Reads a palette from a photo on disk.
 *
 * **Why it downscales rather than samples.** The previous version walked a 48×48
 * grid of individual pixels out of the full-resolution frame — 2 304 of roughly
 * twelve million, about 0.02% of the image. Whether a colour was found at all
 * came down to whether one of those points happened to land on it, so two reads
 * of the same scene disagreed and a small strong accent was usually missed
 * entirely.
 *
 * Drawing the image into a 128×128 surface with mipmap filtering makes the GPU
 * box-filter *every* pixel down into those cells, so each sample is the mean of
 * the region it covers and nothing is unrepresented. It is also faster: the full
 * `readPixels` this replaced pulled a ~48MB buffer into JS first.
 */
/**
 * The decode step, kept separate so the async boundary is explicit: everything
 * after it is synchronous CPU work.
 */
export async function decodeImage(uri: string) {
  const data = await Skia.Data.fromURI(uri);
  return Skia.Image.MakeImageFromEncoded(data);
}

/** Downscale + extract. Synchronous once the image is decoded. */
export function extractFromImage(
  image: NonNullable<Awaited<ReturnType<typeof decodeImage>>>,
  colorCount = 5,
): ReadOutcome {
  const surface = Skia.Surface.MakeOffscreen(GRID, GRID);
  if (!surface) return { ok: false, reason: 'unsupported' };

  const width = image.width();
  const height = image.height();

  // Cover rather than stretch: a 16:9 frame squashed into a square would
  // over-weight whatever runs along its short axis.
  const scale = Math.max(GRID / width, GRID / height);
  const matrix = Skia.Matrix();
  matrix.translate((GRID - width * scale) / 2, (GRID - height * scale) / 2);
  matrix.scale(scale, scale);

  const paint = Skia.Paint();
  paint.setShader(
    image.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      // Mipmaps are what make this an average of every pixel rather than a
      // bilinear read of four of them.
      MipmapMode.Linear,
      matrix,
    ),
  );

  const canvas = surface.getCanvas();
  canvas.drawRect(Skia.XYWHRect(0, 0, GRID, GRID), paint);
  surface.flush();

  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width: GRID,
    height: GRID,
    colorType: 4, // RGBA_8888
    alphaType: 1, // Unpremul
  });
  if (!pixels) return { ok: false, reason: 'pixels' };

  const rgba = pixels instanceof Uint8Array ? pixels : new Uint8Array(pixels.buffer);
  return { ok: true, result: extractPaletteFromRgba(rgba, GRID, GRID, colorCount) };
}

/** Decode then extract. The one entry point screens use. */
export async function readPalette(uri: string, colorCount = 5): Promise<ReadOutcome> {
  let image: Awaited<ReturnType<typeof decodeImage>>;
  try {
    image = await decodeImage(uri);
  } catch {
    return { ok: false, reason: 'decode' };
  }
  if (!image) return { ok: false, reason: 'decode' };

  try {
    return extractFromImage(image, colorCount);
  } finally {
    // The decoded frame can be tens of megabytes; holding it until GC notices
    // is what turns a few captures in a row into a memory warning.
    image.dispose();
  }
}
