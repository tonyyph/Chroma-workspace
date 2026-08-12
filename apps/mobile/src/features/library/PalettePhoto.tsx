import type { Palette } from '@cw/domain';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
const harbourPhoto: number = require('../../../assets/brand/library/harbour-dusk.jpg');

const FALLBACK_PHOTOS: readonly number[] = [
  harbourPhoto,
  require('../../../assets/brand/library/market-awning.jpg'),
  require('../../../assets/brand/library/pool-tile.jpg'),
  require('../../../assets/brand/library/terracotta-wall.jpg'),
];

const SEED_PHOTO_INDEX: Readonly<Record<string, number>> = {
  'a0000000-0000-4000-8000-000000000001': 0,
  'a0000000-0000-4000-8000-000000000002': 1,
  'a0000000-0000-4000-8000-000000000003': 2,
  'a0000000-0000-4000-8000-000000000004': 3,
};

/**
 * Picks a real photographic fallback whose temperature matches the palette.
 * Scan-built and legacy palettes can legitimately have no single source frame;
 * their library cards still keep the product's photo-first visual contract.
 */
export function fallbackPhotoIndexFor(palette: Palette): number {
  const seeded = SEED_PHOTO_INDEX[palette.id];
  if (seeded !== undefined) return seeded;

  const hue = palette.colors.find((color) => color.role === 'dominant')?.oklch.hue ?? 260;
  if (hue < 45 || hue >= 330) return 3;
  if (hue < 100) return 1;
  if (hue < 210) return 2;
  return 0;
}

export function PalettePhoto({
  palette,
  style,
}: {
  palette: Palette;
  style: StyleProp<ImageStyle>;
}) {
  const [sourceFailed, setSourceFailed] = useState(false);

  useEffect(() => {
    setSourceFailed(false);
  }, [palette.photoUri]);

  const fallback = FALLBACK_PHOTOS[fallbackPhotoIndexFor(palette)] ?? harbourPhoto;
  const source = palette.photoUri && !sourceFailed ? { uri: palette.photoUri } : fallback;

  return (
    <Image
      accessibilityElementsHidden
      // The grid is scrolled back and forth over the same rows; keeping decoded
      // frames in memory as well as on disk is what stops a card re-decoding its
      // photo every time it comes back into the window.
      cachePolicy="memory-disk"
      contentFit="cover"
      onError={() => {
        if (palette.photoUri) setSourceFailed(true);
      }}
      recyclingKey={`${palette.id}:${palette.photoUri ?? 'fallback'}`}
      source={source}
      style={style}
    />
  );
}
