import { makeColor, type Color, type Palette } from '@cw/domain';

/**
 * Seed content, transcribed from `Chroma Wave App.dc.html`.
 *
 * Every palette, name, hex and proportion below appears in the design document,
 * so the built screens can be compared against it directly. This is fixture
 * data for a local-first build with no server — it is written on first launch
 * and is fully editable and deletable afterwards.
 */

/** The document expresses strip proportions as flex ratios; weights must sum to 1. */
function weighted(entries: readonly [string, number, Color['role']][]): Color[] {
  const total = entries.reduce((sum, [, ratio]) => sum + ratio, 0);
  const swatches = entries.map(([hex, ratio, role]) =>
    makeColor(hex, Math.round((ratio / total) * 1000) / 1000, role),
  );
  // Push any rounding remainder onto the dominant swatch so the sum stays exact.
  const drift = 1 - swatches.reduce((sum, s) => sum + s.weight, 0);
  const first = swatches[0];
  if (!first) return swatches;
  return [
    { ...first, weight: Math.round((first.weight + drift) * 1000) / 1000 },
    ...swatches.slice(1),
  ];
}

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

export function seedPalettes(): Palette[] {
  return [
    {
      schemaVersion: 1,
      id: 'a0000000-0000-4000-8000-000000000001',
      name: 'Harbour dusk',
      createdAt: ago(2),
      capturedAt: ago(2),
      source: 'photo',
      // B2 states these shares explicitly: 38 / 24 / 18 / 12 / 8.
      colors: [
        makeColor('#7C5CFF', 0.38, 'dominant'),
        makeColor('#4A3AA8', 0.24, 'support'),
        makeColor('#22D3EE', 0.18, 'signal'),
        makeColor('#FF7A5C', 0.12),
        makeColor('#F1E7D6', 0.08),
      ],
      tags: ['dusk', 'urban', 'cool'],
      location: 'Oslo',
      photoUri: null,
      deltaE: 2.4,
      confidence: 0.94,
      space: 'srgb',
      tuned: false,
      setIds: [],
      isPinned: true,
    },
    {
      schemaVersion: 1,
      id: 'a0000000-0000-4000-8000-000000000002',
      name: 'Market awning',
      createdAt: ago(3),
      capturedAt: ago(3),
      source: 'photo',
      colors: weighted([
        ['#FFC24A', 2, 'dominant'],
        ['#FF7A5C', 1.3, 'support'],
        ['#8A3B2E', 1, 'signal'],
        ['#F1E7D6', 0.7, 'extra'],
      ]),
      tags: ['market', 'warm'],
      location: null,
      photoUri: null,
      deltaE: 3.1,
      confidence: 0.89,
      space: 'srgb',
      tuned: false,
      setIds: [],
      isPinned: false,
    },
    {
      schemaVersion: 1,
      id: 'a0000000-0000-4000-8000-000000000003',
      name: 'Pool tile',
      createdAt: ago(7),
      capturedAt: ago(7),
      source: 'photo',
      colors: weighted([
        ['#22D3EE', 2, 'dominant'],
        ['#0F6E7C', 1.3, 'support'],
        ['#EDEAE3', 1, 'signal'],
        ['#7C5CFF', 0.7, 'extra'],
      ]),
      tags: ['water', 'cool'],
      location: null,
      photoUri: null,
      deltaE: 1.9,
      confidence: 0.96,
      space: 'p3',
      tuned: false,
      setIds: [],
      isPinned: true,
    },
    {
      schemaVersion: 1,
      id: 'a0000000-0000-4000-8000-000000000004',
      name: 'Terracotta wall',
      createdAt: ago(14),
      capturedAt: ago(14),
      source: 'photo',
      colors: weighted([
        ['#C4623B', 2, 'dominant'],
        ['#F1E7D6', 1.3, 'support'],
        ['#5C3A2E', 1, 'signal'],
        ['#FFC24A', 0.7, 'extra'],
      ]),
      tags: ['earth', 'warm'],
      location: null,
      photoUri: null,
      deltaE: 2.8,
      confidence: 0.91,
      space: 'srgb',
      tuned: false,
      setIds: [],
      isPinned: false,
    },
  ];
}

/**
 * The trending feed used to live here as a third fixture list, which put two
 * catalogues of palettes in one file with no relationship between them. It is
 * now `@/data/trending`, read through `trendingRepository` — see that file for
 * why the feed is validated rather than imported directly.
 */

/** B1 · the live read strip, before a capture is committed. */
export const liveReadSample = ['#7C5CFF', '#4A3AA8', '#22D3EE', '#FF7A5C', '#F1E7D6'] as const;
