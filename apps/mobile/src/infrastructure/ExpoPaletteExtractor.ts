import { extractPaletteFromRgba, type Palette, type PaletteExtractor } from '@chromawave/domain';
import { toByteArray } from 'base64-js';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';

export class ExpoPaletteExtractor implements PaletteExtractor {
  async extract(sourceUri: string): Promise<Palette> {
    const context = ImageManipulator.manipulate(sourceUri);
    context.resize({ width: 64 });

    try {
      const image = await context.renderAsync();
      try {
        const normalized = await image.saveAsync({
          base64: true,
          compress: 0.76,
          format: SaveFormat.JPEG,
        });
        if (!normalized.base64) {
          throw new Error('Image normalization returned no pixel payload.');
        }

        const decoded = decode(toByteArray(normalized.base64), {
          formatAsRGBA: true,
          tolerantDecoding: true,
          useTArray: true,
        });
        return extractPaletteFromRgba(decoded.data, decoded.width, decoded.height);
      } finally {
        image.release();
      }
    } finally {
      context.release();
    }
  }
}
