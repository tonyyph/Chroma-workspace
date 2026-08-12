import {
  runPairing,
  unpairedPairing,
  type AtmosphereReading,
  type MusicFeedback,
  type MusicPairing,
  type MusicRecommendation,
  type MusicTrackReference,
  type PairingError,
  type PairingStage,
  type VisualAnalysis,
} from '@cw/domain';
import { create } from 'zustand';
import { musicProvider, previewPlayer } from '@/infrastructure/dependencies';

/**
 * The music search in flight, between a palette and a saved memory.
 *
 * Separate from `captureStore`, which owns the colour. The split follows the
 * failure boundary rather than the screen boundary: colour extraction is local
 * and cannot fail once it has returned, music needs a network and fails in five
 * distinct ways. Keeping them in one store would make "the palette is ready but
 * the catalogue is not" an awkward combination of flags instead of two
 * independent states — and that combination is the product's most common one.
 *
 * Nothing here is persisted. A memory is written by `captureStore`/the
 * repository; this is what the pairing screen reads while the user chooses.
 */
type PairingState = {
  status: 'idle' | 'running' | 'ready' | 'failed';
  stage: PairingStage;
  completed: readonly PairingStage[];

  atmosphere: AtmosphereReading | null;
  visualAnalysis: VisualAnalysis | null;
  recommendations: readonly MusicRecommendation[];
  previewAvailable: ReadonlySet<string>;
  selectedTrackId: string | null;
  error: PairingError | null;
  /** Rotated by "Try again", so a second run explores rather than repeats. */
  seed: number;
  version: string | null;
  /** Accumulated this session; written onto the memory at save. */
  feedback: readonly MusicFeedback[];

  start: (input: { atmosphere: AtmosphereReading; market: string | null }) => Promise<void>;
  retry: () => Promise<void>;
  select: (providerTrackId: string) => void;
  reject: (providerTrackId: string) => void;
  /** Records that a preview ran to the end, or was skipped almost immediately. */
  noteListening: (providerTrackId: string, signal: 'played-through' | 'skipped-early') => void;
  /** Everything chosen so far, as the shape a memory stores. */
  toPairing: () => MusicPairing;
  reset: () => void;
};

const initial = {
  status: 'idle' as const,
  stage: 'reading-colour' as PairingStage,
  completed: [] as readonly PairingStage[],
  atmosphere: null,
  visualAnalysis: null,
  recommendations: [] as readonly MusicRecommendation[],
  previewAvailable: new Set<string>() as ReadonlySet<string>,
  selectedTrackId: null,
  error: null,
  seed: 0,
  version: null,
  feedback: [] as readonly MusicFeedback[],
};

/**
 * One run at a time.
 *
 * Held outside the store because it is a handle, not state: nothing renders
 * differently because a controller exists, and putting it in the store would
 * make every subscriber re-render when a request starts.
 */
let inFlight: AbortController | null = null;

const genresOf = (
  recommendations: readonly MusicRecommendation[],
  providerTrackId: string,
): string[] =>
  recommendations
    .find((entry) => entry.track.providerTrackId === providerTrackId)
    ?.track.genres.slice() ?? [];

export const usePairingStore = create<PairingState>((set, get) => ({
  ...initial,

  start: async ({ atmosphere, market }) => {
    // A second start replaces the first. The user re-running a match must not
    // have two searches racing to write the same result.
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;

    set({
      ...initial,
      seed: get().seed,
      atmosphere,
      status: 'running',
      stage: 'reading-atmosphere',
      completed: ['reading-colour'],
    });

    try {
      const outcome = await runPairing({
        atmosphere,
        music: musicProvider,
        market,
        seed: get().seed,
        feedback: get().feedback,
        signal: controller.signal,
        onProgress: ({ stage, completed }) => {
          // A late progress report from a superseded run would drag the UI
          // backwards through stages it has already passed.
          if (inFlight !== controller) return;
          set({ stage, completed });
        },
      });

      if (inFlight !== controller) return;

      set({
        status: outcome.error === null ? 'ready' : 'failed',
        atmosphere: outcome.atmosphere,
        visualAnalysis: outcome.visualAnalysis,
        recommendations: outcome.recommendations,
        previewAvailable: outcome.previewAvailable,
        error: outcome.error,
        version: outcome.version,
        stage: 'done',
      });
    } catch {
      if (inFlight !== controller) return;
      // `runPairing` resolves rather than throws for provider failures, so
      // reaching here means something unexpected. It is still not fatal: the
      // palette is intact and a colour-only memory remains saveable.
      set({ status: 'failed', error: 'provider-error', stage: 'done' });
    } finally {
      if (inFlight === controller) inFlight = null;
    }
  },

  retry: async () => {
    const atmosphere = get().atmosphere;
    if (!atmosphere) return;
    // A new seed, so "Try again" reaches different ground rather than repeating
    // the same query and looking broken.
    set({ seed: get().seed + 1 });
    await get().start({ atmosphere, market: null });
  },

  select: (providerTrackId) => {
    previewPlayer.stop();
    set((state) => ({
      selectedTrackId: providerTrackId,
      feedback: [
        ...state.feedback,
        {
          providerTrackId: providerTrackId,
          signal: 'selected' as const,
          at: new Date().toISOString(),
          genres: genresOf(state.recommendations, providerTrackId),
        },
      ],
    }));
  },

  reject: (providerTrackId) => {
    previewPlayer.stop();
    set((state) => ({
      // Removed from the list, not merely deprioritised: the user said no, and
      // leaving it on screen makes the rejection feel unheard.
      recommendations: state.recommendations.filter(
        (entry) => entry.track.providerTrackId !== providerTrackId,
      ),
      selectedTrackId: state.selectedTrackId === providerTrackId ? null : state.selectedTrackId,
      feedback: [
        ...state.feedback,
        {
          providerTrackId: providerTrackId,
          signal: 'rejected' as const,
          at: new Date().toISOString(),
          genres: genresOf(state.recommendations, providerTrackId),
        },
      ],
    }));
  },

  noteListening: (providerTrackId, signal) => {
    set((state) => ({
      feedback: [
        ...state.feedback,
        {
          providerTrackId: providerTrackId,
          signal,
          at: new Date().toISOString(),
          genres: genresOf(state.recommendations, providerTrackId),
        },
      ],
    }));
  },

  toPairing: () => {
    const state = get();
    const selected =
      state.recommendations.find((entry) => entry.track.providerTrackId === state.selectedTrackId)
        ?.track ?? null;

    // Bounded on the way out: the schema caps recommendations at 12 and feedback
    // at 50, and a long session of retries can exceed both.
    const recommendations = state.recommendations.slice(0, 12);
    const feedback = state.feedback.slice(-50);

    if (selected === null) {
      return {
        ...unpairedPairing,
        status: state.recommendations.length > 0 ? 'suggested' : unpairedPairing.status,
        recommendations,
        recommendationVersion: state.version,
        feedback,
        error: state.error,
      };
    }

    return {
      status: 'paired',
      selectedTrack: selected as MusicTrackReference,
      recommendations,
      intent: null,
      recommendationVersion: state.version,
      feedback,
      pairedAt: new Date().toISOString(),
      error: null,
    };
  },

  reset: () => {
    inFlight?.abort();
    inFlight = null;
    previewPlayer.stop();
    set({ ...initial, previewAvailable: new Set() });
  },
}));
