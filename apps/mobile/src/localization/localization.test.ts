import { en } from './en';
import { messageKeys, translate } from './messages';
import { vi } from './vi';

/**
 * BUILD KIT · 08 · LOCALISATION:
 *
 *   "Ship EN + VI at launch. Vietnamese runs ~25% longer — every button and chip
 *    must survive a 30% string expansion without truncating. Hex values, ΔE
 *    numbers, and the wordmark never translate."
 *
 * These assert the parts of that which are checkable from the strings alone. The
 * budgets below are the character counts each control can render at its designed
 * width without wrapping past its line allowance, measured from SYSTEM F's type
 * scale — a chip is mono 10px in a 13pt-padded pill, a button is 15px semibold in
 * a full-width pill.
 */

/**
 * Characters that were once typed into strings to stand in for icons.
 *
 * They render in whatever the text font happens to carry, so they shifted weight
 * and baseline between platforms, could not be sized against their control, and
 * VoiceOver read them aloud by their Unicode names. `@expo/vector-icons` draws
 * them now, which means a translator must never be handed one to carry.
 *
 * `×` is deliberately absent: it is a real typographic operator, and
 * `compare.mergedName` uses it to join two palette names.
 */
const ICON_GLYPHS = ['⌕', '✕', '✖', '•••', '‹', '›', '→', '←', '↔', '⌄', '⌃'];

/** Controls whose width is fixed by the design and cannot grow. */
const BUDGETS: Record<string, number> = {
  // Mono chips: 10px, ~5.5pt per glyph, sharing a row of up to four.
  chip: 16,
  // Buttons: 15-16px semibold, full width less 22pt padding each side.
  button: 34,
  // Tab bar labels sit in a fifth of the bar.
  tab: 10,
};

const CHIP_KEYS = messageKeys.filter(
  (key) =>
    key.startsWith('library.filter.') ||
    // The discovery axes are chips on two screens apiece, in the same rail as
    // the library filters, so they live under the same width budget.
    key.startsWith('library.mood.') ||
    key.startsWith('library.style.') ||
    key.startsWith('trending.category.') ||
    key.startsWith('trending.sort.') ||
    key.startsWith('tune.preset.') ||
    key.startsWith('import.mode.') ||
    key.startsWith('capture.mode.') ||
    key === 'collection.exportSet' ||
    key === 'collection.invite' ||
    key === 'trending.save' ||
    key === 'trending.saved' ||
    key === 'filter.toggle' ||
    key === 'filter.active' ||
    key === 'filter.reset' ||
    key === 'common.pro' ||
    key === 'tune.contrast.pass' ||
    key === 'tune.contrast.fail',
);

const BUTTON_KEYS = messageKeys.filter(
  (key) =>
    key === 'onboarding.continue' ||
    key === 'onboarding.allowCamera' ||
    key === 'onboarding.importInstead' ||
    key === 'result.tune' ||
    key === 'result.save' ||
    // The import screen's second primary action, full width under the swatches.
    key === 'import.cinematic' ||
    key === 'tune.apply' ||
    key === 'tune.cancel' ||
    key === 'palette.share' ||
    key === 'paywall.cta' ||
    key === 'share.saveImage' ||
    key === 'share.share' ||
    key === 'compare.addThird' ||
    key === 'compare.merge' ||
    // The one action on a set's gap line, in a row beside the sentence it answers.
    key === 'collection.gap.action' ||
    key === 'theme.export' ||
    key === 'export.copyToClipboard' ||
    // Carousel calls to action, and the trending feed's own buttons.
    (key.startsWith('hero.') && key.endsWith('.cta')) ||
    key === 'trending.retry' ||
    key === 'trending.loadMore',
);

describe('catalogue integrity', () => {
  it('carries no icon glyphs in either language', () => {
    const offenders = messageKeys.flatMap((key) =>
      ICON_GLYPHS.some((glyph) => en[key].includes(glyph) || vi[key].includes(glyph)) ? [key] : [],
    );
    expect(offenders).toEqual([]);
  });

  it('translates every English key into Vietnamese', () => {
    const missing = messageKeys.filter((key) => !(key in vi) || vi[key].trim() === '');
    expect(missing).toEqual([]);
  });

  it('has no Vietnamese keys the source language lacks', () => {
    const extra = Object.keys(vi).filter((key) => !(key in en));
    expect(extra).toEqual([]);
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

    const mismatched = messageKeys.filter(
      (key) => placeholders(en[key]).join(',') !== placeholders(vi[key]).join(','),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('30% expansion headroom', () => {
  it.each(CHIP_KEYS)('chip %s fits its pill in Vietnamese', (key) => {
    expect(vi[key].length).toBeLessThanOrEqual(BUDGETS.chip!);
  });

  it.each(BUTTON_KEYS)('button %s fits its pill in Vietnamese', (key) => {
    expect(vi[key].length).toBeLessThanOrEqual(BUDGETS.button!);
  });

  it('holds every control under a synthetic 30% expansion of the English', () => {
    // The kit's rule is about *any* language expanding 30%, not just Vietnamese.
    // A control whose English is already at budget would break in translation, so
    // the English is checked against a 30%-reduced budget.
    const overflowing = [...CHIP_KEYS, ...BUTTON_KEYS].filter((key) => {
      const budget = CHIP_KEYS.includes(key) ? BUDGETS.chip! : BUDGETS.button!;
      return en[key].length * 1.3 > budget;
    });
    expect(overflowing).toEqual([]);
  });
});

describe('never-translated content', () => {
  it('contains no hex literals in either catalogue', () => {
    // Hex arrives as a {hex} parameter; a literal would mean a translator could
    // change a colour value.
    const hex = /#[0-9A-Fa-f]{6}\b/;
    const offenders = messageKeys.filter((key) => hex.test(en[key]) || hex.test(vi[key]));
    expect(offenders).toEqual([]);
  });

  it('leaves the wordmark untranslated wherever it appears', () => {
    const withWordmark = messageKeys.filter((key) => en[key].includes('Chroma Wave'));
    expect(withWordmark.length).toBeGreaterThan(0);
    for (const key of withWordmark) {
      expect(vi[key]).toContain('Chroma Wave');
    }
  });

  it('keeps ΔE and colour-space names as-is', () => {
    expect(vi['compare.matrixLabel']).toContain('ΔE00');
    expect(vi['contrast.meta']).toContain('WCAG 2.2');
  });
});

describe('translate', () => {
  it('substitutes named parameters', () => {
    expect(translate('en', 'library.card.meta', { count: 5, age: '2D' })).toBe('5 colours · 2D');
    expect(translate('vi', 'library.card.meta', { count: 5, age: '2D' })).toBe('5 màu · 2D');
  });

  it('leaves an unsupplied placeholder visible rather than printing undefined', () => {
    expect(translate('en', 'library.card.meta', { count: 5 })).toBe('5 colours · {age}');
  });

  it('returns the template untouched when no parameters are given', () => {
    expect(translate('en', 'library.title')).toBe('Library');
  });
});
