import type { Palette } from '@cw/domain';
import { useCallback } from 'react';
import { readPalette, toDecodableUri } from '@/lib';
import { useCaptureStore } from '@/store';
import { useCaptureCommit } from './useCaptureCommit';

/**
 * Why three failures rather than a nullable.
 *
 * They are three different sentences. A photograph the decoder cannot open is
 * not a photograph with too little colour in it, and neither is a record the
 * store refused to write — telling a user to "try another photo" when the disk
 * is full sends them round a loop that cannot end.
 */
export type ImportOutcome =
  { ok: true; palette: Palette } | { ok: false; reason: 'decode' | 'tooFewColours' | 'write' };

/**
 * Everything that happens between choosing a photograph and having one.
 *
 * **One implementation, two callers.** The recents strip and the system picker
 * both arrive here with nothing but a uri, which is what stops the quick path
 * and the thorough path from drifting into two different behaviours for one
 * job. The steps are the ones the old import route performed inline; what is
 * new is that they are named, ordered in one place, and each failure survives
 * as far as the screen.
 */
export function useImportPhoto(): (uri: string) => Promise<ImportOutcome> {
  const begin = useCaptureStore((state) => state.begin);
  const discard = useCaptureStore((state) => state.discard);
  const commit = useCaptureCommit();

  return useCallback(
    async (uri: string): Promise<ImportOutcome> => {
      // An iPhone's library is mostly HEIC and the shipped Skia binary carries
      // no HEIF codec, so this is not an optimisation — it is the difference
      // between reading most of a real user's photos and none of them.
      const decodable = await toDecodableUri(uri);
      const outcome = await readPalette(decodable, 5);
      if (!outcome.ok) return { ok: false, reason: 'decode' };

      /**
       * Checked here rather than left to `toPalette`.
       *
       * A palette needs two colours. Below that the commit returns null, which
       * is indistinguishable from a write that failed — and the old route
       * swallowed both with a bare `return`, so tapping a photograph simply did
       * nothing. Splitting the check is what lets the two say different things.
       */
      if (outcome.result.colors.length < 2) return { ok: false, reason: 'tooFewColours' };

      begin({
        colors: outcome.result.colors,
        photoUri: decodable,
        // The whole image was read, so there is no sampling drift to report:
        // this is the photograph's own colour, not an estimate of it.
        deltaE: 0,
        confidence: 1,
        source: 'photo',
      });

      const palette = await commit('Imported photo');
      if (!palette) {
        // `commit` leaves the pending capture in place when it writes nothing.
        // Left there, the next screen to read the store would show a photograph
        // nobody chose.
        discard();
        return { ok: false, reason: 'write' };
      }

      return { ok: true, palette };
    },
    [begin, commit, discard],
  );
}
