import { describe, expect, it } from 'vitest';

import { readAtmosphere } from './atmosphere';
import { contrastRatio } from './color';
import {
  emptyPersonalContext,
  LEGACY_IMAGE_URI,
  toChromaticMemory,
  withSelectedTrack,
  type ChromaticMemory,
  type ChromaticMemoryDraft,
} from './memory';
import { unpairedPairing, type MusicTrackReference } from './music';
import { makeColor } from './palette';
import {
  buildWidgetSnapshotFile,
  emptyWidgetSnapshotFile,
  parseDeepLink,
  readWidgetSnapshotFile,
  snapshotChanged,
  toDeepLink,
  toWidgetSnapshot,
  widgetSnapshotFileSchema,
  WIDGET_SNAPSHOT_BANDS,
  WIDGET_SNAPSHOT_CAPACITY,
  WIDGET_SNAPSHOT_VERSION,
} from './snapshot';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-10T12:00:00.000Z';

const colors = [
  makeColor('#7C5CFF', 0.5, 'dominant'),
  makeColor('#4A3AA8', 0.3, 'support'),
  makeColor('#22D3EE', 0.2, 'signal'),
];

const draft = (overrides: Partial<ChromaticMemoryDraft> = {}): ChromaticMemoryDraft => ({
  image: {
    localUri: 'file:///photos/a.jpg',
    width: 3000,
    height: 4000,
    source: 'photo-library',
    thumbnailUri: null,
  },
  palette: { colors, deltaE: 2.4, confidence: 0.94, space: 'srgb', tuned: false, source: 'photo' },
  atmosphere: readAtmosphere(colors, 2.4),
  visualAnalysis: null,
  pairing: unpairedPairing,
  personalContext: emptyPersonalContext,
  capturedAt: NOW,
  ...overrides,
});

const memoryOf = (
  overrides: Partial<ChromaticMemoryDraft> = {},
  id = ID,
  capturedAt = NOW,
): ChromaticMemory => {
  const result = toChromaticMemory(draft({ capturedAt, ...overrides }), { id, now: NOW });
  if (!result.success) throw new Error('fixture did not validate');
  return result.data;
};

const track: MusicTrackReference = {
  provider: 'itunes',
  providerTrackId: '12345',
  title: 'Nightswimming',
  artist: 'R.E.M.',
  album: 'Automatic for the People',
  artworkUrl: 'https://example.test/art.jpg',
  durationMs: 256_000,
  isrc: null,
  genres: ['Alternative'],
  releaseYear: 1992,
  externalUrl: 'https://music.apple.com/track/12345',
  attribution: 'Preview via Apple Music',
};

const idAt = (index: number) => `1111111${index}-1111-4111-8111-111111111111`;

/* ------------------------------------------------------------- deep links */

describe('deep links', () => {
  it('round-trips every target', () => {
    const links = [
      { target: 'memory', memoryId: ID },
      { target: 'pair', memoryId: ID },
      { target: 'today' },
      { target: 'library' },
    ] as const;

    for (const link of links) {
      expect(parseDeepLink(toDeepLink(link))).toEqual(link);
    }
  });

  it('builds the scheme the app registered', () => {
    expect(toDeepLink({ target: 'memory', memoryId: ID })).toBe(`chromawave://memory/${ID}`);
  });

  it('encodes an id that would otherwise break the path', () => {
    const url = toDeepLink({ target: 'memory', memoryId: 'a/b c' });
    expect(url).not.toContain(' ');
    expect(parseDeepLink(url)).toEqual({ target: 'memory', memoryId: 'a/b c' });
  });

  it.each([
    ['a foreign scheme', 'https://memory/abc'],
    ['an unknown host', 'chromawave://settings/abc'],
    ['a memory with no id', 'chromawave://memory/'],
    ['a target that takes no id', 'chromawave://today/abc'],
    ['nonsense', 'not a url at all'],
    ['an empty string', ''],
  ])('refuses %s', (_label, url) => {
    expect(parseDeepLink(url)).toBeNull();
  });
});

/* -------------------------------------------------------------- projection */

describe('toWidgetSnapshot', () => {
  it('carries a destination for every memory', () => {
    expect(toWidgetSnapshot(memoryOf()).deepLink).toBe(`chromawave://memory/${ID}`);
  });

  it('precomputes an ink that actually reads on the dominant colour', () => {
    const snapshot = toWidgetSnapshot(memoryOf());
    expect(contrastRatio(snapshot.inkHex, snapshot.dominantHex)).toBeGreaterThanOrEqual(4.5);
  });

  it('precomputes a readable ink for a near-white palette too', () => {
    const pale = [
      makeColor('#FAFAF7', 0.6, 'dominant'),
      makeColor('#EFEDE6', 0.25, 'support'),
      makeColor('#E2DFD6', 0.15, 'signal'),
    ];
    const snapshot = toWidgetSnapshot(
      memoryOf({
        palette: {
          colors: pale,
          deltaE: 1.2,
          confidence: 0.9,
          space: 'srgb',
          tuned: false,
          source: 'photo',
        },
        atmosphere: readAtmosphere(pale, 1.2),
      }),
    );
    expect(contrastRatio(snapshot.inkHex, snapshot.dominantHex)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the widest bands and re-normalises them to sum to one', () => {
    const many = [
      makeColor('#111111', 0.05, 'extra'),
      makeColor('#222222', 0.3, 'dominant'),
      makeColor('#333333', 0.25, 'support'),
      makeColor('#444444', 0.2, 'signal'),
      makeColor('#555555', 0.1, 'extra'),
      makeColor('#666666', 0.06, 'extra'),
      makeColor('#777777', 0.04, 'extra'),
    ];
    const snapshot = toWidgetSnapshot(
      memoryOf({
        palette: {
          colors: many,
          deltaE: 3,
          confidence: 0.8,
          space: 'srgb',
          tuned: false,
          source: 'photo',
        },
        atmosphere: readAtmosphere(many, 3),
      }),
    );

    expect(snapshot.bands).toHaveLength(WIDGET_SNAPSHOT_BANDS);
    // The 0.05 and 0.04 bands are the ones dropped, not the 0.3.
    expect(snapshot.bands.map((band) => band.hex)).not.toContain('#777777');
    const total = snapshot.bands.reduce((sum, band) => sum + band.weight, 0);
    expect(Math.abs(total - 1)).toBeLessThan(0.01);
  });

  it('never carries the note, the title, the tags or the place', () => {
    const snapshot = toWidgetSnapshot(
      memoryOf({
        personalContext: {
          title: 'The night we left',
          note: 'I did not tell anyone where I was going.',
          mood: 'unmoored',
          tags: ['secret'],
          location: { name: 'Hà Nội' },
        },
      }),
    );

    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain('did not tell anyone');
    expect(serialised).not.toContain('The night we left');
    expect(serialised).not.toContain('Hà Nội');
    expect(serialised).not.toContain('secret');
  });

  it('shows no image path for a colour-only memory', () => {
    const snapshot = toWidgetSnapshot(
      memoryOf({
        image: {
          localUri: LEGACY_IMAGE_URI,
          width: 1,
          height: 1,
          source: 'legacy',
          thumbnailUri: null,
        },
      }),
    );
    expect(snapshot.imagePath).toBeNull();
    expect(snapshot.bands.length).toBeGreaterThan(0);
  });

  it('leaves the track fields null together when unpaired', () => {
    const snapshot = toWidgetSnapshot(memoryOf());
    expect(snapshot.trackTitle).toBeNull();
    expect(snapshot.trackArtist).toBeNull();
  });

  it('carries the track once one is chosen', () => {
    const snapshot = toWidgetSnapshot(withSelectedTrack(memoryOf(), track, NOW));
    expect(snapshot.trackTitle).toBe('Nightswimming');
    expect(snapshot.trackArtist).toBe('R.E.M.');
  });

  it('never carries a remote artwork url', () => {
    const snapshot = toWidgetSnapshot(withSelectedTrack(memoryOf(), track, NOW));
    expect(snapshot.artworkPath).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain('https://');
  });

  it('truncates a title too long for a widget without cutting mid-word', () => {
    const long = { ...track, title: 'A'.repeat(40) + ' ' + 'B'.repeat(60) };
    const snapshot = toWidgetSnapshot(withSelectedTrack(memoryOf(), long, NOW));
    expect(snapshot.trackTitle!.length).toBeLessThanOrEqual(80);
    expect(snapshot.trackTitle).toMatch(/…$/);
  });
});

/* --------------------------------------------------------------- the file */

describe('buildWidgetSnapshotFile', () => {
  it('orders most recently captured first', () => {
    const file = buildWidgetSnapshotFile(
      [
        memoryOf({}, idAt(1), '2026-01-01T00:00:00.000Z'),
        memoryOf({}, idAt(2), '2026-08-01T00:00:00.000Z'),
        memoryOf({}, idAt(3), '2026-04-01T00:00:00.000Z'),
      ],
      { skin: 'chroma', now: NOW },
    );
    expect(file.entries.map((entry) => entry.id)).toEqual([idAt(2), idAt(3), idAt(1)]);
  });

  it('caps the file at the rendering budget', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      memoryOf({}, idAt(index % 10), `2026-0${(index % 9) + 1}-01T00:00:00.000Z`),
    );
    expect(buildWidgetSnapshotFile(many, { skin: 'swiss' }).entries.length).toBe(
      WIDGET_SNAPSHOT_CAPACITY,
    );
  });

  it('produces a file that validates against its own schema', () => {
    const file = buildWidgetSnapshotFile([memoryOf()], { skin: 'chroma', now: NOW });
    expect(widgetSnapshotFileSchema.safeParse(file).success).toBe(true);
  });

  it('handles an empty library', () => {
    const file = buildWidgetSnapshotFile([], { skin: 'chroma', now: NOW });
    expect(file.entries).toEqual([]);
    expect(widgetSnapshotFileSchema.safeParse(file).success).toBe(true);
  });
});

/* ---------------------------------------------------------------- reading */

describe('readWidgetSnapshotFile', () => {
  const good = () => buildWidgetSnapshotFile([memoryOf()], { skin: 'chroma', now: NOW });

  it('reads a file it just wrote, from its JSON text', () => {
    const result = readWidgetSnapshotFile(JSON.stringify(good()));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.file.entries).toHaveLength(1);
    expect(result.dropped).toBe(0);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('reports %s as empty rather than corrupt', (_label, value) => {
    expect(readWidgetSnapshotFile(value).status).toBe('empty');
  });

  it('reports a truncated write as corrupt', () => {
    const result = readWidgetSnapshotFile('{"schemaVersion":1,"entr');
    expect(result).toEqual({ status: 'corrupt', reason: 'not-json' });
  });

  it('refuses a future version rather than guessing at it', () => {
    const future = { ...good(), schemaVersion: WIDGET_SNAPSHOT_VERSION + 1 };
    expect(readWidgetSnapshotFile(JSON.stringify(future))).toEqual({
      status: 'unsupported',
      found: WIDGET_SNAPSHOT_VERSION + 1,
    });
  });

  it('refuses a past version too', () => {
    expect(readWidgetSnapshotFile(JSON.stringify({ ...good(), schemaVersion: 0 }))).toEqual({
      status: 'unsupported',
      found: 0,
    });
  });

  it('reports a missing version as corrupt', () => {
    expect(readWidgetSnapshotFile(JSON.stringify({ entries: [] })).status).toBe('corrupt');
  });

  it('drops one bad entry and keeps the rest', () => {
    const file = buildWidgetSnapshotFile([memoryOf({}, idAt(1)), memoryOf({}, idAt(2))], {
      skin: 'chroma',
      now: NOW,
    });
    const damaged = {
      ...file,
      entries: [file.entries[0], { id: 'not-a-uuid' }, file.entries[1]],
    };

    const result = readWidgetSnapshotFile(JSON.stringify(damaged));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.file.entries).toHaveLength(2);
    expect(result.dropped).toBe(1);
  });

  it('reads the empty file as a valid, empty state', () => {
    const result = readWidgetSnapshotFile(JSON.stringify(emptyWidgetSnapshotFile('swiss', NOW)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.file.entries).toEqual([]);
    expect(result.file.skin).toBe('swiss');
  });

  it('rejects an array at the top level', () => {
    expect(readWidgetSnapshotFile('[]').status).toBe('corrupt');
  });
});

/* -------------------------------------------------------------- reloading */

describe('snapshotChanged', () => {
  const base = () => buildWidgetSnapshotFile([memoryOf()], { skin: 'chroma', now: NOW });

  it('asks for a reload when there was nothing before', () => {
    expect(snapshotChanged(null, base())).toBe(true);
  });

  it('does not ask for a reload when only the write time moved', () => {
    const previous = base();
    const next = { ...base(), updatedAt: '2026-08-11T09:00:00.000Z' };
    expect(snapshotChanged(previous, next)).toBe(false);
  });

  it('asks for a reload when a memory is paired', () => {
    const previous = base();
    const next = buildWidgetSnapshotFile([withSelectedTrack(memoryOf(), track, NOW)], {
      skin: 'chroma',
      now: NOW,
    });
    expect(snapshotChanged(previous, next)).toBe(true);
  });

  it('asks for a reload when the skin changes', () => {
    expect(
      snapshotChanged(base(), buildWidgetSnapshotFile([memoryOf()], { skin: 'swiss', now: NOW })),
    ).toBe(true);
  });

  it('asks for a reload when a memory is added', () => {
    const next = buildWidgetSnapshotFile([memoryOf({}, idAt(1)), memoryOf({}, idAt(2))], {
      skin: 'chroma',
      now: NOW,
    });
    expect(snapshotChanged(base(), next)).toBe(true);
  });
});

/* ------------------------------------------------- Swift Codable agreement */

/**
 * The contract with `Snapshot.swift`.
 *
 * Swift's synthesised `Decodable` fails the *whole* decode on a key it expects
 * and does not find, so a field that is sometimes omitted is a blank widget
 * rather than a missing line. These assertions are the ones that catch it: every
 * optional must serialise as an explicit `null`, and no value may be a type
 * Swift cannot decode into the property it was declared as.
 */
describe('Codable compatibility', () => {
  it('emits every key even when the value is absent', () => {
    const raw = JSON.parse(JSON.stringify(toWidgetSnapshot(memoryOf()))) as Record<string, unknown>;
    for (const key of [
      'id',
      'imagePath',
      'artworkPath',
      'bands',
      'dominantHex',
      'inkHex',
      'mood',
      'trackTitle',
      'trackArtist',
      'capturedAt',
      'deepLink',
    ]) {
      expect(Object.hasOwn(raw, key)).toBe(true);
    }
    expect(raw.imagePath).not.toBeUndefined();
    expect(raw.trackTitle).toBeNull();
  });

  it('survives a JSON round trip unchanged', () => {
    const file = buildWidgetSnapshotFile([withSelectedTrack(memoryOf(), track, NOW)], {
      skin: 'chroma',
      now: NOW,
    });
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });

  it('stays small enough to read on a timeline request', () => {
    const full = Array.from({ length: WIDGET_SNAPSHOT_CAPACITY }, (_, index) =>
      withSelectedTrack(memoryOf({}, idAt(index)), track, NOW),
    );
    const bytes = JSON.stringify(buildWidgetSnapshotFile(full, { skin: 'chroma' })).length;
    // A full file is a few kilobytes. The ceiling is loose on purpose — it is
    // there to catch a field that accidentally carries a base64 image, not to
    // police byte counts.
    expect(bytes).toBeLessThan(16_384);
  });
});
