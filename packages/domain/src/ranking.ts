import type { AccumulatedPreference } from './feedback';
import { EMPTY_PREFERENCE } from './feedback';
import type { MusicIntent } from './intent';
import type {
  MusicRecommendation,
  MusicRecommendationReason,
  MusicSearchResult,
  MusicTrackReference,
} from './music';

/**
 * Turning a bag of search results into three to five things worth hearing.
 *
 * **What this is honest about.** The catalogues we can legally use expose
 * keyword search and metadata — title, artist, genre, year, duration — and
 * nothing else. Spotify's audio-features endpoint, which would have reported a
 * track's actual valence and energy, is closed to applications registered after
 * 2024-11-27 along with its previews. So ranking here scores *how well a
 * candidate answers the query the intent produced*, plus the metadata we really
 * received. It does not pretend to know a song's tempo.
 *
 * That constraint shapes what the user is told: the reasons on a card cite
 * colour, light, atmosphere and genre — the things we measured — and never a
 * fabricated audio feature. See docs/06 and docs/07.
 */

export const RANKING_WEIGHTS = {
  /** The candidate's genre appears in the intent's genre list. */
  genreMatch: 0.2,
  /** Genre appears, and it was the *lead* genre — the query that found it. */
  leadGenreBonus: 0.08,
  /** Era fits, when the intent asked for one. */
  eraMatch: 0.05,
  /** The device's own accumulated taste. Deliberately small. */
  preferenceBias: 0.1,
  /** A second track by an artist already in the list. */
  artistRepeat: 0.15,
  /** Previously turned down. Large enough to sink it, small enough not to hide it. */
  rejected: 0.5,
  /** Nothing to play is worse than something to play, but not disqualifying. */
  noPreview: 0.12,
  /**
   * The track's title echoes the genre we searched for.
   *
   * A keyword index cannot distinguish "this record belongs to the shoegaze
   * scene" from "this record has the word Dream in its title", and the second
   * kind arrives constantly: searching `dream pop` surfaced two K-pop singles
   * called "Dream", and `chamber music` returned four separate tracks actually
   * titled "Chamber Music". A song named after a genre is nearly always either a
   * novelty or a keyword-farmed upload — almost never the canonical record
   * someone meant.
   */
  titleEcho: 0.18,
} as const;

/**
 * How close a track's duration sits to what the intent's pace implies.
 *
 * The one genuine audio signal the catalogues give us. It is weak — a four-
 * minute song can be fast or slow — so it carries little weight and is never
 * cited as a reason on its own.
 */
const paceDurationFit = (intent: MusicIntent, durationMs: number | null): number => {
  if (durationMs === null) return 0.5;
  const minutes = durationMs / 60_000;
  const ideal = intent.pace === 'slow' ? 5.5 : intent.pace === 'medium' ? 4 : 3.2;
  return Math.max(0, 1 - Math.abs(minutes - ideal) / 4);
};

export type RankingInput = {
  intent: MusicIntent;
  /**
   * Accepts search results or bare tracks.
   *
   * A `MusicSearchResult` carries which genre query surfaced it, which is a far
   * better genre signal than the provider's own taxonomy — iTunes files Slowdive
   * under "Alternative", so comparing against `primaryGenreName` misses a match
   * the search itself already proved. Bare tracks are still accepted, for
   * re-ranking a stored set where that provenance is gone.
   */
  candidates: readonly (MusicSearchResult | MusicTrackReference)[];
  preference?: AccumulatedPreference;
  /** Which ids we could resolve a playable excerpt for. */
  previewAvailable?: ReadonlySet<string>;
  /** How many to return. The product shows a finite choice, not a catalogue. */
  limit?: number;
};

const asResult = (candidate: MusicSearchResult | MusicTrackReference): MusicSearchResult =>
  'track' in candidate ? candidate : { track: candidate, matchedGenre: null };

/**
 * Deterministic. Same input, same order, every time — which is what makes it
 * testable, and what makes "Try again" meaningful (the intent's seed changes,
 * so the *query* changes, so the candidates change).
 */
export function rankCandidates({
  intent,
  candidates,
  preference = EMPTY_PREFERENCE,
  previewAvailable,
  limit = 5,
}: RankingInput): readonly MusicRecommendation[] {
  const leadGenre = intent.genres[0]?.toLowerCase() ?? null;
  const intentGenres = new Set(intent.genres.map((genre) => genre.toLowerCase()));

  const scored = candidates.map(asResult).map(({ track, matchedGenre }) => {
    const trackGenres = track.genres.map((genre) => genre.toLowerCase());
    const surfacedBy = matchedGenre?.toLowerCase() ?? null;

    // Two independent ways a candidate can be the right genre: the provider says
    // so, or our own genre query returned it. The second is usually the reliable
    // one, because provider taxonomies are far coarser than the intent's terms.
    const taxonomyMatch = trackGenres.filter((genre) => intentGenres.has(genre));
    const searchMatch = surfacedBy !== null && intentGenres.has(surfacedBy);

    let score = 0.5;
    const reasons: MusicRecommendationReason[] = [];

    if (taxonomyMatch.length > 0 || searchMatch) {
      score += RANKING_WEIGHTS.genreMatch;
      reasons.push({ kind: 'genre', weight: 1 });
      if (leadGenre !== null && (taxonomyMatch.includes(leadGenre) || surfacedBy === leadGenre)) {
        score += RANKING_WEIGHTS.leadGenreBonus;
      }
    }

    if (intent.eras && track.releaseYear !== null && matchesEra(intent.eras, track.releaseYear)) {
      score += RANKING_WEIGHTS.eraMatch;
      reasons.push({ kind: 'era', weight: 1 });
    }

    // Duration fit contributes, but is never shown as a reason: a four-minute
    // track is not evidence of anything the user would recognise.
    score += (paceDurationFit(intent, track.durationMs) - 0.5) * 0.1;

    const bias = trackGenres.reduce(
      (sum, genre) => sum + (preference.genreWeights.get(genre) ?? 0),
      0,
    );
    if (bias !== 0) {
      score += Math.max(-1, Math.min(1, bias)) * RANKING_WEIGHTS.preferenceBias;
    }

    if (preference.rejectedTrackIds.has(track.providerTrackId)) {
      score -= RANKING_WEIGHTS.rejected;
    }

    if (surfacedBy !== null && titleEchoesGenre(track.title, surfacedBy)) {
      score -= RANKING_WEIGHTS.titleEcho;
    }

    const hasPreview = previewAvailable ? previewAvailable.has(track.providerTrackId) : true;
    if (!hasPreview) score -= RANKING_WEIGHTS.noPreview;

    return { track, score, reasons, hasPreview };
  });

  /**
   * Diversity is applied after scoring, not inside it.
   *
   * A penalty computed per candidate cannot know what else was selected, so a
   * greedy pass over the sorted list is what actually prevents three tracks by
   * the same artist. Ties broken by id so the order never depends on the
   * provider's response order.
   */
  const ordered = [...scored].sort(
    (left, right) =>
      right.score - left.score ||
      left.track.providerTrackId.localeCompare(right.track.providerTrackId),
  );

  const chosen: typeof ordered = [];
  const artistCount = new Map<string, number>();

  for (const entry of ordered) {
    if (chosen.length >= limit) break;
    const artist = entry.track.artist.toLowerCase();
    const seen = artistCount.get(artist) ?? 0;
    // One repeat is a coincidence; two is a search that collapsed onto one
    // record. Allow the second, refuse the third.
    if (seen >= 2) continue;
    artistCount.set(artist, seen + 1);
    chosen.push(entry);
  }

  // A short candidate pool can leave us under the limit after the diversity
  // pass. Backfill rather than show two cards, because the choice is the point.
  if (chosen.length < limit) {
    for (const entry of ordered) {
      if (chosen.length >= limit) break;
      if (!chosen.includes(entry)) chosen.push(entry);
    }
  }

  return chosen.map((entry, index) => ({
    track: entry.track,
    rank: index,
    score: clamp01(round3(entry.score)),
    reasons: withAtmosphereReasons(entry.reasons, intent),
    explanation: '',
    previewAvailable: entry.hasPreview,
  }));
}

/**
 * Every card needs at least one reason, and the schema enforces `min(1)`.
 *
 * A track matched purely by genre still matched *this* intent, and the intent
 * came from the photograph — so the strongest atmosphere dimensions are named
 * alongside it. These are the dimensions we genuinely measured, which is why
 * they can be stated without qualification.
 */
function withAtmosphereReasons(
  reasons: readonly MusicRecommendationReason[],
  intent: MusicIntent,
): MusicRecommendationReason[] {
  const dimensions: MusicRecommendationReason[] = [
    { kind: 'warmth', weight: round3(intent.warmth * 2 - 1) },
    { kind: 'energy', weight: round3(intent.energy * 2 - 1) },
    { kind: 'luminosity', weight: round3(intent.valence * 2 - 1) },
    { kind: 'pace', weight: intent.pace === 'slow' ? -1 : intent.pace === 'fast' ? 1 : 0 },
  ];

  // Strongest first, by absolute deviation from neutral — a strongly cool image
  // is as much a reason as a strongly warm one.
  const strongest = dimensions
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight))
    .slice(0, Math.max(1, 4 - reasons.length));

  return [...reasons, ...strongest].slice(0, 4);
}

/**
 * Whether the title looks like it matched the *word* rather than the genre.
 *
 * Tested on the head word, because that is the one a title collides on:
 * "dream pop" collides through "Dream", "chamber music" through "Chamber".
 * Short head words are skipped — a three-letter fragment appearing in a title
 * says nothing.
 */
function titleEchoesGenre(title: string, genre: string): boolean {
  const head = genre.split(' ')[0]?.toLowerCase() ?? '';
  if (head.length < 4) return false;
  return new RegExp(`\\b${head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(title);
}

function matchesEra(eras: readonly string[], year: number): boolean {
  return eras.some((era) => {
    const decade = Number.parseInt(era.replace(/\D/g, ''), 10);
    if (Number.isNaN(decade)) return false;
    const start = decade < 100 ? 1900 + decade : decade;
    return year >= start && year < start + 10;
  });
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;
