import { HARMONICS, loopFrequencies, offsetAt } from './backdropField';

/**
 * The loop has to close.
 *
 * The clock restarts every cycle. If a mass is not exactly where it began when
 * that happens, the whole field visibly jumps — which it did: the frequencies
 * this replaced put one mass 0.97 of a full swing away from its starting point
 * at the wrap, once every lap, forever.
 */
describe('ambient field loop', () => {
  it('uses only whole-number frequencies', () => {
    // This is the condition. Everything else in this file is a consequence.
    expect(loopFrequencies().filter((f) => !Number.isInteger(f))).toEqual([]);
  });

  it('returns every mass to its exact starting position', () => {
    for (const harmonic of HARMONICS) {
      const start = offsetAt(harmonic, 0);
      const end = offsetAt(harmonic, 1);
      expect(end.x).toBeCloseTo(start.x, 10);
      expect(end.y).toBeCloseTo(start.y, 10);
    }
  });

  it('matches velocity across the wrap, so there is no flick either', () => {
    // Position alone is not enough: a mass arriving at the right place moving
    // the wrong way still reads as a stutter.
    const step = 1e-6;
    for (const harmonic of HARMONICS) {
      const before = offsetAt(harmonic, 1 - step);
      const atEnd = offsetAt(harmonic, 1);
      const atStart = offsetAt(harmonic, 0);
      const after = offsetAt(harmonic, step);

      const incoming = { x: atEnd.x - before.x, y: atEnd.y - before.y };
      const outgoing = { x: after.x - atStart.x, y: after.y - atStart.y };

      expect(outgoing.x).toBeCloseTo(incoming.x, 9);
      expect(outgoing.y).toBeCloseTo(incoming.y, 9);
    }
  });

  it('actually moves the masses a visible distance', () => {
    // A loop that closes because nothing moved would pass everything above.
    for (const harmonic of HARMONICS) {
      const travelled = Array.from({ length: 64 }, (_, step) => offsetAt(harmonic, step / 64));
      const spanX = Math.max(...travelled.map((p) => p.x)) - Math.min(...travelled.map((p) => p.x));
      const spanY = Math.max(...travelled.map((p) => p.y)) - Math.min(...travelled.map((p) => p.y));
      // Roughly a third of the screen's short side, in normalised units.
      expect(Math.max(spanX, spanY)).toBeGreaterThan(0.2);
    }
  });

  it('keeps the masses from moving as one block', () => {
    // Identical harmonics would loop perfectly and look like a single sliding
    // gradient. The phases and frequencies have to actually differ.
    const signatures = HARMONICS.map((h) => `${h.fx}:${h.fy}:${h.px}:${h.py}`);
    expect(new Set(signatures).size).toBe(HARMONICS.length);
  });
});
