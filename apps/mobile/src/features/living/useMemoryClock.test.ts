import type { Storyboard } from '@cw/domain';
import { act, renderHook } from '@testing-library/react-native';
import { useMemoryClock } from './useMemoryClock';

/**
 * The clock behind the living-memory performance.
 *
 * Written to pin the behaviour before removing a render-phase ref write, so the
 * refactor is provably behaviour-preserving rather than merely plausible. The
 * case that matters most is the one the ref existed to serve: resuming from
 * where it paused rather than restarting.
 *
 * **Every storyboard here is hoisted to a stable reference.** The hook rewinds
 * whenever the storyboard's *identity* changes, so building one inside the
 * render callback would construct a new object every render and reset the clock
 * to zero on every tick — which is a bug in the test, not in the hook.
 */

const board = (totalMs: number): Storyboard =>
  ({
    totalMs,
    scenes: [],
    drift: { fromScale: 1, toScale: 1.06, panX: 0, panY: 0 },
  }) as unknown as Storyboard;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useMemoryClock', () => {
  it('starts at zero and is not finished', () => {
    const storyboard = board(1000);
    const { result } = renderHook(() =>
      useMemoryClock({ storyboard, playing: false, audioPositionMs: null }),
    );
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.finished).toBe(false);
  });

  it('does not advance while paused', () => {
    const storyboard = board(10_000);
    const { result } = renderHook(() =>
      useMemoryClock({ storyboard, playing: false, audioPositionMs: null }),
    );
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.elapsedMs).toBe(0);
  });

  it('advances while playing with no audio to follow', () => {
    const storyboard = board(10_000);
    const { result } = renderHook(() =>
      useMemoryClock({ storyboard, playing: true, audioPositionMs: null }),
    );
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.elapsedMs).toBeGreaterThan(0);
    expect(result.current.elapsedMs).toBeLessThanOrEqual(600);
  });

  /**
   * The case the render-phase ref was there for.
   *
   * Pausing and resuming must continue from where it stopped, and must not
   * credit the paused time — a viewer who pauses for five seconds should not
   * come back to a performance five seconds further along.
   */
  it('resumes from where it paused, without crediting the paused time', () => {
    const storyboard = board(10_000);
    const { result, rerender } = renderHook(
      ({ playing }: { playing: boolean }) =>
        useMemoryClock({ storyboard, playing, audioPositionMs: null }),
      { initialProps: { playing: true } },
    );

    act(() => {
      jest.advanceTimersByTime(600);
    });
    const atPause = result.current.elapsedMs;
    expect(atPause).toBeGreaterThan(0);

    rerender({ playing: false });
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.elapsedMs).toBe(atPause);

    rerender({ playing: true });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.elapsedMs).toBeGreaterThan(atPause);
    expect(result.current.elapsedMs).toBeLessThan(atPause + 5000);
  });

  it('follows the audio position when a preview is playing', () => {
    const storyboard = board(10_000);
    const { result, rerender } = renderHook(
      ({ audioPositionMs }: { audioPositionMs: number | null }) =>
        useMemoryClock({ storyboard, playing: true, audioPositionMs }),
      { initialProps: { audioPositionMs: null as number | null } },
    );

    rerender({ audioPositionMs: 4200 });
    expect(result.current.elapsedMs).toBe(4200);
  });

  it('lets the audio clock move the performance backwards on a seek', () => {
    const storyboard = board(10_000);
    const { result, rerender } = renderHook(
      ({ audioPositionMs }: { audioPositionMs: number | null }) =>
        useMemoryClock({ storyboard, playing: true, audioPositionMs }),
      { initialProps: { audioPositionMs: 4200 as number | null } },
    );
    rerender({ audioPositionMs: 1000 });
    expect(result.current.elapsedMs).toBe(1000);
  });

  it('does not run its own timer while following audio', () => {
    const storyboard = board(10_000);
    const { result, rerender } = renderHook(
      ({ audioPositionMs }: { audioPositionMs: number | null }) =>
        useMemoryClock({ storyboard, playing: true, audioPositionMs }),
      { initialProps: { audioPositionMs: null as number | null } },
    );

    rerender({ audioPositionMs: 2000 });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    // The audio is the clock; the timer must not add to what it reported.
    expect(result.current.elapsedMs).toBe(2000);
  });

  it('clamps at the storyboard length and reports finished', () => {
    const storyboard = board(500);
    const { result } = renderHook(() =>
      useMemoryClock({ storyboard, playing: true, audioPositionMs: null }),
    );
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.elapsedMs).toBe(500);
    expect(result.current.finished).toBe(true);
  });

  it('clamps a runaway audio position to the storyboard length', () => {
    const storyboard = board(500);
    const { result, rerender } = renderHook(
      ({ audioPositionMs }: { audioPositionMs: number | null }) =>
        useMemoryClock({ storyboard, playing: true, audioPositionMs }),
      { initialProps: { audioPositionMs: null as number | null } },
    );
    rerender({ audioPositionMs: 99_999 });
    expect(result.current.elapsedMs).toBe(500);
    expect(result.current.finished).toBe(true);
  });

  it('rewinds when a different storyboard arrives', () => {
    const { result, rerender } = renderHook(
      ({ storyboard }: { storyboard: Storyboard }) =>
        useMemoryClock({ storyboard, playing: true, audioPositionMs: null }),
      { initialProps: { storyboard: board(10_000) } },
    );

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(result.current.elapsedMs).toBeGreaterThan(0);

    rerender({ storyboard: board(10_000) });
    expect(result.current.elapsedMs).toBe(0);
  });

  it('stops its timer when unmounted', () => {
    const storyboard = board(10_000);
    const { unmount } = renderHook(() =>
      useMemoryClock({ storyboard, playing: true, audioPositionMs: null }),
    );
    unmount();
    // A surviving interval would throw on a setState after unmount.
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }).not.toThrow();
  });
});
