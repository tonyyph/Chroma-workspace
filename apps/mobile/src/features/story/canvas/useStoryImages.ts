import type { StoryProject } from '@cw/domain';
import type { SkImage } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { decodeImage } from '@/lib/readPalette';

/**
 * The decoded photographs the editor's canvas draws.
 *
 * **Previews, never masters.** `previewUri` is capped at 1024px on the long edge
 * by `StoryAssetManager`; the master is capped at 4096. Twenty masters live at
 * once is the out-of-memory crash `bakeGrade.ts` documents, and the editor is
 * exactly where twenty images are on screen together. The exporter is the only
 * thing that touches masters, and it does so one slide at a time.
 *
 * **Decoded once per asset, not once per element.** A subject repeated across a
 * carousel is several elements sharing one `assetId`, and decoding per element
 * would multiply the cost by however many times someone repeated it.
 *
 * An asset whose file is gone resolves to `null` rather than throwing. The
 * renderer draws a visible gap for it and the editor can offer to replace it —
 * see `drawScene`'s `missingAssets`.
 */
export function useStoryImages(project: StoryProject | null): {
  images: ReadonlyMap<string, SkImage>;
  loading: boolean;
} {
  const [images, setImages] = useState<ReadonlyMap<string, SkImage>>(new Map());
  const [loading, setLoading] = useState(false);

  const cache = useRef(new Map<string, SkImage>());
  const wanted = project === null ? '' : project.assets.map((a) => `${a.id}:${uriOf(a)}`).join('|');

  useEffect(() => {
    if (project === null) {
      setImages(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async (): Promise<void> => {
      const next = new Map<string, SkImage>();

      for (const asset of project.assets) {
        const uri = uriOf(asset);
        const cacheKey = `${asset.id}:${uri}`;
        const cached = cache.current.get(cacheKey);
        if (cached !== undefined) {
          next.set(asset.id, cached);
          continue;
        }

        const image = await decodeImage(uri);
        if (cancelled) return;
        if (image !== null) {
          cache.current.set(cacheKey, image);
          next.set(asset.id, image);
        }
      }

      if (cancelled) return;
      setImages(next);
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);

  /**
   * Releases every decoded image when the editor unmounts.
   *
   * Skia images are native memory and are not collected by leaving scope. A
   * story opened, closed and reopened twenty times would otherwise accumulate
   * twenty sets of decoded previews.
   *
   * Deliberately a separate effect with an empty dependency list: folding this
   * into the effect above would dispose images the very next decode still needs.
   */
  useEffect(() => {
    const held = cache.current;
    return () => {
      for (const image of held.values()) image.dispose();
      held.clear();
    };
  }, []);

  return { images, loading };
}

/** The editing copy, falling back to the master when no preview was made. */
const uriOf = (asset: StoryProject['assets'][number]): string => asset.previewUri ?? asset.uri;
