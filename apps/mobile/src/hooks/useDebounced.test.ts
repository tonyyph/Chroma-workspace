import { act, renderHook } from '@testing-library/react-native';
import { SEARCH_DEBOUNCE_MS, useDebounced } from './useDebounced';

/**
 * The point of the hook is what it *doesn't* pass on. Typing "coral" one letter
 * at a time used to run five feed queries and five scans of the whole library,
 * each on the thread that has to draw the next character.
 */
describe('useDebounced', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('holds a value back until the typing stops', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebounced(value),
      {
        initialProps: { value: '' },
      },
    );

    for (const value of ['c', 'co', 'cor', 'cora', 'coral']) {
      rerender({ value });
      act(() => {
        jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 20);
      });
      // Every keystroke restarts the wait, so nothing downstream has run yet.
      expect(result.current).toBe('');
    }

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(result.current).toBe('coral');
  });

  it('clears immediately', () => {
    const { result, rerender } = renderHook<string, { value: string }>(
      ({ value }) => useDebounced(value),
      {
        initialProps: { value: 'coral' },
      },
    );

    rerender({ value: '' });

    // Emptying the field is not a search being typed — the unfiltered list comes
    // back at once rather than a fifth of a second after the last character.
    expect(result.current).toBe('');
  });
});
