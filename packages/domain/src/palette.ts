import { z } from 'zod';

import { hexDeltaE00, hexToRgb, rgbToHex, rgbToOklch } from './color';
import { gradeSchema } from './grading';
import { asProportions, withExactWeights } from './weights';

/**
 * The palette — the entity this product is built around.
 *
 * Shape follows BUILD KIT · 07 · CORE MODEL:
 *
 *   Palette { id, name, createdAt, source, colors, tags, location?, deltaE,
 *             confidence, space, tuned, setIds }
 *   Color   { hex, rgb, oklch, role, weight, locked }
 *   Set     { id, name, paletteIds, members[], merged? }
 *
 * The roles are the language the whole app speaks, from FLOW A3: "Dominant ·
 * the colour the scene is actually made of / Support · what holds it up /
 * Signal · the accent that makes people look".
 */

export const hexSchema = z.string().regex(/^#[0-9A-F]{6}$/, 'Hex must be uppercase #RRGGBB');

export const colorRoleSchema = z.enum(['dominant', 'support', 'signal', 'extra']);

/** "source: 'live'|'photo'|'scan'" — which of the three capture paths produced it. */
export const paletteSourceSchema = z.enum(['live', 'photo', 'scan']);

/** "space: 'srgb'|'p3'" */
export const colorSpaceSchema = z.enum(['srgb', 'p3']);

const rgbSchema = z.object({
  red: z.number().int().min(0).max(255),
  green: z.number().int().min(0).max(255),
  blue: z.number().int().min(0).max(255),
});

const oklchSchema = z.object({
  lightness: z.number().min(0).max(1),
  chroma: z.number().min(0).max(0.5),
  hue: z.number().min(0).max(360),
});

/**
 * `rgb` and `oklch` are derived from `hex`, and the kit lists all three on
 * `Color` because exports and P3 rendering need them without recomputing. They
 * are therefore validated against the hex rather than trusted: a stored colour
 * whose components disagree with its hex is corrupt, not merely stale.
 */
export const colorSchema = z
  .object({
    hex: hexSchema,
    rgb: rgbSchema,
    oklch: oklchSchema,
    role: colorRoleSchema,
    /** Share of the source image, 0-1. Drives every proportional strip. */
    weight: z.number().min(0).max(1),
    /** Held through a retune — the user pinned this exact value. */
    locked: z.boolean(),
  })
  .superRefine((color, context) => {
    if (rgbToHex(color.rgb) !== color.hex) {
      context.addIssue({
        code: 'custom',
        message: `rgb does not describe ${color.hex}`,
        path: ['rgb'],
      });
    }
  });

export const paletteSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    createdAt: z.iso.datetime(),
    capturedAt: z.iso.datetime(),
    source: paletteSourceSchema,
    /** B2 shows five; the design never draws fewer than two or more than eight. */
    colors: z.array(colorSchema).min(2).max(8),
    tags: z.array(z.string().trim().min(1).max(24)).max(8),
    /** "SAVED 2D AGO · OSLO" — optional, and never inferred without permission. */
    location: z.string().trim().max(80).nullable(),
    photoUri: z.string().min(1).nullable(),
    /** Mean ΔE00 of the extraction. B2 reports "ΔE 2.4 · STABLE". */
    deltaE: z.number().min(0).max(100),
    /** "CONF 94%" on the result sheet. */
    confidence: z.number().min(0).max(1),
    space: colorSpaceSchema,
    /** Whether B3 Tune has been applied. Reported on `palette_saved`. */
    tuned: z.boolean(),
    setIds: z.array(z.string().uuid()).max(50),
    isPinned: z.boolean(),
    /**
     * The grade applied to this palette's photograph, or null for none.
     *
     * A widening rather than a new version: `.default(null)` means every record
     * written before grading existed still parses, so `schemaVersion` stays at 1
     * and no migration has to run. The grade is stored, never the graded pixels —
     * it is eleven numbers, it re-renders identically every time, and keeping the
     * original frame is what makes the grade something you can change your mind
     * about a year later.
     */
    grade: gradeSchema.nullable().default(null),
    /**
     * A rendered copy of the photograph, graded when the palette is graded.
     *
     * Lists read this; the grade screen and the performance render the original
     * live. A library grid cannot mount a Skia canvas per card without becoming
     * a stuttering grid, and this is what keeps it from having to.
     */
    thumbnailUri: z.string().min(1).nullable().default(null),
  })
  .superRefine((palette, context) => {
    const total = palette.colors.reduce((sum, color) => sum + color.weight, 0);
    if (Math.abs(total - 1) > 0.02) {
      context.addIssue({
        code: 'custom',
        message: 'Colour weights must sum to one.',
        path: ['colors'],
      });
    }
    // 'extra' repeats by design; the three named roles are singular.
    const named = palette.colors.map((c) => c.role).filter((role) => role !== 'extra');
    if (new Set(named).size !== named.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each named role may be assigned to at most one colour.',
        path: ['colors'],
      });
    }
  });

export const paletteListSchema = z.array(paletteSchema);

/** "Set { id, name, paletteIds, members[], merged?: Color[] }" */
export const setSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  paletteIds: z.array(z.string().uuid()).max(200),
  /** Collaborators. Local-first builds carry the owner alone. */
  members: z.array(z.string().trim().min(1).max(80)).max(50),
  /** C3's "MERGED SET · PRO" strip, once computed. */
  merged: z.array(colorSchema).max(12).nullable(),
});

export const setListSchema = z.array(setSchema);

export type Hex = z.infer<typeof hexSchema>;
export type ColorRole = z.infer<typeof colorRoleSchema>;
export type PaletteSource = z.infer<typeof paletteSourceSchema>;
export type ColorSpace = z.infer<typeof colorSpaceSchema>;
export type Color = z.infer<typeof colorSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type PaletteSet = z.infer<typeof setSchema>;

export interface PaletteRepository {
  list(): Promise<readonly Palette[]>;
  get(id: string): Promise<Palette | null>;
  save(palette: Palette): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SetRepository {
  list(): Promise<readonly PaletteSet[]>;
  get(id: string): Promise<PaletteSet | null>;
  save(set: PaletteSet): Promise<void>;
  remove(id: string): Promise<void>;
}

/* ------------------------------------------------------------------ helpers */

/**
 * The only way to build a `Color`. Deriving `rgb` and `oklch` here is what keeps
 * the schema's consistency check from ever firing in normal use.
 */
export function makeColor(
  hex: string,
  weight: number,
  role: ColorRole = 'extra',
  locked = false,
): Color {
  const upper = hex.toUpperCase();
  const rgb = hexToRgb(upper);
  const oklch = rgbToOklch(rgb);
  return {
    hex: upper,
    rgb,
    oklch: {
      lightness: clamp01(oklch.lightness),
      chroma: Math.min(0.5, Math.max(0, oklch.chroma)),
      hue: oklch.hue,
    },
    role,
    weight,
    locked,
  };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The order a palette hands out its named roles when nothing else has said. */
const ROLE_ORDER = ['dominant', 'support', 'signal'] as const;

/**
 * Builds a palette's colours from proportions.
 *
 * The proportions are relative — flex ratios from the design document, pixel
 * counts from an extraction, or a bare 1 apiece — and become weights that sum to
 * exactly one. A role given as `null` is filled from the band order, so callers
 * that simply have a list of hexes in dominance order get the right roles.
 *
 * Four call sites each carried their own copy of this arithmetic. Weights
 * summing to one is a rule about palettes, not a detail of the screen that
 * happens to be building one.
 */
export function weightedColors(
  entries: readonly (readonly [hex: string, ratio: number, role?: ColorRole | null])[],
): Color[] {
  const weights = asProportions(entries.map(([, ratio]) => ratio));
  return withExactWeights(
    entries.map(([hex, , role], index) =>
      makeColor(hex, weights[index] ?? 0, role ?? ROLE_ORDER[index] ?? 'extra'),
    ),
  );
}

/**
 * `weightedColors` for colours that carry no proportion of their own — pinned
 * while walking, or tapped onto an imported photo. Each takes an equal share.
 */
export function evenlyWeightedColors(hexes: readonly string[]): Color[] {
  return weightedColors(hexes.map((hex) => [hex, 1] as const));
}

/** The colour carrying a named role, or null. Named roles are unique. */
export function colorForRole(palette: Palette, role: ColorRole): Color | null {
  return palette.colors.find((color) => color.role === role) ?? null;
}

/**
 * The three named colours in band order, for strips and the tune screen.
 * Falls back to source order when a capture produced fewer than three.
 */
export function roledColors(palette: Palette): readonly Color[] {
  return roledFrom(palette.colors);
}

/**
 * `roledColors` for a bare colour list.
 *
 * Exists because the roles are a property of the *colours*, not of the record
 * holding them: a merged set's strip and a capture still in flight both need the
 * same ordering and neither is a `Palette`. Callers were reaching this by
 * constructing a throwaway object with only a `colors` field, which typechecked
 * only through a cast.
 */
export function roledFrom(colors: readonly Color[]): readonly Color[] {
  const ordered = (['dominant', 'support', 'signal'] as const)
    .map((role) => colors.find((color) => color.role === role) ?? null)
    .filter((color): color is Color => color !== null);
  return ordered.length ? ordered : colors.slice(0, 3);
}

/**
 * B2's stability verdict. ΔE00 ≈ 2.3 is the long-standing just-noticeable
 * difference, so a read below it is one the user cannot perceive drifting —
 * which is why the document pairs "ΔE 2.4" with the word "STABLE".
 */
export function readStability(deltaE: number): 'stable' | 'drifting' | 'unstable' {
  if (deltaE <= 2.3) return 'stable';
  if (deltaE <= 5) return 'drifting';
  return 'unstable';
}

/**
 * FLOW C filters — the *library* axis: where a palette the user already owns
 * sits in their own collection. `all` is the default chip.
 *
 * Temperature used to be a fourth chip here. It is a property of the colour, not
 * of the user's relationship to it, so it moved to the colour-mood axis in
 * `discovery` alongside pastel, monochrome and vibrant — where it can be
 * combined with a style rather than replacing the whole selection.
 */
export const libraryFilters = ['all', 'recent', 'pinned'] as const;
export type LibraryFilter = (typeof libraryFilters)[number];

/**
 * Warmth is decided on the dominant colour's OKLCh hue: reds through yellows
 * read warm, cyans through violets read cool.
 */
export function isWarmHue(hue: number): boolean {
  return hue < 110 || hue >= 330;
}

/**
 * Read from the stored `oklch` rather than recomputed, since `makeColor`
 * guarantees it is current.
 */
export function isWarm(palette: Palette): boolean {
  const dominant = colorForRole(palette, 'dominant') ?? palette.colors[0];
  if (!dominant) return false;
  return isWarmHue(dominant.oklch.hue);
}

export function filterPalettes(
  palettes: readonly Palette[],
  filter: LibraryFilter,
): readonly Palette[] {
  switch (filter) {
    case 'recent':
      return [...palettes].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)).slice(0, 12);
    case 'pinned':
      return palettes.filter((palette) => palette.isPinned);
    default:
      return palettes;
  }
}

/* ------------------------------------------------------------------- merge */

/** Colours closer than this count as the same colour. ΔE00 5 is "close, but
 * a designer would still pick one of the two" — twice the just-noticeable
 * difference `readStability` treats as stable. */
export const SAME_COLOUR_DELTA_E = 5;

/** The strip is a system, not an inventory. Five is what `Color`'s roles cover. */
export const MERGED_COLOR_LIMIT = 5;

/**
 * The colours a group of palettes have in common, as one weighted system.
 *
 * This is what a `Set` is *for*: twenty captures of the same kitchen are not
 * twenty palettes, they are one palette measured twenty times. ΔE00 decides what
 * is genuinely distinct — the same measure the compare matrix reports — and
 * everything that survives is renormalised, because dropping colours leaves the
 * weights summing to less than one.
 *
 * **Near-duplicates accumulate rather than being discarded.** A colour present in
 * every member is the set's real dominant even when no single capture gave it a
 * large share, so a match adds its weight to the colour already kept instead of
 * being dropped. The two-palette version this replaces kept whichever colour it
 * saw *first* and threw the other away, which meant the merge depended on the
 * order the palettes happened to be in.
 */
export function mergePalettes(palettes: readonly Palette[]): Color[] {
  const kept: { hex: string; weight: number }[] = [];

  for (const palette of palettes) {
    for (const color of palette.colors) {
      const existing = kept.find(
        (entry) => hexDeltaE00(entry.hex, color.hex) < SAME_COLOUR_DELTA_E,
      );
      if (existing) {
        existing.weight += color.weight;
        continue;
      }
      kept.push({ hex: color.hex, weight: color.weight });
    }
  }

  const top = kept.sort((a, b) => b.weight - a.weight).slice(0, MERGED_COLOR_LIMIT);
  const total = top.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const roles = ['dominant', 'support', 'signal'] as const;
  const merged = top.map((entry, index) =>
    makeColor(entry.hex, round3(entry.weight / total), roles[index] ?? 'extra'),
  );

  // Rounding leaves a remainder; push it onto the dominant so weights sum to one.
  const drift = 1 - merged.reduce((sum, color) => sum + color.weight, 0);
  const dominant = merged[0];
  if (dominant) {
    merged[0] = { ...dominant, weight: round3(dominant.weight + drift) };
  }
  return merged;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** "5 COLOURS · 2D" — the compact age used on library cards. */
export function shortAge(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'TODAY';
  if (days < 7) return `${days}D`;
  if (days < 30) return `${Math.floor(days / 7)}W`;
  if (days < 365) return `${Math.floor(days / 30)}MO`;
  return `${Math.floor(days / 365)}Y`;
}
