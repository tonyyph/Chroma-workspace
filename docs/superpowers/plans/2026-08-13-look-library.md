# Look Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow six film stocks into thirty looks across five named collections, browsable as a grid of real previews, with one free look per collection and the rest behind `advanced_grading`.

**Architecture:** Slice 4 of `docs/superpowers/specs/2026-08-13-cinematic-import-design.md`. A look is a `Grade` with a name and a collection — the same type the automatic grade already produces, so storage, the shader, `gradesEqual`, `scaleGrade` and `describeGrade` learn nothing new. The work is editorial data plus one grid that decodes the photograph once and shares the decoded image across every tile.

**Tech Stack:** TypeScript, Zod 4, Vitest (domain); React Native, Skia, Jest + `@testing-library/react-native` (mobile).

## Global Constraints

- **Do not modify `gradeShader.ts` or `gradePixels.ts`.** Thirty looks are thirty sets of numbers for a renderer that already exists and is already proven against its reference.
- **Names describe what a look does; they never name a film.** `grading.ts` states the rule and the reason: "a stock name is a trademark, and 'warm skin, lifted shadows' is more use to someone choosing than a word they may never have shot." Ids may nod at a stock (`portra`, `cinestill` already do); the `name` a user reads may not.
- **A monochrome look takes its tone from `shadowTint`/`highlightTint`, never from `temperature` or `tint`.** The pipeline is exposure → lift → contrast → white balance → **saturation** → split tone (`gradePixels.ts:79-100`). At `saturation: -1`, step 5 discards everything step 4 did, so a warm `temperature` on a black-and-white look changes no pixel while `describeGrade` still announces "warmer". Task 3 adds a test for this.
- **The six existing stocks keep their exact numbers.** They ship today. This slice files them into collections and adds around them.
- **`describeGrade` must produce a distinct sentence for every look.** The existing test `offer looks that actually differ from each other` already asserts this and is the binding design constraint at thirty — every look in the tables below was chosen against it.
- **Export stays unrestricted and `watermark_free_share` is untouched.** The only entitlement in play is `advanced_grading`.
- **Every new user-facing string goes in BOTH `en.ts` and `vi.ts`.**
- **Every commit leaves `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm format:check` green.**

## Reading the tables

Each row is a complete `Grade` plus its identity. Blank means the schema default: `0` for a scalar, `{hue: 0, strength: 0}` for a tint. `SH`/`HL` are `shadowTint`/`highlightTint` as `hue/strength`.

The **Says** column is what `describeGrade` will emit — it is the distinctness proof, not a value to type in. Verify it rather than trusting it: if an implementation's output disagrees with the column, the numbers are wrong, not the column.

`describeGrade` thresholds, for checking that column:
`exposure` ±0.08 · `contrast` +0.15/−0.12 · `temperature` ±0.12 · `saturation` +0.1/−0.15 · `lift` +0.04/−0.03 · tint strength 0.15 · `grain` 0.18 · `vignette` 0.2.
Hue names: red <20 or ≥345 · amber 20–49 · gold 50–79 · green 80–159 · teal 160–199 · blue 200–264 · violet 265–314 · magenta 315–344.

## File Structure

**Created:**

| File                                            | Responsibility                                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/looks.ts`                  | The thirty looks, their collections, and lookup. Split from `grading.ts` because thirty grades of data would otherwise swamp the module that defines what a grade _is_. |
| `packages/domain/src/looks.test.ts`             | The invariants that keep thirty looks honest: distinctness, describability, schema validity, monochrome tone.                                                           |
| `apps/mobile/src/features/grading/LookGrid.tsx` | The browsable grid: collection rail, one shared decoded image, a tile per look.                                                                                         |
| `apps/mobile/src/features/grading/LookTile.tsx` | One tile — a small canvas over the shared image with its own uniforms, plus its lock state.                                                                             |

**Modified:**

| File                                                     | Change                                                                                                                             |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/grading.ts`                         | Loses `FILM_STOCKS`/`filmStockIds`/`filmStock`; keeps `Grade`, `gradeForAtmosphere`, `scaleGrade`, `describeGrade`, `gradesEqual`. |
| `packages/domain/src/grading.test.ts`                    | The `FILM_STOCKS` describe block moves to `looks.test.ts`; `scaleGrade`'s fixture stops importing it.                              |
| `packages/domain/src/index.ts`                           | Exports `./looks`.                                                                                                                 |
| `apps/mobile/src/features/grading/GradeScreen.tsx`       | The stock chip rail becomes `LookGrid`.                                                                                            |
| `apps/mobile/src/features/studio/CameraStudioScreen.tsx` | Same rail, same replacement.                                                                                                       |
| `apps/mobile/src/localization/en.ts`, `vi.ts`            | Collection names and the grid's strings.                                                                                           |

---

### Task 1: A look is a grade with a collection

Structure only. No new looks, no visual change: the six stocks come through with identical numbers under a new type, in a new module, and both screens keep rendering the same six chips.

**Files:**

- Create: `packages/domain/src/looks.ts`, `packages/domain/src/looks.test.ts`
- Modify: `packages/domain/src/grading.ts:236-363` (remove the film-stock section), `packages/domain/src/grading.test.ts:195-221` (move that describe block), `packages/domain/src/index.ts`
- Modify: `apps/mobile/src/features/grading/GradeScreen.tsx:4,249`, `apps/mobile/src/features/studio/CameraStudioScreen.tsx:2,256`

**Interfaces:**

- Produces:
  - `const lookCollectionIds` — a `readonly` tuple, `'negative' | 'slide' | 'monochrome' | 'after-dark'` after this task and `'early-digital'` added by Task 6
  - `type LookCollectionId = (typeof lookCollectionIds)[number]` — derived from the tuple, so it widens with it
  - `type Look = Readonly<{ id: string; name: string; collection: LookCollectionId; free: boolean; grade: Grade }>`
  - `const LOOKS: readonly Look[]`
  - `looksIn(collection: LookCollectionId): readonly Look[]`
  - `look(id: string): Look | null`

> **On dropping `FilmStockId`:** nothing persists a stock id. `memory.ts` stores `grade` — the values — and never a reference to which look produced them, which is exactly why re-grading works and why this rename is safe. `look()` takes a plain `string` because ids are no longer a closed set worth a union of thirty.

- [ ] **Step 1: Write the failing test**

Create `packages/domain/src/looks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { describeGrade, gradeSchema, gradesEqual, NEUTRAL_GRADE } from './grading';
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd packages/domain && npx vitest run looks`
Expected: FAIL — `Failed to resolve import "./looks"`.

- [ ] **Step 3: Create the module**

Create `packages/domain/src/looks.ts`. Move the six stock grades across **verbatim** from `grading.ts` — copy the numbers, do not retype them:

```ts
import { NEUTRAL_GRADE, type Grade } from './grading';

/**
 * The look library.
 *
 * Separate from `grading.ts` on purpose: that module defines what a grade *is*
 * and how one is derived from a photograph, and thirty sets of numbers sitting
 * on top of it would bury the argument. This module is the catalogue.
 *
 * Every look is the same `Grade` an automatic read produces. That is the whole
 * design: choosing a look and letting the photograph choose for itself yield the
 * same kind of object, so the picker, the dial, the storage and the renderer
 * never learn the difference.
 *
 * Names say what a look does rather than which film it nods at — partly because
 * a stock name is a trademark, and partly because "warm skin, lifted shadows" is
 * more use to someone choosing than a word they may never have shot.
 */

export const lookCollectionIds = [
  'negative',
  'slide',
  'monochrome',
  'after-dark',
  'early-digital',
] as const;
export type LookCollectionId = (typeof lookCollectionIds)[number];

export type Look = Readonly<{
  id: string;
  /** What it does, in the app's own words. Never a film's name. */
  name: string;
  collection: LookCollectionId;
  /**
   * One look per collection is free.
   *
   * A wall of locked chips tells someone the app is not for them. One working
   * look per collection tells them what the collection *is*, which is the thing
   * worth paying to unlock.
   */
  free: boolean;
  grade: Grade;
}>;

export const LOOKS: readonly Look[] = [
  {
    id: 'portra',
    name: 'Warm skin',
    collection: 'negative',
    free: true,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.06,
      contrast: -0.18,
      lift: 0.08,
      saturation: -0.12,
      temperature: 0.2,
      shadowTint: { hue: 30, strength: 0.14 },
      highlightTint: { hue: 45, strength: 0.12 },
      grain: 0.18,
    },
  },
  {
    id: 'polaroid',
    name: 'Instant',
    collection: 'negative',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.1,
      contrast: -0.24,
      lift: 0.14,
      saturation: -0.2,
      temperature: 0.1,
      tint: 0.08,
      shadowTint: { hue: 190, strength: 0.2 },
      highlightTint: { hue: 55, strength: 0.18 },
      vignette: 0.18,
      grain: 0.2,
    },
  },
  {
    id: 'ektachrome',
    name: 'Clean slide',
    collection: 'slide',
    free: true,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.22,
      saturation: 0.08,
      temperature: -0.08,
      lift: -0.02,
      shadowTint: { hue: 225, strength: 0.16 },
      grain: 0.08,
    },
  },
  {
    id: 'velvia',
    name: 'Saturated landscape',
    collection: 'slide',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.32,
      saturation: 0.28,
      lift: -0.05,
      temperature: 0.06,
      shadowTint: { hue: 240, strength: 0.12 },
      vignette: 0.22,
      grain: 0.05,
    },
  },
  {
    id: 'tri-x',
    name: 'Black and grain',
    collection: 'monochrome',
    free: true,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.3,
      saturation: -1,
      lift: 0.06,
      vignette: 0.2,
      grain: 0.4,
    },
  },
  {
    id: 'cinestill',
    name: 'Tungsten night',
    collection: 'after-dark',
    free: true,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.08,
      contrast: 0.16,
      lift: 0.1,
      temperature: -0.24,
      saturation: 0.06,
      shadowTint: { hue: 250, strength: 0.28 },
      highlightTint: { hue: 15, strength: 0.22 },
      vignette: 0.24,
      grain: 0.26,
    },
  },
];

export const looksIn = (collection: LookCollectionId): readonly Look[] =>
  LOOKS.filter((entry) => entry.collection === collection);

export const look = (id: string): Look | null => LOOKS.find((entry) => entry.id === id) ?? null;
```

> **`lookCollectionIds` above deliberately omits `'early-digital'`.** Task 6 adds it together with its six looks. Declaring a collection before anything belongs to it would mean either a collection id that renders an empty grid or a test assertion switched off for four tasks; adding the id and its members in one commit avoids both.

- [ ] **Step 4: Remove the film-stock section from `grading.ts`**

Delete `grading.ts` lines 233–363 — the `/* film stocks */` banner, `filmStockIds`, `FilmStockId`, `FilmStock`, `FILM_STOCKS` and `filmStock`. Everything else in the module stays.

- [ ] **Step 5: Move the tests**

Delete the `describe('FILM_STOCKS', …)` block from `grading.test.ts` (lines 195–221) — `looks.test.ts` now covers it. In the same file:

- change `scaleGrade`'s fixture from `FILM_STOCKS.find(…)!.grade` to an inline grade so the domain's core test stops depending on the catalogue:

```ts
const look: Grade = {
  ...NEUTRAL_GRADE,
  exposure: -0.08,
  contrast: 0.16,
  lift: 0.1,
  temperature: -0.24,
  saturation: 0.06,
  shadowTint: { hue: 250, strength: 0.28 },
  highlightTint: { hue: 15, strength: 0.22 },
  vignette: 0.24,
  grain: 0.26,
};
```

- replace the two `gradesEqual` assertions that reach for `FILM_STOCKS[0]`/`[1]` with `look` and a visibly different grade;
- replace the `produces a schema-valid grade across the range for every stock` loop's `FILM_STOCKS` with `[look]` plus two more inline grades, or move that test to `looks.test.ts` where the catalogue lives. Prefer moving it.
- drop `FILM_STOCKS`, `filmStock`, `filmStockIds`, `FilmStockId` from the import list.

- [ ] **Step 6: Export the module**

In `packages/domain/src/index.ts`, beside `export * from './grading';`:

```ts
export * from './looks';
```

- [ ] **Step 7: Update the two screens**

In `GradeScreen.tsx` and `CameraStudioScreen.tsx`, change the import from `FILM_STOCKS` to `LOOKS` and the map from `FILM_STOCKS.map((stock) => …)` to `LOOKS.map((entry) => …)`, keeping `entry.id`, `entry.name` and `entry.grade` in the same places. Nothing else changes yet — the grid arrives in Task 7.

- [ ] **Step 8: Verify**

Run: `cd packages/domain && npx vitest run && npx tsc --noEmit`
Expected: PASS.

Run: `cd apps/mobile && npx tsc --noEmit && npx jest --runInBand`
Expected: PASS, and the same test count as before this task — no behaviour changed.

- [ ] **Step 9: Commit**

```bash
git add packages/domain/src/looks.ts packages/domain/src/looks.test.ts packages/domain/src/grading.ts packages/domain/src/grading.test.ts packages/domain/src/index.ts apps/mobile/src/features/grading/GradeScreen.tsx apps/mobile/src/features/studio/CameraStudioScreen.tsx
git commit -m "refactor(domain): give a look a collection, and a module of its own

grading.ts argues what a grade is and how a photograph asks for one.
Thirty sets of numbers on top of that would bury the argument, so the
catalogue moves out with the six that already shipped, unchanged."
```

---

### Task 2: The Negative collection

Colour negative: forgiving, lifted, warm. The two shipped looks stay; four join them.

**Files:**

- Modify: `packages/domain/src/looks.ts`

| id                     | name             | exp  | con  | lift | sat  | temp | tint | SH      | HL     | vig | grain | Says                                                                                         |
| ---------------------- | ---------------- | ---- | ---- | ---- | ---- | ---- | ---- | ------- | ------ | --- | ----- | -------------------------------------------------------------------------------------------- |
| `portra` _(shipped)_   | Warm skin        | .06  | −.18 | .08  | −.12 | .2   |      | 30/.14  | 45/.12 |     | .18   | softer contrast, warmer, lifted blacks, grain                                                |
| `polaroid` _(shipped)_ | Instant          | .1   | −.24 | .14  | −.2  | .1   | .08  | 190/.2  | 55/.18 | .18 | .2    | brighter, softer contrast, muted colour, lifted blacks, teal shadows, gold highlights, grain |
| `faded-print`          | Faded print      |      | −.22 | .12  | −.3  | −.05 |      | 300/.18 |        |     | .14   | softer contrast, muted colour, lifted blacks, violet shadows                                 |
| `golden-hour`          | Golden hour      | .12  | .05  | .05  | .05  | .3   |      | 35/.2   | 60/.22 | .1  | .2    | brighter, warmer, lifted blacks, amber shadows, gold highlights, grain                       |
| `overcast`             | Overcast         | −.04 | −.14 | .06  | −.22 | −.2  |      | 220/.2  |        |     | .16   | softer contrast, cooler, muted colour, lifted blacks, blue shadows                           |
| `pushed`               | Pushed two stops | .05  | .26  | .05  | −.18 | .08  |      | 25/.16  |        | .24 | .4    | harder contrast, muted colour, lifted blacks, amber shadows, grain, vignette                 |

`free`: `portra` only.

- [ ] **Step 1: Add the four looks**

Add them to `LOOKS` after `polaroid`, in the shape the existing entries use (`...NEUTRAL_GRADE` then the non-default fields). `collection: 'negative'`, `free: false`.

- [ ] **Step 2: Run the suite**

Run: `cd packages/domain && npx vitest run looks`
Expected: PASS — in particular `offer looks that actually differ from each other`.

If distinctness fails, the failure names nothing useful on its own. Print the sentences to find the collision:

```ts
// Temporary, in the test file:
console.log(LOOKS.map((e) => `${e.id}: ${describeGrade(e.grade).join(', ')}`).join('\n'));
```

Fix by moving a number across a threshold — not by deleting a look.

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/looks.ts
git commit -m "feat(domain): four more ways a negative can look

Faded, golden, overcast, pushed. Each differs from the others in what
describeGrade can actually say about it, which is the only definition of
'different look' the app has."
```

---

### Task 3: The Monochrome collection, and the rule it needs

Black and white, plus the invariant that keeps a toned monochrome honest.

**Files:**

- Modify: `packages/domain/src/looks.ts`, `packages/domain/src/looks.test.ts`

| id                  | name            | exp | con | lift | sat | SH     | HL     | vig | grain | Says                                                                 |
| ------------------- | --------------- | --- | --- | ---- | --- | ------ | ------ | --- | ----- | -------------------------------------------------------------------- |
| `tri-x` _(shipped)_ | Black and grain |     | .3  | .06  | −1  |        |        | .2  | .4    | harder contrast, muted colour, lifted blacks, grain, vignette        |
| `soft-mono`         | Soft mono       |     | −.2 | .1   | −1  |        |        |     | .08   | softer contrast, muted colour, lifted blacks                         |
| `hard-mono`         | Hard mono       |     | .4  | −.06 | −1  |        |        | .12 | .06   | harder contrast, muted colour, crushed blacks                        |
| `toned-warm`        | Warm tone       |     | .1  | .08  | −1  | 30/.34 | 55/.24 |     | .22   | muted colour, lifted blacks, amber shadows, gold highlights, grain   |
| `toned-cool`        | Cool tone       |     | .26 | .04  | −1  | 240/.3 |        | .22 | .16   | harder contrast, muted colour, lifted blacks, blue shadows, vignette |
| `newsprint`         | Newsprint       | .14 | .18 | .12  | −1  |        |        |     | .5    | brighter, harder contrast, muted colour, lifted blacks, grain        |

`free`: `tri-x` only. **Every row has `temperature: 0` and `tint: 0`, and that is not an oversight** — see the test below.

- [ ] **Step 1: Write the failing test**

Add to `looks.test.ts`:

```ts
/**
 * A monochrome look cannot be warmed by the white balance.
 *
 * The pipeline is exposure → lift → contrast → white balance → saturation →
 * split tone. At `saturation: -1`, saturation discards everything white balance
 * did, so a warm `temperature` on a black-and-white look moves no pixel — while
 * `describeGrade` cheerfully announces "warmer" to a screen reader. Toning comes
 * from the split tone, which runs after, or it does not happen.
 */
it('tones a monochrome look with split tone rather than white balance', () => {
  for (const entry of LOOKS.filter((candidate) => candidate.grade.saturation <= -1)) {
    expect(entry.grade.temperature).toBe(0);
    expect(entry.grade.tint).toBe(0);
  }
});
```

- [ ] **Step 2: Run it to verify it passes trivially, then meaningfully**

Run: `cd packages/domain && npx vitest run looks`
Expected: PASS — `tri-x` already has no white balance. The test is a guard for what Step 3 adds; confirm it fails if you temporarily set `temperature: 0.3` on `tri-x`, then put it back.

- [ ] **Step 3: Add the five looks**

`collection: 'monochrome'`, `free: false`, `saturation: -1` on every one.

- [ ] **Step 4: Run the suite**

Run: `cd packages/domain && npx vitest run looks`
Expected: PASS, all invariants.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/looks.ts packages/domain/src/looks.test.ts
git commit -m "feat(domain): five monochromes, and the rule that keeps two honest

Saturation runs after white balance and throws it away, so a warm
temperature on a black-and-white look changes nothing while describeGrade
announces 'warmer' to a screen reader. Toning is split tone or it is
nothing, and a test now says so."
```

---

### Task 4: The Slide collection

Reversal film: contrast first, colour second, blacks that go.

**Files:**

- Modify: `packages/domain/src/looks.ts`

| id                       | name                | exp | con | lift | sat | temp | tint | SH      | HL     | vig | grain | Says                                                                                        |
| ------------------------ | ------------------- | --- | --- | ---- | --- | ---- | ---- | ------- | ------ | --- | ----- | ------------------------------------------------------------------------------------------- |
| `ektachrome` _(shipped)_ | Clean slide         |     | .22 | −.02 | .08 | −.08 |      | 225/.16 |        |     | .08   | harder contrast, blue shadows                                                               |
| `velvia` _(shipped)_     | Saturated landscape |     | .32 | −.05 | .28 | .06  |      | 240/.12 |        | .22 | .05   | harder contrast, richer colour, crushed blacks, vignette                                    |
| `deep-chrome`            | Deep chrome         |     | .3  | −.06 | .3  | −.14 |      | 230/.24 |        | .26 |       | harder contrast, cooler, richer colour, crushed blacks, blue shadows, vignette              |
| `sunlit-chrome`          | Sunlit chrome       | .1  | .24 | −.04 | .22 | .22  |      |         | 55/.2  | .2  |       | brighter, harder contrast, warmer, richer colour, crushed blacks, gold highlights, vignette |
| `cross-process`          | Cross process       |     | .28 | .1   | .18 | −.1  | .2   | 175/.35 | 330/.3 | .12 | .1    | harder contrast, richer colour, lifted blacks, teal shadows, magenta highlights             |
| `muted-chrome`           | Muted chrome        |     | .2  | .04  | −.2 | .05  |      | 120/.18 |        | .1  | .06   | harder contrast, muted colour, lifted blacks, green shadows                                 |

`free`: `ektachrome` only.

- [ ] **Step 1: Add the four looks**

- [ ] **Step 2: Run the suite**

Run: `cd packages/domain && npx vitest run looks`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/looks.ts
git commit -m "feat(domain): four more ways a slide can look

Deep, sunlit, cross-processed, muted. Reversal film is contrast first and
colour second, and these differ in which of the two they spend."
```

---

### Task 5: The After dark collection

Night, and the several different colours night comes in.

**Files:**

- Modify: `packages/domain/src/looks.ts`

| id                      | name               | exp  | con  | lift | sat  | temp | SH      | HL      | vig | grain | Says                                                                                             |
| ----------------------- | ------------------ | ---- | ---- | ---- | ---- | ---- | ------- | ------- | --- | ----- | ------------------------------------------------------------------------------------------------ |
| `cinestill` _(shipped)_ | Tungsten night     | −.08 | .16  | .1   | .06  | −.24 | 250/.28 | 15/.22  | .24 | .26   | harder contrast, cooler, lifted blacks, blue shadows, red highlights, grain, vignette            |
| `neon`                  | Neon               | −.06 | .24  | .08  | .24  | −.16 | 290/.3  | 180/.24 | .28 | .12   | harder contrast, cooler, richer colour, lifted blacks, violet shadows, teal highlights, vignette |
| `sodium`                | Street light       | −.1  | .2   | .1   | −.1  | .28  | 35/.28  | 50/.26  | .26 | .3    | darker, harder contrast, warmer, lifted blacks, amber shadows, gold highlights, grain, vignette  |
| `blue-hour`             | Blue hour          | −.05 | −.14 | .1   | −.12 | −.3  | 235/.3  | 280/.18 | .14 | .18   | softer contrast, cooler, lifted blacks, blue shadows, violet highlights, grain                   |
| `available-dark`        | Available darkness | −.12 | .3   | −.04 | −.34 | −.08 | 245/.2  |         | .3  | .45   | darker, harder contrast, muted colour, crushed blacks, blue shadows, grain, vignette             |
| `interior`              | Interior lamp      | .06  | −.16 | .12  | −.08 | .24  | 10/.2   | 40/.2   | .1  | .14   | softer contrast, warmer, lifted blacks, red shadows, amber highlights                            |

`free`: `cinestill` only.

- [ ] **Step 1: Add the five looks**

- [ ] **Step 2: Run the suite**

Run: `cd packages/domain && npx vitest run looks`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/looks.ts
git commit -m "feat(domain): five more ways a night can look

Neon, sodium, blue hour, high ISO, a lamp indoors. Night is not one
colour, and a single 'night' look was the app pretending it is."
```

---

### Task 6: The Early digital collection

The 1995–2005 sensor: green casts, blown flash, crushed shadows. The collection that dates a photograph rather than warming it.

**Files:**

- Modify: `packages/domain/src/looks.ts`

| id             | name           | exp  | con  | lift | sat  | temp | tint | SH      | HL     | vig | grain | Says                                                                                             |
| -------------- | -------------- | ---- | ---- | ---- | ---- | ---- | ---- | ------- | ------ | --- | ----- | ------------------------------------------------------------------------------------------------ |
| `camcorder`    | Camcorder      | .1   | −.16 |      | −.14 | −.06 | −.24 | 110/.26 | 95/.2  | .16 | .1    | brighter, softer contrast, green shadows, green highlights                                       |
| `tape`         | Tape           | .04  | −.18 | .14  | .12  | .06  | .22  | 325/.28 | 185/.2 | .2  | .34   | softer contrast, richer colour, lifted blacks, magenta shadows, teal highlights, grain, vignette |
| `direct-flash` | Direct flash   | .16  | .28  | −.05 | −.18 | −.14 |      | 170/.18 |        | .24 | .08   | brighter, harder contrast, cooler, muted colour, crushed blacks, teal shadows, vignette          |
| `low-res`      | Low resolution | −.06 | .22  | −.04 | −.26 | .1   |      | 295/.2  | 65/.18 |     | .38   | harder contrast, muted colour, crushed blacks, violet shadows, gold highlights, grain            |
| `screen-glow`  | Screen glow    | .08  | −.2  | .16  | .14  | −.22 |      | 215/.24 |        |     | .2    | brighter, softer contrast, cooler, richer colour, lifted blacks, blue shadows, grain             |
| `early-web`    | Early web      |      | .34  |      | .34  | .14  |      |         | 45/.2  | .22 |       | harder contrast, warmer, richer colour, amber highlights, vignette                               |

`free`: `camcorder`.

- [ ] **Step 1: Add `'early-digital'` to `lookCollectionIds`**

It was left out in Task 1 so that no collection id ever existed without members.

- [ ] **Step 2: Add the six looks**

- [ ] **Step 3: Run the whole domain suite**

Run: `cd packages/domain && npx vitest run && npx tsc --noEmit`
Expected: PASS. `LOOKS.length` is now 30, and all thirty `describeGrade` sentences are distinct.

- [ ] **Step 4: Assert the shape of the finished library**

Add to `looks.test.ts`:

```ts
it('offers five collections with six looks each, one of them free', () => {
  expect(LOOKS).toHaveLength(30);
  for (const id of lookCollectionIds) {
    const members = looksIn(id);
    expect(members).toHaveLength(6);
    expect(members.filter((entry) => entry.free)).toHaveLength(1);
  }
});
```

- [ ] **Step 5: Run it, then commit**

Run: `cd packages/domain && npx vitest run looks`
Expected: PASS.

```bash
git add packages/domain/src/looks.ts packages/domain/src/looks.test.ts
git commit -m "feat(domain): the sixth collection, and the shape of the finished library

Early digital dates a photograph instead of warming it — green casts,
blown flash, crushed shadows. Thirty looks in five collections, one free
in each, asserted rather than counted by hand."
```

---

### Task 7: The look grid

Thirty chips in a wrapping rail is a list, not a chooser. This is the grid, and the reason it can exist at all is that the photograph is decoded once.

**Files:**

- Create: `apps/mobile/src/features/grading/LookTile.tsx`, `apps/mobile/src/features/grading/LookGrid.tsx`
- Modify: `apps/mobile/src/features/grading/GradeScreen.tsx`, `apps/mobile/src/features/studio/CameraStudioScreen.tsx`
- Modify: `apps/mobile/src/localization/en.ts`, `vi.ts`

**Interfaces:**

- Consumes: `LOOKS`, `looksIn`, `lookCollectionIds`, `gradesEqual`, `scaleGrade`; `GradePreview`'s existing Skia canvas pattern.
- Produces:
  - `LookTile({ look, image, size, selected, locked, onPress })`
  - `LookGrid({ image, current, onChoose, canAdjust, onLocked })`

> **The performance rule.** `bakeGrade.ts` already records what happens when a scrolling list mounts a canvas and compiles a runtime effect per card. Thirty tiles must share **one** decoded `SkImage` — `GradePreview`'s `useGradeImage` already produces it for the hero preview, so `LookGrid` takes the image as a prop rather than decoding its own. Each tile is then a small canvas over shared pixels with its own uniforms: one decode, thirty cheap draws, no file I/O per tile.

- [ ] **Step 1: Add the strings**

The five collection names are chips, and `localization.test.ts` holds chips to 16 characters in Vietnamese **and** to `english.length × 1.3 ≤ 16` — so the English must be 12 characters or fewer. `'Early digital'` is 13 and would fail; it ships as `'Digital'`.

`en.ts`:

```ts
  'look.collection.negative': 'Negative',
  'look.collection.slide': 'Slide',
  'look.collection.monochrome': 'Monochrome',
  'look.collection.after-dark': 'After dark',
  'look.collection.early-digital': 'Digital',
  'look.locked': 'Pro',
  'look.select': 'Apply {name}',
```

`vi.ts`:

```ts
  'look.collection.negative': 'Âm bản',
  'look.collection.slide': 'Slide',
  'look.collection.monochrome': 'Đơn sắc',
  'look.collection.after-dark': 'Về đêm',
  'look.collection.early-digital': 'Số hoá',
  'look.locked': 'Pro',
  'look.select': 'Áp dụng {name}',
```

Add the group to `CHIP_KEYS` in `localization.test.ts`:

```ts
    key.startsWith('look.collection.') ||
```

Run the localisation suite before moving on; it is the only check that these fit.

- [ ] **Step 2: Write the tile**

Create `apps/mobile/src/features/grading/LookTile.tsx`:

```tsx
import type { Look } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import type { SkImage } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Meta, Pressable, Text, useStyles } from '@/ui';
import { GradePreview } from './GradePreview';

/**
 * One look, previewed on the photograph it would be applied to.
 *
 * A swatch of someone else's photograph is a decoration; the point of a tile is
 * that it answers "what would this do to *mine*", which is the question a name
 * like "Cross process" cannot answer on its own.
 *
 * The decoded image arrives as a prop and is shared by every tile on screen —
 * see `LookGrid` for why that is the whole reason a grid is affordable here.
 */
export function LookTile({
  look,
  image,
  size,
  selected,
  locked,
  onPress,
}: {
  look: Look;
  image: SkImage;
  size: number;
  selected: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();

  return (
    <Pressable
      accessibilityLabel={t('look.select', { name: look.name })}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: false }}
      onPress={onPress}
      style={[styles.tile, { width: size }, selected && styles.selected]}
    >
      <View style={[styles.frame, { height: size }]}>
        <GradePreview grade={look.grade} height={size} image={image} width={size} />
        {locked ? (
          <View style={styles.lock}>
            <Meta>{t('look.locked')}</Meta>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} tone={selected ? 'primary' : 'secondary'} variant="chip">
        {look.name}
      </Text>
    </Pressable>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    tile: { gap: 6 },
    selected: { opacity: 1 },
    frame: {
      borderRadius: skin.round.control,
      overflow: 'hidden',
      backgroundColor: skin.ui.bg.media,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    lock: {
      position: 'absolute',
      right: 4,
      bottom: 4,
      backgroundColor: skin.ui.scrim.strong,
      borderRadius: skin.round.chip,
      paddingHorizontal: space.xs,
      paddingVertical: 2,
    },
  });
```

> The selected border is drawn by swapping `borderColor`, which needs a skin value — use whatever token `Chip`'s `selected` tone already uses so the grid agrees with the chips beside it. Read `Chip` and copy that token rather than picking a colour.

- [ ] **Step 3: Write the grid**

Create `apps/mobile/src/features/grading/LookGrid.tsx`:

```tsx
import {
  gradesEqual,
  lookCollectionIds,
  looksIn,
  type Grade,
  type LookCollectionId,
} from '@cw/domain';
import { space } from '@cw/tokens';
import type { SkImage } from '@shopify/react-native-skia';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Chip } from '@/ui';
import { LookTile } from './LookTile';

const TILE = 96;

/**
 * Thirty looks, six at a time.
 *
 * **The collection rail is a performance decision as much as an editorial one.**
 * Every tile is a Skia canvas compiling the grade shader, and thirty of those in
 * one scroll view is the stutter `bakeGrade.ts` already documents for the library
 * grid. Showing one collection at a time caps it at six live canvases, and the
 * six share a single decoded `SkImage` passed down from the screen — one decode
 * for the whole grid, no file I/O per tile.
 */
export function LookGrid({
  image,
  current,
  onChoose,
  isLocked,
  onLocked,
}: {
  image: SkImage;
  current: Grade;
  onChoose: (grade: Grade) => void;
  /** Asked per look, because the free one in each collection is not locked. */
  isLocked: (lookId: string) => boolean;
  onLocked: () => void;
}) {
  const { t } = usePreferences();
  const [collection, setCollection] = useState<LookCollectionId>('negative');

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={styles.rail}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {lookCollectionIds.map((id) => (
          <Chip
            key={id}
            label={t(`look.collection.${id}`)}
            onPress={() => setCollection(id)}
            tone={collection === id ? 'selected' : 'default'}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.tiles}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {looksIn(collection).map((look) => {
          const locked = isLocked(look.id);
          return (
            <LookTile
              image={image}
              key={look.id}
              locked={locked}
              look={look}
              // A locked tile still responds. One that does nothing teaches
              // someone the app is broken; one that opens the paywall teaches
              // them what it costs.
              onPress={() => (locked ? onLocked() : onChoose(look.grade))}
              selected={gradesEqual(current, look.grade)}
              size={TILE}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  rail: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.gutter },
  tiles: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.gutter },
});
```

> `t()` is typed against the message catalogue, so ``t(`look.collection.${id}`)`` only compiles because every `LookCollectionId` has a matching key. If TypeScript rejects the template, a key is missing — fix the catalogue, do not cast.

- [ ] **Step 4: Replace the rails**

In `GradeScreen.tsx`, replace the `FILM_STOCKS`/`LOOKS` chip rail under the `grade.stocks` heading with `<LookGrid image={image} … />`, passing the `image` already produced by `useGradeImage`. `onLocked` routes to `/paywall?trigger=advanced-grading`, as the chips do today.

`CameraStudioScreen.tsx` has its own captured frame; pass whatever `SkImage` it already holds for review. If it holds none, leave its chip rail alone and note why in the commit — a grid with no photograph to preview on is worse than chips.

- [ ] **Step 5: Verify**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint && npx jest --runInBand && npx prettier --check src`
Expected: PASS. `screens.test.tsx` presses every control on both screens, so a tile with a missing handler fails there.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/grading/LookTile.tsx apps/mobile/src/features/grading/LookGrid.tsx apps/mobile/src/features/grading/GradeScreen.tsx apps/mobile/src/features/studio/CameraStudioScreen.tsx apps/mobile/src/localization/
git commit -m "feat(grade): make thirty looks something you can look at

A wrapping rail of thirty chips is a list. The grid previews each look on
the actual photograph, sharing one decoded image across every tile —
thirty decodes in a scroll view is the stutter bakeGrade already warned
about."
```

---

### Task 8: One free look per collection

The data already says which. This is the gate reading it.

**Files:**

- Modify: `apps/mobile/src/features/grading/LookGrid.tsx`, `apps/mobile/src/features/grading/GradeScreen.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/grading/lookGating.test.ts`:

```ts
import { LOOKS, look, lookCollectionIds, looksIn } from '@cw/domain';
import { hasEntitlement } from '@cw/domain';

/**
 * Which looks a free account can actually use.
 *
 * The catalogue carries `free` and the screen reads it; this asserts the two
 * agree on the shape of the offer, so "one taster per collection" cannot quietly
 * become none — the failure mode that turns the grid into a wall.
 */

const lockedFor = (tier: 'free' | 'pro', id: string) =>
  !hasEntitlement(tier, 'advanced_grading') && !look(id)!.free;

it('leaves exactly one look open per collection on the free tier', () => {
  for (const collection of lookCollectionIds) {
    const open = looksIn(collection).filter((entry) => !lockedFor('free', entry.id));
    expect(open).toHaveLength(1);
  }
});

it('locks nothing at all on pro', () => {
  const locked = LOOKS.filter((entry) => lockedFor('pro', entry.id));
  expect(locked).toEqual([]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/mobile && npx jest lookGating --runInBand`
Expected: FAIL until Task 6 has landed all thirty looks — if Tasks 2–6 are complete it passes immediately, which is fine: it is a regression guard on data that already exists, and Step 3 is what makes the screen honour it.

- [ ] **Step 3: Gate on the look, not on the screen**

In `GradeScreen.tsx`, the stock rail is currently gated wholesale on `useEntitlement('advanced_grading')`. Pass per-look gating into the grid instead:

```tsx
<LookGrid
  current={current}
  image={image}
  isLocked={(lookId) => !canAdjust && !(look(lookId)?.free ?? false)}
  onChoose={choose}
  onLocked={() => router.push('/paywall?trigger=advanced-grading')}
/>
```

Import `look` from `@cw/domain`. The manual sliders stay gated exactly as they are — `advanced_grading` still means "take the grade apart", and that has not changed.

- [ ] **Step 3: Verify**

Run: `cd /Users/tony/Chroma-workspace && pnpm check`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/grading/
git commit -m "feat(grade): open one look in every collection

Thirty locked chips tells someone the app is not for them. One working
look per collection tells them what the collection is, which is the thing
worth paying to unlock."
```

---

## Verification

```bash
pnpm check
cd apps/mobile && npx expo export --platform ios
```

**On a device:** the grid scrolls without stutter (the shared-image claim), each tile previews the real photograph, a locked tile opens the paywall, and the five free looks apply without one.

**Whether thirty looks are thirty _good_ looks cannot be checked from here.** The tests prove they are distinct, describable, schema-valid and honest about monochrome toning. Whether `Blue hour` looks like blue hour needs an eye and a photograph.

## Not in this plan

Slices 5 and 6 of the spec — batch grading and cinematic share frames — keep their own plans.
