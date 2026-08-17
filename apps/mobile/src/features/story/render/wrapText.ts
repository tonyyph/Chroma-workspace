/**
 * Breaking a caption into lines.
 *
 * Pure, and given its measurer rather than owning one, so the hard part — where
 * the breaks land — is testable without a font, a canvas or a device. Skia's
 * `SkFont.measureText` is what the renderer passes in; a fake ruler is what the
 * tests pass in.
 *
 * Greedy rather than optimal (no Knuth–Plass). A caption on a story slide is a
 * few words at display size, where the difference between greedy and optimal
 * line breaking is invisible, and the cost of the optimal algorithm is a
 * quadratic pass on every keystroke.
 */

export type MeasureText = (text: string) => number;

export type WrapOptions = {
  /** Logical pixels. Lines are broken to fit inside this. */
  maxWidth: number;
  /** Guards against a pathological caption pushing the renderer into a long loop. */
  maxLines?: number;
};

export const DEFAULT_MAX_LINES = 40;

/**
 * Splits into lines that fit, honouring the newlines the user typed.
 *
 * Explicit newlines are respected first and always: someone who pressed return
 * meant it, and a wrapper that reflows across their break has overridden a
 * decision rather than made one.
 */
export function wrapText(
  text: string,
  measure: MeasureText,
  options: WrapOptions,
): readonly string[] {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  if (text.length === 0) return [];
  // A zero or negative width has no solution; returning the paragraphs unbroken
  // is more useful than returning nothing, and it cannot loop.
  if (options.maxWidth <= 0) return text.split('\n').slice(0, maxLines);

  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (lines.length >= maxLines) break;

    // An empty paragraph is a blank line the user asked for, not nothing.
    if (paragraph.trim().length === 0) {
      lines.push('');
      continue;
    }

    for (const line of wrapParagraph(paragraph, measure, options.maxWidth)) {
      if (lines.length >= maxLines) break;
      lines.push(line);
    }
  }

  return lines;
}

function wrapParagraph(
  paragraph: string,
  measure: MeasureText,
  maxWidth: number,
): readonly string[] {
  const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current.length > 0) {
      lines.push(current);
      current = '';
    }

    // A single word wider than the line has no break point between words, so it
    // is broken between characters. Overflowing instead would push type off the
    // slide and out of the export, where the user cannot see it went.
    if (measure(word) > maxWidth) {
      const pieces = breakWord(word, measure, maxWidth);
      lines.push(...pieces.slice(0, -1));
      current = pieces[pieces.length - 1] ?? '';
    } else {
      current = word;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}

/**
 * Splits an over-long word into pieces that fit.
 *
 * Always emits at least one character per piece even when a single glyph is
 * wider than the line — otherwise the loop would make no progress and the
 * renderer would hang on a caption. A too-wide character overflows visibly,
 * which is a bad layout; a hang is a bug.
 */
function breakWord(word: string, measure: MeasureText, maxWidth: number): readonly string[] {
  const pieces: string[] = [];
  let current = '';

  for (const character of word) {
    const candidate = current + character;
    if (current.length > 0 && measure(candidate) > maxWidth) {
      pieces.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) pieces.push(current);
  return pieces.length > 0 ? pieces : [word];
}

/**
 * Where each line's baseline sits, and how tall the block is.
 *
 * Separated from wrapping because the renderer needs both and the exporter needs
 * the height to centre a block — and because "the first baseline is one ascent
 * down, not one line-height down" is the kind of off-by-one that is much easier
 * to see stated than to spot in a draw call.
 */
export function layoutLines(
  lineCount: number,
  lineHeight: number,
  ascent: number,
): { baselines: readonly number[]; height: number } {
  const baselines: number[] = [];
  for (let index = 0; index < lineCount; index += 1) {
    baselines.push(ascent + index * lineHeight);
  }
  return { baselines, height: lineCount * lineHeight };
}
