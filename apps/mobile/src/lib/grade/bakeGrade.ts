import { resolveGrade, type Grade } from '@cw/domain';
import { FilterMode, MipmapMode, Skia, TileMode } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import { decodeImage } from '@/lib/readPalette';
import { GRADE_SHADER, GRADE_UNIFORM_ORDER, gradeUniforms } from './gradeShader';

/**
 * Renders a graded copy of a photograph, once, and writes it to disk.
 *
 * **Why bake at all.** The grade is stored as eleven numbers and re-rendered
 * live wherever the photograph is large — the grade screen, the performance. A
 * library grid is the case that cannot work that way: mounting a Skia canvas and
 * compiling a runtime effect per card, for a list the user flicks through, is the
 * classic way to turn a smooth grid into a stuttering one. So the moment someone
 * applies a grade — the one moment they are already waiting — a graded copy is
 * rendered at card size and every list reads that instead.
 *
 * The original frame is never touched. It is what re-grading a year later starts
 * from, and a baked file that replaced it would make the grade permanent, which
 * is the opposite of what storing eleven numbers was for.
 */

/**
 * Long edge of the baked copy.
 *
 * Comfortably above the largest card the app draws on a 3x screen, and far below
 * the frame itself: this is a thumbnail with a look, not a second master.
 */
const LONG_EDGE = 1024;

const FOLDER = 'palette-photos';

/**
 * Writes the graded copy and returns its uri, or null if anything on the way
 * failed.
 *
 * Null rather than throwing: a grade that saved but could not be baked is a
 * grade that still works everywhere it is rendered live, and the caller has a
 * more useful thing to do with that than a crash.
 */
export async function bakeGradedThumbnail(
  sourceUri: string,
  grade: Grade,
  paletteId: string,
): Promise<string | null> {
  try {
    const image = await decodeImage(sourceUri);
    if (!image) return null;

    try {
      const width = image.width();
      const height = image.height();
      if (width <= 0 || height <= 0) return null;

      const scale = Math.min(1, LONG_EDGE / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const surface = Skia.Surface.MakeOffscreen(targetWidth, targetHeight);
      if (!surface) return null;

      const effect = Skia.RuntimeEffect.Make(GRADE_SHADER);
      if (!effect) return null;

      const matrix = Skia.Matrix();
      matrix.scale(scale, scale);
      const source = image.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.Linear,
        matrix,
      );

      const named = gradeUniforms(resolveGrade(grade), targetWidth, targetHeight);
      const flat: number[] = [];
      for (const name of GRADE_UNIFORM_ORDER) {
        const value = named[name];
        if (Array.isArray(value)) flat.push(...value);
        else flat.push(value as number);
      }

      const paint = Skia.Paint();
      paint.setShader(effect.makeShaderWithChildren(flat, [source]));

      const canvas = surface.getCanvas();
      canvas.drawRect(Skia.XYWHRect(0, 0, targetWidth, targetHeight), paint);
      surface.flush();

      const bytes = surface.makeImageSnapshot().encodeToBytes();
      if (!bytes || bytes.length === 0) return null;

      return write(bytes, paletteId);
    } finally {
      image.dispose();
    }
  } catch {
    return null;
  }
}

/**
 * Beside the palette's own photograph, in the directory the system does not
 * reclaim — `StoredMemoryRepository` already deletes this path with the memory.
 */
function write(bytes: Uint8Array, paletteId: string): string | null {
  try {
    const directory = new Directory(Paths.document, FOLDER);
    directory.create({ intermediates: true, idempotent: true });

    const file = new File(directory, `${paletteId}-graded.png`);
    if (file.exists) file.delete();
    file.create();
    file.write(bytes);
    return file.uri;
  } catch {
    return null;
  }
}
