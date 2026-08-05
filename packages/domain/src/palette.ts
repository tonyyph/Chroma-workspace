import { z } from 'zod';

import { hexToRgb, rgbToHex, rgbToOklch } from './color';

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

/** The colour carrying a named role, or null. Named roles are unique. */
export function colorForRole(palette: Palette, role: ColorRole): Color | null {
  return palette.colors.find((color) => color.role === role) ?? null;
}

/**
 * The three named colours in band order, for strips and the tune screen.
 * Falls back to source order when a capture produced fewer than three.
 */
export function roledColors(palette: Palette): readonly Color[] {
  const ordered = (['dominant', 'support', 'signal'] as const)
    .map((role) => colorForRole(palette, role))
    .filter((color): color is Color => color !== null);
  return ordered.length ? ordered : palette.colors.slice(0, 3);
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

/** "5 COLOURS · 2D" — the compact age used on library cards. */
export function shortAge(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'TODAY';
  if (days < 7) return `${days}D`;
  if (days < 30) return `${Math.floor(days / 7)}W`;
  if (days < 365) return `${Math.floor(days / 30)}MO`;
  return `${Math.floor(days / 365)}Y`;
}
