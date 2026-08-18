import type { MusicTrackReference } from '../music';

/**
 * What can honestly be done with a track that is attached to a story.
 *
 * **This exists so the UI can state a limitation instead of showing a disabled
 * control.** `previewUnavailableReasons` already models "why you cannot hear
 * this" as a *displayed state, not a spinner*; this is the same discipline one
 * level up — why you cannot synchronise to this.
 *
 * The ladder is the brief's. What this module records is which rungs are
 * actually reachable, and `docs/creative-platform/04-music-analysis-adr.md`
 * argues why. In short: no provider available to this app reports tempo, valence
 * or danceability; nothing in the app decodes audio samples; and a licensed
 * preview permits playback, not analysis. So the top three rungs are absent, and
 * their absence is data rather than a comment.
 */

export const musicCapabilityRungs = [
  /** Nothing attached. */
  'none',
  /** Title, artist, genres, year, artwork, attribution. */
  'metadata',
  /** The above, plus somewhere to go and hear it. */
  'external-link',
  /** The above, plus a licensed excerpt that can be *played*. Never analysed. */
  'preview-playback',
  /** Audio the user owns, which may be analysed. Not implemented. */
  'user-audio',
  /** A licensed library with published tempo. Not implemented. */
  'royalty-free',
  /** Server-side analysis. No backend exists. Not implemented. */
  'analysed',
] as const;

export type MusicCapabilityRung = (typeof musicCapabilityRungs)[number];

/**
 * The rungs a track can actually be on in this build.
 *
 * A narrower type than `MusicCapabilityRung` on purpose: `trackCapability` can
 * only ever return one of these, and saying so in the type means a caller
 * writing copy for each case has exactly four to write rather than seven — three
 * of which describe states that cannot occur.
 */
export type ReachableRung = 'none' | 'metadata' | 'external-link' | 'preview-playback';

/** The highest rung this build can reach at all, whatever a track offers. */
export const HIGHEST_REACHABLE_RUNG: MusicCapabilityRung = 'preview-playback';

export const isReachable = (rung: MusicCapabilityRung): boolean =>
  musicCapabilityRungs.indexOf(rung) <= musicCapabilityRungs.indexOf(HIGHEST_REACHABLE_RUNG);

/**
 * What a story can do with the track it carries.
 *
 * `previewResolvable` is the caller's answer to "did the provider hand us a
 * playable excerpt just now" — deliberately a parameter rather than something
 * read here, because a preview is re-resolved on demand and is never persisted
 * (`music.ts`), so this module must not pretend to know.
 */
export function trackCapability(
  track: MusicTrackReference | null,
  previewResolvable: boolean,
): ReachableRung {
  if (track === null) return 'none';
  if (previewResolvable) return 'preview-playback';
  if (track.externalUrl !== null) return 'external-link';
  return 'metadata';
}

/**
 * Whether timing may be derived from the audio itself.
 *
 * Always false in this build, and written as a function rather than a constant
 * so the day user-owned audio arrives, the change is here and every caller
 * already asks. Nothing in the app may cite a beat, a tempo or a downbeat while
 * this returns false.
 */
export const canAnalyseAudio = (rung: MusicCapabilityRung): boolean =>
  rung === 'user-audio' || rung === 'royalty-free' || rung === 'analysed';

/**
 * Whether an export may claim to contain the music.
 *
 * Always false for a carousel: a PNG carries no audio. Kept as a predicate
 * rather than an assumption so that if a video encoder ever lands, exactly one
 * place decides what the export is allowed to say.
 */
export const exportCarriesAudio = (): boolean => false;
