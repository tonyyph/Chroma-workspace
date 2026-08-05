import { makeColor, type Color } from '@chromawave/domain';

/**
 * The trending catalogue.
 *
 * This build is local-first with no server, so the feed is fixture content —
 * every palette, handle and save count below is written here rather than fetched.
 * What it is *not* is filler: each entry is a distinct palette with its own
 * colours, so no two rows share a colour signature and the feed can be
 * deduplicated against the user's own library by content rather than by id.
 *
 * `trendingRepository` is what screens read; it pages and validates this array,
 * which is what keeps the swap to a real endpoint a change in one file.
 */

/** The document expresses strip proportions as flex ratios; weights must sum to 1. */
function weighted(entries: readonly (readonly [string, number, Color['role']?])[]): Color[] {
  const total = entries.reduce((sum, [, ratio]) => sum + ratio, 0);
  const swatches = entries.map(([hex, ratio, role]) =>
    makeColor(hex, Math.round((ratio / total) * 1000) / 1000, role ?? 'extra'),
  );
  const drift = 1 - swatches.reduce((sum, swatch) => sum + swatch.weight, 0);
  const first = swatches[0];
  if (!first) return swatches;
  return [
    { ...first, weight: Math.round((first.weight + drift) * 1000) / 1000 },
    ...swatches.slice(1),
  ];
}

/**
 * Where the palette was read. This is the axis the feed is browsed by, and it is
 * editorial rather than derived — two palettes can be identical in colour and
 * come from a market awning and a server rack.
 */
export const trendingCategories = ['editorial', 'urban', 'nature', 'interior', 'archive'] as const;
export type TrendingCategory = (typeof trendingCategories)[number];

export type TrendingItem = {
  /** Stable and content-free, so it survives a reordering of this array. */
  readonly id: string;
  readonly name: string;
  /** The handle that published it. Rendered as "@handle". */
  readonly author: string;
  readonly saves: number;
  readonly category: TrendingCategory;
  /** One line of why it is worth a tap. Never a duplicate of the name. */
  readonly blurb: string;
  /** ISO date the entry surfaced, for the "NEW" marker and recency sort. */
  readonly publishedAt: string;
  readonly colors: readonly Color[];
};

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

export const trendingItems: readonly TrendingItem[] = [
  {
    id: 'chlorine-haze',
    name: 'Chlorine haze',
    author: 'mira',
    saves: 2100,
    category: 'interior',
    blurb: 'Municipal pool at 7am, before anyone gets in',
    publishedAt: ago(1),
    colors: weighted([
      ['#22D3EE', 2, 'dominant'],
      ['#0F6E7C', 1, 'support'],
      ['#F1E7D6', 1, 'signal'],
    ]),
  },
  {
    id: 'late-brick',
    name: 'Late brick',
    author: 'dao',
    saves: 1800,
    category: 'urban',
    blurb: 'West-facing wall holding the last hour of sun',
    publishedAt: ago(2),
    colors: weighted([
      ['#FFC24A', 2, 'dominant'],
      ['#C4623B', 1, 'support'],
      ['#31241F', 1, 'signal'],
    ]),
  },
  {
    id: 'night-transit',
    name: 'Night transit',
    author: 'sol',
    saves: 1200,
    category: 'urban',
    blurb: 'Platform lighting and a single orange sign',
    publishedAt: ago(3),
    colors: weighted([
      ['#7C5CFF', 2, 'dominant'],
      ['#161327', 1, 'support'],
      ['#FF7A5C', 1, 'signal'],
    ]),
  },
  {
    id: 'paper-mill',
    name: 'Paper mill',
    author: 'ines',
    saves: 3400,
    category: 'editorial',
    blurb: 'Ink on uncoated stock — the whole contrast range',
    publishedAt: ago(4),
    colors: weighted([
      ['#F7F4EC', 2.2, 'dominant'],
      ['#14110D', 1.4, 'support'],
      ['#8A3B2E', 0.6, 'signal'],
    ]),
  },
  {
    id: 'salt-flat',
    name: 'Salt flat',
    author: 'kaya',
    saves: 980,
    category: 'nature',
    blurb: 'Bleached ground, one degree of sky in it',
    publishedAt: ago(5),
    colors: weighted([
      ['#EFEAE0', 2, 'dominant'],
      ['#D9DEDC', 1.2, 'support'],
      ['#B9C6C4', 0.8, 'signal'],
      ['#8FA3A5', 0.5],
    ]),
  },
  {
    id: 'fern-shade',
    name: 'Fern shade',
    author: 'noor',
    saves: 1550,
    category: 'nature',
    blurb: 'Understorey green, three stops below the canopy',
    publishedAt: ago(6),
    colors: weighted([
      ['#6E7F4F', 2, 'dominant'],
      ['#2E3524', 1.2, 'support'],
      ['#B8B08A', 0.9, 'signal'],
    ]),
  },
  {
    id: 'server-room',
    name: 'Server room',
    author: 'wren',
    saves: 2650,
    category: 'interior',
    blurb: 'Status LEDs against a room with no daylight',
    publishedAt: ago(7),
    colors: weighted([
      ['#00E5FF', 1.8, 'dominant'],
      ['#0B0A16', 1.6, 'support'],
      ['#7C5CFF', 1, 'signal'],
    ]),
  },
  {
    id: 'kodachrome-64',
    name: 'Kodachrome 64',
    author: 'tam',
    saves: 4200,
    category: 'archive',
    blurb: 'Slide film reds that no sensor gets for free',
    publishedAt: ago(8),
    colors: weighted([
      ['#C03A2B', 1.9, 'dominant'],
      ['#E3B25A', 1.1, 'support'],
      ['#2C4A5E', 0.9, 'signal'],
      ['#EFE3CB', 0.6],
    ]),
  },
  {
    id: 'terrazzo-lobby',
    name: 'Terrazzo lobby',
    author: 'juno',
    saves: 870,
    category: 'interior',
    blurb: 'Chips of everything in a field of nothing',
    publishedAt: ago(9),
    colors: weighted([
      ['#E8E2D6', 2.2, 'dominant'],
      ['#C98A7A', 0.7, 'support'],
      ['#6E8B8A', 0.6, 'signal'],
      ['#3B3A35', 0.5],
    ]),
  },
  {
    id: 'risograph-two-run',
    name: 'Risograph two-run',
    author: 'per',
    saves: 3100,
    category: 'editorial',
    blurb: 'Fluoro pink over teal, misregistered on purpose',
    publishedAt: ago(10),
    colors: weighted([
      ['#FF48A0', 1.6, 'dominant'],
      ['#00A6A6', 1.4, 'support'],
      ['#FAF6EC', 1, 'signal'],
    ]),
  },
  {
    id: 'harbour-crane',
    name: 'Harbour crane',
    author: 'esme',
    saves: 1340,
    category: 'urban',
    blurb: 'Safety orange as the only colour for a mile',
    publishedAt: ago(11),
    colors: weighted([
      ['#FF6A13', 1.7, 'dominant'],
      ['#5B6670', 1.3, 'support'],
      ['#1D2126', 1, 'signal'],
    ]),
  },
  {
    id: 'plum-dusk',
    name: 'Plum dusk',
    author: 'rio',
    saves: 2280,
    category: 'nature',
    blurb: 'Twelve minutes after sunset, facing east',
    publishedAt: ago(12),
    colors: weighted([
      ['#5B3E7A', 1.8, 'dominant'],
      ['#2A1B3D', 1.2, 'support'],
      ['#E3877F', 0.8, 'signal'],
      ['#F4D9C6', 0.5],
    ]),
  },
  {
    id: 'vhs-tracking',
    name: 'VHS tracking',
    author: 'bex',
    saves: 1910,
    category: 'archive',
    blurb: 'Chroma bleed from a tape played once too often',
    publishedAt: ago(13),
    colors: weighted([
      ['#2B1E4F', 1.7, 'dominant'],
      ['#00C2A8', 1.1, 'support'],
      ['#F25C7A', 1, 'signal'],
      ['#D8D2E0', 0.6],
    ]),
  },
  {
    id: 'linen-and-clay',
    name: 'Linen and clay',
    author: 'aya',
    saves: 760,
    category: 'editorial',
    blurb: 'A stylist’s flatlay with the contrast pulled out',
    publishedAt: ago(14),
    colors: weighted([
      ['#E6DACA', 2, 'dominant'],
      ['#B98D74', 1, 'support'],
      ['#7C6A5A', 0.8, 'signal'],
    ]),
  },
];
