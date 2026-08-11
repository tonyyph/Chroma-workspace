import type { AtmosphereReading } from './atmosphere';
import type {
  AnalysisDegradation,
  ImageUnderstandingProvider,
  RecommendationProvider,
  VisualAnalysis,
} from './analysis';
import { acceptRefinedIntent, retainKnownExplanations } from './analysis';
import { accumulatePreference, type MusicFeedback } from './feedback';
import { deriveIntent, type MusicIntent } from './intent';
import {
  queriesForIntent,
  type MusicProvider,
  type MusicRecommendation,
  type MusicSearchResult,
  type PairingError,
} from './music';
import type { Language } from './preferences';
import { rankCandidates } from './ranking';

/**
 * The orchestration: a palette in, ranked and playable candidates out.
 *
 * Written as a pure-ish function over injected providers rather than as part of
 * a store, so every failure path below is testable without mounting a screen —
 * and there are more failure paths here than anywhere else in the product.
 *
 * **Partial success is the design centre.** Each stage can fail independently
 * and the pipeline continues with what it has: the atmosphere is computed
 * locally and cannot fail, so a memory is always saveable even when the network,
 * the model and the catalogue are all unavailable. `degraded` records what went
 * wrong so the UI can say so plainly instead of hiding it behind a spinner.
 */

export type PairingStage =
  'reading-colour' | 'reading-atmosphere' | 'finding-music' | 'preparing-previews' | 'done';

export type PairingProgress = {
  stage: PairingStage;
  /** Stages already finished, in order, so the UI can tick them off. */
  completed: readonly PairingStage[];
};

export type PairingOutcome = {
  atmosphere: AtmosphereReading;
  visualAnalysis: VisualAnalysis | null;
  intent: MusicIntent;
  recommendations: readonly MusicRecommendation[];
  /** Ids with a resolvable excerpt. A card without one is shown, and marked. */
  previewAvailable: ReadonlySet<string>;
  degraded: readonly AnalysisDegradation[];
  error: PairingError | null;
  /** "{intent}.{ranker}.{provider}" — which generation produced this. */
  version: string;
};

/** Bumped when the mapping or the table changes, so a memory can be re-matched knowingly. */
export const INTENT_VERSION = '1';
export const RANKER_VERSION = '1';

export type PairingInput = {
  atmosphere: AtmosphereReading;
  music: MusicProvider;
  /** Absent when no endpoint is configured or consent was declined. */
  vision?: ImageUnderstandingProvider | null;
  recommendation?: RecommendationProvider | null;
  /** The 1024px copy, only when `vision` is present and consented. See docs/08. */
  image?: { base64: string; mimeType: 'image/jpeg'; width: number; height: number } | null;
  feedback?: readonly MusicFeedback[];
  userMood?: string | null;
  note?: string | null;
  language?: Language;
  market?: string | null;
  /** Rotated by "Try again" so a second run explores rather than repeats. */
  seed?: number;
  limit?: number;
  signal: AbortSignal;
  onProgress?: (progress: PairingProgress) => void;
};

const TIMEOUTS = {
  vision: 8_000,
  refine: 6_000,
  search: 6_000,
  previews: 4_000,
} as const;

export async function runPairing(input: PairingInput): Promise<PairingOutcome> {
  const {
    atmosphere,
    music,
    vision = null,
    recommendation = null,
    image = null,
    feedback = [],
    userMood = null,
    note = null,
    language = 'en',
    market = null,
    seed = 0,
    limit = 5,
    signal,
    onProgress,
  } = input;

  const degraded: AnalysisDegradation[] = [];
  const completed: PairingStage[] = ['reading-colour'];
  const report = (stage: PairingStage) => onProgress?.({ stage, completed: [...completed] });

  report('reading-atmosphere');

  /* ------------------------------------------------- stage 2 · visual analysis */

  let visualAnalysis: VisualAnalysis | null = null;
  if (vision && image) {
    try {
      visualAnalysis = await withTimeout(
        vision.analyse({ image, signal }),
        TIMEOUTS.vision,
        signal,
      );
    } catch (error) {
      // Never fatal. The atmosphere is already computed from every pixel of the
      // frame; a caption only ever refines it.
      degraded.push(isTimeout(error) ? 'vision-timeout' : 'vision-unavailable');
    }
  } else if (vision) {
    degraded.push('vision-unavailable');
  }

  /* ---------------------------------------------------------- stage 3 · intent */

  const preference = accumulatePreference(feedback);
  const baseline = deriveIntent({ atmosphere, visual: visualAnalysis, preference, seed });

  let intent = baseline;
  if (recommendation) {
    try {
      const refined = await withTimeout(
        recommendation.refineIntent({
          atmosphere,
          visual: visualAnalysis,
          baseline,
          userMood,
          note,
          preference,
          language,
          signal,
        }),
        TIMEOUTS.refine,
        signal,
      );
      // All-or-nothing: a malformed refinement falls back rather than merging a
      // half-corrupt intent nobody designed.
      intent = acceptRefinedIntent(refined, baseline);
      if (intent === baseline) degraded.push('refine-invalid');
    } catch (error) {
      degraded.push(isTimeout(error) ? 'refine-timeout' : 'refine-unavailable');
    }
  }

  completed.push('reading-atmosphere');
  report('finding-music');

  /* ---------------------------------------------------------- stage 4 · search */

  let results: readonly MusicSearchResult[] = [];
  try {
    results = await withTimeout(
      music.search(queriesForIntent(intent, { market }), signal),
      TIMEOUTS.search,
      signal,
    );
  } catch (error) {
    return {
      atmosphere,
      visualAnalysis,
      intent,
      recommendations: [],
      previewAvailable: new Set(),
      degraded,
      // The user is offered a colour-only save from here, which is a complete
      // memory rather than a consolation prize.
      error: isTimeout(error) ? 'timeout' : 'provider-unavailable',
      version: versionOf(music.id),
    };
  }

  if (results.length === 0) {
    return {
      atmosphere,
      visualAnalysis,
      intent,
      recommendations: [],
      previewAvailable: new Set(),
      degraded,
      error: 'no-results',
      version: versionOf(music.id),
    };
  }

  completed.push('finding-music');
  report('preparing-previews');

  /* -------------------------------------------------------- stage 5 · previews */

  /**
   * Availability is resolved before ranking, not after.
   *
   * A card offering a play button that cannot play is the worst state this
   * screen can reach, and ranking first would mean discovering the problem after
   * choosing what to show. Resolved for a wider pool than we display so an
   * unplayable candidate can be replaced rather than merely marked.
   */
  const pool = results.slice(0, Math.max(limit * 2, 10));
  const previewAvailable = new Set<string>();
  try {
    const checked = await withTimeout(
      Promise.allSettled(
        pool.map(async ({ track }) => ({
          id: track.providerTrackId,
          preview: await music.getPreview(track, signal),
        })),
      ),
      TIMEOUTS.previews,
      signal,
    );
    for (const outcome of checked) {
      if (outcome.status === 'fulfilled' && outcome.value.preview !== null) {
        previewAvailable.add(outcome.value.id);
      }
    }
  } catch {
    // Availability unknown is not availability false: the cards still render,
    // and the player reports honestly if a clip turns out to be missing.
  }

  /* ----------------------------------------------------------- stage 6 · rank */

  const ranked = rankCandidates({
    intent,
    candidates: results,
    preference,
    previewAvailable,
    limit,
  });

  /* ------------------------------------------------------- stage 7 · explain */

  let recommendations = ranked;
  if (recommendation && ranked.length > 0) {
    try {
      const explanations = await withTimeout(
        recommendation.explain({
          intent,
          candidates: ranked.map((entry) => entry.track),
          language,
          signal,
        }),
        TIMEOUTS.refine,
        signal,
      );
      // The enforcement point: anything the model returned that we did not offer
      // is dropped, so a model cannot introduce a track.
      const known = retainKnownExplanations(
        explanations,
        ranked.map((entry) => entry.track),
      );
      const byId = new Map(known.map((entry) => [entry.providerTrackId, entry.text]));
      recommendations = ranked.map((entry) => ({
        ...entry,
        explanation: byId.get(entry.track.providerTrackId) ?? entry.explanation,
      }));
    } catch {
      degraded.push('explain-unavailable');
    }
  }

  completed.push('preparing-previews');
  report('done');

  return {
    atmosphere,
    visualAnalysis,
    intent,
    recommendations,
    previewAvailable,
    degraded,
    error: null,
    version: versionOf(music.id),
  };
}

const versionOf = (providerId: string) => `${INTENT_VERSION}.${RANKER_VERSION}.${providerId}`;

class TimeoutError extends Error {
  readonly code = 'TIMEOUT';
  constructor() {
    super('The operation timed out.');
    this.name = 'TimeoutError';
  }
}

const isTimeout = (error: unknown) => error instanceof TimeoutError;

/**
 * A ceiling on every network stage.
 *
 * Providers accept an `AbortSignal` and are expected to honour it, but "expected
 * to" is not a guarantee — and a stage that never settles is exactly the endless
 * loading state this product refuses to show. The race is the backstop.
 */
function withTimeout<T>(work: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error('Aborted.'));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
