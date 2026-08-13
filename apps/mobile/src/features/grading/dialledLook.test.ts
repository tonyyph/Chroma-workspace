import { NEUTRAL_GRADE, gradesEqual, scaleGrade, type Grade } from '@cw/domain';
import { dialledLook } from './dialledLook';

/**
 * Which look the dial is dialling.
 *
 * These are regression assertions, not arithmetic ones. The bug they guard was a
 * saved grade being swapped for the automatic one the moment someone touched the
 * intensity slider — a change nothing on screen announced, which the next Apply
 * then wrote to the record.
 */

const saved: Grade = { ...NEUTRAL_GRADE, saturation: -1, contrast: 0.3 };
const automatic: Grade = { ...NEUTRAL_GRADE, temperature: 0.22, lift: 0.07 };
const chosen: Grade = { ...NEUTRAL_GRADE, vignette: 0.4 };

it('dials the look the user just chose, over everything else', () => {
  expect(dialledLook(chosen, saved, automatic)).toEqual(chosen);
});

it('dials the saved grade rather than the automatic one', () => {
  // The regression. `automatic` is what the photograph's colours ask for, and it
  // is not what someone who graded this picture last week is looking at.
  expect(dialledLook(null, saved, automatic)).toEqual(saved);
});

it('falls back to the automatic read only when nothing is saved', () => {
  expect(dialledLook(null, null, automatic)).toEqual(automatic);
});

it('leaves a full dial identical to the look it started from', () => {
  // What makes resolving the base up front safe: at 100% the dial is a no-op, so
  // there is no need to wait for the slider to move before deciding.
  for (const look of [chosen, saved, automatic]) {
    expect(gradesEqual(scaleGrade(dialledLook(null, look, automatic), 1), look)).toBe(true);
  }
});
