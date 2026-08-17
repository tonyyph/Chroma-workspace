import type { TextRole } from '@cw/domain';
import { matchFont, type SkFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useSkin } from '@/providers';
import type { SceneTypography } from './drawScene';

/**
 * Type on the canvas, as opposed to type on a screen.
 *
 * **Story text cannot reuse the skin's sizes, and this is why.** The skin's
 * `title` is 28pt because a screen is ~390 points wide. A story slide is 1080
 * *canvas units* wide, so 28 there is a caption a reader would need to zoom to
 * find. The sizes below are expressed in canvas units against that 1080
 * reference, which is also what makes them deterministic: the same document
 * produces the same pixels on every device, because nothing here is measured in
 * screen points.
 *
 * **The skin still chooses the family.** Swiss sets labels and numbers in mono
 * and chroma does not, and a story that hard-coded a family would look like
 * chroma's idea of a headline under both — the appearance leak
 * `no-appearance-leaks.test.ts` fails the build over. So: sizes are the canvas's,
 * families are the skin's.
 */

/** The canvas width every size below is expressed against. */
export const STORY_TYPE_REFERENCE_WIDTH = 1080;

/**
 * Base size per role, in canvas units.
 *
 * Chosen against the reference width rather than derived from the screen scale:
 * `display` at 112 is roughly a tenth of the slide's width, which is the size a
 * headline has to be to read as one in a feed thumbnail.
 */
export const STORY_TYPE_SIZES: Readonly<Record<TextRole, number>> = {
  display: 112,
  title: 72,
  body: 40,
  meta: 28,
};

/**
 * The size an element's text is actually drawn at.
 *
 * Pure and exported so the arithmetic can be asserted — this is the number that
 * has to agree between the editor's preview and the exporter, and a mismatch
 * shows up as text that moves when you export it.
 */
export const storyFontSize = (role: TextRole, scale: number, canvasWidth: number): number => {
  const base = STORY_TYPE_SIZES[role];
  // Sizes are relative to the reference width, so a format whose slides are a
  // different width scales its type rather than keeping it at absolute pixels.
  return base * scale * (canvasWidth / STORY_TYPE_REFERENCE_WIDTH);
};

/**
 * One `SkFont` per text role, in the active skin's families.
 *
 * `matchFont` resolves through the platform's font manager rather than loading a
 * file, so it finds the families `_layout.tsx` already registered with
 * `expo-font` and needs no second copy of them in the bundle. A family the
 * platform cannot find falls back to the system face — the text still draws,
 * which is the right failure for a renderer.
 */
export function useStoryFonts(canvasWidth: number, scale = 1): SceneTypography | null {
  const skin = useSkin();

  return useMemo(() => {
    /**
     * Null when Skia's font manager is not there to ask.
     *
     * `matchFont` reaches the platform's font manager through Skia's native
     * side, which is absent under jest and during the moment before Skia has
     * loaded. `LivingStage` guards its `RuntimeEffect` the same way and renders
     * nothing until it resolves — a canvas that cannot measure text cannot draw
     * a scene, and returning a half-built typography would put the failure
     * somewhere much harder to see than here.
     */
    try {
      const build = (role: TextRole, family: string): SkFont =>
        matchFont({
          fontFamily: family,
          fontSize: storyFontSize(role, scale, canvasWidth),
        });

      return {
        display: build('display', skin.type.display.fontFamily),
        title: build('title', skin.type.title.fontFamily),
        body: build('body', skin.type.body.fontFamily),
        meta: build('meta', skin.type.meta.fontFamily),
      };
    } catch {
      return null;
    }
  }, [canvasWidth, scale, skin]);
}
