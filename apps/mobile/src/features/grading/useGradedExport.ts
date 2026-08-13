import { gradesEqual, type Grade } from '@cw/domain';
import { useCallback, useState } from 'react';
import { hapticsService } from '@/infrastructure/dependencies';
import { saveGradedToPhotos, shareGraded, type GradeExportOutcome } from '@/lib/grade';

export type ExportStatus = 'idle' | 'working' | GradeExportOutcome;

/**
 * Getting the grade on screen out of the app.
 *
 * It exports the grade being *shown*, not the one on the record. Someone who
 * moved a slider and wants that frame should not have to apply it to the palette
 * first — applying is about the library, and saving a photograph is not.
 *
 * Every terminal state is drawn by the caller, refusal included. A save button
 * that silently does nothing when permission was denied is the worst outcome
 * available here, and it is the one that happens by default.
 */
export function useGradedExport(photoUri: string | null, grade: Grade) {
  const [working, setWorking] = useState(false);
  /**
   * The last outcome, and the grade it belongs to.
   *
   * Kept together because an outcome is only true of the look that produced it.
   * A bare status would leave "Saved to your photos" sitting under a look nobody
   * has saved as soon as the user picks a different one — the message claiming
   * something that did not happen.
   */
  const [done, setDone] = useState<{ outcome: GradeExportOutcome; grade: Grade } | null>(null);

  const status: ExportStatus = working
    ? 'working'
    : done && gradesEqual(done.grade, grade)
      ? done.outcome
      : 'idle';

  const run = useCallback(
    (action: (uri: string, grade: Grade) => Promise<GradeExportOutcome>) => {
      if (!photoUri || working) return;
      setWorking(true);
      void (async () => {
        const outcome = await action(photoUri, grade);
        setDone({ outcome, grade });
        setWorking(false);
        if (outcome === 'saved' || outcome === 'shared') {
          void hapticsService.fire('extractionComplete');
        }
      })();
    },
    [photoUri, grade, working],
  );

  return {
    status,
    save: useCallback(() => run(saveGradedToPhotos), [run]),
    share: useCallback(() => run(shareGraded), [run]),
  };
}
