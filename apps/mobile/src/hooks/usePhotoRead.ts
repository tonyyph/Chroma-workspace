import { extractPaletteFromRgba, type Color } from '@chromawave/domain';
import { Skia } from '@shopify/react-native-skia';
import { useCallback, useState } from 'react';

/** Grid the photo is reduced to before clustering. 48×48 = 2304 samples. */
const GRID = 48;

/**
 * Reads a palette out of a captured photo.
 *
 * **Why not a live frame processor.** Vision Camera's frame processors need
 * `react-native-vision-camera-worklets`, which fails to compile against React
 * Native 0.83's prebuilt React pods — it includes `React/RCTMessageThread.h`, a
 * private header those pods do not expose. So the read happens on the frame the
 * shutter captures rather than continuously.
 *
 * The user-visible difference is that the LIVE READ strip fills in after the
 * shutter instead of tracking the lens. Everything downstream is unchanged: the
 * same extractor, the same ΔE00, the same roles.
 *
 * Sampling is a 48×48 grid rather than the full image, which is what keeps a 12MP
 * frame well inside the extraction budget.
 */
export function usePhotoRead() {
  const [colors, setColors] = useState<readonly Color[]>([]);
  const [deltaE, setDeltaE] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [reading, setReading] = useState(false);

  const read = useCallback(async (uri: string, colorCount = 5) => {
    setReading(true);
    try {
      const data = await Skia.Data.fromURI(uri);
      const image = Skia.Image.MakeImageFromEncoded(data);
      if (!image) return null;

      const width = image.width();
      const height = image.height();
      const pixels = image.readPixels(0, 0, {
        width,
        height,
        colorType: 4, // RGBA_8888
        alphaType: 1, // Unpremul
      });
      if (!pixels) return null;

      // Subsample into a small RGBA buffer; the extractor caps its own sample
      // anyway, but reading 12M pixels into JS first would not be free.
      const grid = new Uint8Array(GRID * GRID * 4);
      for (let gy = 0; gy < GRID; gy++) {
        const y = Math.min(height - 1, Math.floor(((gy + 0.5) / GRID) * height));
        for (let gx = 0; gx < GRID; gx++) {
          const x = Math.min(width - 1, Math.floor(((gx + 0.5) / GRID) * width));
          const from = (y * width + x) * 4;
          const to = (gy * GRID + gx) * 4;
          grid[to] = pixels[from] ?? 0;
          grid[to + 1] = pixels[from + 1] ?? 0;
          grid[to + 2] = pixels[from + 2] ?? 0;
          grid[to + 3] = 255;
        }
      }

      const result = extractPaletteFromRgba(grid, GRID, GRID, colorCount);
      setColors(result.colors);
      setDeltaE(result.deltaE);
      setConfidence(result.confidence);
      return result;
    } catch {
      // A frame that cannot be decoded leaves the previous read in place rather
      // than blanking the strip.
      return null;
    } finally {
      setReading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setColors([]);
    setDeltaE(0);
    setConfidence(0);
  }, []);

  return { read, reset, colors, deltaE, confidence, reading };
}
