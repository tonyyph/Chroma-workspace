import { readableOn, type Color } from '@cw/domain';
import { useMemo } from 'react';
import { useSkin } from '@/providers';
import { accentTint } from '@/ui/chroma';

export type Accent = {
  /** The colour itself, guaranteed to clear AA against the app's ground. */
  color: string;
  /** A filled-pill recipe in that colour, shaped like the `tint.*` tokens. */
  tint: { backgroundColor: string; borderColor: string; color: string };
};

/**
 * The one colour a screen borrows from its subject.
 *
 * The signal role, because that is the colour the extractor already decided was
 * the accent — "the accent that makes people look" is the app's own definition
 * of it, and picking a different one here would mean the app disagreed with
 * itself about which colour that is.
 *
 * Run through `readableOn` first: a signal read off a night photograph can be
 * almost black, and an accent nobody can see is not an accent. Lightness moves,
 * hue does not, so what comes back is recognisably the colour in the picture.
 *
 * Returns null when there is no single subject, which is the signal to callers
 * to keep the brand's own violet rather than invent something.
 */
export function useAccent(colors: readonly Color[] | null): Accent | null {
  const skin = useSkin();
  return useMemo(() => {
    if (!colors?.length) return null;
    const signal = colors.find((color) => color.role === 'signal');
    const source = signal ?? colors[colors.length - 1] ?? colors[0];
    if (!source) return null;
    const color = readableOn(source.hex, skin.ui.bg.base, 4.5);
    return { color, tint: accentTint(color) };
  }, [colors, skin]);
}
