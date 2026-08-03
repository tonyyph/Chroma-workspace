import { Directory, File, Paths } from 'expo-file-system';

/**
 * Where a capture's frame lives once it belongs to a saved palette.
 *
 * **Why this exists.** Both sources of a `photoUri` hand back a temporary path:
 * Vision Camera writes the shot into the app's caches directory, and
 * `expo-image-picker` copies the chosen photo there too. iOS purges that
 * directory whenever it wants storage back, so a palette saved in March showed a
 * blank card in April — the record survived, the picture did not.
 *
 * The document directory is the one iOS does not reclaim, and is what the
 * palette's own lifetime is measured against.
 */
const FOLDER = 'palette-photos';

function photosDirectory(): Directory {
  const directory = new Directory(Paths.document, FOLDER);
  // `idempotent` so a second capture does not throw on an existing folder.
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

/**
 * Copies a captured frame into permanent storage, keyed by the palette that owns
 * it. Returns the new URI, or the original if the copy failed.
 *
 * Falling back to the original is deliberate: a palette with a photo that may
 * expire is better than refusing the save outright, and every reader already
 * handles a `photoUri` that no longer resolves.
 */
export function persistPhoto(sourceUri: string | null, paletteId: string): string | null {
  if (!sourceUri) return null;
  // Re-saving the same palette must not copy its photo onto itself. A *different*
  // palette pointing at it must, though — duplicating a palette and then deleting
  // the original would otherwise take the copy's photo with it.
  if (sourceUri.includes(`/${FOLDER}/${paletteId}.`)) return sourceUri;

  try {
    const source = new File(sourceUri);
    if (!source.exists) return sourceUri;

    // The extension matters: `expo-image` picks its decoder from it.
    const extension = sourceUri.split('.').pop()?.split('?')[0] ?? 'jpg';
    const destination = new File(photosDirectory(), `${paletteId}.${extension}`);
    if (destination.exists) destination.delete();
    source.copy(destination);
    return destination.uri;
  } catch {
    return sourceUri;
  }
}

/**
 * Removes a palette's frame. Called when the palette goes, so deleting a library
 * does not leave its photos occupying storage no screen can reach.
 */
export function deletePhoto(uri: string | null): void {
  if (!uri || !uri.includes(`/${FOLDER}/`)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // A photo that cannot be deleted is wasted space, not a failure worth
    // interrupting the delete the user actually asked for.
  }
}
