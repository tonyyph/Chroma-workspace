import { extractPaletteFromRgba } from '@cw/domain';

/**
 * Why the reader downscales instead of point-sampling.
 *
 * `readPalette` draws the photo into a 128×128 surface with mipmap filtering, so
 * every pixel contributes to the cell that covers it. What it replaced walked a
 * 48×48 grid of *individual* pixels out of the full frame — 2 304 samples from
 * roughly twelve million, about 0.02%.
 *
 * The difference only shows on the thing the app exists to find: a signal colour
 * that occupies a small share of the frame. These build a synthetic photo with
 * one and check that each strategy finds it, using pure JS on both sides — the
 * real path runs on the GPU, but the sampling arithmetic is what is at stake.
 */

const WIDTH = 1200;
const HEIGHT = 900;

/**
 * A grey field with a coral accent, laid out either as one solid block or as
 * thin stripes.
 *
 * The shape matters more than the share. A solid block big enough to cover a
 * few grid steps gets hit by point sampling regardless of how little of the
 * frame it occupies — so the block case is not where the two strategies differ.
 * Thin features are: neon tubing, a painted line, light through a railing.
 */
function syntheticPhoto(accentShare: number, shape: 'block' | 'stripes' = 'block'): Uint8Array {
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  const accentPixels = Math.round(WIDTH * HEIGHT * accentShare);

  const inAccent = (x: number, y: number): boolean => {
    if (shape === 'stripes') {
      // 2px stripes spaced to hit the requested share. The old sampler stepped
      // 25px at a time, so a stripe this thin sits between its samples.
      const period = Math.max(4, Math.round((WIDTH * HEIGHT * 2) / Math.max(1, accentPixels)));
      return y % period < 2;
    }
    const side = Math.round(Math.sqrt(accentPixels));
    return x >= 40 && x < 40 + side && y >= 40 && y < 40 + side;
  };

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const at = (y * WIDTH + x) * 4;
      const accent = inAccent(x, y);
      // A mid grey ground, and a strong coral accent.
      pixels[at] = accent ? 255 : 90;
      pixels[at + 1] = accent ? 122 : 92;
      pixels[at + 2] = accent ? 92 : 96;
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}

/** The old strategy: read one pixel per grid cell and ignore the rest. */
function pointSample(pixels: Uint8Array, grid: number): Uint8Array {
  const out = new Uint8Array(grid * grid * 4);
  for (let gy = 0; gy < grid; gy++) {
    const y = Math.min(HEIGHT - 1, Math.floor(((gy + 0.5) / grid) * HEIGHT));
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.min(WIDTH - 1, Math.floor(((gx + 0.5) / grid) * WIDTH));
      const from = (y * WIDTH + x) * 4;
      const to = (gy * grid + gx) * 4;
      out[to] = pixels[from] ?? 0;
      out[to + 1] = pixels[from + 1] ?? 0;
      out[to + 2] = pixels[from + 2] ?? 0;
      out[to + 3] = 255;
    }
  }
  return out;
}

/** The new strategy: every source pixel lands in the cell that covers it. */
function boxDownscale(pixels: Uint8Array, grid: number): Uint8Array {
  const sums = new Float64Array(grid * grid * 4);
  for (let y = 0; y < HEIGHT; y++) {
    const gy = Math.min(grid - 1, Math.floor((y / HEIGHT) * grid));
    for (let x = 0; x < WIDTH; x++) {
      const gx = Math.min(grid - 1, Math.floor((x / WIDTH) * grid));
      const from = (y * WIDTH + x) * 4;
      const to = (gy * grid + gx) * 4;
      sums[to] = (sums[to] ?? 0) + (pixels[from] ?? 0);
      sums[to + 1] = (sums[to + 1] ?? 0) + (pixels[from + 1] ?? 0);
      sums[to + 2] = (sums[to + 2] ?? 0) + (pixels[from + 2] ?? 0);
      sums[to + 3] = (sums[to + 3] ?? 0) + 1;
    }
  }
  const out = new Uint8Array(grid * grid * 4);
  for (let cell = 0; cell < grid * grid; cell++) {
    const at = cell * 4;
    const count = (sums[at + 3] ?? 0) || 1;
    out[at] = Math.round((sums[at] ?? 0) / count);
    out[at + 1] = Math.round((sums[at + 1] ?? 0) / count);
    out[at + 2] = Math.round((sums[at + 2] ?? 0) / count);
    out[at + 3] = 255;
  }
  return out;
}

/** How close the closest extracted colour gets to the accent, per channel. */
function bestAccentDistance(rgba: Uint8Array, grid: number): number {
  const { colors } = extractPaletteFromRgba(rgba, grid, grid, 5);
  return Math.min(
    ...colors.map((color) =>
      Math.max(
        Math.abs(color.rgb.red - 255),
        Math.abs(color.rgb.green - 122),
        Math.abs(color.rgb.blue - 92),
      ),
    ),
  );
}

describe('sampling strategy', () => {
  it('carries a thin accent that point sampling steps straight over', () => {
    // 4% of the frame, but as 2px stripes — the shape a point sampler on a 25px
    // stride is blind to no matter how much of the image it adds up to.
    const photo = syntheticPhoto(0.04, 'stripes');

    const sparse = bestAccentDistance(pointSample(photo, 48), 48);
    const dense = bestAccentDistance(boxDownscale(photo, 128), 128);

    // Averaging pulls the stripes into the cells they cross, so the accent
    // shifts those cells measurably towards it.
    expect(dense).toBeLessThan(sparse);
  });

  it('agrees with point sampling on a colour that fills the frame', () => {
    // The two strategies must not disagree about the easy case — this is the
    // control, and a failure here would mean the downscale is distorting.
    const photo = syntheticPhoto(0.45);

    expect(bestAccentDistance(pointSample(photo, 48), 48)).toBeLessThan(40);
    expect(bestAccentDistance(boxDownscale(photo, 128), 128)).toBeLessThan(40);
  });

  it('finds a small solid accent under both strategies', () => {
    // Stated plainly because it is the honest limit of the claim: for a
    // contiguous block, point sampling lands on it too. The downscale is not
    // better here, only never worse.
    const photo = syntheticPhoto(0.01);

    expect(bestAccentDistance(pointSample(photo, 48), 48)).toBeLessThan(40);
    expect(bestAccentDistance(boxDownscale(photo, 128), 128)).toBeLessThan(40);
  });

  it('is deterministic, so two reads of one photo agree', () => {
    // The old sampler's result depended on where its 2 304 points happened to
    // land, so re-reading the same photo could produce a different palette.
    const photo = syntheticPhoto(0.08);
    const first = extractPaletteFromRgba(boxDownscale(photo, 128), 128, 128, 5);
    const second = extractPaletteFromRgba(boxDownscale(photo, 128), 128, 128, 5);

    expect(first.colors.map((color) => color.hex)).toEqual(second.colors.map((color) => color.hex));
  });
});
