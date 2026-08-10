import { musicTrackReferenceSchema, type MusicSearchQuery } from '@chromawave/domain';
import { ITUNES_ATTRIBUTION, ITunesMusicProvider } from './ITunesMusicProvider';

const query = (terms: string, overrides: Partial<MusicSearchQuery> = {}): MusicSearchQuery => ({
  terms,
  genre: null,
  limit: 25,
  market: 'VN',
  ...overrides,
});

/** A realistic row, trimmed to the fields the adapter reads. */
const row = (overrides: Record<string, unknown> = {}) => ({
  trackId: 1440857781,
  trackName: 'Nightswimming',
  artistName: 'R.E.M.',
  collectionName: 'Automatic for the People',
  artworkUrl100: 'https://example.test/a/100x100bb.jpg',
  previewUrl: 'https://audio.example.test/preview.m4a',
  primaryGenreName: 'Alternative',
  releaseDate: '1992-10-05T07:00:00Z',
  trackViewUrl: 'https://music.apple.com/track/1440857781',
  trackTimeMillis: 256_000,
  ...overrides,
});

const respond = (results: unknown[]) =>
  jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ results }) })) as never;

const signal = new AbortController().signal;

describe('ITunesMusicProvider', () => {
  it('normalises a provider row into a domain track', async () => {
    const provider = new ITunesMusicProvider(respond([row()]));
    const [track] = await provider.search([query('ambient')], signal);

    expect(musicTrackReferenceSchema.safeParse(track).success).toBe(true);
    expect(track).toMatchObject({
      provider: 'itunes',
      providerTrackId: '1440857781',
      title: 'Nightswimming',
      artist: 'R.E.M.',
      album: 'Automatic for the People',
      genres: ['Alternative'],
      releaseYear: 1992,
      durationMs: 256_000,
    });
  });

  it('attaches the attribution the licence requires to every track', async () => {
    const provider = new ITunesMusicProvider(respond([row(), row({ trackId: 2 })]));
    const tracks = await provider.search([query('ambient')], signal);

    expect(tracks).toHaveLength(2);
    for (const track of tracks) {
      expect(track.attribution).toBe(ITUNES_ATTRIBUTION);
      expect(track.externalUrl).toBeTruthy();
    }
  });

  it('never exposes a preview URL on the track model', async () => {
    const provider = new ITunesMusicProvider(respond([row()]));
    const [track] = await provider.search([query('ambient')], signal);

    // The reference is what gets persisted; a preview URL in it would be a dead
    // link in six months and a stored pointer to copyrighted audio today.
    expect(JSON.stringify(track)).not.toContain('preview.m4a');
    expect(Object.keys(track!)).not.toContain('previewUrl');
  });

  it('resolves a preview separately, from the search it already ran', async () => {
    const provider = new ITunesMusicProvider(respond([row()]));
    const [track] = await provider.search([query('ambient')], signal);
    const preview = await provider.getPreview(track!, signal);

    expect(preview).toEqual({
      url: 'https://audio.example.test/preview.m4a',
      durationMs: 30_000,
      expiresAt: null,
      providerSupplied: true,
    });
  });

  it('reports no preview rather than throwing when the catalogue offers none', async () => {
    const provider = new ITunesMusicProvider(respond([row({ previewUrl: undefined })]));
    const [track] = await provider.search([query('ambient')], signal);

    // A row with no clip is a normal catalogue condition, so the track still
    // exists and is still selectable — it just cannot be heard.
    expect(track).toBeDefined();
    expect(await provider.getPreview(track!, signal)).toBeNull();
  });

  it('drops unusable rows without losing the good ones', async () => {
    const provider = new ITunesMusicProvider(
      respond([
        row(),
        { trackName: 'No id' },
        { trackId: 3, artistName: 'No title' },
        row({ trackId: 4, trackName: 'Second' }),
      ]),
    );
    const tracks = await provider.search([query('ambient')], signal);
    expect(tracks.map((t) => t.providerTrackId)).toEqual(['1440857781', '4']);
  });

  it('deduplicates the same record surfacing from two queries', async () => {
    const provider = new ITunesMusicProvider(respond([row()]));
    const tracks = await provider.search([query('ambient'), query('downtempo')], signal);
    expect(tracks).toHaveLength(1);
  });

  it('asks for the market it was given, so a VN user gets the VN catalogue', async () => {
    const fetchImpl = respond([row()]);
    const provider = new ITunesMusicProvider(fetchImpl);
    await provider.search([query('ambient', { market: 'VN' })], signal);

    const url = String((fetchImpl as unknown as jest.Mock).mock.calls[0]![0]);
    expect(url).toContain('country=VN');
    expect(url).toContain('entity=song');
  });

  it('requests artwork large enough for a card', async () => {
    const provider = new ITunesMusicProvider(respond([row()]));
    const [track] = await provider.search([query('ambient')], signal);
    expect(track!.artworkUrl).toContain('600x600bb');
  });

  it('survives one failing query when another succeeds', async () => {
    let call = 0;
    const fetchImpl = jest.fn(async () => {
      call += 1;
      if (call === 1) throw new Error('network');
      return { ok: true, status: 200, json: async () => ({ results: [row()] }) };
    }) as never;

    const provider = new ITunesMusicProvider(fetchImpl);
    const tracks = await provider.search([query('a'), query('b')], signal);
    expect(tracks).toHaveLength(1);
  });

  it('fails when every query fails, rather than reporting an empty catalogue', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    }) as never;

    const provider = new ITunesMusicProvider(fetchImpl);
    // An empty result and a dead network mean different things to the user, and
    // collapsing them would show "no matches" to someone on a plane.
    await expect(provider.search([query('a')], signal)).rejects.toThrow();
  });

  it('treats a non-2xx response as a failure', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as never;

    const provider = new ITunesMusicProvider(fetchImpl);
    await expect(provider.search([query('a')], signal)).rejects.toThrow(/503/);
  });

  it('tolerates a payload that is not the shape it expects', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: 'not an array' }),
    })) as never;

    const provider = new ITunesMusicProvider(fetchImpl);
    expect(await provider.search([query('a')], signal)).toEqual([]);
  });

  it('opens the store link, and does nothing when there is none', async () => {
    const openUrl = jest.fn(async () => undefined);
    const provider = new ITunesMusicProvider(respond([row()]), openUrl);
    const [track] = await provider.search([query('ambient')], signal);

    await provider.openExternal(track!);
    expect(openUrl).toHaveBeenCalledWith('https://music.apple.com/track/1440857781');

    openUrl.mockClear();
    await provider.openExternal({ ...track!, externalUrl: null });
    expect(openUrl).not.toHaveBeenCalled();
  });
});
