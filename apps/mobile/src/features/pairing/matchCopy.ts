import type { AtmosphereReading, MusicIntent, MusicRecommendation } from '@chromawave/domain';
import type { MessageKey } from '@/localization/messages';

/**
 * Turning a measured match into a sentence, in either language.
 *
 * **Composed from keys, never translated as prose.** The reason a card gives has
 * to be specific — "the muted blue-violet, low contrast and late light suggest
 * something unhurried", not "this song matches your vibe" — and it has to be
 * specific *in Vietnamese too*. Building it from a template plus four localised
 * fragments is the only way to get that: a translator sees a sentence with slots
 * and can rearrange it for Vietnamese word order, where machine-translating
 * generated English prose would produce something no one would say.
 *
 * Every fragment names something the pipeline actually measured. There is
 * deliberately no vocabulary here for tempo or danceability, because the
 * catalogue does not report them and citing them would be an invention.
 */

export type MatchCopy = {
  /** `pair.because`, with its four slots filled. */
  key: MessageKey;
  params: Record<string, string>;
};

const lightKey = (luminosity: number): MessageKey =>
  luminosity < 0.35
    ? 'pair.light.low'
    : luminosity > 0.68
      ? 'pair.light.bright'
      : 'pair.light.even';

const temperatureKey = (warmth: number): MessageKey =>
  warmth > 0.15
    ? 'pair.temperature.warm'
    : warmth < -0.15
      ? 'pair.temperature.cool'
      : 'pair.temperature.neutral';

const paceKey = (pace: MusicIntent['pace']): MessageKey =>
  pace === 'slow' ? 'pair.pace.slow' : pace === 'fast' ? 'pair.pace.fast' : 'pair.pace.medium';

const moodKey = (mood: AtmosphereReading['mood']): MessageKey => `pair.mood.${mood}` as MessageKey;

/**
 * The fallback explanation, used whenever no language model wrote one — which is
 * the default configuration and therefore the common case, not the edge case.
 */
export function composeMatchCopy(
  atmosphere: AtmosphereReading,
  intent: MusicIntent,
  translate: (key: MessageKey) => string,
  /** The candidate's own genre, when the catalogue reported one. */
  genre?: string | null,
): MatchCopy {
  const params = {
    mood: translate(moodKey(atmosphere.mood)),
    light: translate(lightKey(atmosphere.luminosity)),
    temperature: translate(temperatureKey(atmosphere.warmth)),
    pace: translate(paceKey(intent.pace)),
  };

  /**
   * Lead with the track's own genre when there is one.
   *
   * The palette rationale is identical for every candidate — it is a property of
   * the photograph, not of the song — so a card headed "Why **this** matches"
   * that prints the same sentence five times is answering a question it did not
   * ask. Naming the genre is the one thing we genuinely know that differs
   * between candidates, and it is provider metadata rather than an inference.
   */
  return genre
    ? { key: 'pair.becauseGenre', params: { ...params, genre } }
    : { key: 'pair.because', params };
}

/**
 * The two or three dimensions worth showing as indicators beside the sentence.
 *
 * Sorted by how strongly each drove the match, and capped — a card listing nine
 * equally-weighted reasons is telling the user nothing, and "everything matched"
 * is the shape of a claim that was not measured.
 */
export function strongestReasons(
  recommendation: MusicRecommendation,
  limit = 3,
): readonly { key: MessageKey; strength: 1 | 2 | 3 }[] {
  return [...recommendation.reasons]
    .sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight))
    .slice(0, limit)
    .map((reason) => ({
      key: `pair.reason.${reason.kind}` as MessageKey,
      // Three steps, so the indicator is a count as well as a colour — a match
      // strength shown only as a hue is invisible to a colour-blind user.
      strength: (Math.abs(reason.weight) > 0.66 ? 3 : Math.abs(reason.weight) > 0.33 ? 2 : 1) as
        1 | 2 | 3,
    }));
}

/** `0:12` — mono, and never localised. */
export const formatClock = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
