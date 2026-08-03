/**
 * The rules that keep a saved palette's photo alive.
 *
 * This is a data-loss guard, not a filesystem test: both capture paths hand back
 * a URI in a purgeable cache, and storing it verbatim meant every library card
 * eventually went blank while its palette record survived.
 */

/** An in-memory stand-in for the parts of `expo-file-system` this module uses. */
const mockFiles = new Set<string>();

jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(parent: { uri: string } | string, name: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = `${base}/${name}`;
    }
    create() {}
  }

  class File {
    uri: string;
    constructor(parent: { uri: string } | string, name?: string) {
      const base = typeof parent === 'string' ? parent : parent.uri;
      this.uri = name ? `${base}/${name}` : base;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    copy(destination: { uri: string }) {
      if (!mockFiles.has(this.uri)) throw new Error('source missing');
      mockFiles.add(destination.uri);
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }

  return { Directory, File, Paths: { document: 'file:///documents', cache: 'file:///cache' } };
});

import { deletePhoto, persistPhoto } from './photos';

const CACHED = 'file:///cache/capture-9182.jpg';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

beforeEach(() => {
  mockFiles.clear();
  mockFiles.add(CACHED);
});

describe('persistPhoto', () => {
  it('moves a cached capture into the document directory under the palette id', () => {
    const stored = persistPhoto(CACHED, A);

    expect(stored).toBe(`file:///documents/palette-photos/${A}.jpg`);
    expect(mockFiles.has(stored!)).toBe(true);
  });

  it('keeps the extension, because the image decoder is chosen from it', () => {
    mockFiles.add('file:///cache/pick.png');
    expect(persistPhoto('file:///cache/pick.png', A)).toBe(
      `file:///documents/palette-photos/${A}.png`,
    );
  });

  it('is idempotent for the palette that already owns the file', () => {
    const first = persistPhoto(CACHED, A);
    // Re-saving a palette — a rename, a pin — must not copy the photo onto itself.
    expect(persistPhoto(first, A)).toBe(first);
  });

  it('gives a duplicate its own copy rather than sharing the original', () => {
    const original = persistPhoto(CACHED, A);
    const copy = persistPhoto(original, B);

    expect(copy).not.toBe(original);
    expect(mockFiles.has(original!)).toBe(true);
    expect(mockFiles.has(copy!)).toBe(true);

    // Deleting the original must leave the duplicate's photo intact — sharing
    // one file would have taken both.
    deletePhoto(original);
    expect(mockFiles.has(original!)).toBe(false);
    expect(mockFiles.has(copy!)).toBe(true);
  });

  it('passes a null through and leaves a vanished source alone', () => {
    expect(persistPhoto(null, A)).toBeNull();
    // The cache can be purged between capture and save; returning the original
    // keeps the save working rather than failing it over a missing thumbnail.
    expect(persistPhoto('file:///cache/gone.jpg', A)).toBe('file:///cache/gone.jpg');
  });
});

describe('deletePhoto', () => {
  it('ignores anything outside the folder it owns', () => {
    // A seeded palette points at a bundled asset, and a capture that failed to
    // persist still points at the cache. Neither is ours to delete.
    deletePhoto(CACHED);
    expect(mockFiles.has(CACHED)).toBe(true);
    expect(() => deletePhoto(null)).not.toThrow();
  });
});
