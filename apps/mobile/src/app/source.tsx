import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
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
   * Close the sheet, *then* open what it answered with.
   *
   * **Not `replace`.** This route is presented as a form sheet sized to its own
   * contents, and replacing it hands the next screen that same container: the
   * grade opened inside the sheet, clipped at whatever height the detent had
   * measured, with its nav bar under the status bar because a sheet reports no
   * top inset — it believes something else is already covering that strip.
   *
   * Dismissing first is also what the flow means. The sheet asks a question;
   * the answer belongs on a screen of its own, and the question should not be
   * sitting behind it afterwards.
   */
  const leaveFor = useCallback(
    (href: Href) => {
      if (router.canDismiss()) router.dismiss();
      router.push(href);
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
