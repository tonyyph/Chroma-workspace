import type { Grade } from '@cw/domain';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { shareFile } from '@/lib/export';
import { EXPORT_LONG_EDGE, renderGraded } from './bakeGrade';

/**
 * Getting a graded photograph out of the app.
 *
 * Two destinations over one renderer. Saving puts it in the camera roll, which
 * is where a photograph belongs and is why this module carries a permission at
 * all. Sharing hands the same bytes to the system sheet.
 *
 * Neither is gated: the export is free at full resolution and carries no
 * watermark on any tier. What Pro buys is the look, not the file.
 */

export type GradeExportOutcome = 'saved' | 'shared' | 'dismissed' | 'denied' | 'failed';

/** Named for the person, not the palette: this is what lands in their library. */
const FILENAME = 'chromawave-graded.png';

/**
 * Renders at export size and writes to the photo library.
 *
 * `denied` is a distinct outcome from `failed` because the two need different
 * sentences: one is answered in Settings and the other is not the user's doing
 * at all. Collapsing them would leave someone tapping a button that will never
 * work with no idea why.
 */
export async function saveGradedToPhotos(
  sourceUri: string,
  grade: Grade,
): Promise<GradeExportOutcome> {
  const bytes = await renderGraded(sourceUri, grade, EXPORT_LONG_EDGE);
  if (!bytes) return 'failed';

  try {
    // Write-only: the app is adding a photograph, not reading the library, and
    // asking for more access than that is a permission prompt people refuse.
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) return 'denied';

    // `saveToLibraryAsync` takes a file, so the bytes land in the cache first.
    // The cache is the right home for it: the copy that matters is now the one
    // in the photo library, and the system can reclaim this whenever it likes.
    const file = new File(Paths.cache, FILENAME);
    file.create({ overwrite: true, intermediates: true });
    file.write(bytes);

    await MediaLibrary.saveToLibraryAsync(file.uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Renders at export size and hands the file to the system share sheet. */
export async function shareGraded(sourceUri: string, grade: Grade): Promise<GradeExportOutcome> {
  const bytes = await renderGraded(sourceUri, grade, EXPORT_LONG_EDGE);
  if (!bytes) return 'failed';

  const outcome = await shareFile(bytes, FILENAME);
  if (outcome === 'shared') return 'shared';
  return outcome === 'dismissed' ? 'dismissed' : 'failed';
}
