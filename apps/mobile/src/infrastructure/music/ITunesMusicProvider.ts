import {
  musicTrackReferenceSchema,
  type MusicPreview,
  type MusicProvider,
  type MusicSearchQuery,
  type MusicSearchResult,
  type MusicTrackReference,
} from '@cw/domain';
import { Linking } from 'react-native';

/**
 * The iTunes Search API.
 *
 * **Why this provider first.** It is the only catalogue that gives a new
 * application in 2026 a genuinely playable 30-second preview with *no* key, no
 * account, no backend and no native module — `fetch` and `expo-audio`, both
 * already in the app. Spotify removed preview access for applications registered
 * after 2024-11-27, and Apple Music's own API needs an ES256 developer token
 * signed with a private key that must never be in the bundle. See docs/07.
 *
 * **The condition attached to it.** Apple permits these previews and artwork to
 * *promote store content*, with sound samples kept proximate to a store badge.
 * That is why `attribution` and `externalUrl` are populated for every track and
 * carried on the model rather than looked up by a screen: a card that forgets to
 * render its store link is a licence problem, and the reliable way to stop that
 * is to make the link arrive attached to the data. A test asserts no
 * recommendation card renders without it.
 *
 * Audio is streamed from the provider's URL and never downloaded, trimmed,
 * cached to disk or re-hosted.
 */

const ENDPOINT = 'https://itunes.apple.com/search';

/** Apple documents roughly 20 requests per minute. Queries run in parallel, so
 *  the intent's query count is capped rather than the rate being managed. */
const MAX_PARALLEL_QUERIES = 3;

export const ITUNES_ATTRIBUTION = 'Preview via Apple Music';

/**
 * The fields we read. Everything else in the payload is ignored deliberately —
 * a provider shape must not leak past this file, so nothing here is re-exported.
 */
type ITunesResult = {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackViewUrl?: string;
  trackTimeMillis?: number;
};

export class ITunesMusicProvider implements MusicProvider {
  readonly id = 'itunes' as const;
  readonly attribution = ITUNES_ATTRIBUTION;

  /**
   * Preview URLs are resolved during search and held in memory only.
   *
   * They are never written to a `MusicTrackReference` and never persisted: a
   * stored preview URL is a dead link in six months and a durable pointer to
   * copyrighted audio today. A memory reopened later re-resolves through
   * `getPreview`.
   */
  private readonly previews = new Map<string, { url: string; durationMs: number }>();

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly openUrl: (url: string) => Promise<unknown> = (url) => Linking.openURL(url),
  ) {}

  async search(
    queries: readonly MusicSearchQuery[],
    signal: AbortSignal,
  ): Promise<readonly MusicSearchResult[]> {
    const settled = await Promise.allSettled(
      queries.slice(0, MAX_PARALLEL_QUERIES).map((query) => this.runQuery(query, signal)),
    );

    // Deduplicated across queries by provider id: two intent queries frequently
    // surface the same record, and the ranker should see it once. The first
    // query to find it keeps the provenance, which is the most specific genre
    // term that returned it since `queriesForIntent` orders them that way.
    const byId = new Map<string, MusicSearchResult>();
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      for (const result of outcome.value) {
        if (!byId.has(result.track.providerTrackId)) {
          byId.set(result.track.providerTrackId, result);
        }
      }
    }

    // Every query failing is a real failure; some failing is not. A partial
    // catalogue still gives the user a choice.
    if (byId.size === 0 && settled.every((outcome) => outcome.status === 'rejected')) {
      const [first] = settled;
      throw first && first.status === 'rejected' ? first.reason : new Error('Search failed.');
    }

    return [...byId.values()];
  }

  async getTrack(
    providerTrackId: string,
    signal: AbortSignal,
  ): Promise<MusicTrackReference | null> {
    const url = new URL('https://itunes.apple.com/lookup');
    url.searchParams.set('id', providerTrackId);
    url.searchParams.set('entity', 'song');

    const results = await this.request(url, signal);
    const track = results.map((result) => this.normalise(result)).find((entry) => entry !== null);
    return track ?? null;
  }

  async getPreview(track: MusicTrackReference, signal: AbortSignal): Promise<MusicPreview | null> {
    const known = this.previews.get(track.providerTrackId);
    if (known) {
      return {
        url: known.url,
        durationMs: known.durationMs,
        expiresAt: null,
        providerSupplied: true,
      };
    }

    // Re-resolve: a memory opened months later has no cached preview, and the
    // catalogue may have changed. A null here is a normal state — the card shows
    // "preview unavailable" and its store link, not an error.
    await this.getTrack(track.providerTrackId, signal);
    const resolved = this.previews.get(track.providerTrackId);
    return resolved
      ? {
          url: resolved.url,
          durationMs: resolved.durationMs,
          expiresAt: null,
          providerSupplied: true,
        }
      : null;
  }

  async openExternal(track: MusicTrackReference): Promise<void> {
    if (track.externalUrl === null) return;
    await this.openUrl(track.externalUrl).catch(() => undefined);
  }

  private async runQuery(
    query: MusicSearchQuery,
    signal: AbortSignal,
  ): Promise<MusicSearchResult[]> {
    const url = new URL(ENDPOINT);
    url.searchParams.set('media', 'music');
    url.searchParams.set('entity', 'song');
    url.searchParams.set('term', query.terms);
    url.searchParams.set('limit', String(query.limit));
    if (query.market) url.searchParams.set('country', query.market);

    const results = await this.request(url, signal);
    return results
      .map((result) => this.normalise(result))
      .filter((track): track is MusicTrackReference => track !== null)
      .map((track) => ({ track, matchedGenre: query.genre }));
  }

  private async request(url: URL, signal: AbortSignal): Promise<ITunesResult[]> {
    const response = await this.fetchImpl(url.toString(), { signal });
    if (!response.ok) {
      throw new Error(`iTunes search failed with ${response.status}.`);
    }
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null) return [];
    const results = (payload as { results?: unknown }).results;
    return Array.isArray(results) ? (results as ITunesResult[]) : [];
  }

  /**
   * Provider payload to domain model. The boundary.
   *
   * Returns null rather than throwing for an unusable record: a catalogue
   * response routinely contains rows missing a title or an id, and one bad row
   * must not lose the other twenty-four.
   */
  private normalise(result: ITunesResult): MusicTrackReference | null {
    if (
      typeof result.trackId !== 'number' ||
      typeof result.trackName !== 'string' ||
      typeof result.artistName !== 'string'
    ) {
      return null;
    }

    const providerTrackId = String(result.trackId);

    if (typeof result.previewUrl === 'string' && result.previewUrl.length > 0) {
      this.previews.set(providerTrackId, {
        url: result.previewUrl,
        // Apple's clips are ~30s. The player reads the real duration from the
        // asset once it loads; this is what the card can show before that.
        durationMs: 30_000,
      });
    }

    const candidate = {
      provider: 'itunes' as const,
      providerTrackId,
      title: result.trackName.slice(0, 200),
      artist: result.artistName.slice(0, 200),
      album: result.collectionName?.slice(0, 200) ?? null,
      // 100px is what the search API returns; the card asks for a larger render
      // of the same asset rather than storing a copy.
      artworkUrl: result.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null,
      durationMs: result.trackTimeMillis ?? null,
      isrc: null,
      genres: result.primaryGenreName ? [result.primaryGenreName.slice(0, 32)] : [],
      releaseYear: readYear(result.releaseDate),
      externalUrl: result.trackViewUrl ?? null,
      attribution: ITUNES_ATTRIBUTION,
    };

    // Validated at the boundary, not trusted. A provider that changes its shape
    // should produce fewer results, not corrupt records.
    const parsed = musicTrackReferenceSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  }
}

function readYear(releaseDate: string | undefined): number | null {
  if (!releaseDate) return null;
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(year) && year >= 1900 && year <= 2100 ? year : null;
}
