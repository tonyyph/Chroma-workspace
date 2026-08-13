import { describe, expect, it } from 'vitest';
import { describeGrade, gradeSchema, gradesEqual, NEUTRAL_GRADE, scaleGrade } from './grading';
import { LOOKS, look, lookCollectionIds, looksIn } from './looks';

/**
 * What keeps a library of looks honest.
 *
 * Looks are data, and data is cheap to add and easy to fake. These are the
 * assertions that stand in for the judgement a colourist would apply: that every
 * entry does something, that no two do the same thing under different names, and
 * that nothing promises an effect the renderer will discard.
 */

describe('LOOKS', () => {
  it('are grades, not a separate kind of thing', () => {
    for (const entry of LOOKS) {
      expect(() => gradeSchema.parse(entry.grade)).not.toThrow();
    }
  });

  it('name every id exactly once', () => {
    expect(new Set(LOOKS.map((entry) => entry.id)).size).toBe(LOOKS.length);
  });

  it('are each distinguishable from an untouched photograph', () => {
    for (const entry of LOOKS) {
      expect(describeGrade(entry.grade)).not.toEqual(['untouched']);
      expect(gradesEqual(entry.grade, NEUTRAL_GRADE)).toBe(false);
    }
  });

  /**
   * The binding constraint on the whole library.
   *
   * Two looks that produce the same sentence are the same look sold twice, and
   * `describeGrade` is the only description the app has — so if it cannot tell
   * two apart, neither can the person choosing between them.
   */
  it('offer looks that actually differ from each other', () => {
    const described = LOOKS.map((entry) => describeGrade(entry.grade).join(', '));
    expect(new Set(described).size).toBe(LOOKS.length);
  });

  it('belong to a collection that exists', () => {
    for (const entry of LOOKS) {
      expect(lookCollectionIds).toContain(entry.collection);
    }
  });

  it('give every collection at least one look', () => {
    for (const id of lookCollectionIds) {
      expect(looksIn(id).length).toBeGreaterThan(0);
    }
  });

  it('look up by id, and refuse an unknown one', () => {
    expect(look('portra')?.name).toBe('Warm skin');
    expect(look('nope')).toBeNull();
  });

  it('stay schema-valid at every point the intensity dial can reach', () => {
    for (const entry of LOOKS) {
      for (const amount of [0, 0.13, 0.5, 0.87, 1]) {
        expect(() => gradeSchema.parse(scaleGrade(entry.grade, amount))).not.toThrow();
      }
    }
  });

  it('keeps the six shipped stocks unchanged', () => {
    // These are in people's libraries. A tidy-up that moved a number would
    // silently re-grade every photograph already carrying one of them.
    expect(look('portra')?.grade.temperature).toBe(0.2);
    expect(look('tri-x')?.grade.saturation).toBe(-1);
    expect(look('cinestill')?.grade.shadowTint).toEqual({ hue: 250, strength: 0.28 });
    expect(look('velvia')?.grade.contrast).toBe(0.32);
    expect(look('ektachrome')?.grade.contrast).toBe(0.22);
    expect(look('polaroid')?.grade.lift).toBe(0.14);
  });
});
