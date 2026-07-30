import { useImage } from '@shopify/react-native-skia';
import { useCallback, useState } from 'react';

/**
 * Reads real pixels out of an imported photo.
 *
 * Skia decodes the file once into an `SkImage` held in state, then `sampleAt`
 * averages a disc of pixels around a point — which is what G2's "SAMPLE RADIUS ·
 * 12 PX · AVERAGED" control actually means. Averaging happens in linear light for
 * the same reason the extractor does it: averaging gamma-encoded values shifts
 * the result muddy (BUILD KIT · 08).
 */
export function useImageSampler(uri: string | null) {
  const [failed, setFailed] = useState(false);
  // Skia owns the decode and the cache; passing null yields null rather than throwing.
  const image = useImage(uri ?? null, () => setFailed(true));

  /**
   * @param x,y      Point in *image* coordinates.
   * @param radius   Sample disc radius in image pixels.
   * @returns Uppercase hex, or null if the image is not decoded.
   */
  const sampleAt = useCallback(
    (x: number, y: number, radius: number): string | null => {
      if (!image) return null;
      const width = image.width();
      const height = image.height();

      // `readPixels` on a sub-rect avoids pulling the whole bitmap for one tap.
      const size = Math.max(1, Math.ceil(radius * 2));
      const left = Math.max(0, Math.min(width - 1, Math.round(x - radius)));
      const top = Math.max(0, Math.min(height - 1, Math.round(y - radius)));
      const rectWidth = Math.min(size, width - left);
      const rectHeight = Math.min(size, height - top);
      if (rectWidth <= 0 || rectHeight <= 0) return null;

      const pixels = image.readPixels(left, top, {
        width: rectWidth,
        height: rectHeight,
        colorType: 4, // RGBA_8888
        alphaType: 1, // Unpremul
      });
      if (!pixels) return null;

      const centreX = x - left;
      const centreY = y - top;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let py = 0; py < rectHeight; py++) {
        for (let px = 0; px < rectWidth; px++) {
          // Circular disc, not the bounding square — a square average drags in
          // corners the user did not point at.
          if ((px - centreX) ** 2 + (py - centreY) ** 2 > radius ** 2) continue;
          const offset = (py * rectWidth + px) * 4;
          r += toLinear(pixels[offset] ?? 0);
          g += toLinear(pixels[offset + 1] ?? 0);
          b += toLinear(pixels[offset + 2] ?? 0);
          count += 1;
        }
      }
      if (count === 0) return null;

      return `#${[r / count, g / count, b / count]
        .map((channel) => Math.round(toSrgb(channel)).toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()}`;
    },
    [image],
  );

  return {
    image,
    ready: image !== null,
    failed,
    sampleAt,
    dimensions: image ? { width: image.width(), height: image.height() } : null,
  };
}

const toLinear = (value: number) => {
  const n = value / 255;
  return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (value: number) => {
  const c = Math.min(1, Math.max(0, value));
  return (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255;
};
