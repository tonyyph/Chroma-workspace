/**
 * Helpers over the platform: files, sharing, and pixel reads.
 *
 * **For screens only.** `export.ts` reaches a Skia canvas to rasterise a share
 * card, so importing this barrel pulls a rendering module in with it. Screens
 * already carry that through `@/ui`, and pay nothing. Storage, hooks and
 * anything else below the view layer import the module they want directly, so
 * the data layer never grows a dependency on how things are drawn.
 */
export * from './decodable';
export * from './export';
export * from './photos';
export * from './readPalette';
