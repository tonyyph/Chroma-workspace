import { layoutLines, wrapText } from './wrapText';

/**
 * A ruler where every character is exactly ten wide.
 *
 * Fixed-width means an expected line can be read off the string length, so each
 * test states a width and the assertion is obvious rather than font-dependent.
 */
const measure = (text: string) => text.length * 10;

describe('wrapText', () => {
  it('returns nothing for empty text', () => {
    expect(wrapText('', measure, { maxWidth: 100 })).toEqual([]);
  });

  it('leaves a line that already fits alone', () => {
    expect(wrapText('four', measure, { maxWidth: 100 })).toEqual(['four']);
  });

  it('breaks between words when a line would overflow', () => {
    // "aaa bbb" is 70 wide; "aaa bbb ccc" is 110.
    expect(wrapText('aaa bbb ccc', measure, { maxWidth: 100 })).toEqual(['aaa bbb', 'ccc']);
  });

  it('fits a line that lands exactly on the limit', () => {
    // Exactly 100 wide — inclusive, so it stays on one line.
    expect(wrapText('aaa bbbbbb', measure, { maxWidth: 100 })).toEqual(['aaa bbbbbb']);
  });

  it('honours newlines the user typed', () => {
    expect(wrapText('one\ntwo', measure, { maxWidth: 1000 })).toEqual(['one', 'two']);
  });

  it('keeps a deliberate blank line', () => {
    expect(wrapText('one\n\ntwo', measure, { maxWidth: 1000 })).toEqual(['one', '', 'two']);
  });

  it('wraps within a paragraph without reflowing across an explicit break', () => {
    expect(wrapText('aaa bbb ccc\nddd', measure, { maxWidth: 100 })).toEqual([
      'aaa bbb',
      'ccc',
      'ddd',
    ]);
  });

  it('collapses runs of whitespace between words', () => {
    expect(wrapText('aaa    bbb', measure, { maxWidth: 1000 })).toEqual(['aaa bbb']);
  });

  it('breaks a single word that is wider than the line', () => {
    // 12 characters at width 100 → 10 per piece.
    expect(wrapText('abcdefghijkl', measure, { maxWidth: 100 })).toEqual(['abcdefghij', 'kl']);
  });

  it('puts a long word on its own line rather than jamming it onto the previous one', () => {
    expect(wrapText('hi abcdefghijkl', measure, { maxWidth: 100 })).toEqual([
      'hi',
      'abcdefghij',
      'kl',
    ]);
  });

  it('makes progress even when one character is wider than the line', () => {
    const wide = () => 999;
    const lines = wrapText('abc', wide, { maxWidth: 10 });
    // The point is that it terminates and loses nothing, not the exact split.
    expect(lines.join('')).toBe('abc');
  });

  it('never loops on a zero width', () => {
    expect(wrapText('one\ntwo', measure, { maxWidth: 0 })).toEqual(['one', 'two']);
  });

  it('is bounded, so a pathological caption cannot stall the renderer', () => {
    const long = 'word '.repeat(500);
    expect(wrapText(long, measure, { maxWidth: 20, maxLines: 12 })).toHaveLength(12);
  });
});

describe('layoutLines', () => {
  it('puts the first baseline one ascent down, not one line-height down', () => {
    const { baselines } = layoutLines(3, 40, 30);
    expect(baselines).toEqual([30, 70, 110]);
  });

  it('reports the block height as lines times line-height', () => {
    expect(layoutLines(3, 40, 30).height).toBe(120);
  });

  it('handles an empty block', () => {
    expect(layoutLines(0, 40, 30)).toEqual({ baselines: [], height: 0 });
  });
});
