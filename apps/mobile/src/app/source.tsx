import { useRouter } from 'expo-router';
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
 *
 * `replace`, not `push`: the sheet is a question, and going back to a question
 * that has been answered is not a place anyone wants to land.
 */
export default function SourceRoute() {
  const router = useRouter();
  const importPhoto = useImportPhoto();

  return (
    <ErrorBoundary label="Choosing a photo" onReset={() => router.back()}>
      <SourceSheet
        onCamera={() => router.replace('/capture')}
        onCancel={router.back}
        onPhoto={async (uri) => {
          const outcome = await importPhoto(uri);
          if (outcome.ok) {
            router.replace(`/tools/grade?id=${outcome.palette.id}`);
            return null;
          }
          // The sheet is still on screen, which is the whole point of reporting
          // here: the failure lands where the photograph was chosen rather than
          // on a grade screen it never reached.
          return outcome.reason;
        }}
        onScan={() => router.replace('/tools/scan')}
      />
    </ErrorBoundary>
  );
}
