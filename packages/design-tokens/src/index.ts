/**
 * The token barrel.
 *
 * This file used to also *define* a complete second design system — a warm
 * champagne palette, a Playfair/Source Serif type scale, its own spacing,
 * radius, shadow and motion ramps, and six named theme palettes with a
 * light/dark map. None of it was imported by a single screen. The two things
 * that were (`themePalettes`, `themeModes`) reached one provider, which put
 * them on context where nothing read them.
 *
 * It described the product before the pivot, and leaving it here meant every
 * contributor had to work out which of two spacing scales was the real one.
 * The real one is `ui`.
 */
export * from './brand';
export * from './ui';
export * from './skins';
