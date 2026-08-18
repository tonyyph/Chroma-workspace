import {
  colorForRole,
  colorMoods,
  matchesMood,
  matchesStyle,
  visualStyles,
  type ColorMood,
  type Palette,
  type TasteEntry,
  type VisualStyle,
} from '@cw/domain';

/**
 * What the profile knows about someone, read from what they have kept.
 *
 * Every number on the You screen is derived here rather than stored. There is no
 * account and no server, so a "favourite colour" the user had to declare would
 * be a second source of truth that goes stale the moment they capture something
 * — and a profile that describes a taste they no longer have is worse than one
 * that describes none.
 *
 * These are pure functions over the library so they can be asserted directly;
 * the screen renders them and does no arithmetic of its own.
 */

/**
 * One definition of taste, in the domain.
 *
 * This module used to declare its own `TasteEntry` with `count` and `share`
 * while `domain/styleDna.ts` carried `count` and `weight` — two answers to "what
 * does this person like", of which the one that drifts is whichever was edited
 * second. Re-exported rather than redeclared so there is one.
 */
export type { TasteEntry } from '@cw/domain';

/** How many colours the signature strip carries before it stops reading as one. */
const SIGNATURE_MAX = 6;

/**
 * The colours that identify this library: the dominant band of each palette,
 * most recent first, with repeats dropped.
 *
 * Repeats are dropped by *value* here rather than by palette id, and deliberately
 * so — this is the one place where two records carrying the same colour really
 * are one fact about the person, and showing the same violet three times says
 * nothing the first one did not.
 */
export function signatureColors(palettes: readonly Palette[]): readonly string[] {
  const seen = new Set<string>();
  const signature: string[] = [];

  for (const palette of byRecency(palettes)) {
    const dominant = colorForRole(palette, 'dominant') ?? palette.colors[0];
    if (!dominant) continue;
    const hex = dominant.hex.toUpperCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    signature.push(hex);
    if (signature.length === SIGNATURE_MAX) break;
  }
  return signature;
}

export function byRecency(palettes: readonly Palette[]): readonly Palette[] {
  return [...palettes].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

/**
 * Moods ranked by how much of the library sits in them.
 *
 * A palette counts towards every mood it matches, so the shares do not sum to
 * one — "warm and vibrant" is one palette described twice, not half a palette
 * each way. The bar this feeds is therefore drawn proportionally *within* the
 * ranked set rather than as a percentage of the library.
 */
export function moodTaste(palettes: readonly Palette[]): readonly TasteEntry<ColorMood>[] {
  return rank(colorMoods, palettes, (palette, mood) => matchesMood(palette.colors, mood));
}

export function styleTaste(palettes: readonly Palette[]): readonly TasteEntry<VisualStyle>[] {
  return rank(visualStyles, palettes, (palette, style) => matchesStyle(palette.colors, style));
}

function rank<Value extends string>(
  values: readonly Value[],
  palettes: readonly Palette[],
  matches: (palette: Palette, value: Value) => boolean,
): readonly TasteEntry<Value>[] {
  const total = palettes.length;
  if (total === 0) return [];

  return values
    .map((value) => {
      const count = palettes.filter((palette) => matches(palette, value)).length;
      // `weight` equals `count` here: this reads the *palette* projection, which
      // carries no capture date to age by. The recency-weighted reading is
      // `readStyleDna`, over memories, which do.
      return { value, count, weight: count, share: count / total };
    })
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Captures in the calendar month `now` falls in — the profile's "this month". */
export function capturedThisMonth(palettes: readonly Palette[], now: Date = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth();
  return palettes.filter((palette) => {
    const captured = new Date(palette.capturedAt);
    if (Number.isNaN(captured.getTime())) return false;
    return captured.getFullYear() === year && captured.getMonth() === month;
  }).length;
}

export function totalColors(palettes: readonly Palette[]): number {
  return palettes.reduce((sum, palette) => sum + palette.colors.length, 0);
}
