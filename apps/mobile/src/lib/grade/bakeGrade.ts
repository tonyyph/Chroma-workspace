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
export const THUMBNAIL_LONG_EDGE = 1024;

/**
 * Long edge of an exported copy.
 *
 * Not the frame's own size. A 48MP photograph through `Skia.Surface.MakeOffscreen`
 * is the shortest route to an out-of-memory crash on an older phone, and a crash
 * while saving is a worse outcome than a ceiling. 4096px prints A3 at 300dpi,
 * which is past where anyone is taking a phone photograph.
 */
export const EXPORT_LONG_EDGE = 4096;

const FOLDER = 'palette-photos';

/**
 * The size a frame is rendered at, and the scale that gets it there.
 *
 * Null for a frame with no area: a zero-dimension surface is not an error worth
 * throwing about, but it is certainly not something to hand to the GPU.
 */
export function targetSize(
  width: number,
  height: number,
  longEdge: number,
): { width: number; height: number; scale: number } | null {
  if (width <= 0 || height <= 0) return null;
  // `min(1, …)` is the no-upscaling rule: a frame already inside the ceiling is
  // rendered at its own size, because enlarging it invents detail it never had.
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Renders a graded copy in memory and returns its PNG bytes, or null.
 *
 * The bytes rather than a file, because the two callers want different things
 * done with them — one writes beside the palette, the other hands them to the
 * photo library or the share sheet — and a renderer that also decided where
 * things live would have to be asked twice.
 */
export async function renderGraded(
  sourceUri: string,
  grade: Grade,
  longEdge: number,
): Promise<Uint8Array | null> {
  try {
    const image = await decodeImage(sourceUri);
    if (!image) return null;

    try {
      const size = targetSize(image.width(), image.height(), longEdge);
      if (!size) return null;

      const surface = Skia.Surface.MakeOffscreen(size.width, size.height);
      if (!surface) return null;

      const effect = Skia.RuntimeEffect.Make(GRADE_SHADER);
      if (!effect) return null;

      const matrix = Skia.Matrix();
      matrix.scale(size.scale, size.scale);
      const source = image.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.Linear,
        matrix,
      );

      const named = gradeUniforms(resolveGrade(grade), size.width, size.height);
      const flat: number[] = [];
      for (const name of GRADE_UNIFORM_ORDER) {
        const value = named[name];
        if (Array.isArray(value)) flat.push(...value);
        else flat.push(value as number);
      }

      const paint = Skia.Paint();
      paint.setShader(effect.makeShaderWithChildren(flat, [source]));

      const canvas = surface.getCanvas();
      canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), paint);
      surface.flush();

      const bytes = surface.makeImageSnapshot().encodeToBytes();
      return bytes && bytes.length > 0 ? bytes : null;
    } finally {
      image.dispose();
    }
  } catch {
    return null;
  }
}

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
  const bytes = await renderGraded(sourceUri, grade, THUMBNAIL_LONG_EDGE);
  return bytes ? write(bytes, paletteId) : null;
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
