import { contrastRatio, hexToRgb, makeColor, rgbToOklch } from '@cw/domain';
import { renderHook } from '@testing-library/react-native';
import { useAccent } from './useAccent';

const GROUND = '#08070E';

/**
 * A screen borrowing a colour from a photograph is only safe because of the
 * readability pass. These are the guarantees the rest of the UI relies on when
 * it renders a label in whatever the user pointed the camera at.
 */
describe('useAccent', () => {
  it('has no opinion when there is no subject', () => {
    expect(renderHook(() => useAccent(null)).result.current).toBeNull();
    expect(renderHook(() => useAccent([])).result.current).toBeNull();
  });

  it('prefers the signal role, which is the extractor’s own idea of the accent', () => {
    const { result } = renderHook(() =>
      useAccent([
        makeColor('#7C5CFF', 0.6, 'dominant'),
        makeColor('#4A3AA8', 0.2, 'support'),
        makeColor('#22D3EE', 0.2, 'signal'),
      ]),
    );
    // The cyan already clears AA, so it survives untouched.
    expect(result.current?.color).toBe('#22D3EE');
  });

  it('lifts an accent too dark to see and keeps its hue', () => {
    const dark = '#1A1630';
    const { result } = renderHook(() => useAccent([makeColor(dark, 1, 'signal')]));
    const accent = result.current!.color;

    expect(contrastRatio(accent, GROUND)).toBeGreaterThanOrEqual(4.5);
    const before = rgbToOklch(hexToRgb(dark));
    const after = rgbToOklch(hexToRgb(accent));
    expect(Math.abs(after.hue - before.hue)).toBeLessThan(3);
  });

  it('is readable for every colour a capture could produce', () => {
    for (const hex of ['#000000', '#FFFFFF', '#08070E', '#FF0000', '#003300', '#7C5CFF']) {
      const { result } = renderHook(() => useAccent([makeColor(hex, 1, 'signal')]));
      expect(contrastRatio(result.current!.color, GROUND)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('builds a pill recipe carrying the accent as its text colour', () => {
    const { result } = renderHook(() => useAccent([makeColor('#22D3EE', 1, 'signal')]));
    expect(result.current?.tint.color).toBe(result.current?.color);
    expect(result.current?.tint.backgroundColor).toContain('rgba(');
  });
});
