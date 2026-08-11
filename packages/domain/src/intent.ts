import { z } from 'zod';

import type { AtmosphereMood, AtmosphereReading } from './atmosphere';
import type { VisualAnalysis } from './analysis';
import type { AccumulatedPreference } from './feedback';

/**
 * What kind of music this moment wants — the typed thing that sits between
 * colour science and a catalogue search.
 *
 * The intermediate representation exists so that neither end knows about the
 * other. Colour code never learns what a genre is; provider code never learns
 * what OKLCh is. It is also the only artefact in the pipeline that is worth
 * showing a person: "slow, warm, close, mostly instrumental, ambient or modern
 * classical" is a sentence someone can agree or disagree with, which is what
 * makes the recommendation arguable rather than magic.
 *
 * Deterministic. The same atmosphere and the same seed always produce the same
 * intent, which is what lets ranking be tested and what makes "Try again"
 * meaningfully different rather than randomly different.
 */

export const musicPaceSchema = z.enum(['slow', 'medium', 'fast']);
export type MusicPace = z.infer<typeof musicPaceSchema>;

export const lyricalPreferenceSchema = z.enum(['instrumental', 'vocal', 'either']);
export type LyricalPreference = z.infer<typeof lyricalPreferenceSchema>;

export const musicIntentSchema = z.object({
  /** 0–1, sombre to bright. */
  valence: z.number().min(0).max(1),
  /** 0–1, still to driving. */
  energy: z.number().min(0).max(1),
  /** 0–1, cool and electronic to warm and organic. */
  warmth: z.number().min(0).max(1),
  /** 0–1, vast to close. */
  intimacy: z.number().min(0).max(1),
  /** 0–1, resolved to unresolved. */
  tension: z.number().min(0).max(1),
  pace: musicPaceSchema,
  texture: z.array(z.string().min(1).max(24)).max(5),
  genres: z.array(z.string().min(1).max(32)).min(1).max(5),
  instruments: z.array(z.string().min(1).max(24)).max(5),
  eras: z.array(z.string().min(1).max(16)).max(3).nullable(),
  lyricalPreference: lyricalPreferenceSchema,
  /** One sentence, in the product's calibrated register. Never a claim about the user. */
  explanation: z.string().max(240),
  /** Rotated by "Try again", so a second run explores rather than repeats. */
  seed: z.number().int().min(0),
});

export type MusicIntent = z.infer<typeof musicIntentSchema>;

/**
 * How much each atmosphere dimension drives each musical one.
 *
 * Exported so the coefficients are one diff and one test away from being tuned,
 * rather than buried in expressions. They are judgments, not measurements, and
 * they are the most likely thing in this module to be wrong — which is exactly
 * why they are named, gathered, and visible.
 *
 * Each row sums to 1, so every output lands in 0–1 without a clamp doing the
 * work. A test asserts that.
 */
export const INTENT_WEIGHTS = {
  valence: { luminosity: 0.55, warmth: 0.25, saturation: 0.2 },
  energy: { saturation: 0.45, contrast: 0.3, spread: 0.25 },
  intimacy: { closeness: 0.6, coherence: 0.4 },
  tension: { contrast: 0.5, incoherence: 0.3, neutrality: 0.2 },
} as const;

/**
 * The curatorial layer.
 *
 * Genres are a human judgment and belong in a table a person can edit, not in
 * arithmetic. Nothing here is derived; it is a stated opinion about what a
 * nocturnal, low-energy photograph sounds like, and it is the part of the
 * product most worth arguing about over time.
 *
 * Keyed by mood and then by an energy band, because the same mood at rest and in
 * motion are different records: nocturnal and still is environmental music,
 * nocturnal and driving is darkwave.
 *
 * ---
 *
 * **Every term below was measured against the live catalogue, and the first
 * draft of this table was mostly wrong.**
 *
 * These queries hit a keyword index over titles and artist names, so a genre
 * term only works if it is a term people actually *name records with*. Checked
 * against the VN storefront on 2026-08-11:
 *
 * | term                | returned                                        |
 * | ------------------- | ----------------------------------------------- |
 * | `kankyo ongaku`     | Satoshi Ashikawa · Yoshio Ojima · Fumio Miyashita |
 * | `spiritual jazz`    | John Coltrane · Kamasi Washington                |
 * | `darkwave`          | Siouxsie & The Banshees · Joy Division · Depeche Mode |
 * | `slowcore`          | Mojave 3 · Duster · Red House Painters           |
 * | `city pop`          | Tomoko Aran · Anri · Mariya Takeuchi             |
 * | `tropicalia`        | Caetano Veloso · Beck · Eliane Elias             |
 * | ‡ `ambient`         | "weather balloon" · "Briar Moonwhisper"          |
 * | ‡ `new age`         | "Sleep Music Lullabies" · "White Noise For Babies" |
 * | ‡ `funk`            | Brazilian funk beat producers — a different genre |
 * | ‡ `house`           | Beach House — a title match                      |
 * | ‡ `disco`, `soul`, `piano`, `gospel`, `bossa nova`, `indie folk`, `noise rock`, `bedroom pop`, `exotica`, `highlife` | filler or the wrong music entirely |
 *
 * **The rule.** A single common English noun fails: it collides with song titles
 * and with the catalogue's long tail of production music sold by keyword.
 * Compound or subculturally specific names succeed, because only records that
 * really belong to the scene are labelled with them. Prefer `spiritual jazz` to
 * `jazz`, `folk rock` to `folk`, `modern classical` to `piano`.
 *
 * Terms marked ‡ above are **banned** and should not come back without new
 * evidence. See docs/13 · R5.
 */
type EnergyBand = 'low' | 'medium' | 'high';

type Curation = {
  genres: readonly string[];
  texture: readonly string[];
  instruments: readonly string[];
  lyrical: LyricalPreference;
};

export const CURATION: Record<AtmosphereMood, Record<EnergyBand, Curation>> = {
  nocturnal: {
    low: {
      genres: ['kankyo ongaku', 'modern classical', 'downtempo'],
      texture: ['spacious', 'hushed', 'reverberant'],
      instruments: ['synthesiser', 'piano', 'strings'],
      lyrical: 'instrumental',
    },
    medium: {
      genres: ['trip hop', 'dream pop', 'post-rock'],
      texture: ['smoky', 'low-lit'],
      instruments: ['bass', 'rhodes', 'drum machine'],
      lyrical: 'either',
    },
    high: {
      genres: ['darkwave', 'post-punk', 'krautrock'],
      texture: ['taut', 'metallic'],
      instruments: ['bass', 'guitar', 'drum machine'],
      lyrical: 'vocal',
    },
  },
  melancholy: {
    low: {
      genres: ['slowcore', 'neoclassical', 'modern classical'],
      texture: ['sparse', 'unhurried'],
      instruments: ['piano', 'cello', 'guitar'],
      lyrical: 'either',
    },
    medium: {
      genres: ['shoegaze', 'dream pop', 'chamber music'],
      texture: ['blurred', 'weathered'],
      instruments: ['guitar', 'strings'],
      lyrical: 'vocal',
    },
    high: {
      genres: ['post-rock', 'shoegaze', 'post-punk'],
      texture: ['swelling', 'saturated'],
      instruments: ['guitar', 'drums'],
      lyrical: 'either',
    },
  },
  serene: {
    low: {
      genres: ['kankyo ongaku', 'chamber music', 'minimalism'],
      texture: ['still', 'airy'],
      instruments: ['guitar', 'harp', 'field recording'],
      lyrical: 'instrumental',
    },
    medium: {
      genres: ['spiritual jazz', 'folk rock', 'tropicalia'],
      texture: ['gentle', 'unhurried'],
      instruments: ['nylon guitar', 'brushes', 'upright bass'],
      lyrical: 'either',
    },
    high: {
      genres: ['city pop', 'soft rock', 'tropicalia'],
      texture: ['open', 'sunlit'],
      instruments: ['guitar', 'synthesiser'],
      lyrical: 'vocal',
    },
  },
  tender: {
    low: {
      genres: ['dream pop', 'neoclassical', 'folk rock'],
      texture: ['close', 'warm'],
      instruments: ['guitar', 'rhodes', 'voice'],
      lyrical: 'vocal',
    },
    medium: {
      genres: ['city pop', 'chamber music', 'spiritual jazz'],
      texture: ['soft-focus', 'intimate'],
      instruments: ['rhodes', 'bass', 'strings'],
      lyrical: 'vocal',
    },
    high: {
      genres: ['motown', 'soft rock', 'synth pop'],
      texture: ['bright', 'lifting'],
      instruments: ['horns', 'organ', 'drums'],
      lyrical: 'vocal',
    },
  },
  earthy: {
    low: {
      genres: ['psychedelic folk', 'folk rock', 'spiritual jazz'],
      texture: ['woody', 'dusty'],
      instruments: ['acoustic guitar', 'upright bass', 'pedal steel'],
      lyrical: 'either',
    },
    medium: {
      genres: ['folk rock', 'spiritual jazz', 'tropicalia'],
      texture: ['organic', 'rolling'],
      instruments: ['horns', 'percussion', 'guitar'],
      lyrical: 'either',
    },
    high: {
      genres: ['psychedelic', 'folk rock', 'motown'],
      texture: ['gritty', 'live'],
      instruments: ['guitar', 'drums', 'horns'],
      lyrical: 'vocal',
    },
  },
  luminous: {
    low: {
      genres: ['kankyo ongaku', 'minimalism', 'contemporary classical'],
      texture: ['glassy', 'weightless'],
      instruments: ['synthesiser', 'vibraphone'],
      lyrical: 'instrumental',
    },
    medium: {
      genres: ['city pop', 'tropicalia', 'soft rock'],
      texture: ['bright', 'buoyant'],
      instruments: ['guitar', 'synthesiser', 'bass'],
      lyrical: 'vocal',
    },
    high: {
      genres: ['synth pop', 'city pop', 'motown'],
      texture: ['gleaming', 'propulsive'],
      instruments: ['synthesiser', 'drum machine'],
      lyrical: 'vocal',
    },
  },
  vivid: {
    low: {
      genres: ['psychedelic', 'tropicalia', 'dream pop'],
      texture: ['saturated', 'swirling'],
      instruments: ['organ', 'percussion'],
      lyrical: 'either',
    },
    medium: {
      genres: ['tropicalia', 'psychedelic', 'spiritual jazz'],
      texture: ['vivid', 'kinetic'],
      instruments: ['percussion', 'horns', 'guitar'],
      lyrical: 'vocal',
    },
    high: {
      genres: ['motown', 'synth pop', 'psychedelic'],
      texture: ['electric', 'insistent'],
      instruments: ['bass', 'horns', 'drums'],
      lyrical: 'vocal',
    },
  },
  stark: {
    low: {
      genres: ['minimalism', 'modern classical', 'contemporary classical'],
      texture: ['severe', 'unadorned'],
      instruments: ['piano', 'strings'],
      lyrical: 'instrumental',
    },
    medium: {
      genres: ['krautrock', 'post-punk', 'minimalism'],
      texture: ['angular', 'repetitive'],
      instruments: ['bass', 'drum machine', 'guitar'],
      lyrical: 'either',
    },
    high: {
      genres: ['darkwave', 'post-punk', 'krautrock'],
      texture: ['hard-edged', 'relentless'],
      instruments: ['drum machine', 'synthesiser'],
      lyrical: 'instrumental',
    },
  },
};

const bandFor = (energy: number): EnergyBand =>
  energy < 0.34 ? 'low' : energy < 0.67 ? 'medium' : 'high';

export const paceFor = (energy: number): MusicPace =>
  energy < 0.33 ? 'slow' : energy < 0.66 ? 'medium' : 'fast';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * How far a visual reading is allowed to move a colour reading.
 *
 * Bounded on purpose. The palette is measured from every pixel of the frame; the
 * caption is one model's guess about what the frame contains. A confident wrong
 * guess — "a nightclub" for a dim living room — must not be able to overrule
 * what the colour actually says, so each adjustment is capped and they are
 * applied additively rather than multiplicatively.
 */
export const VISUAL_ADJUSTMENT_CAP = 0.15;

export type IntentInput = {
  atmosphere: AtmosphereReading;
  visual?: VisualAnalysis | null;
  /** What the user typed, if they typed anything. Never inferred. */
  userMood?: string | null;
  preference?: AccumulatedPreference | null;
  /** Rotate to explore a different corner of the same intent. */
  seed?: number;
};

/**
 * Atmosphere to intent. Pure, total, deterministic.
 */
export function deriveIntent({
  atmosphere,
  visual = null,
  preference = null,
  seed = 0,
}: IntentInput): MusicIntent {
  const w = INTENT_WEIGHTS;

  // Warmth arrives as −1..1 and every musical dimension is 0..1.
  const warmth01 = (atmosphere.warmth + 1) / 2;

  let valence =
    w.valence.luminosity * atmosphere.luminosity +
    w.valence.warmth * warmth01 +
    w.valence.saturation * atmosphere.saturation;

  let energy =
    w.energy.saturation * atmosphere.saturation +
    w.energy.contrast * atmosphere.contrast +
    w.energy.spread * atmosphere.spread;

  // A palette whose colours sit close together is a *close* image — one light,
  // one surface, one subject. Spread is the opposite of intimacy, not of energy.
  let intimacy =
    w.intimacy.closeness * (1 - atmosphere.spread) + w.intimacy.coherence * atmosphere.coherence;

  // Neutrality: a palette with no temperature commits to nothing, which is its
  // own kind of unease. `1 − |warmth|` peaks at grey.
  let tension =
    w.tension.contrast * atmosphere.contrast +
    w.tension.incoherence * (1 - atmosphere.coherence) +
    w.tension.neutrality * (1 - Math.abs(atmosphere.warmth));

  if (visual) {
    const cap = VISUAL_ADJUSTMENT_CAP;
    // Night reads as lower valence and closer, whatever the colours did — a
    // brightly lit night scene is still a night scene.
    if (visual.timeOfDay === 'night' || visual.timeOfDay === 'dusk') {
      valence -= cap;
      intimacy += cap;
    }
    if (visual.timeOfDay === 'dawn' || visual.timeOfDay === 'morning') {
      valence += cap * 0.5;
    }
    if (visual.motion === 'active') energy += cap;
    if (visual.motion === 'still') energy -= cap;
    if (visual.indoorOutdoor === 'indoor') intimacy += cap * 0.5;
    if (visual.indoorOutdoor === 'outdoor') intimacy -= cap * 0.5;
  }

  valence = clamp01(valence);
  energy = clamp01(energy);
  intimacy = clamp01(intimacy);
  tension = clamp01(tension);

  const band = bandFor(energy);
  const curation = CURATION[atmosphere.mood][band];

  /**
   * The genre list rotates rather than shuffling, so a different lead genre is
   * still inside the same curatorial judgment. A shuffle would make repeat runs
   * unreproducible; a rotation is deterministic, which is what the tests need.
   *
   * **Temperature rotates it as well as the seed, and that is not cosmetic.**
   * `mood` and the energy band are the only keys into `CURATION`, and neither
   * carries warmth — so a cold grey rain and a warm sunlit kitchen both read as
   * `serene` at low energy and were producing the *same three queries and the
   * same five tracks*. Two photographs that could not look less alike were
   * getting identical music, which is the plainest possible refutation of what
   * this product claims.
   *
   * Rotating by temperature gives them different lead genres, so different
   * queries, so different candidate pools. It is a narrower fix than the real
   * one — splitting the mood table into warm and cool variants — but that would
   * re-label every memory already saved, and this does not.
   */
  const temperatureStep = atmosphere.warmth > 0.2 ? 2 : atmosphere.warmth < -0.2 ? 1 : 0;
  const genres = rotate(curation.genres, seed + temperatureStep);

  return musicIntentSchema.parse({
    valence: round3(valence),
    energy: round3(energy),
    warmth: round3(warmth01),
    intimacy: round3(intimacy),
    tension: round3(tension),
    pace: paceFor(energy),
    texture: [...curation.texture].slice(0, 5),
    // Preference biases which curated genre leads; it never introduces one the
    // curation did not offer, so a user's history cannot drag every photograph
    // toward the same record.
    genres: preferGenres(genres, preference).slice(0, 5),
    instruments: [...curation.instruments].slice(0, 5),
    eras: null,
    lyricalPreference: curation.lyrical,
    explanation: '',
    seed,
  });
}

function rotate<T>(items: readonly T[], by: number): T[] {
  if (items.length === 0) return [];
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

/**
 * Moves genres the user has chosen before toward the front of the curated list.
 * Order only — nothing is added and nothing is removed.
 */
function preferGenres(
  genres: readonly string[],
  preference: AccumulatedPreference | null,
): string[] {
  if (!preference || preference.genreWeights.size === 0) return [...genres];
  return [...genres].sort(
    (left, right) =>
      (preference.genreWeights.get(right.toLowerCase()) ?? 0) -
      (preference.genreWeights.get(left.toLowerCase()) ?? 0),
  );
}
