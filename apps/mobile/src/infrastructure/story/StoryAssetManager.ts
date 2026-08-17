import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { toDecodableUri } from '@/lib/decodable';
import { THUMBNAIL_LONG_EDGE } from '@/lib/grade';

/**
 * Where a story's photographs live, and in how many sizes.
 *
 * **Why not reuse `lib/photos.ts`.** That module keys a file by the palette that
 * owns it — one photograph, one memory, one name. A story is the other shape
 * entirely: many photographs, each possibly drawn by several elements, and the
 * same photograph may appear in two different stories. Keying by asset id inside
 * a per-story folder keeps those independent, so deleting one story cannot take
 * a file another story is still drawing.
 *
 * **The rule it does inherit, unchanged.** Files go under `Paths.document`, never
 * the cache directory. iOS purges caches whenever it wants storage back, and the
 * app has already paid for that once — `photos.ts` exists because "a palette
 * saved in March showed a blank card in April". A story is a document someone
 * expects to reopen in June.
 *
 * **Two sizes, deliberately.**
 *
 *   - the **master**, capped at `EXPORT_LONG_EDGE`, is what the exporter reads;
 *   - the **preview**, capped at `THUMBNAIL_LONG_EDGE`, is what the canvas draws.
 *
 * The editor must never decode masters. Twenty 48MP frames live at once is an
 * out-of-memory crash, and `bakeGrade.ts` documents that exact failure at that
 * exact ceiling. The preview is small enough that twenty of them are ordinary.
 */

const FOLDER = 'story-assets';

/**
 * Long edge of a stored master.
 *
 * The same 4096 ceiling `bakeGrade.ts` sets, and for the same reason — but
 * applied at *import* rather than at export. A story holds up to twenty
 * photographs, so keeping originals would mean a single project could occupy
 * several hundred megabytes of a user's device for pixels no export can use.
 */
export const STORY_MASTER_LONG_EDGE = 4096;

/** Long edge of the copy the canvas draws. Matches the app's existing thumbnail. */
export const STORY_PREVIEW_LONG_EDGE = THUMBNAIL_LONG_EDGE;

export type ImportedAsset = {
  uri: string;
  previewUri: string | null;
  width: number;
  height: number;
};

function storyDirectory(storyId: string): Directory {
  const directory = new Directory(Paths.document, FOLDER, storyId);
  // `idempotent` so importing a second photograph does not throw on the folder
  // the first one created.
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/**
 * Brings a chosen photograph into a story.
 *
 * Returns the master's dimensions as measured *after* normalisation, not as the
 * picker reported them. Those are the numbers a crop is a fraction of, and a
 * crop computed against the original then applied to a resized master is exactly
 * the kind of off-by-a-scale-factor bug that only shows up on export.
 *
 * Returns `null` rather than throwing when the import cannot be completed. The
 * caller is a picker callback; a rejected promise there becomes an unhandled
 * rejection, and the user's actual problem — "that photo did not come in" — is
 * better said by a screen than by a stack.
 */
export async function importStoryAsset(
  sourceUri: string,
  storyId: string,
  assetId: string,
): Promise<ImportedAsset | null> {
  try {
    // HEIC is what an iPhone actually stores, and Skia has no HEIF codec. This
    // is the same transcode the capture path already performs before extraction.
    const decodable = await toDecodableUri(sourceUri);

    const master = await render(decodable, STORY_MASTER_LONG_EDGE);
    if (master === null) return null;

    const directory = storyDirectory(storyId);
    const masterFile = new File(directory, `${assetId}.jpg`);
    if (masterFile.exists) masterFile.delete();
    new File(master.uri).copy(masterFile);

    // A missing preview is survivable — `previewUri` is nullable and the canvas
    // falls back to the master — so a failure here must not lose the import.
    const preview = await render(decodable, STORY_PREVIEW_LONG_EDGE);
    let previewUri: string | null = null;
    if (preview !== null) {
      const previewFile = new File(directory, `${assetId}.preview.jpg`);
      if (previewFile.exists) previewFile.delete();
      new File(preview.uri).copy(previewFile);
      previewUri = previewFile.uri;
    }

    return {
      uri: masterFile.uri,
      previewUri,
      width: master.width,
      height: master.height,
    };
  } catch {
    return null;
  }
}

/**
 * Resizes to fit a long edge and writes a JPEG, or null.
 *
 * `resize` takes one dimension and preserves the aspect, so which one to pass
 * depends on the orientation — passing both would distort a portrait frame into
 * a square. There is no upscaling branch: `renderAsync` on an image already
 * inside the ceiling would re-encode it for nothing, so the caller's ceiling is
 * only applied when it actually binds.
 */
async function render(
  uri: string,
  longEdge: number,
): Promise<{ uri: string; width: number; height: number } | null> {
  try {
    const context = ImageManipulator.manipulate(uri);
    const probe = await context.renderAsync();

    const isLandscape = probe.width >= probe.height;
    const currentLongEdge = isLandscape ? probe.width : probe.height;

    // Already inside the ceiling: save what we have rather than resampling it.
    const rendered =
      currentLongEdge <= longEdge
        ? probe
        : await ImageManipulator.manipulate(uri)
            .resize(isLandscape ? { width: longEdge } : { height: longEdge })
            .renderAsync();

    // Quality 0.9 rather than 1: these are composition inputs that will be
    // resampled again at export, and a lossless master of a phone photograph is
    // storage spent on detail no exported slide can show.
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
    return { uri: saved.uri, width: rendered.width, height: rendered.height };
  } catch {
    return null;
  }
}

/**
 * Removes every file a story owns.
 *
 * Called when the story itself goes. Deleting only the record would leave its
 * photographs occupying storage that no screen can reach or remove — the same
 * orphaning `StoredMemoryRepository.remove` avoids for memories.
 */
export function deleteStoryAssets(storyId: string): void {
  try {
    const directory = new Directory(Paths.document, FOLDER, storyId);
    if (directory.exists) directory.delete();
  } catch {
    // Files that cannot be deleted are wasted space, not a reason to fail the
    // delete the user actually asked for.
  }
}

/**
 * Whether an asset's bytes are still where the document says they are.
 *
 * A missing file is an expected condition rather than corruption — a restore
 * from backup, a failed write, a user clearing storage — and the editor's answer
 * is a visible, replaceable gap. This is what lets it tell the difference
 * between that and a document that was never valid.
 */
export function assetExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
