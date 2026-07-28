# Color extraction strategy

The first extractor normalizes any picker-supported image to a small JPEG through
Expo Image Manipulator. JPEG pixels are decoded locally, transparent/near-white
outliers are filtered, and deterministic weighted k-means runs in OKLab space.

## Budget

- Normalize to at most 64 x 64 pixels.
- Target under 750 ms on a current mid-range device.
- Limit clustering iterations to 14.
- Return five colors unless the image has fewer meaningful clusters.
- Perform no upload.

OKLab distance is used instead of raw RGB distance. Results include dominance,
lightness, chroma, hue, brightness, saturation, temperature, and contrast. A future
native or WASM implementation can replace pixel decoding behind `PaletteExtractor`
without changing the aggregate.

Fallback behavior is explicit: decoding or extraction failure returns a retryable
state and never saves a fabricated palette.
