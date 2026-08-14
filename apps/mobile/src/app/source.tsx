import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { InteractionManager } from 'react-native';
import { ErrorBoundary } from '@/components';
import { SourceSheet } from '@/features/capture/SourceSheet';
import { useImportPhoto } from '@/features/capture/useImportPhoto';

/**
 * B0 · the door.
 *
 * A chosen photograph is read and saved here, then handed to the grade. There
 * is no fork to answer first: an import always writes a palette record, so both
 * products exist whichever screen opens — and asking someone to pick between
 * "extract colours" and "make it cinematic" before they have seen anything was
 * asking them to choose a screen, not an outcome.
 */
export default function SourceRoute() {
  const router = useRouter();
  const importPhoto = useImportPhoto();

  /**
   * Close the sheet, let it finish closing, *then* open what it answered with.
   *
   * **On iOS a modal is a presentation context, and anything opened from inside
   * one is presented inside it.** This route is a form sheet sized to its own
   * contents, so the grade opened as a child of that sheet: clipped at whatever
   * height the detent had measured for three channels and a filmstrip, and with
   * its nav bar under the status bar — a sheet reports no top inset, because it
   * believes something else already covers that strip. `Screen` applies
   * `insets.top` faithfully; there was nothing to apply.
   *
   * `replace` had the same fault, and so did dismissing and pushing in one tick:
   * the dismissal is a native animation, and a push issued before it lands still
   * finds the sheet presented and attaches to it. `runAfterInteractions` is the
   * wait for that animation — not a timeout guessing at its duration.
   *
   * Sequencing it is also what the flow means. The sheet asks a question; the
   * answer belongs on a screen of its own, and the question should not still be
   * open behind it.
   */
  const leaveFor = useCallback(
    (href: Href) => {
      router.back();
      InteractionManager.runAfterInteractions(() => router.push(href));
    },
    [router],
  );

  return (
    <ErrorBoundary label="Choosing a photo" onReset={() => router.back()}>
      <SourceSheet
        onCamera={() => leaveFor('/capture')}
        onCancel={router.back}
        onPhoto={async (uri) => {
          const outcome = await importPhoto(uri);
          if (outcome.ok) {
            leaveFor(`/tools/grade?id=${outcome.palette.id}`);
            return null;
          }
          // The sheet is still on screen, which is the whole point of reporting
          // here: the failure lands where the photograph was chosen rather than
          // on a grade screen it never reached.
          return outcome.reason;
        }}
        onScan={() => leaveFor('/tools/scan')}
      />
    </ErrorBoundary>
  );
}
