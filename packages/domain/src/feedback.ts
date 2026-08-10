import { z } from 'zod';

/**
 * What the user told us about a suggestion, explicitly or by behaviour.
 *
 * Kept as a short event log on the memory rather than as a user profile. There
 * is no account and no server, so "learning" here means one thing: the next run
 * on this device ranks a little better. Nothing accumulates anywhere a person
 * cannot see or delete, and deleting the memory deletes its feedback with it.
 */

export const musicFeedbackSignalSchema = z.enum([
  /** Chose it. The strongest positive signal we get. */
  'selected',
  /** Dismissed the card outright. */
  'rejected',
  /** Swapped it out for something else later — a delayed rejection. */
  'replaced',
  /** Let the preview run to the end without skipping. Implicit approval. */
  'played-through',
  /** Skipped within the first few seconds. Implicit rejection. */
  'skipped-early',
]);

export type MusicFeedbackSignal = z.infer<typeof musicFeedbackSignalSchema>;

export const musicFeedbackSchema = z.object({
  providerTrackId: z.string().min(1).max(64),
  signal: musicFeedbackSignalSchema,
  at: z.iso.datetime(),
  /**
   * The candidate's genres, copied at the time.
   *
   * Denormalised deliberately: preference has to survive the track disappearing
   * from the catalogue, and re-fetching a rejected track purely to learn what
   * genre it was would be a network call to answer a question we already knew
   * the answer to.
   */
  genres: z.array(z.string().min(1).max(32)).max(5),
});

export type MusicFeedback = z.infer<typeof musicFeedbackSchema>;

/** How much each signal moves a genre's weight. */
export const FEEDBACK_WEIGHTS: Record<MusicFeedbackSignal, number> = {
  selected: 1,
  'played-through': 0.4,
  'skipped-early': -0.3,
  rejected: -0.6,
  replaced: -0.8,
};

/**
 * The bias a device has accumulated, derived on demand and never stored.
 *
 * Recomputing from the event log rather than persisting a profile means there is
 * exactly one source of truth, deleting a memory genuinely removes its
 * influence, and a change to the weights above takes effect immediately instead
 * of only for future feedback.
 */
export type AccumulatedPreference = {
  /** Lower-cased genre → net weight. Positive means liked. */
  genreWeights: ReadonlyMap<string, number>;
  /** Track ids the user has turned down. Ranked last, never silently hidden. */
  rejectedTrackIds: ReadonlySet<string>;
};

export const EMPTY_PREFERENCE: AccumulatedPreference = {
  genreWeights: new Map(),
  rejectedTrackIds: new Set(),
};

/**
 * Rolls a feedback log into a bias.
 *
 * Recency-weighted: a rejection from a year ago should not still be steering
 * today's suggestions, and someone's taste is allowed to change. The half-life
 * is 90 days, so a signal is worth half as much a quarter later.
 */
export function accumulatePreference(
  feedback: readonly MusicFeedback[],
  now: Date = new Date(),
): AccumulatedPreference {
  const genreWeights = new Map<string, number>();
  const rejectedTrackIds = new Set<string>();

  for (const entry of feedback) {
    const weight = FEEDBACK_WEIGHTS[entry.signal];
    const ageDays = (now.getTime() - Date.parse(entry.at)) / 86_400_000;
    // Guards a clock that has gone backwards: a future timestamp is treated as
    // current rather than as unboundedly important.
    const recency = 0.5 ** (Math.max(0, ageDays) / 90);
    const effective = weight * recency;

    if (entry.signal === 'rejected' || entry.signal === 'replaced') {
      rejectedTrackIds.add(entry.providerTrackId);
    }

    for (const genre of entry.genres) {
      const key = genre.toLowerCase();
      genreWeights.set(key, (genreWeights.get(key) ?? 0) + effective);
    }
  }

  return { genreWeights, rejectedTrackIds };
}
