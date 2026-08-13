import type { Grade } from '@cw/domain';
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
  const [status, setStatus] = useState<ExportStatus>('idle');

  const run = useCallback(
    (action: (uri: string, grade: Grade) => Promise<GradeExportOutcome>) => {
      if (!photoUri || status === 'working') return;
      setStatus('working');
      void (async () => {
        const outcome = await action(photoUri, grade);
        setStatus(outcome);
        if (outcome === 'saved' || outcome === 'shared') {
          void hapticsService.fire('extractionComplete');
        }
      })();
    },
    [photoUri, grade, status],
  );

  return {
    status,
    save: useCallback(() => run(saveGradedToPhotos), [run]),
    share: useCallback(() => run(shareGraded), [run]),
  };
}
