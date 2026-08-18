import {
  coverCrop,
  formatOf,
  sliceBounds,
  type StoryElement,
  type StoryFormatId,
} from '@cw/domain';

/**
 * Where a photograph lands when it first arrives.
 *
 * Full-bleed on its own slide, cropped to fill without distortion. That is the
 * composition someone who chose three pictures for a three-slide carousel is
 * asking for, and it is the one that needs the fewest corrections afterwards —
 * a photograph that arrives letter boxed inside its slide has to be resized
 * before any real work starts.
 *
 * Pure, and separated from the screen, because the crop arithmetic is the part
 * that is wrong in ways only an export reveals: a cover crop computed against
 * the wrong pair of dimensions produces a preview that looks right and an
 * exported slide that is squashed.
 */
export function placePhotoOnSlide(input: {
  elementId: string;
  assetId: string;
  sourceWidth: number;
  sourceHeight: number;
  format: StoryFormatId;
  slideIndex: number;
}): StoryElement {
  const format = formatOf(input.format);
  const frame = sliceBounds(format, input.slideIndex);

  return {
    kind: 'photo',
    id: input.elementId,
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: input.assetId,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    crop: coverCrop(
      { width: input.sourceWidth, height: input.sourceHeight },
      { width: frame.width, height: frame.height },
    ),
    // The centre until the author moves it. Honest as a default: nothing has
    // looked at this photograph yet, so the app has no basis for guessing where
    // its subject is. Cross-format adaptation reframes around whatever this
    // ends up being.
    focal: { x: 0.5, y: 0.5 },
    // Unmasked. Nothing can produce a mask yet — no extractor is implemented
    // (decision D4) — and a photograph arrives whole in any case.
    maskAssetId: null,
  };
}
