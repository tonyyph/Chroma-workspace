import { z } from 'zod';

import type { AtmosphereReading } from './atmosphere';
import type { AccumulatedPreference } from './feedback';
import { musicIntentSchema, type MusicIntent } from './intent';
import type { MusicTrackReference } from './music';
import type { Language } from './preferences';

/**
 * The optional intelligence layer, behind interfaces so it can be replaced,
 * disabled, or absent entirely.
 *
 * Everything here is a *refinement*. The product's core claim — that a
 * photograph's colour predicts its atmosphere — is answered in `atmosphere.ts`
 * with pure arithmetic that runs offline in under a millisecond. A vision model
 * adds what the colours cannot know (that the grey is rain, that the figure is
 * asleep); a language model writes the sentence that connects colour to sound.
 * Both improve the product. Neither is allowed to be required by it, and neither
 * is allowed to originate a track.
 */

export const timeOfDaySchema = z.enum(['dawn', 'morning', 'midday', 'afternoon', 'dusk', 'night']);

/**
 * Every field nullable inside a nullable object.
 *
 * A provider that recognises the light but not the subject has partly succeeded,
 * and throwing that away because one field is missing would be strictly worse
 * than keeping it. The *object* is null only when the call did not happen or its
 * response failed validation outright.
 */
export const visualAnalysisSchema = z.object({
  caption: z.string().max(240).nullable(),
  subjects: z.array(z.string().min(1).max(40)).max(6),
  scene: z.string().max(40).nullable(),
  lighting: z.string().max(40).nullable(),
  timeOfDay: timeOfDaySchema.nullable(),
  weather: z.string().max(40).nullable(),
  indoorOutdoor: z.enum(['indoor', 'outdoor']).nullable(),
  motion: z.enum(['still', 'gentle', 'active']).nullable(),
  confidence: z.number().min(0).max(1),
  /** Provider id and prompt version, so a stored reading can be re-run knowingly. */
  analysisVersion: z.string().min(1).max(32),
  analysedAt: z.iso.datetime(),
});

export type VisualAnalysis = z.infer<typeof visualAnalysisSchema>;
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

/** The bytes a provider is given. Never the original file. See docs/08. */
export type AnalysableImage = {
  /** Longest edge ≤1024, JPEG q0.7, EXIF stripped, no location. */
  base64: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
};

export interface ImageUnderstandingProvider {
  readonly id: string;
  readonly version: string;
  analyse(input: { image: AnalysableImage; signal: AbortSignal }): Promise<VisualAnalysis>;
}

/**
 * The provider that ships by default.
 *
 * Not a stub standing in for something better — it is the honest answer when no
 * analysis endpoint is configured and no consent has been given, which is the
 * default state of every install. Returning null is a *supported* outcome that
 * every downstream stage already handles.
 */
export class NullImageUnderstandingProvider implements ImageUnderstandingProvider {
  readonly id = 'none';
  readonly version = '0';
  async analyse(): Promise<never> {
    throw new AnalysisUnavailableError();
  }
}

export class AnalysisUnavailableError extends Error {
  readonly code = 'ANALYSIS_UNAVAILABLE';
  constructor() {
    super('No image-understanding provider is configured.');
    this.name = 'AnalysisUnavailableError';
  }
}

/** One explanation for one *already verified* candidate. */
export const trackExplanationSchema = z.object({
  providerTrackId: z.string().min(1).max(64),
  text: z.string().min(1).max(240),
});

export type TrackExplanation = z.infer<typeof trackExplanationSchema>;

/**
 * The language-model surface.
 *
 * Two methods, and the shape of both is chosen to make fabrication structurally
 * impossible rather than merely discouraged:
 *
 * - `refineIntent` returns a `MusicIntent`, which contains no catalogue data at
 *   all. There is nothing in its output that could be a fake track.
 * - `explain` is *given* the candidates and returns text keyed by their ids. The
 *   caller drops any id it did not supply, so a model that invents a song has
 *   invented something the caller discards.
 *
 * A model cannot add a track to this pipeline. That is a property of the types,
 * not a promise in a prompt.
 */
export interface RecommendationProvider {
  readonly id: string;
  readonly version: string;

  refineIntent(input: {
    atmosphere: AtmosphereReading;
    visual: VisualAnalysis | null;
    /** Already computed. Returned unchanged if refinement fails or is invalid. */
    baseline: MusicIntent;
    userMood: string | null;
    note: string | null;
    preference: AccumulatedPreference;
    language: Language;
    signal: AbortSignal;
  }): Promise<MusicIntent>;

  explain(input: {
    intent: MusicIntent;
    /** Verified provider results. The only tracks in scope. */
    candidates: readonly MusicTrackReference[];
    language: Language;
    signal: AbortSignal;
  }): Promise<readonly TrackExplanation[]>;
}

/**
 * Keeps only explanations whose id was actually offered.
 *
 * The enforcement point for "the model may not invent a track". Called by the
 * pipeline on every response, including from providers we wrote ourselves —
 * a boundary that is only checked for third parties is not a boundary.
 */
export function retainKnownExplanations(
  explanations: readonly TrackExplanation[],
  candidates: readonly MusicTrackReference[],
): readonly TrackExplanation[] {
  const known = new Set(candidates.map((track) => track.providerTrackId));
  const seen = new Set<string>();
  return explanations.filter((entry) => {
    if (!known.has(entry.providerTrackId) || seen.has(entry.providerTrackId)) return false;
    seen.add(entry.providerTrackId);
    return true;
  });
}

/**
 * Validates a refinement, falling back to the baseline.
 *
 * Deliberately all-or-nothing. Merging the valid half of a malformed response
 * would produce an intent no one designed — part measurement, part corruption —
 * and it would do so silently. The baseline is always already computed, so the
 * fallback costs nothing and is never worse than not calling at all.
 */
export function acceptRefinedIntent(candidate: unknown, baseline: MusicIntent): MusicIntent {
  const parsed = musicIntentSchema.safeParse(candidate);
  if (!parsed.success) return baseline;
  // The seed is ours, not the model's: it is how "Try again" stays reproducible.
  return { ...parsed.data, seed: baseline.seed };
}

export type AIAnalysisResult = {
  visual: VisualAnalysis | null;
  intent: MusicIntent;
  /** Which generation produced this, for `ChromaticMemory.recommendationVersion`. */
  version: string;
  /** What failed, if anything, so the UI can say so rather than hide it. */
  degraded: readonly AnalysisDegradation[];
};

export type AnalysisDegradation =
  | 'vision-unavailable'
  | 'vision-timeout'
  | 'vision-invalid'
  | 'refine-unavailable'
  | 'refine-timeout'
  | 'refine-invalid'
  | 'explain-unavailable'
  | 'explain-invalid';
