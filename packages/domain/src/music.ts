import { z } from 'zod';

import { musicFeedbackSchema } from './feedback';
import { musicIntentSchema, type MusicIntent } from './intent';

/**
 * Music, as the domain sees it: never as a provider sees it.
 *
 * Every adapter maps its own payload into these shapes at the edge, and nothing
 * provider-shaped is allowed past that line — no `wrapperType`, no
 * `collectionName`, no `spotify:track:` URI. That boundary is what makes the
 * provider decision reversible, and it has already had to be: Spotify removed
 * 30-second preview access for new applications on 2024-11-27, which retired the
 * adapter most designs would have been built around. See docs/07.
 */

export const musicProviderIds = ['itunes', 'appleMusic', 'deezer', 'none'] as const;
export const musicProviderIdSchema = z.enum(musicProviderIds);
export type MusicProviderId = z.infer<typeof musicProviderIdSchema>;

export const musicTrackReferenceSchema = z.object({
  provider: musicProviderIdSchema,
  /** The provider's own identifier. Opaque here, by design. */
  providerTrackId: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  album: z.string().max(200).nullable(),
  artworkUrl: z.string().url().nullable(),
  durationMs: z.number().int().positive().nullable(),
  /**
   * The one identifier that means the same thing to every provider, when the
   * provider gives it. It is what would let a memory paired on one service be
   * re-resolved on another.
   */
  isrc: z.string().length(12).nullable(),
  genres: z.array(z.string().min(1).max(32)).max(5),
  releaseYear: z.number().int().min(1900).max(2100).nullable(),
  /** Where the user goes to hear the whole thing, legally. */
  externalUrl: z.string().url().nullable(),
  /**
   * The credit the provider's terms require on screen.
   *
   * Carried on the model rather than looked up by the view, because a screen
   * that forgets to render attribution is a licence breach, and the reliable
   * way to stop that is to make the text arrive attached to the data.
   */
  attribution: z.string().min(1).max(80),
});

export type MusicTrackReference = z.infer<typeof musicTrackReferenceSchema>;

/**
 * A playable excerpt, resolved at playback time and **never persisted**.
 *
 * Preview URLs are temporary and provider-controlled, and in some cases signed.
 * Writing one to disk buys a dead link in six months and, worse, means the app
 * is storing a durable pointer to copyrighted audio. `ChromaticMemory` therefore
 * stores the track *reference* and re-resolves the preview on demand; a test
 * asserts no audio URL ever appears in a serialised memory.
 *
 * There is no schema here because nothing validates it on the way out of
 * storage — it never goes into storage.
 */
export type MusicPreview = {
  url: string;
  durationMs: number;
  /** When the provider says this stops working. Null means unstated, not forever. */
  expiresAt: string | null;
  /**
   * Always true, and always literal.
   *
   * A preview exists because a provider handed us one. There is no branch of
   * this product that constructs, trims, or hosts audio, and the type says so
   * loudly enough that adding one would be a visible change.
   */
  providerSupplied: true;
};

/** Why a candidate cannot be heard. Shown to the user; never hidden as a spinner. */
export const previewUnavailableReasons = [
  'not-offered',
  'expired',
  'region-restricted',
  'network',
] as const;
export type PreviewUnavailableReason = (typeof previewUnavailableReasons)[number];

/**
 * The dimensions a match can be justified by.
 *
 * Structured before prose, for four reasons that all matter: it translates into
 * Vietnamese as a template rather than as machine-translated English; it renders
 * as indicators as well as a sentence; it is unit-testable; and it can be
 * written without a language model.
 *
 * Every kind here is something the pipeline *measured*. There is deliberately no
 * `tempo` or `danceability`: the catalogue APIs available to us do not report
 * them, and citing a number we did not measure would be the exact dishonesty
 * this product is built to avoid.
 */
export const recommendationReasonKinds = [
  'warmth',
  'energy',
  'luminosity',
  'pace',
  'texture',
  'genre',
  'era',
  'mood',
  'contrast',
] as const;

export const musicRecommendationReasonSchema = z.object({
  kind: z.enum(recommendationReasonKinds),
  /** −1 to 1. Negative means this dimension matched by contrast, not similarity. */
  weight: z.number().min(-1).max(1),
});

export type MusicRecommendationReason = z.infer<typeof musicRecommendationReasonSchema>;

export const musicRecommendationSchema = z.object({
  track: musicTrackReferenceSchema,
  rank: z.number().int().min(0).max(11),
  /** 0–1, from `ranking.ts`. Computed, never model-supplied. */
  score: z.number().min(0).max(1),
  reasons: z.array(musicRecommendationReasonSchema).min(1).max(4),
  /** Composed from `reasons` by default; replaced by a model when one is configured. */
  explanation: z.string().max(240),
  previewAvailable: z.boolean(),
});

export type MusicRecommendation = z.infer<typeof musicRecommendationSchema>;

/**
 * A search a provider can actually answer.
 *
 * Keyword terms rather than feature ranges, because that is what the catalogues
 * we can legally use expose. Spotify's feature-based recommendation endpoint —
 * the one that would have taken valence and energy directly — is also closed to
 * new applications, so the honest shape of this type is a query string.
 */
export const musicSearchQuerySchema = z.object({
  terms: z.string().min(1).max(120),
  genre: z.string().max(32).nullable(),
  limit: z.number().int().min(1).max(50),
  /** ISO 3166-1 alpha-2, from device locale, so a VN user gets the VN catalogue. */
  market: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
});

export type MusicSearchQuery = z.infer<typeof musicSearchQuerySchema>;

/**
 * A track, plus which of our genre queries surfaced it.
 *
 * The provenance matters because provider genre taxonomies are coarse. iTunes
 * files Slowdive and Cocteau Twins under "Alternative" and Tangerine Dream under
 * "Electronic", so comparing an intent's `shoegaze` against a track's
 * `primaryGenreName` almost never matches even when the track is exactly right.
 *
 * But we *know* it is right, because we asked for shoegaze and the catalogue
 * answered with this. That is a real signal and it is the strongest one
 * available, so it is carried rather than thrown away at the boundary.
 *
 * It is provenance, not provider data: `matchedGenre` is a term this app chose,
 * which is why it can sit in the domain without leaking a provider's schema.
 */
export type MusicSearchResult = {
  track: MusicTrackReference;
  /** The genre term whose query returned this, when a genre query did. */
  matchedGenre: string | null;
};

/**
 * An intent becomes one search per genre — each a **bare genre term**.
 *
 * **This is measured, not assumed.** Against the live iTunes catalogue on
 * 2026-08-10:
 *
 *   "shoegaze"          → Cocteau Twins · Slowdive · Mazzy Star · Massive Attack
 *   "krautrock"         → Faust · Cluster & Eno · Pink Floyd · Tangerine Dream
 *   "krautrock angular" → **zero results**
 *   "mid tempo krautrock" → **zero results**
 *
 * The first version of this function issued exactly those compound queries. Two
 * of its three searches returned nothing, and the survivor was the one query
 * that happened to be a bare genre — so the product was ranking whatever filler
 * a single accidental query returned and calling it a recommendation.
 *
 * The lesson generalises past iTunes: these catalogues match keywords against
 * *title and artist text*, not against a semantic index. Adding a texture word
 * does not narrow the genre, it demands that the word appear in the title. A
 * genre name is the one term with enough curated weight behind it to return the
 * records people actually mean.
 *
 * So texture, pace, instrumentation and mood stay where they are useful — in the
 * intent, in the ranking, and in the sentence shown to the user — and out of the
 * query string entirely.
 *
 * Kept in the domain rather than in an adapter because the shape of the search
 * follows from the intent, and every provider would otherwise reinvent it
 * slightly differently, badly, in the same way.
 */
export function queriesForIntent(
  intent: MusicIntent,
  options: { market?: string | null; limit?: number } = {},
): readonly MusicSearchQuery[] {
  const market = options.market ?? null;
  const limit = options.limit ?? 25;

  // Three at most: enough breadth that a thin catalogue for the lead genre still
  // fills a screen, few enough to stay well inside the provider's rate limit.
  return intent.genres.slice(0, 3).map((genre) => ({
    terms: genre,
    genre,
    limit,
    market,
  }));
}

export const recommendationStatusSchema = z.enum([
  /** No attempt yet. A complete, legitimate memory — not an error. */
  'unpaired',
  /** In flight. Runtime only; never persisted. */
  'pending',
  /** Candidates exist, none chosen. */
  'suggested',
  /** A track is selected. */
  'paired',
  /** The chosen track no longer resolves. Metadata retained. */
  'unavailable',
  /** The last attempt failed. Retryable. */
  'failed',
]);

export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;

export const pairingErrorSchema = z.enum([
  'offline',
  'provider-unavailable',
  'provider-error',
  'no-results',
  'timeout',
  'not-configured',
]);

export type PairingError = z.infer<typeof pairingErrorSchema>;

export const musicPairingSchema = z.object({
  status: recommendationStatusSchema,
  selectedTrack: musicTrackReferenceSchema.nullable(),
  recommendations: z.array(musicRecommendationSchema).max(12),
  /** What we asked for, kept so a memory can explain itself later. */
  intent: musicIntentSchema.nullable(),
  /** "{intent}.{ranker}.{provider}" — which generation produced this pairing. */
  recommendationVersion: z.string().max(32).nullable(),
  feedback: z.array(musicFeedbackSchema).max(50),
  pairedAt: z.iso.datetime().nullable(),
  error: pairingErrorSchema.nullable(),
});

export type MusicPairing = z.infer<typeof musicPairingSchema>;

/** The zero value: what every migrated v1 palette gets, and it is a valid state. */
export const unpairedPairing: MusicPairing = {
  status: 'unpaired',
  selectedTrack: null,
  recommendations: [],
  intent: null,
  recommendationVersion: null,
  feedback: [],
  pairedAt: null,
  error: null,
};

/**
 * The whole surface a music service must implement.
 *
 * Four methods, chosen so that no part of the app needs to know which service is
 * behind them. `getPreview` returns null rather than throwing when a track has
 * no excerpt, because that is a normal catalogue condition and not an error —
 * treating it as an exception is how apps end up showing a play button that
 * cannot play.
 */
export interface MusicProvider {
  readonly id: MusicProviderId;
  /** Rendered on every card and every track block. A licence condition. */
  readonly attribution: string;
  search(
    queries: readonly MusicSearchQuery[],
    signal: AbortSignal,
  ): Promise<readonly MusicSearchResult[]>;
  getTrack(providerTrackId: string, signal: AbortSignal): Promise<MusicTrackReference | null>;
  getPreview(track: MusicTrackReference, signal: AbortSignal): Promise<MusicPreview | null>;
  openExternal(track: MusicTrackReference): Promise<void>;
}

/**
 * The provider that ships when nothing is configured.
 *
 * It reports honestly that pairing is unavailable. It does **not** return
 * plausible-looking songs: a fixture catalogue in a production build is a
 * non-playable mock presented as a finished feature, which is the one failure
 * this product cannot afford. Development fixtures exist, behind `__DEV__` and
 * an explicit flag, and a test asserts they are unreachable from here.
 */
export class UnconfiguredMusicProvider implements MusicProvider {
  readonly id = 'none' as const;
  readonly attribution = '';
  async search(): Promise<readonly MusicSearchResult[]> {
    return [];
  }
  async getTrack(): Promise<null> {
    return null;
  }
  async getPreview(): Promise<null> {
    return null;
  }
  async openExternal(): Promise<void> {
    /* nothing to open */
  }
}
