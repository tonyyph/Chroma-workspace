import {
  readAtmosphere,
  toChromaticMemory,
  unpairedPairing,
  emptyPersonalContext,
  makeColor,
  readWidgetSnapshotFile,
  withSelectedTrack,
  type ChromaticMemory,
  type ChromaticMemoryDraft,
  type MusicTrackReference,
} from '@cw/domain';
import type { KeyValueStorage } from '@/infrastructure/KeyValueStorage';
import {
  LAST_PUBLISHED_KEY,
  SNAPSHOT_FILE_NAME,
  unavailableContainer,
  WidgetSnapshotWriter,
  type SharedContainer,
} from './WidgetSnapshotWriter';

const NOW = '2026-08-10T12:00:00.000Z';
const idAt = (index: number) => `1111111${index}-1111-4111-8111-111111111111`;

const colors = [
  makeColor('#7C5CFF', 0.5, 'dominant'),
  makeColor('#4A3AA8', 0.3, 'support'),
  makeColor('#22D3EE', 0.2, 'signal'),
];

const memoryOf = (id = idAt(1), overrides: Partial<ChromaticMemoryDraft> = {}): ChromaticMemory => {
  const draft: ChromaticMemoryDraft = {
    image: {
      grade: null,
      localUri: 'file:///photos/a.jpg',
      width: 3000,
      height: 4000,
      source: 'photo-library',
      thumbnailUri: 'file:///photos/a-thumb.jpg',
      ...overrides.image,
    },
    palette: {
      colors,
      deltaE: 2.4,
      confidence: 0.94,
      space: 'srgb',
      tuned: false,
      source: 'photo',
    },
    atmosphere: readAtmosphere(colors, 2.4),
    visualAnalysis: null,
    pairing: unpairedPairing,
    personalContext: emptyPersonalContext,
    capturedAt: NOW,
    ...overrides,
  };
  const result = toChromaticMemory(draft, { id, now: NOW });
  if (!result.success) throw new Error('fixture did not validate');
  return result.data;
};

const track: MusicTrackReference = {
  provider: 'itunes',
  providerTrackId: '12345',
  title: 'Nightswimming',
  artist: 'R.E.M.',
  album: null,
  artworkUrl: null,
  durationMs: null,
  isrc: null,
  genres: ['Alternative'],
  releaseYear: null,
  externalUrl: null,
  attribution: 'Preview via Apple Music',
};

/** An in-memory App Group container. */
function fakeContainer(overrides: Partial<SharedContainer> = {}) {
  const files = new Map<string, string>();
  const copies: string[] = [];
  let pruned: readonly string[] | null = null;

  const container: SharedContainer = {
    available: true,
    read: (path) => files.get(path) ?? null,
    write: (path, contents) => void files.set(path, contents),
    copyIn: (source, path) => {
      copies.push(`${source}→${path}`);
      files.set(path, 'binary');
      return true;
    },
    prune: (keep) => void (pruned = keep),
    ...overrides,
  };

  return {
    container,
    files,
    copies,
    get pruned() {
      return pruned;
    },
  };
}

function fakeStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  };
}

function fakeReloader() {
  let count = 0;
  return {
    reload: () => {
      count += 1;
    },
    get count() {
      return count;
    },
  };
}

describe('WidgetSnapshotWriter', () => {
  it('publishes a file the extension reader accepts', async () => {
    const { container, files } = fakeContainer();
    const writer = new WidgetSnapshotWriter(container, fakeReloader(), fakeStorage());

    const result = await writer.sync([memoryOf()], 'chroma', NOW);

    expect(result.status).toBe('written');
    const published = readWidgetSnapshotFile(files.get(SNAPSHOT_FILE_NAME));
    expect(published.status).toBe('ok');
    if (published.status !== 'ok') return;
    expect(published.file.entries).toHaveLength(1);
    expect(published.file.skin).toBe('chroma');
  });

  it('copies the thumbnail rather than the full frame', async () => {
    const { container, copies } = fakeContainer();
    const writer = new WidgetSnapshotWriter(container, fakeReloader(), fakeStorage());

    await writer.sync([memoryOf()], 'chroma', NOW);

    expect(copies).toHaveLength(1);
    expect(copies[0]).toContain('a-thumb.jpg');
    expect(copies[0]).not.toContain('/a.jpg→');
  });

  it('falls back to the original frame when there is no thumbnail', async () => {
    const { container, copies } = fakeContainer();
    const writer = new WidgetSnapshotWriter(container, fakeReloader(), fakeStorage());

    await writer.sync(
      [
        memoryOf(idAt(1), {
          image: {
            grade: null,
            localUri: 'file:///photos/a.jpg',
            width: 100,
            height: 100,
            source: 'camera',
            thumbnailUri: null,
          },
        }),
      ],
      'chroma',
      NOW,
    );

    expect(copies[0]).toContain('/a.jpg');
  });

  it('nulls the image path when the copy fails, rather than naming a missing file', async () => {
    const { container, files } = fakeContainer({ copyIn: () => false });
    const writer = new WidgetSnapshotWriter(container, fakeReloader(), fakeStorage());

    const result = await writer.sync([memoryOf()], 'chroma', NOW);
    expect(result).toMatchObject({ status: 'written', images: 0 });

    const published = readWidgetSnapshotFile(files.get(SNAPSHOT_FILE_NAME));
    if (published.status !== 'ok') throw new Error('expected a readable file');
    expect(published.file.entries[0]!.imagePath).toBeNull();
  });

  it('reloads the timeline exactly once for a real change', async () => {
    const { container } = fakeContainer();
    const reloader = fakeReloader();
    const writer = new WidgetSnapshotWriter(container, reloader, fakeStorage());

    await writer.sync([memoryOf()], 'chroma', NOW);

    expect(reloader.count).toBe(1);
  });

  /** The whole reason `snapshotChanged` exists: WidgetKit rations reloads. */
  it('does not reload when nothing a widget renders has changed', async () => {
    const { container } = fakeContainer();
    const reloader = fakeReloader();
    const storage = fakeStorage();
    const writer = new WidgetSnapshotWriter(container, reloader, storage);

    await writer.sync([memoryOf()], 'chroma', NOW);
    const second = await writer.sync([memoryOf()], 'chroma', '2026-08-11T09:00:00.000Z');

    expect(second).toEqual({ status: 'unchanged' });
    expect(reloader.count).toBe(1);
  });

  it('reloads when a memory gains a track', async () => {
    const { container } = fakeContainer();
    const reloader = fakeReloader();
    const writer = new WidgetSnapshotWriter(container, reloader, fakeStorage());

    await writer.sync([memoryOf()], 'chroma', NOW);
    await writer.sync([withSelectedTrack(memoryOf(), track, NOW)], 'chroma', NOW);

    expect(reloader.count).toBe(2);
  });

  it('reloads when the skin changes', async () => {
    const { container } = fakeContainer();
    const reloader = fakeReloader();
    const writer = new WidgetSnapshotWriter(container, reloader, fakeStorage());

    await writer.sync([memoryOf()], 'chroma', NOW);
    await writer.sync([memoryOf()], 'swiss', NOW);

    expect(reloader.count).toBe(2);
  });

  it('republishes when the remembered file is unreadable', async () => {
    const { container } = fakeContainer();
    const reloader = fakeReloader();
    const storage = fakeStorage();
    storage.data.set(LAST_PUBLISHED_KEY, '{"schemaVersion":99}');

    const writer = new WidgetSnapshotWriter(container, reloader, storage);
    expect((await writer.sync([memoryOf()], 'chroma', NOW)).status).toBe('written');
    expect(reloader.count).toBe(1);
  });

  it('prunes images no published entry refers to', async () => {
    const fake = fakeContainer();
    const writer = new WidgetSnapshotWriter(fake.container, fakeReloader(), fakeStorage());

    await writer.sync([memoryOf(idAt(1)), memoryOf(idAt(2))], 'chroma', NOW);

    expect(fake.pruned).toEqual([`widget/${idAt(1)}.jpg`, `widget/${idAt(2)}.jpg`]);
  });

  it('does nothing at all when there is no shared container', async () => {
    const reloader = fakeReloader();
    const writer = new WidgetSnapshotWriter(unavailableContainer, reloader, fakeStorage());

    expect(await writer.sync([memoryOf()], 'chroma', NOW)).toEqual({ status: 'unavailable' });
    expect(reloader.count).toBe(0);
  });

  /** A save must never fail because a widget could not be updated. */
  it('reports a container failure instead of throwing', async () => {
    const { container } = fakeContainer({
      write: () => {
        throw new Error('disk full');
      },
    });
    const writer = new WidgetSnapshotWriter(container, fakeReloader(), fakeStorage());

    const result = await writer.sync([memoryOf()], 'chroma', NOW);
    expect(result).toEqual({ status: 'failed', reason: 'disk full' });
  });

  it('publishes an empty file for an empty library', async () => {
    const { container, files } = fakeContainer();
    const writer = new WidgetSnapshotWriter(container, fakeReloader(), fakeStorage());

    expect((await writer.sync([], 'chroma', NOW)).status).toBe('written');
    const published = readWidgetSnapshotFile(files.get(SNAPSHOT_FILE_NAME));
    if (published.status !== 'ok') throw new Error('expected a readable file');
    expect(published.file.entries).toEqual([]);
  });

  describe('clear', () => {
    it('empties the container and forgets what was published', async () => {
      const fake = fakeContainer();
      const reloader = fakeReloader();
      const storage = fakeStorage();
      const writer = new WidgetSnapshotWriter(fake.container, reloader, storage);

      await writer.sync([memoryOf()], 'chroma', NOW);
      await writer.clear();

      expect(fake.files.get(SNAPSHOT_FILE_NAME)).toBe('');
      expect(fake.pruned).toEqual([]);
      expect(storage.data.has(LAST_PUBLISHED_KEY)).toBe(false);
      expect(reloader.count).toBe(2);
    });

    it('is a no-op without a container', async () => {
      const reloader = fakeReloader();
      const writer = new WidgetSnapshotWriter(unavailableContainer, reloader, fakeStorage());
      await writer.clear();
      expect(reloader.count).toBe(0);
    });
  });
});
