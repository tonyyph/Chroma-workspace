import { contrastRatio } from './color';
import { filterPalettes, isWarmHue, type Color, type LibraryFilter, type Palette } from './palette';

/**
 * Discovery — the vocabulary the library and the trending feed are browsed with.
 *
 * The library already had one axis (`LibraryFilter`: all / recent / pinned), which
 * answers "where is the palette I already know about". It cannot answer "show me
 * something cool and pastel", which is the question anyone browsing a colour
 * library actually has. Two more axes are added here:
 *
 *   · COLOUR MOOD  — what the palette feels like as light: warm, cool, pastel,
 *     monochrome, vibrant.
 *   · VISUAL STYLE — what it reads as when used: minimal, editorial, retro,
 *     futuristic, organic.
 *
 * Both are *derived*, never stored. A palette is a set of measured colours; a tag
 * the user has to apply by hand would be wrong the moment they retuned a band.
 * Every predicate below reads the OKLCh values `makeColor` already guarantees are
 * current, so a tuned palette re-classifies itself with no write.
 *
 * The thresholds are stated once, here, as named constants rather than inline
 * numbers — they are the definition of the words, and the tests assert them.
 */

/* ----------------------------------------------------------------- metrics */

/** What every mood and style predicate is decided from. */
export type ColorMetrics = {
  /** Weight-averaged OKLCh chroma. How saturated the palette is overall. */
  meanChroma: number;
  /** Weight-averaged OKLCh lightness. */
  meanLightness: number;
  /** Lightest minus darkest. High means the palette carries its own contrast. */
  lightnessRange: number;
  /**
   * The smallest arc, in degrees, that contains every hue. 0 means one hue,
   * 180 means the palette spans opposite sides of the wheel. Computed as
   * 360 minus the largest gap between adjacent hues, which is what makes it
   * correct across the 360→0 wrap that a plain max-minus-min gets wrong.
   */
  hueSpread: number;
  /** The dominant colour's hue, or the first colour's when no role is set. */
  dominantHue: number;
  colorCount: number;
};

const EMPTY_METRICS: ColorMetrics = {
  meanChroma: 0,
  meanLightness: 0,
  lightnessRange: 0,
  hueSpread: 0,
  dominantHue: 0,
  colorCount: 0,
};

export function colorMetrics(colors: readonly Color[]): ColorMetrics {
  if (colors.length === 0) return EMPTY_METRICS;

  // Weights sum to one for a valid palette, but a raw colour list — a merged
  // set's strip, say — has no such guarantee, so they are normalised here.
  const totalWeight = colors.reduce((sum, color) => sum + color.weight, 0);
  const share = (color: Color) =>
    totalWeight > 0 ? color.weight / totalWeight : 1 / colors.length;

  const lightnesses = colors.map((color) => color.oklch.lightness);
  const dominant = colors.find((color) => color.role === 'dominant') ?? colors[0]!;

  return {
    meanChroma: colors.reduce((sum, color) => sum + color.oklch.chroma * share(color), 0),
    meanLightness: colors.reduce((sum, color) => sum + color.oklch.lightness * share(color), 0),
    lightnessRange: Math.max(...lightnesses) - Math.min(...lightnesses),
    hueSpread: hueSpread(colors.map((color) => color.oklch.hue)),
    dominantHue: dominant.oklch.hue,
    colorCount: colors.length,
  };
}

export function paletteMetrics(palette: Palette): ColorMetrics {
  return colorMetrics(palette.colors);
}

function hueSpread(hues: readonly number[]): number {
  if (hues.length < 2) return 0;
  const sorted = [...hues].map((hue) => ((hue % 360) + 360) % 360).sort((a, b) => a - b);

  let largestGap = 0;
  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index]!;
    const next = index === sorted.length - 1 ? sorted[0]! + 360 : sorted[index + 1]!;
    largestGap = Math.max(largestGap, next - current);
  }
  return Math.round((360 - largestGap) * 10) / 10;
}

/* -------------------------------------------------------------- colour mood */

export const colorMoods = ['warm', 'cool', 'pastel', 'monochrome', 'vibrant'] as const;
export type ColorMood = (typeof colorMoods)[number];

/**
 * The numbers that define the words. Chroma in OKLCh runs 0–0.37 for sRGB, so
 * 0.13 is roughly where a colour stops reading as a tint and starts reading as
 * a hue; 0.07 is where it stops reading as a hue at all.
 */
export const moodThresholds = {
  /** Above this the palette is saying a colour, not suggesting one. */
  vibrantChroma: 0.13,
  /** Pastel is low chroma *and* high lightness — low chroma alone is just mud. */
  pastelChroma: 0.095,
  pastelLightness: 0.68,
  /** One hue, or near enough that the eye reads a single family. */
  monochromeHueSpread: 45,
  /** Greys carry no hue to spread, so they are monochrome by chroma instead. */
  monochromeChroma: 0.035,
} as const;

export function matchesMood(colors: readonly Color[], mood: ColorMood): boolean {
  const metrics = colorMetrics(colors);
  if (metrics.colorCount === 0) return false;

  switch (mood) {
    case 'warm':
      // Reds through yellows. The same rule `isWarm` has always used, so a
      // palette does not change temperature by changing screen.
      return isWarmHue(metrics.dominantHue);
    case 'cool':
      return !isWarmHue(metrics.dominantHue);
    case 'pastel':
      return (
        metrics.meanChroma < moodThresholds.pastelChroma &&
        metrics.meanLightness > moodThresholds.pastelLightness
      );
    case 'monochrome':
      return (
        metrics.hueSpread <= moodThresholds.monochromeHueSpread ||
        metrics.meanChroma < moodThresholds.monochromeChroma
      );
    case 'vibrant':
      return metrics.meanChroma >= moodThresholds.vibrantChroma;
  }
}

/**
 * Every mood a palette belongs to. A palette is normally in two or three — warm
 * *and* vibrant *and* monochrome is an ordinary description, not a contradiction
 * — which is why the filter rail is multi-select rather than a segmented control.
 */
export function moodsOf(colors: readonly Color[]): readonly ColorMood[] {
  return colorMoods.filter((mood) => matchesMood(colors, mood));
}

/* ------------------------------------------------------------- visual style */

export const visualStyles = ['minimal', 'editorial', 'retro', 'futuristic', 'organic'] as const;
export type VisualStyle = (typeof visualStyles)[number];

export const styleThresholds = {
  /** Two or three bands is a system; six is a scene. */
  minimalColorCount: 3,
  minimalHueSpread: 60,
  /** Editorial is built on the paper-and-ink jump, not on saturation. */
  editorialLightnessRange: 0.5,
  editorialChroma: 0.17,
  /** Ambers, olives and brick — the muted warm band. */
  retroHue: { from: 25, to: 115 },
  retroChroma: { from: 0.05, to: 0.16 },
  /** Cyans through violets, at full strength. */
  futuristicHue: { from: 175, to: 325 },
  futuristicChroma: 0.11,
  /** Greens and earths, held back. */
  organicHue: { from: 90, to: 190 },
  organicChroma: 0.14,
} as const;

export function matchesStyle(colors: readonly Color[], style: VisualStyle): boolean {
  const metrics = colorMetrics(colors);
  if (metrics.colorCount === 0) return false;

  switch (style) {
    case 'minimal':
      return (
        metrics.colorCount <= styleThresholds.minimalColorCount ||
        metrics.hueSpread <= styleThresholds.minimalHueSpread
      );
    case 'editorial':
      return (
        metrics.lightnessRange >= styleThresholds.editorialLightnessRange &&
        metrics.meanChroma < styleThresholds.editorialChroma
      );
    case 'retro':
      return (
        inHueBand(metrics.dominantHue, styleThresholds.retroHue) &&
        metrics.meanChroma >= styleThresholds.retroChroma.from &&
        metrics.meanChroma <= styleThresholds.retroChroma.to
      );
    case 'futuristic':
      return (
        inHueBand(metrics.dominantHue, styleThresholds.futuristicHue) &&
        metrics.meanChroma >= styleThresholds.futuristicChroma
      );
    case 'organic':
      return (
        inHueBand(metrics.dominantHue, styleThresholds.organicHue) &&
        metrics.meanChroma < styleThresholds.organicChroma
      );
  }
}

/** Hue bands are arcs, so one that crosses 360 has `from` greater than `to`. */
function inHueBand(hue: number, band: { from: number; to: number }): boolean {
  const normalised = ((hue % 360) + 360) % 360;
  return band.from <= band.to
    ? normalised >= band.from && normalised <= band.to
    : normalised >= band.from || normalised <= band.to;
}

export function stylesOf(colors: readonly Color[]): readonly VisualStyle[] {
  return visualStyles.filter((style) => matchesStyle(colors, style));
}

/* --------------------------------------------------------------------- gaps */

/**
 * What a set of colours cannot yet do.
 *
 * A merged set is a working system, and a system is judged by what it can be
 * *used* for rather than by how it looks. These are the three failures that stop
 * one being usable, and each is measurable — no taste is being asserted:
 *
 *  · nothing saturated enough to act as an accent;
 *  · not enough range between lightest and darkest to carry its own contrast;
 *  · no pair of members that can legally sit on top of each other as text.
 *
 * Deliberately only three. A longer list would need thresholds that cannot be
 * defended from the metrics, and a gap the user disagrees with is worse than no
 * gap at all — it is the app being wrong about their work.
 */
export const gapKinds = ['missing-signal', 'narrow-lightness', 'no-safe-pairing'] as const;
export type GapKind = (typeof gapKinds)[number];

export type Gap = Readonly<{
  kind: GapKind;
  /** Where the set stands now, so the copy can name the number. */
  measured: number;
  /** What it has to reach to close. */
  threshold: number;
}>;

/**
 * Borrowed rather than invented. A set has no signal colour when nothing in it
 * would count as `vibrant`, and no range when it falls short of the paper-and-ink
 * jump `editorial` is defined by — so the gaps speak the vocabulary the filter
 * rail already taught the user, instead of introducing a second set of numbers
 * that mean almost but not quite the same thing.
 */
export const gapThresholds = {
  signalChroma: moodThresholds.vibrantChroma,
  lightnessRange: styleThresholds.editorialLightnessRange,
  /** WCAG 2.2 AA for normal text — the same bar the contrast tool reports. */
  contrastAA: 4.5,
} as const;

export function paletteGaps(colors: readonly Color[]): readonly Gap[] {
  if (colors.length === 0) return [];
  const gaps: Gap[] = [];

  // Peak, not mean: one strong accent among five muted colours is a signal, and
  // averaging would report the set as having none.
  const peakChroma = Math.max(...colors.map((color) => color.oklch.chroma));
  if (peakChroma < gapThresholds.signalChroma) {
    gaps.push({
      kind: 'missing-signal',
      measured: round2(peakChroma),
      threshold: gapThresholds.signalChroma,
    });
  }

  const { lightnessRange } = colorMetrics(colors);
  if (lightnessRange < gapThresholds.lightnessRange) {
    gaps.push({
      kind: 'narrow-lightness',
      measured: round2(lightnessRange),
      threshold: gapThresholds.lightnessRange,
    });
  }

  const best = bestPairContrast(colors);
  if (best < gapThresholds.contrastAA) {
    gaps.push({
      kind: 'no-safe-pairing',
      measured: round2(best),
      threshold: gapThresholds.contrastAA,
    });
  }

  return gaps;
}

/**
 * The strongest contrast any two members can make together. A single colour has
 * no pair, so it reports 1 — the ratio of a colour with itself — and correctly
 * registers as a gap.
 */
function bestPairContrast(colors: readonly Color[]): number {
  let best = 1;
  for (let first = 0; first < colors.length; first += 1) {
    for (let second = first + 1; second < colors.length; second += 1) {
      best = Math.max(best, contrastRatio(colors[first]!.hex, colors[second]!.hex));
    }
  }
  return best;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/* -------------------------------------------------------------------- query */

/**
 * A whole filter state, as one value.
 *
 * Passing the three axes around separately is what produced the old bug where
 * the header's result count and the grid disagreed: two call sites, two
 * re-implementations of "what is showing". One value, one function.
 */
export type PaletteQuery = {
  base: LibraryFilter;
  moods: readonly ColorMood[];
  styles: readonly VisualStyle[];
  /** Free text, matched against name, tags and hex. Empty means no constraint. */
  search: string;
};

export const emptyQuery: PaletteQuery = { base: 'all', moods: [], styles: [], search: '' };

/** How many constraints are on, for the "N active · RESET" affordance. */
export function activeFilterCount(query: PaletteQuery): number {
  return (
    (query.base === 'all' ? 0 : 1) +
    query.moods.length +
    query.styles.length +
    (query.search.trim() ? 1 : 0)
  );
}

export function isEmptyQuery(query: PaletteQuery): boolean {
  return activeFilterCount(query) === 0;
}

/**
 * Toggling is the same operation for both groups, and it has to be immutable —
 * mutating the array in place left React with an unchanged reference and a chip
 * that only repainted when something else re-rendered.
 */
export function toggleIn<Value extends string>(
  values: readonly Value[],
  value: Value,
): readonly Value[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value].sort();
}

/**
 * Selections inside a group are OR — "warm or cool" is a widening. Across
 * groups they are AND — "warm" and "minimal" is a narrowing. That is the
 * behaviour every faceted browser has, and the one users expect without being
 * told.
 */
export function matchesQuery(
  colors: readonly Color[],
  query: Pick<PaletteQuery, 'moods' | 'styles'>,
): boolean {
  const moodOk = query.moods.length === 0 || query.moods.some((mood) => matchesMood(colors, mood));
  const styleOk =
    query.styles.length === 0 || query.styles.some((style) => matchesStyle(colors, style));
  return moodOk && styleOk;
}

/** Name, tag or hex. The three things a user types when looking for a palette. */
export function matchesSearch(palette: Palette, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  return (
    palette.name.toLocaleLowerCase().includes(needle) ||
    palette.tags.some((tag) => tag.toLocaleLowerCase().includes(needle)) ||
    palette.colors.some((color) => color.hex.toLocaleLowerCase().includes(needle))
  );
}

/**
 * The one function that decides what is on screen. Deduplicated on the way out,
 * because the input can be a merge of several reads and a repeated card is
 * indistinguishable from a rendering bug.
 */
export function queryPalettes(
  palettes: readonly Palette[],
  query: PaletteQuery,
): readonly Palette[] {
  const byBase = filterPalettes(dedupeById(palettes), query.base);
  return byBase.filter(
    (palette) => matchesQuery(palette.colors, query) && matchesSearch(palette, query.search),
  );
}

/* ------------------------------------------------------------ deduplication */

/** Anything addressable by a stable identity. */
export type Identified = { readonly id: string };

/**
 * First occurrence wins, order preserved.
 *
 * Identity is the id and only the id. Deduplicating on name would merge two
 * captures a user deliberately called the same thing; deduplicating on index is
 * not deduplication at all. Every list that can be built from more than one read
 * — a merged page, a refresh landing on top of a load, a fixture set overlapping
 * the user's own library — goes through this before it reaches a renderer.
 */
export function dedupeById<Item extends Identified>(items: readonly Item[]): Item[] {
  const seen = new Set<string>();
  const unique: Item[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

/**
 * A palette's colour signature: its hexes, in canonical order.
 *
 * Saving a trending palette copies it into the library as a new record with a
 * fresh uuid, so the copy and the fixture have different ids and `dedupeById`
 * cannot see they are the same thing. What they do share is the exact set of
 * colours they were built from. Sorting makes the signature independent of band
 * order, so a reordered copy still matches its origin.
 */
export function colorSignature(colors: readonly Color[]): string {
  return [...colors.map((color) => color.hex.toUpperCase())].sort().join('-');
}

export function paletteSignature(palette: Palette): string {
  return colorSignature(palette.colors);
}

/**
 * Which of `items` the user already owns, as origin id → owned palette id.
 * Used to keep a saved feed entry from appearing twice — once as the fixture and
 * once as the copy — and to send a tap to the copy the user can actually edit.
 */
export function ownedSignatureIndex<Item extends { id: string; colors: readonly Color[] }>(
  items: readonly Item[],
  library: readonly Palette[],
): ReadonlyMap<string, string> {
  const bySignature = new Map<string, string>();
  for (const palette of library) {
    const signature = paletteSignature(palette);
    // First save wins, so the mapping is stable as the library grows.
    if (!bySignature.has(signature)) bySignature.set(signature, palette.id);
  }

  const owned = new Map<string, string>();
  for (const item of items) {
    const paletteId = bySignature.get(colorSignature(item.colors));
    if (paletteId) owned.set(item.id, paletteId);
  }
  return owned;
}
