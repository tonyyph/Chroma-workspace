import type { AtmosphereMood } from '../atmosphere';
import type { ChromaticMemory } from '../memory';
import { emphasisFor, type PaceIntensity, type SequenceOrder } from './pacing';
import { STORY_PATCH_VERSION, type StoryPatch } from './patch';
import type { LivingPalettePreset } from './livingPalette';

/**
 * The composer, and why it is local.
 *
 * **This is the feature, not a placeholder for one.** `05-ai-director-adr.md`
 * requires the deterministic composer to exist and be good before any provider
 * is offered one, for two reasons: it is what a malformed or absent response
 * falls back to, and it is the baseline a model *patches* rather than replaces.
 * A heuristic shipped under an "AI" label would be the exact fabrication
 * `analysis.ts` refuses when it leaves `visualAnalysis` null rather than guessing.
 *
 * So: no provider is configured, and this is called the composer.
 *
 * **Everything it proposes comes from something measured.** Mood, energy,
 * contrast and saturation are computed from the photographs' own colours and
 * already stored on every memory. Nothing here infers a subject, a place or a
 * feeling.
 *
 * **It does not write captions.** A generated caption on someone's memory makes
 * a claim about *their* experience. The composer may propose a memory's own
 * title — the author's words — and nothing else.
 */

export type CompositionProposal = Readonly<{
  patch: StoryPatch;
  /**
   * Why, in terms a screen can show.
   *
   * Structured rather than prose, for the reason `music.ts` gives for its
   * recommendation reasons: it translates into Vietnamese as a template, it is
   * unit-testable, and it can be written without a language model.
   */
  reasons: readonly CompositionReason[];
}>;

export const compositionReasonKinds = [
  /** Ordered so the sequence builds from quiet to energetic. */
  'ordered-by-energy',
  /** Ordered so each slide flows into the next by colour. */
  'ordered-by-colour',
  /** Ordered as they happened. */
  'ordered-by-time',
  /** One memory stood out on contrast and got the emphasis. */
  'focal-chosen',
  /** A palette motion was suggested from the prevailing mood. */
  'motion-from-mood',
  /** A title was taken from a memory the author had already named. */
  'title-from-memory',
] as const;
export type CompositionReasonKind = (typeof compositionReasonKinds)[number];

export type CompositionReason = Readonly<{
  kind: CompositionReasonKind;
  /** The memory or element the reason is about, when it is about one. */
  subjectId: string | null;
}>;

/**
 * Which motion a set of memories suggests.
 *
 * From the prevailing mood, which is itself derived from colour. Quiet moods get
 * quiet motion. This is a mapping table rather than a formula so it can be
 * argued with — and so it is obvious that nothing about audio enters into it.
 */
const MOTION_FOR_MOOD: Readonly<Record<AtmosphereMood, LivingPalettePreset>> = {
  serene: 'calm',
  tender: 'calm',
  melancholy: 'calm',
  nocturnal: 'flow',
  earthy: 'flow',
  luminous: 'flow',
  vivid: 'pulse',
  stark: 'pulse',
};

/** The mood most of these memories share, or the first one's when they tie. */
export function prevailingMood(memories: readonly ChromaticMemory[]): AtmosphereMood | null {
  if (memories.length === 0) return null;

  const counts = new Map<AtmosphereMood, number>();
  for (const memory of memories) {
    counts.set(memory.facets.mood, (counts.get(memory.facets.mood) ?? 0) + 1);
  }

  let best: AtmosphereMood | null = null;
  let bestCount = 0;
  // Iterated in insertion order, so a tie resolves to the earliest-seen mood and
  // the result does not depend on Map iteration being anything but stable.
  for (const [mood, count] of counts) {
    if (count > bestCount) {
      best = mood;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The memory that should carry the composition.
 *
 * Highest `emphasisFor`, which weights contrast over brightness — a picture that
 * is merely bright is not necessarily the one a sequence should land on.
 */
export function focalMemory(memories: readonly ChromaticMemory[]): ChromaticMemory | null {
  let best: ChromaticMemory | null = null;
  let bestScore = -1;

  for (const memory of memories) {
    const score = emphasisFor(memory);
    if (score > bestScore) {
      best = memory;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Composes a proposal for a set of memories.
 *
 * Returns a **patch**, deliberately — the same shape a provider would return, so
 * the local and remote paths go through one validator and one accept/reject
 * screen. There is no second code path for "the app's own suggestion".
 *
 * Deterministic and clock-free: the same memories always produce the same
 * proposal, which is what makes "regenerate" meaningful (it must be given
 * different inputs to give a different answer) and what makes this testable.
 */
export function compose(input: {
  memories: readonly ChromaticMemory[];
  order: SequenceOrder;
  intensity: PaceIntensity;
  /** Element ids in the document, in the order the composer's slides map onto. */
  slideElementIds: readonly string[];
}): CompositionProposal {
  const reasons: CompositionReason[] = [];

  reasons.push({
    kind:
      input.order === 'building'
        ? 'ordered-by-energy'
        : input.order === 'colour-flow'
          ? 'ordered-by-colour'
          : 'ordered-by-time',
    subjectId: null,
  });

  const focal = focalMemory(input.memories);
  if (focal !== null) reasons.push({ kind: 'focal-chosen', subjectId: focal.id });

  const mood = prevailingMood(input.memories);
  const animation = mood === null ? null : MOTION_FOR_MOOD[mood];
  if (animation !== null) reasons.push({ kind: 'motion-from-mood', subjectId: null });

  /**
   * A title, only if the author already wrote one.
   *
   * The focal memory's own words, never a sentence this app composed about
   * someone's photograph.
   */
  const theme = focal?.personalContext.title ?? null;
  if (theme !== null) reasons.push({ kind: 'title-from-memory', subjectId: focal?.id ?? null });

  return {
    patch: {
      version: STORY_PATCH_VERSION,
      theme,
      // Ordering is already applied when a story is composed from memories, so
      // the proposal does not re-order what it just ordered. It is here for the
      // case where a composer is asked to rework an existing document.
      slideOrder: null,
      crops: [],
      typography: [],
      // The composer proposes arrangement, not decoration. Effects are the
      // author's choice, the same way a template's are not.
      effects: [],
      animation,
    },
    reasons,
  };
}
