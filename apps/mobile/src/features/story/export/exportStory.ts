import {
  canvasSize,
  formatOf,
  planSlicesFor,
  verifyTiling,
  type StoryProject,
  type TextRole,
} from '@cw/domain';
import { Skia, type SkImage } from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import { decodeImage } from '@/lib/readPalette';
import { drawScene, type SceneTypography } from '../render/drawScene';

/**
 * Turning a story into the images someone posts.
 *
 * **One slice at a time, and nothing held between them.** Twenty 1080×1350
 * surfaces at four bytes a pixel is ~117MB before a single photograph is
 * decoded, and a story may reference twenty masters at 4096px. So each slide
 * decodes only the images it actually shows, draws, encodes, writes, and
 * disposes before the next begins. Peak memory is one slide, not one story.
 * `bakeGrade.ts` documents the crash this avoids, at this exact ceiling.
 *
 * **The tiling is verified before anything is written.** A story that would
 * export with a seam refuses to export at all. A carousel someone posts and only
 * then notices is a far worse failure than an error message.
 */

const FOLDER = 'story-exports';

export type ExportProgress = {
  completed: number;
  total: number;
};

export type ExportResult =
  | {
      status: 'exported';
      files: readonly string[];
      missingAssets: readonly string[];
    }
  | { status: 'failed'; reason: ExportFailure };

/**
 * Why an export did not happen, as something a screen can translate.
 *
 * A closed union rather than an `Error`: these are conditions the user can
 * usually act on — free some space, replace a missing photo — and a message
 * string would have to be written in two languages at the throw site.
 */
export type ExportFailure =
  'no-slides' | 'seam-detected' | 'surface-unavailable' | 'encode-failed' | 'write-failed';

export type ExportOptions = {
  project: StoryProject;
  fonts: SceneTypography;
  background: string;
  onProgress?: (progress: ExportProgress) => void;
  shouldCancel?: () => boolean;
};

export async function exportStory(options: ExportOptions): Promise<ExportResult> {
  const { project, fonts, background, onProgress, shouldCancel } = options;

  const plans = planSlicesFor(project);
  if (plans.length === 0) return { status: 'failed', reason: 'no-slides' };

  const canvas = canvasSize(formatOf(project.format), project.slideCount);
  if (verifyTiling(plans, canvas).length > 0) {
    return { status: 'failed', reason: 'seam-detected' };
  }

  const directory = new Directory(Paths.cache, FOLDER, project.id);
  directory.create({ intermediates: true, idempotent: true });

  const files: string[] = [];
  const missingAssets = new Set<string>();

  for (const plan of plans) {
    if (shouldCancel?.() === true) break;

    const outcome = await renderSlice({
      project,
      plan,
      fonts,
      background,
      directory,
    });

    if (outcome.status === 'failed') return outcome;

    files.push(outcome.file);
    for (const assetId of outcome.missingAssets) missingAssets.add(assetId);

    onProgress?.({ completed: files.length, total: plans.length });
  }

  return { status: 'exported', files, missingAssets: [...missingAssets] };
}

/**
 * Which assets one slide actually needs decoded.
 *
 * **This function is the memory guarantee.** A twenty-slide story where each
 * slide holds its own photograph decodes one master at a time rather than
 * twenty, and that is the difference between an export that works on an older
 * phone and one that is killed partway through. It is pure and exported so the
 * claim can be asserted rather than assumed.
 *
 * Hidden and fully transparent elements are excluded because they are not in the
 * output — decoding a 4096px master to draw nothing is the most expensive
 * possible no-op.
 */
export function assetsForSlice(
  layers: readonly StoryProject['layers'][number][],
  plan: { bounds: { x: number }; width: number },
): ReadonlySet<string> {
  const needed = new Set<string>();
  const sliceStart = plan.bounds.x;
  const sliceEnd = plan.bounds.x + plan.width;

  for (const layer of layers) {
    if (layer.kind !== 'photo' && layer.kind !== 'video') continue;
    if (layer.hidden || layer.opacity <= 0) continue;
    if (layer.frame.x < sliceEnd && sliceStart < layer.frame.x + layer.frame.width) {
      needed.add(layer.assetId);
    }
  }

  return needed;
}

type SliceOutcome =
  | { status: 'rendered'; file: string; missingAssets: readonly string[] }
  | { status: 'failed'; reason: ExportFailure };

/**
 * Renders exactly one slide and releases everything it touched.
 *
 * The `finally` is what makes the memory claim hold rather than merely being
 * intended: an image left undisposed because an encode threw is a leak that only
 * shows up on the twentieth slide of a long story, on someone else's phone.
 *
 * (This is a plain function, not a component or hook, so the React Compiler
 * bail-out that `finally` causes — see `apps/mobile/AGENTS.md` — does not apply.)
 */
async function renderSlice(input: {
  project: StoryProject;
  plan: ReturnType<typeof planSlicesFor>[number];
  fonts: SceneTypography;
  background: string;
  directory: Directory;
}): Promise<SliceOutcome> {
  const { project, plan, fonts, background, directory } = input;

  const needed = assetsForSlice(project.layers, plan);
  const decoded = new Map<string, SkImage>();

  try {
    for (const assetId of needed) {
      const asset = project.assets.find((entry) => entry.id === assetId);
      if (asset === undefined) continue;
      const image = await decodeImage(asset.uri);
      if (image !== null) decoded.set(assetId, image);
    }

    const surface = Skia.Surface.MakeOffscreen(plan.width, plan.height);
    if (surface === null) return { status: 'failed', reason: 'surface-unavailable' };

    const report = drawScene({
      canvas: surface.getCanvas(),
      layers: project.layers,
      plan,
      images: (assetId) => decoded.get(assetId) ?? null,
      fonts,
      scale: 1,
      background,
    });

    surface.flush();
    const bytes = surface.makeImageSnapshot().encodeToBytes();
    if (bytes === null) return { status: 'failed', reason: 'encode-failed' };

    try {
      const file = new File(directory, `${slideName(plan.index)}.png`);
      if (file.exists) file.delete();
      file.write(bytes);
      return { status: 'rendered', file: file.uri, missingAssets: report.missingAssets };
    } catch {
      return { status: 'failed', reason: 'write-failed' };
    }
  } finally {
    for (const image of decoded.values()) image.dispose();
    decoded.clear();
  }
}

/**
 * `slide-01`, not `slide-1`.
 *
 * Share sheets and photo libraries sort lexicographically, and a ten-slide
 * carousel posted in the order `1, 10, 2, 3…` is a carousel that reads wrong.
 */
const slideName = (index: number): string => `slide-${String(index + 1).padStart(2, '0')}`;

/**
 * Removes a story's exported files.
 *
 * Exports live in the cache directory on purpose — they are derived, they can
 * always be made again, and iOS reclaiming them costs nothing. This exists so
 * the space can be returned immediately after a share rather than waiting for
 * the system to want it.
 */
export function clearStoryExports(storyId: string): void {
  try {
    const directory = new Directory(Paths.cache, FOLDER, storyId);
    if (directory.exists) directory.delete();
  } catch {}
}

/** Which text roles a caller must supply fonts for. Exported so a screen cannot miss one. */
export const requiredTextRoles: readonly TextRole[] = ['display', 'title', 'body', 'meta'];
