import {
  makeColor,
  paletteToMemory,
  withSelectedTrack,
  type MusicTrackReference,
  type Palette,
} from '@chromawave/domain';
import type { KeyValueStorage } from './KeyValueStorage';
import { MemoryBackedPaletteRepository } from './MemoryBackedPaletteRepository';
import { StoredMemoryRepository } from './StoredMemoryRepository';

jest.mock('@/lib/photos', () => ({ deletePhoto: jest.fn() }));

class MapStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const uuid = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;

const palette = (n: number, overrides: Partial<Palette> = {}): Palette => ({
  schemaVersion: 1,
  id: uuid(n),
  name: `Capture ${n}`,
  createdAt: '2026-08-01T00:00:00.000Z',
  capturedAt: '2026-08-01T00:00:00.000Z',
  source: 'photo',
  colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
  tags: [],
  location: null,
  photoUri: 'file:///photos/a.jpg',
  deltaE: 2,
  confidence: 0.9,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
  ...overrides,
});

const track: MusicTrackReference = {
  provider: 'itunes',
  providerTrackId: '99',
  title: 'Nightswimming',
  artist: 'R.E.M.',
  album: null,
  artworkUrl: null,
  durationMs: 256_000,
  isrc: null,
  genres: ['Alternative'],
  releaseYear: 1992,
  externalUrl: 'https://music.apple.com/track/99',
  attribution: 'Preview via Apple Music',
};

const build = () => {
  const storage = new MapStorage();
  const memories = new StoredMemoryRepository(storage);
  return { storage, memories, palettes: new MemoryBackedPaletteRepository(memories) };
};

describe('MemoryBackedPaletteRepository', () => {
  it('serves the v1 shape from v2 storage', async () => {
    const { memories, palettes } = build();
    await memories.save(paletteToMemory(palette(1)));

    expect(await palettes.get(uuid(1))).toEqual(palette(1));
    expect(await palettes.list()).toEqual([palette(1)]);
  });

  it('widens a palette that storage has never seen', async () => {
    const { memories, palettes } = build();
    await palettes.save(palette(1));

    const memory = await memories.get(uuid(1));
    expect(memory).not.toBeNull();
    expect(memory!.musicPairing.status).toBe('unpaired');
  });

  /**
   * The reason this class patches instead of replacing. A colour tool saving a
   * retuned palette must not silently drop the music, the note, or the frame.
   */
  it('keeps the music when a colour tool saves a retuned palette', async () => {
    const { memories, palettes } = build();
    const paired = withSelectedTrack(paletteToMemory(palette(1)), track);
    await memories.save(paired);

    const retuned: Palette = {
      ...palette(1),
      colors: [makeColor('#FF7A5C', 0.7, 'dominant'), makeColor('#F1E7D6', 0.3, 'support')],
      tuned: true,
    };
    await palettes.save(retuned);

    const after = await memories.get(uuid(1));
    expect(after!.musicPairing.selectedTrack).toEqual(track);
    expect(after!.musicPairing.status).toBe('paired');
    expect(after!.palette.colors[0]!.hex).toBe('#FF7A5C');
    expect(after!.palette.tuned).toBe(true);
  });

  it('keeps the note and the visual analysis a palette cannot express', async () => {
    const { memories, palettes } = build();
    const base = paletteToMemory(palette(1));
    await memories.save({
      ...base,
      personalContext: { ...base.personalContext, note: 'The harbour at dusk.' },
    });

    await palettes.save({ ...palette(1), name: 'Renamed' });

    const after = await memories.get(uuid(1));
    expect(after!.personalContext.note).toBe('The harbour at dusk.');
    expect(after!.personalContext.title).toBe('Renamed');
  });

  it('re-reads the atmosphere when the colours change, so filters do not go stale', async () => {
    const { memories, palettes } = build();
    await memories.save(paletteToMemory(palette(1)));
    const before = (await memories.get(uuid(1)))!;

    await palettes.save({
      ...palette(1),
      colors: [makeColor('#FFF4E0', 0.6, 'dominant'), makeColor('#FFE0B0', 0.4, 'support')],
    });

    const after = (await memories.get(uuid(1)))!;
    expect(after.atmosphere.luminosity).toBeGreaterThan(before.atmosphere.luminosity);
    // The denormalised facet moved with it. A stale facet is a filter that lies.
    expect(after.facets.luminosity).toBe(after.atmosphere.luminosity);
    expect(after.facets.dominantHex).toBe('#FFF4E0');
  });

  it('does not erase the photograph when a projected palette carries none', async () => {
    const { memories, palettes } = build();
    await memories.save(paletteToMemory(palette(1)));

    // A view that does not model an image is not a request to delete the image.
    await palettes.save({ ...palette(1), photoUri: null });

    expect((await memories.get(uuid(1)))!.image.localUri).toBe('file:///photos/a.jpg');
  });

  it('adopts a genuinely different photograph', async () => {
    const { memories, palettes } = build();
    await memories.save(paletteToMemory(palette(1)));

    await palettes.save({ ...palette(1), photoUri: 'file:///photos/b.jpg' });

    expect((await memories.get(uuid(1)))!.image.localUri).toBe('file:///photos/b.jpg');
  });

  it('carries pin and collection membership both ways', async () => {
    const { memories, palettes } = build();
    await memories.save(paletteToMemory(palette(1)));

    await palettes.save({ ...palette(1), isPinned: true, setIds: [uuid(7)] });

    const memory = (await memories.get(uuid(1)))!;
    expect(memory.isPinned).toBe(true);
    expect(memory.collectionIds).toEqual([uuid(7)]);
    expect((await palettes.get(uuid(1)))!.setIds).toEqual([uuid(7)]);
  });

  it('removes the memory behind the palette', async () => {
    const { memories, palettes } = build();
    await palettes.save(palette(1));
    await palettes.remove(uuid(1));

    expect(await memories.list()).toEqual([]);
    expect(await palettes.get(uuid(1))).toBeNull();
  });

  it('returns null for an id it does not hold', async () => {
    const { palettes } = build();
    expect(await palettes.get(uuid(42))).toBeNull();
  });
});
