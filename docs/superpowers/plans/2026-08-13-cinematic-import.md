# Cinematic Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a photograph, reach its grade in one step, adjust the look's intensity, and save the graded result at full resolution to the photo library.

**Architecture:** Slices 1–3 of `docs/superpowers/specs/2026-08-13-cinematic-import-design.md`. Everything is an addition on top of the existing `Grade` type. `gradeShader.ts` is not modified. The bake path is generalised by lifting its hard-coded long edge into a parameter; the import path is shortened by extracting the palette commit out of `ResultRoute` so a second caller can use it; intensity is a pure domain function that produces a `Grade` and is never stored.

**Tech Stack:** Expo SDK 55, React Native 0.83, expo-router (typed routes), Zustand, Skia (`@shopify/react-native-skia` 2.4.18), Zod 4, Jest + `@testing-library/react-native` (mobile), Vitest (domain).

## Global Constraints

- **Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing Expo code.** This applies especially to Task 4 (`expo-media-library`) — verify `requestPermissionsAsync` and `saveToLibraryAsync` signatures against v55 docs, not memory.
- **Do not modify `apps/mobile/src/lib/grade/gradeShader.ts`.** It is asserted pixel-for-pixel against `applyGradeToPixel`; changing it costs that proof again. No task here needs to.
- **React Compiler is on but bails out on some files.** Before removing any `useMemo`/`useCallback`, run `node apps/mobile/scripts/react-compiler-healthcheck.mjs`. No task here requires removing memoisation.
- **Export is unrestricted.** Full resolution, no watermark, for every tier. No new entitlement is introduced. `advanced_grading` keeps its current meaning (film stocks + manual sliders).
- **Intensity is free**, and is never persisted — what lands on the record is the scaled `Grade`.
- **Export resolution ceiling is 4096px on the long edge.** Never upscale.
- **Every new user-facing string must be added to BOTH `en.ts` and `vi.ts`.** `localization.test.ts` fails the build otherwise.
- **Every commit leaves these green:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`.
- Workspace packages are addressed as `@cw/domain`, `@cw/tokens`, `@cw/analytics` from the app; never by relative path across directories.

## File Structure

**Created:**

| File                                                      | Responsibility                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/features/capture/useCaptureCommit.ts`    | Commits the pending capture to the library and returns the palette. Owns persistence, set membership, haptics, analytics — not routing. |
| `apps/mobile/src/lib/grade/saveGraded.ts`                 | Renders a graded photograph at export size and gets it out of the app: to the photo library, or to the share sheet.                     |
| `apps/mobile/src/lib/grade/bakeGrade.test.ts`             | Tests `targetSize` — the ceiling arithmetic.                                                                                            |
| `apps/mobile/src/features/grading/useGradedExport.ts`     | The export action as a hook: status machine plus `save`/`share`, so `GradeScreen` stays a screen.                                       |
| `apps/mobile/src/features/tools/importCinematic.test.tsx` | Asserts the "Make cinematic" action hands back the read colours and the photo.                                                          |

**Modified:**

| File                                                  | Change                                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/domain/src/grading.ts`                      | Adds `scaleGrade`.                                                                         |
| `packages/domain/src/grading.test.ts`                 | Tests `scaleGrade`.                                                                        |
| `apps/mobile/src/lib/grade/bakeGrade.ts`              | Lifts `LONG_EDGE` into a parameter; adds `targetSize`, `renderGraded`, `EXPORT_LONG_EDGE`. |
| `apps/mobile/src/lib/grade/index.ts`                  | Re-exports the new surface.                                                                |
| `apps/mobile/src/lib/export.ts`                       | Corrects the module comment that says nothing writes to the photo library.                 |
| `apps/mobile/src/features/capture/ResultRoute.tsx`    | Uses `useCaptureCommit` instead of its inline `commit`.                                    |
| `apps/mobile/src/features/tools/ImportPickScreen.tsx` | Adds the "Make cinematic" action.                                                          |
| `apps/mobile/src/app/tools/import.tsx`                | Wires that action to commit + navigate to `/tools/grade`.                                  |
| `apps/mobile/src/features/grading/GradeScreen.tsx`    | Adds Save/Share and the intensity slider.                                                  |
| `apps/mobile/src/localization/en.ts`, `vi.ts`         | New strings.                                                                               |
| `apps/mobile/src/localization/localization.test.ts`   | Adds the new button keys to `BUTTON_KEYS`.                                                 |
| `apps/mobile/app.json`                                | `expo-media-library` plugin + permission strings.                                          |
| `apps/mobile/package.json`                            | `expo-media-library` dependency.                                                           |
| `apps/mobile/jest.setup.ts`                           | Mocks `expo-media-library`.                                                                |

---

### Task 1: Extract the capture commit from ResultRoute

`ResultRoute` owns the only path that writes a captured palette to the library. The import route needs the same write, and duplicating it would mean two places that must both remember to move the photo out of the purgeable cache.

This task is a **pure refactor — no behaviour changes.** The gate is that the existing suite still passes.

**Files:**

- Create: `apps/mobile/src/features/capture/useCaptureCommit.ts`
- Modify: `apps/mobile/src/features/capture/ResultRoute.tsx:43-91`

**Interfaces:**

- Consumes: `useCaptureStore` (`toPalette`, `discard`), `usePalettes` (`save`), `useSets`, `persistPhoto` — all existing.
- Produces: `useCaptureCommit(): (name: string) => Promise<Palette | null>` — writes the palette, returns it, and leaves routing to the caller. Returns `null` when there is no committable pending capture.

- [ ] **Step 1: Run the existing suite and record the baseline**

Run: `cd apps/mobile && npx jest --runInBand`
Expected: PASS. Note the number of passing tests — Step 5 must match it.

- [ ] **Step 2: Create the hook**

Create `apps/mobile/src/features/capture/useCaptureCommit.ts`:

```tsx
import type { Palette } from '@cw/domain';
import { useCallback } from 'react';
import { usePalettes, useSets } from '@/hooks';
import { analytics, hapticsService, soundService } from '@/infrastructure/dependencies';
import { persistPhoto } from '@/lib';
import { useCaptureStore } from '@/store';

/**
 * Writes the pending capture to the library and hands back what was written.
 *
 * **It does not navigate.** Two callers commit a capture and they go to
 * different places afterwards: the result sheet continues into pairing or back
 * to the project it was started from, and the import path goes straight to the
 * grade. Returning the palette rather than routing is what lets one write serve
 * both, and it is the only reason this is a hook rather than a function.
 */
export function useCaptureCommit(): (name: string) => Promise<Palette | null> {
  const { save } = usePalettes();
  const { sets, save: saveSet } = useSets();
  const toPalette = useCaptureStore((state) => state.toPalette);
  const setId = useCaptureStore((state) => state.pending?.setId ?? null);
  const discard = useCaptureStore((state) => state.discard);

  return useCallback(
    async (name: string) => {
      const draft = toPalette(name);
      if (!draft) return null;
      // The frame is still in a purgeable cache at this point. Saving the record
      // without moving the file first is how a library ends up full of palettes
      // whose photos have quietly vanished.
      const palette = { ...draft, photoUri: persistPhoto(draft.photoUri, draft.id) };
      await save(palette);

      /**
       * A capture started from a project belongs to it. Membership is written
       * here rather than left for the user to do afterwards, because the whole
       * point of the gap line is that answering it closes the gap — a palette
       * that silently missed its set would leave the same sentence on screen.
       */
      const target = setId ? (sets.find((entry) => entry.id === setId) ?? null) : null;
      if (target && !target.paletteIds.includes(palette.id)) {
        try {
          await saveSet({
            ...target,
            paletteIds: [...target.paletteIds, palette.id],
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // The palette is saved and carries the set id on its own record, so
          // nothing was lost — only the set's list missed this write.
        }
      }

      void hapticsService.fire('paletteSaved');
      void soundService.play('save');
      analytics.track('palette_saved', { tuned: palette.tuned, source: palette.source });
      discard();
      return palette;
    },
    [toPalette, save, sets, saveSet, setId, discard],
  );
}
```

- [ ] **Step 3: Rewrite `ResultRoute`'s commit to use it**

In `apps/mobile/src/features/capture/ResultRoute.tsx`, delete the whole `const commit = useCallback(...)` block (lines 43–91) and replace it with:

```tsx
const commitCapture = useCaptureCommit();

const commit = useCallback(
  async (name: string) => {
    const palette = await commitCapture(name);
    if (!palette) return;
    /**
     * Back to the project when there is one: the merged band re-proportioning
     * to include this capture is the result of the action, and landing on the
     * palette detail instead would hide it.
     *
     * Otherwise straight into pairing. The save already produced a complete
     * Chromatic Memory — `MemoryBackedPaletteRepository` widens a palette the
     * memory store has never seen — so this is not "finish the record", it is
     * the second half of what the product is for. Backing out of that screen
     * lands on the memory, which is a finished thing either way.
     */
    router.replace(palette.setIds[0] ? `/set/${palette.setIds[0]}` : `/pair?id=${palette.id}`);
  },
  [commitCapture, router],
);
```

Add the import `import { useCaptureCommit } from './useCaptureCommit';` beside the other local imports. Remove any imports that are now unused (`usePalettes`, `useSets`, `persistPhoto`, `hapticsService`, `soundService`, `analytics`, and the `setId`/`save`/`saveSet`/`discard` bindings the deleted block used) — but keep `discard`, which `onRetake` and the `TuneScreen` branch still use, and keep `usePalettes`/`useSets` only if something else in the file still reads them. `pnpm lint` will name anything left over.

> **Note on `setIds[0]`:** the removed code read `setId` from the store. After `discard()` the store is empty, so the route reads the set from the committed palette instead — `toPalette` writes `setIds: pending.setId ? [pending.setId] : []`, so this is the same value.

- [ ] **Step 4: Typecheck and lint**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint`
Expected: PASS, no unused-import errors.

- [ ] **Step 5: Run the suite and confirm the baseline is unchanged**

Run: `cd apps/mobile && npx jest --runInBand`
Expected: PASS, same count as Step 1. A refactor that changes a test result is not a refactor.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/capture/useCaptureCommit.ts apps/mobile/src/features/capture/ResultRoute.tsx
git commit -m "refactor(capture): make the commit a thing two callers can share

The result sheet owned the only write that puts a captured palette in the
library, routing included. The import path needs the same write and a
different destination, so the write moves into a hook and the routing
stays where it was."
```

---

### Task 2: "Make cinematic" — the one-step way into the grade

Reaching a grade from an imported photograph currently takes five steps. This makes it one.

**Files:**

- Modify: `apps/mobile/src/features/tools/ImportPickScreen.tsx`
- Modify: `apps/mobile/src/app/tools/import.tsx`
- Modify: `apps/mobile/src/localization/en.ts`, `apps/mobile/src/localization/vi.ts`
- Modify: `apps/mobile/src/localization/localization.test.ts`
- Test: `apps/mobile/src/features/tools/importCinematic.test.tsx`

**Interfaces:**

- Consumes: `useCaptureCommit` from Task 1.
- Produces: `ImportPickScreen` gains a required prop `onCinematic: (colors: readonly Color[], photoUri: string | null) => void`, with the same signature as the existing `onExtract`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/features/tools/importCinematic.test.tsx`:

```tsx
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { PreferencesProvider } from '@/providers';

/**
 * The import screen's second intent.
 *
 * EXTRACT produces a palette to work with; MAKE CINEMATIC produces a photograph
 * to grade. Both hand back the same two things, and this asserts the cinematic
 * one is wired to the automatic read rather than requiring sample points — the
 * whole claim of the feature is that picking a photo is enough.
 */

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///tmp/picked.heic' }],
  })),
}));

jest.mock('@/lib/decodable', () => ({
  isDecodable: () => true,
  toDecodableUri: jest.fn(async () => 'file:///tmp/picked.jpg'),
}));

jest.mock('@/lib/readPalette', () => ({
  decodeImage: jest.fn(async () => null),
  readPalette: jest.fn(async () => ({
    ok: true,
    result: {
      colors: [
        { hex: '#7C5CFF', weight: 0.6, role: 'dominant' },
        { hex: '#22D3EE', weight: 0.4, role: 'support' },
      ],
      deltaE: 2.4,
      confidence: 0.94,
    },
  })),
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

it('hands the automatic read and the photo to the cinematic action', async () => {
  const user = userEvent.setup();
  const onCinematic = jest.fn();

  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <ImportPickScreen onCancel={jest.fn()} onCinematic={onCinematic} onExtract={jest.fn()} />
      </PreferencesProvider>
    </SafeAreaProvider>,
  );

  // The picker runs on mount and the whole-image read follows it, so the action
  // becomes available without a single tap on the canvas.
  await waitFor(() => expect(screen.getByText('Make cinematic')).toBeTruthy());
  await user.press(screen.getByText('Make cinematic'));

  expect(onCinematic).toHaveBeenCalledTimes(1);
  const [colors, photoUri] = onCinematic.mock.calls[0]!;
  expect(colors).toHaveLength(2);
  expect(photoUri).toBe('file:///tmp/picked.jpg');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest importCinematic --runInBand`
Expected: FAIL — TypeScript/prop error on `onCinematic`, and `Unable to find an element with text: Make cinematic`.

> **If the render throws for a missing context** rather than failing on the missing button, wrap the tree in `EntitlementProvider` inside `PreferencesProvider`, exactly as `apps/mobile/src/features/capture/captureCommit.test.tsx:57-64` does. That is a wrapper problem, not a signal the test is wrong.

- [ ] **Step 3: Add the strings**

In `apps/mobile/src/localization/en.ts`, beside the other `import.*` keys (around line 367):

```ts
  'import.cinematic': 'Make cinematic',
```

In `apps/mobile/src/localization/vi.ts`, at the matching position:

```ts
  'import.cinematic': 'Làm điện ảnh',
```

In `apps/mobile/src/localization/localization.test.ts`, add the key to `BUTTON_KEYS` — it is a full-width button and must hold under the 30% expansion rule:

```ts
    key === 'result.save' ||
    key === 'import.cinematic' ||
```

- [ ] **Step 4: Add the action to the screen**

In `apps/mobile/src/features/tools/ImportPickScreen.tsx`:

Add `Button` to the `@/ui` import list. Add the prop to the signature:

```tsx
export function ImportPickScreen({
  onCancel,
  onExtract,
  onCinematic,
}: {
  onCancel: () => void;
  /** The photo travels with the colours — the result sheet and card both show it. */
  onExtract: (colors: readonly Color[], photoUri: string | null) => void;
  /**
   * The same two things, going somewhere else: straight to the grade.
   *
   * Two intents rather than two screens. Someone importing a photo either wants
   * the colours out of it or wants the photograph itself to look like something,
   * and making them guess which button means which is worse than having two.
   */
  onCinematic: (colors: readonly Color[], photoUri: string | null) => void;
}) {
```

Add a `cinematic` action beside the existing `extract` function:

```tsx
const cinematic = () => {
  if (usingPoints) {
    onCinematic(evenlyWeightedColors(points.map((point) => point.hex)), uri);
    return;
  }
  if (auto?.colors.length) onCinematic(auto.colors, uri);
};
```

Insert the button between the `preview` swatch row and the `hint` card:

```tsx
{
  canExtract ? (
    <Gutter style={styles.cinematic}>
      <Button label={t('import.cinematic')} onPress={cinematic} size="lg" variant="contrast" />
    </Gutter>
  ) : null;
}
```

Add `Gutter` to the `@/ui` import list, and the style:

```tsx
    cinematic: { paddingTop: space.md },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest importCinematic --runInBand`
Expected: PASS.

- [ ] **Step 6: Wire the route**

Replace `apps/mobile/src/app/tools/import.tsx` with:

```tsx
import { useRouter } from 'expo-router';
import { ErrorBoundary } from '@/components';
import { useCaptureCommit } from '@/features/capture/useCaptureCommit';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { useCaptureStore } from '@/store';

/**
 * G2 feeds the same result sheet the shutter does — and, when asked, skips it.
 *
 * EXTRACT hands the colours to B2, which is what someone building a palette
 * wants. MAKE CINEMATIC commits the same record and goes straight to the grade,
 * because the five steps in between are five steps someone who imported a
 * photograph to make it look like something never asked for.
 */
export default function ImportRoute() {
  const router = useRouter();
  const begin = useCaptureStore((state) => state.begin);
  const commit = useCaptureCommit();

  return (
    <ErrorBoundary label="Photo import" onReset={() => router.back()}>
      <ImportPickScreen
        onCancel={router.back}
        onCinematic={(colors, photoUri) => {
          // `begin` writes the store synchronously, and `commit` reads the
          // current state when it is called rather than closing over it — so
          // the capture is committable on the very next line.
          begin({ colors, photoUri, deltaE: 0, confidence: 1, source: 'photo' });
          void (async () => {
            const palette = await commit('Imported photo');
            // A commit that produced nothing means the read gave fewer than two
            // colours. The screen the user came from is still behind them.
            if (!palette) return;
            router.replace(`/tools/grade?id=${palette.id}`);
          })();
        }}
        onExtract={(colors, photoUri) => {
          begin({
            colors,
            photoUri,
            // The points were placed by hand, so there is no sampling drift to
            // report and no estimate to hedge — this is what was asked for.
            deltaE: 0,
            confidence: 1,
            source: 'photo',
          });
          router.replace('/capture/result');
        }}
      />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 7: Run the full suite, typecheck, lint and format**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint && npx jest --runInBand && npx prettier --check src`
Expected: all PASS. The localisation suite in particular must pass — it fails loudly if `vi.ts` is missing the key or the button is over budget.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/features/tools/ImportPickScreen.tsx apps/mobile/src/features/tools/importCinematic.test.tsx apps/mobile/src/app/tools/import.tsx apps/mobile/src/localization/en.ts apps/mobile/src/localization/vi.ts apps/mobile/src/localization/localization.test.ts
git commit -m "feat(import): let a photograph go straight to its grade

Importing one and reaching the look it asks for took five steps, four of
which are about building a palette. EXTRACT still does that. The new
action commits the same record and opens the grade."
```

---

### Task 3: Lift the bake's long edge into a parameter

`bakeGradedThumbnail` hard-codes 1024px. Export needs the same renderer at a different size. This adds the ceiling arithmetic as a tested pure function and generalises the renderer around it, leaving the thumbnail path byte-for-byte identical.

**Files:**

- Modify: `apps/mobile/src/lib/grade/bakeGrade.ts`
- Modify: `apps/mobile/src/lib/grade/index.ts`
- Test: `apps/mobile/src/lib/grade/bakeGrade.test.ts`

**Interfaces:**

- Produces:
  - `THUMBNAIL_LONG_EDGE = 1024`, `EXPORT_LONG_EDGE = 4096`
  - `targetSize(width: number, height: number, longEdge: number): { width: number; height: number; scale: number } | null`
  - `renderGraded(sourceUri: string, grade: Grade, longEdge: number): Promise<Uint8Array | null>` — PNG bytes, or null on any failure.
  - `bakeGradedThumbnail(sourceUri, grade, paletteId)` keeps its existing signature and behaviour.

> **Why the test targets `targetSize` and not `renderGraded`:** the Jest Skia mock (`jest.setup.ts`) provides `Skia.Surface` and `Skia.RuntimeEffect.Make` but has no `Skia.Matrix` and no `makeShaderWithChildren`, so `renderGraded` takes its `catch` and returns null under Jest. That is correct behaviour for a renderer with no GPU, and it is not a test of anything. The arithmetic is the part with decisions in it.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/lib/grade/bakeGrade.test.ts`:

```ts
import { EXPORT_LONG_EDGE, THUMBNAIL_LONG_EDGE, targetSize } from './bakeGrade';

/**
 * What size a graded copy comes out at.
 *
 * Two rules, and both are about not doing damage: a frame is never enlarged,
 * because inventing pixels is not exporting, and it is never rendered above the
 * ceiling, because a 48MP surface is the shortest path to an out-of-memory crash
 * on an older phone — and a crash while saving is worse than a long edge someone
 * has to be told about.
 */

describe('targetSize', () => {
  it('caps the long edge of a landscape frame', () => {
    expect(targetSize(8000, 6000, EXPORT_LONG_EDGE)).toEqual({
      width: 4096,
      height: 3072,
      scale: 0.512,
    });
  });

  it('caps the long edge of a portrait frame, which is its height', () => {
    const size = targetSize(3000, 6000, EXPORT_LONG_EDGE);
    expect(size?.height).toBe(4096);
    expect(size?.width).toBe(2048);
  });

  it('never upscales a frame smaller than the ceiling', () => {
    expect(targetSize(800, 600, EXPORT_LONG_EDGE)).toEqual({
      width: 800,
      height: 600,
      scale: 1,
    });
  });

  it('keeps the thumbnail size the bake has always produced', () => {
    expect(THUMBNAIL_LONG_EDGE).toBe(1024);
    expect(targetSize(4000, 3000, THUMBNAIL_LONG_EDGE)).toEqual({
      width: 1024,
      height: 768,
      scale: 0.256,
    });
  });

  it('rounds to whole pixels rather than producing a fractional surface', () => {
    const size = targetSize(1000, 333, 100);
    expect(Number.isInteger(size?.width)).toBe(true);
    expect(Number.isInteger(size?.height)).toBe(true);
    expect(size?.height).toBeGreaterThanOrEqual(1);
  });

  it('refuses a frame with no area rather than returning a zero surface', () => {
    expect(targetSize(0, 1000, EXPORT_LONG_EDGE)).toBeNull();
    expect(targetSize(1000, -1, EXPORT_LONG_EDGE)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npx jest bakeGrade --runInBand`
Expected: FAIL — `targetSize is not a function`.

- [ ] **Step 3: Rewrite `bakeGrade.ts` around the parameter**

Replace the constant block and `bakeGradedThumbnail` in `apps/mobile/src/lib/grade/bakeGrade.ts` with:

```ts
/**
 * Long edge of the baked copy.
 *
 * Comfortably above the largest card the app draws on a 3x screen, and far below
 * the frame itself: this is a thumbnail with a look, not a second master.
 */
export const THUMBNAIL_LONG_EDGE = 1024;

/**
 * Long edge of an exported copy.
 *
 * Not the frame's own size. A 48MP photograph through `Skia.Surface.MakeOffscreen`
 * is the shortest route to an out-of-memory crash on an older phone, and a crash
 * while saving is a worse outcome than a ceiling. 4096px prints A3 at 300dpi,
 * which is past where anyone is taking a phone photograph.
 */
export const EXPORT_LONG_EDGE = 4096;

const FOLDER = 'palette-photos';

/**
 * The size a frame is rendered at, and the scale that gets it there.
 *
 * Null for a frame with no area: a zero-dimension surface is not an error worth
 * throwing about, but it is certainly not something to hand to the GPU.
 */
export function targetSize(
  width: number,
  height: number,
  longEdge: number,
): { width: number; height: number; scale: number } | null {
  if (width <= 0 || height <= 0) return null;
  // `min(1, …)` is the no-upscaling rule: a frame already inside the ceiling is
  // rendered at its own size, because enlarging it invents detail it never had.
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Renders a graded copy in memory and returns its PNG bytes, or null.
 *
 * The bytes rather than a file, because the two callers want different things
 * done with them — one writes beside the palette, the other hands them to the
 * photo library or the share sheet — and a renderer that also decided where
 * things live would have to be asked twice.
 */
export async function renderGraded(
  sourceUri: string,
  grade: Grade,
  longEdge: number,
): Promise<Uint8Array | null> {
  try {
    const image = await decodeImage(sourceUri);
    if (!image) return null;

    try {
      const size = targetSize(image.width(), image.height(), longEdge);
      if (!size) return null;

      const surface = Skia.Surface.MakeOffscreen(size.width, size.height);
      if (!surface) return null;

      const effect = Skia.RuntimeEffect.Make(GRADE_SHADER);
      if (!effect) return null;

      const matrix = Skia.Matrix();
      matrix.scale(size.scale, size.scale);
      const source = image.makeShaderOptions(
        TileMode.Clamp,
        TileMode.Clamp,
        FilterMode.Linear,
        MipmapMode.Linear,
        matrix,
      );

      const named = gradeUniforms(resolveGrade(grade), size.width, size.height);
      const flat: number[] = [];
      for (const name of GRADE_UNIFORM_ORDER) {
        const value = named[name];
        if (Array.isArray(value)) flat.push(...value);
        else flat.push(value as number);
      }

      const paint = Skia.Paint();
      paint.setShader(effect.makeShaderWithChildren(flat, [source]));

      const canvas = surface.getCanvas();
      canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), paint);
      surface.flush();

      const bytes = surface.makeImageSnapshot().encodeToBytes();
      return bytes && bytes.length > 0 ? bytes : null;
    } finally {
      image.dispose();
    }
  } catch {
    return null;
  }
}

/**
 * Writes the graded copy and returns its uri, or null if anything on the way
 * failed.
 *
 * Null rather than throwing: a grade that saved but could not be baked is a
 * grade that still works everywhere it is rendered live, and the caller has a
 * more useful thing to do with that than a crash.
 */
export async function bakeGradedThumbnail(
  sourceUri: string,
  grade: Grade,
  paletteId: string,
): Promise<string | null> {
  const bytes = await renderGraded(sourceUri, grade, THUMBNAIL_LONG_EDGE);
  return bytes ? write(bytes, paletteId) : null;
}
```

Leave the module's own doc comment and the `write` function below untouched.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npx jest bakeGrade --runInBand`
Expected: PASS, 6 tests.

- [ ] **Step 5: Widen the module's barrel**

In `apps/mobile/src/lib/grade/index.ts`, add:

```ts
export {
  EXPORT_LONG_EDGE,
  THUMBNAIL_LONG_EDGE,
  bakeGradedThumbnail,
  renderGraded,
  targetSize,
} from './bakeGrade';
```

- [ ] **Step 6: Run the full suite, typecheck and lint**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint && npx jest --runInBand`
Expected: PASS. `GradeScreen` imports `bakeGradedThumbnail` from `@/lib/grade/bakeGrade` and that import still resolves unchanged.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/lib/grade/bakeGrade.ts apps/mobile/src/lib/grade/bakeGrade.test.ts apps/mobile/src/lib/grade/index.ts
git commit -m "feat(grade): render a graded copy at any size, under a ceiling

The bake was a thumbnail with its size welded in. Export needs the same
renderer bigger, so the size becomes an argument and the two rules worth
having — never upscale, never past 4096 — become a tested function."
```

---

### Task 4: Add `expo-media-library` and the save path

The native change. `export.ts` currently documents the opposite decision — that nothing writes to the photo library — and that comment is corrected here rather than left to contradict the code.

**Files:**

- Modify: `apps/mobile/package.json` (via `expo install`)
- Modify: `apps/mobile/app.json`
- Modify: `apps/mobile/jest.setup.ts`
- Modify: `apps/mobile/src/lib/export.ts:23-25` (comment only)
- Create: `apps/mobile/src/lib/grade/saveGraded.ts`
- Modify: `apps/mobile/src/lib/grade/index.ts`

**Interfaces:**

- Consumes: `renderGraded`, `EXPORT_LONG_EDGE` (Task 3); `shareFile` from `@/lib/export`.
- Produces:
  - `type GradeExportOutcome = 'saved' | 'shared' | 'dismissed' | 'denied' | 'failed'`
  - `saveGradedToPhotos(sourceUri: string, grade: Grade): Promise<GradeExportOutcome>`
  - `shareGraded(sourceUri: string, grade: Grade): Promise<GradeExportOutcome>`

- [ ] **Step 1: Read the v55 docs**

Open https://docs.expo.dev/versions/v55.0.0/sdk/media-library/ and confirm the exact signatures of `requestPermissionsAsync` and `saveToLibraryAsync`, and the config-plugin option names. The code below assumes `requestPermissionsAsync(writeOnly?: boolean)` resolving `{ granted: boolean }` and `saveToLibraryAsync(localUri: string)`. **If v55 differs, follow the docs and adjust — the docs win.**

- [ ] **Step 2: Install the dependency**

Run: `cd apps/mobile && npx expo install expo-media-library`
Expected: `package.json` gains `"expo-media-library": "~55.0.x"` at the version the SDK pins.

- [ ] **Step 3: Configure the plugin and the permission string**

In `apps/mobile/app.json`, add to the `plugins` array after the `expo-image-picker` entry:

```json
      [
        "expo-media-library",
        {
          "photosPermission": "Chroma Wave reads colour from a photo you choose. The photo is analysed on device and only the palette is kept.",
          "savePhotosPermission": "Chroma Wave saves the graded photograph you made back to your library.",
          "isAccessMediaLocationEnabled": false
        }
      ],
```

- [ ] **Step 4: Mock it under Jest**

In `apps/mobile/jest.setup.ts`, beside the other Expo module mocks:

```ts
// The photo library is a native capability with no JS fallback. The mock grants
// permission and swallows the write, so the success path runs under test; tests
// that care about refusal override `requestPermissionsAsync` themselves.
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  saveToLibraryAsync: jest.fn(async () => undefined),
}));
```

- [ ] **Step 5: Correct the stale comment in `export.ts`**

In `apps/mobile/src/lib/export.ts`, replace lines 23–25:

```ts
 * Nothing here writes to the photo library — that needs a permission and a
 * native module this build does not carry. Files land in the cache directory and
 * go out through the system share sheet, which offers "Save Image" itself.
```

with:

```ts
 * Nothing *here* writes to the photo library: these are share cards and
 * gradients, and they go out through the system share sheet, which offers
 * "Save Image" itself. A graded photograph is the exception and has its own
 * module — see `lib/grade/saveGraded.ts`, which carries `expo-media-library`
 * and the permission that comes with it. The distinction is deliberate: a card
 * about a palette is something you send, and a photograph is something you keep.
```

- [ ] **Step 6: Write the save module**

Create `apps/mobile/src/lib/grade/saveGraded.ts`:

```ts
import type { Grade } from '@cw/domain';
import { File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { shareFile } from '@/lib/export';
import { EXPORT_LONG_EDGE, renderGraded } from './bakeGrade';

/**
 * Getting a graded photograph out of the app.
 *
 * Two destinations over one renderer. Saving puts it in the camera roll, which
 * is where a photograph belongs and is why this module carries a permission at
 * all. Sharing hands the same bytes to the system sheet.
 *
 * Neither is gated: the export is free at full resolution and carries no
 * watermark on any tier. What Pro buys is the look, not the file.
 */

export type GradeExportOutcome = 'saved' | 'shared' | 'dismissed' | 'denied' | 'failed';

/** Named for the person, not the palette: this is what lands in their library. */
const FILENAME = 'chromawave-graded.png';

/**
 * Renders at export size and writes to the photo library.
 *
 * `denied` is a distinct outcome from `failed` because the two need different
 * sentences: one is answered in Settings and the other is not the user's doing
 * at all. Collapsing them would leave someone tapping a button that will never
 * work with no idea why.
 */
export async function saveGradedToPhotos(
  sourceUri: string,
  grade: Grade,
): Promise<GradeExportOutcome> {
  const bytes = await renderGraded(sourceUri, grade, EXPORT_LONG_EDGE);
  if (!bytes) return 'failed';

  try {
    // Write-only: the app is adding a photograph, not reading the library, and
    // asking for more access than that is a permission prompt people refuse.
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) return 'denied';

    // `saveToLibraryAsync` takes a file, so the bytes land in the cache first.
    // The cache is the right home for it: the copy that matters is now the one
    // in the photo library, and the system can reclaim this whenever it likes.
    const file = new File(Paths.cache, FILENAME);
    file.create({ overwrite: true, intermediates: true });
    file.write(bytes);

    await MediaLibrary.saveToLibraryAsync(file.uri);
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Renders at export size and hands the file to the system share sheet. */
export async function shareGraded(sourceUri: string, grade: Grade): Promise<GradeExportOutcome> {
  const bytes = await renderGraded(sourceUri, grade, EXPORT_LONG_EDGE);
  if (!bytes) return 'failed';

  const outcome = await shareFile(bytes, FILENAME);
  if (outcome === 'shared') return 'shared';
  return outcome === 'dismissed' ? 'dismissed' : 'failed';
}
```

- [ ] **Step 7: Widen the barrel**

In `apps/mobile/src/lib/grade/index.ts`, add:

```ts
export { saveGradedToPhotos, shareGraded, type GradeExportOutcome } from './saveGraded';
```

- [ ] **Step 8: Typecheck, lint, test and bundle**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint && npx jest --runInBand`
Expected: PASS.

Run: `cd apps/mobile && npx expo export --platform ios`
Expected: bundles without error. This is the check that Metro can resolve the new native module's JS side.

- [ ] **Step 9: Commit**

```bash
# All git commands in this plan run from the repository root.
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/jest.setup.ts apps/mobile/src/lib/export.ts apps/mobile/src/lib/grade/saveGraded.ts apps/mobile/src/lib/grade/index.ts pnpm-lock.yaml
git commit -m "feat(grade): give a graded photograph somewhere to go

export.ts said nothing writes to the photo library, and for share cards
that is still the right call. A photograph is not a share card — it is
the thing someone made — so this carries the permission and says why."
```

> **After this commit the native project must be rebuilt** before the save path runs on a device: `pnpm prebuild:ios` then `pnpm ios`. The JS suite passes without it; the button does not work without it.

---

### Task 5: Save and Share on the grade screen

**Files:**

- Create: `apps/mobile/src/features/grading/useGradedExport.ts`
- Modify: `apps/mobile/src/features/grading/GradeScreen.tsx`
- Modify: `apps/mobile/src/localization/en.ts`, `vi.ts`, `localization.test.ts`

**Interfaces:**

- Consumes: `saveGradedToPhotos`, `shareGraded`, `GradeExportOutcome` (Task 4).
- Produces: `useGradedExport(photoUri: string | null, grade: Grade): { status: ExportStatus; save: () => void; share: () => void }` where `ExportStatus = 'idle' | 'working' | GradeExportOutcome`.

> **Why a hook:** `GradeScreen.tsx` is 419 lines and this repo split its screens at 500 (`7b3b99f`). The export is a status machine with four terminal states and belongs beside the screen, not inside it.

- [ ] **Step 1: Add the strings**

`apps/mobile/src/localization/en.ts`, with the other `grade.*` keys:

```ts
  'grade.save': 'Save photo',
  'grade.share': 'Share',
  'grade.exporting': 'Rendering…',
  'grade.savedPhoto': 'Saved to your photos',
  'grade.sharedPhoto': 'Shared',
  'grade.saveDenied': 'Chroma Wave cannot add to your photos.',
  'grade.saveDeniedDetail': 'Allow photo access in Settings to save a graded photograph.',
  'grade.exportFailed': 'That photograph could not be exported.',
  'grade.exportFailedDetail': 'The file may have moved, or it may be larger than this device can render.',
```

`apps/mobile/src/localization/vi.ts`, at the matching positions:

```ts
  'grade.save': 'Lưu ảnh',
  'grade.share': 'Chia sẻ',
  'grade.exporting': 'Đang kết xuất…',
  'grade.savedPhoto': 'Đã lưu vào Ảnh',
  'grade.sharedPhoto': 'Đã chia sẻ',
  'grade.saveDenied': 'Chroma Wave không thêm được vào Ảnh.',
  'grade.saveDeniedDetail': 'Cho phép truy cập Ảnh trong Cài đặt để lưu ảnh đã chỉnh màu.',
  'grade.exportFailed': 'Không xuất được ảnh này.',
  'grade.exportFailedDetail': 'Tệp có thể đã bị di chuyển, hoặc lớn hơn mức máy này kết xuất được.',
```

In `localization.test.ts`, add both buttons to `BUTTON_KEYS`:

```ts
    key === 'grade.save' ||
    key === 'grade.share' ||
```

- [ ] **Step 2: Write the hook**

Create `apps/mobile/src/features/grading/useGradedExport.ts`:

```ts
import type { Grade } from '@cw/domain';
import { useCallback, useState } from 'react';
import { hapticsService } from '@/infrastructure/dependencies';
import { saveGradedToPhotos, shareGraded, type GradeExportOutcome } from '@/lib/grade';

export type ExportStatus = 'idle' | 'working' | GradeExportOutcome;

/**
 * Getting the grade on screen out of the app.
 *
 * It exports the grade being *shown*, not the one on the record. Someone who
 * moved a slider and wants that frame should not have to apply it to the palette
 * first — applying is about the library, and saving a photograph is not.
 *
 * Every terminal state is drawn by the caller, refusal included. A save button
 * that silently does nothing when permission was denied is the worst outcome
 * available here, and it is the one that happens by default.
 */
export function useGradedExport(photoUri: string | null, grade: Grade) {
  const [status, setStatus] = useState<ExportStatus>('idle');

  const run = useCallback(
    (action: (uri: string, grade: Grade) => Promise<GradeExportOutcome>) => {
      if (!photoUri || status === 'working') return;
      setStatus('working');
      void (async () => {
        const outcome = await action(photoUri, grade);
        setStatus(outcome);
        if (outcome === 'saved' || outcome === 'shared') {
          void hapticsService.fire('extractionComplete');
        }
      })();
    },
    [photoUri, grade, status],
  );

  return {
    status,
    save: useCallback(() => run(saveGradedToPhotos), [run]),
    share: useCallback(() => run(shareGraded), [run]),
  };
}
```

- [ ] **Step 3: Use it in the screen**

In `apps/mobile/src/features/grading/GradeScreen.tsx`:

Add the import `import { useGradedExport } from './useGradedExport';` and, after the `const shown = …` line:

```tsx
const exporter = useGradedExport(palette?.photoUri ?? null, current);
```

Replace the `actions` gutter at the bottom of the screen with:

```tsx
<Gutter style={styles.actions}>
  <Button
    disabled={status !== 'ready' || exporter.status === 'working'}
    label={exporter.status === 'working' ? t('grade.exporting') : t('grade.save')}
    onPress={exporter.save}
    size="lg"
    variant="contrast"
  />
  <Button
    disabled={status !== 'ready' || exporter.status === 'working'}
    label={t('grade.share')}
    onPress={exporter.share}
    variant="secondary"
  />

  {exporter.status === 'saved' ? <Meta>{t('grade.savedPhoto')}</Meta> : null}
  {exporter.status === 'shared' ? <Meta>{t('grade.sharedPhoto')}</Meta> : null}
  {exporter.status === 'denied' ? (
    <InlineError detail={t('grade.saveDeniedDetail')} title={t('grade.saveDenied')} />
  ) : null}
  {exporter.status === 'failed' ? (
    <InlineError detail={t('grade.exportFailedDetail')} title={t('grade.exportFailed')} />
  ) : null}

  <Button
    disabled={status !== 'ready' || saved || baking}
    label={saved ? t('grade.applied') : baking ? t('grade.applying') : t('grade.apply')}
    onPress={() => void apply()}
    variant="secondary"
  />
  {palette?.grade ? (
    <Button label={t('grade.remove')} onPress={() => void clear()} variant="ghost" />
  ) : null}
</Gutter>
```

> **Note on the demotion:** "Apply grade" was the screen's primary action and is now secondary. That is the point of the feature — someone who imported a photograph came to get a photograph out, and saving to the library is a separate, smaller intention.

`InlineError` and `Meta` are already imported by this file.

- [ ] **Step 4: Typecheck, lint, test, format**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint && npx jest --runInBand && npx prettier --check src`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/grading/useGradedExport.ts apps/mobile/src/features/grading/GradeScreen.tsx apps/mobile/src/localization/
git commit -m "feat(grade): let the photograph leave, and say so when it cannot

The screen could grade a photograph and then only offer to remember the
grade. It exports what is on screen rather than what is on the record,
and refusal gets a sentence instead of a button that quietly does nothing."
```

---

### Task 6: `scaleGrade` in the domain

**Files:**

- Modify: `packages/domain/src/grading.ts`
- Modify: `packages/domain/src/grading.test.ts`

**Interfaces:**

- Produces: `scaleGrade(grade: Grade, amount: number): Grade` — `amount` 0–1, clamped.

- [ ] **Step 1: Write the failing test**

Append to `packages/domain/src/grading.test.ts`:

```ts
describe('scaleGrade', () => {
  const look = FILM_STOCKS.find((stock) => stock.id === 'cinestill')!.grade;

  it('returns the grade unchanged at full strength', () => {
    expect(scaleGrade(look, 1)).toEqual(look);
  });

  it('returns the neutral grade at zero', () => {
    expect(scaleGrade(look, 0)).toEqual(NEUTRAL_GRADE);
  });

  it('lands halfway between at a half', () => {
    const half = scaleGrade(look, 0.5);
    expect(half.temperature).toBeCloseTo(look.temperature / 2, 3);
    expect(half.contrast).toBeCloseTo(look.contrast / 2, 3);
    expect(half.grain).toBeCloseTo(look.grain / 2, 3);
  });

  /**
   * The one rule that is not "multiply everything".
   *
   * A hue is a position on a circle, and interpolating one towards zero takes
   * the wrong way round: a blue shadow at 250° would pass through green, amber
   * and red on its way to nothing. The hue is already correct at every strength;
   * it is the strength that means "how much of it".
   */
  it('weakens a tint without moving its hue', () => {
    const half = scaleGrade(look, 0.5);
    expect(half.shadowTint.hue).toBe(look.shadowTint.hue);
    expect(half.highlightTint.hue).toBe(look.highlightTint.hue);
    expect(half.shadowTint.strength).toBeCloseTo(look.shadowTint.strength / 2, 3);
  });

  it('clamps an amount outside the range rather than producing an invalid grade', () => {
    expect(scaleGrade(look, 2)).toEqual(look);
    expect(scaleGrade(look, -1)).toEqual(NEUTRAL_GRADE);
  });

  it('produces a schema-valid grade across the range for every stock', () => {
    for (const stock of FILM_STOCKS) {
      for (const amount of [0, 0.13, 0.5, 0.87, 1]) {
        expect(() => gradeSchema.parse(scaleGrade(stock.grade, amount))).not.toThrow();
      }
    }
  });

  it('is describable at full strength and untouched at zero', () => {
    expect(describeGrade(scaleGrade(look, 0))).toEqual(['untouched']);
    expect(describeGrade(scaleGrade(look, 1))).not.toEqual(['untouched']);
  });
});
```

Add `scaleGrade` and `gradeSchema` to the file's existing import from `./grading` (it already imports `FILM_STOCKS`, `NEUTRAL_GRADE` and `describeGrade` — check the top of the file and extend that list rather than adding a second import).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/domain && npx vitest run grading`
Expected: FAIL — `scaleGrade is not a function`.

- [ ] **Step 3: Implement it**

Add to `packages/domain/src/grading.ts`, after `gradesEqual`:

```ts
/* ------------------------------------------------------------------ scaling */

/**
 * The same look, turned down.
 *
 * Linear interpolation towards `NEUTRAL_GRADE`, which is what "50% of this look"
 * means when the identity grade is all zeros: every parameter simply gets
 * smaller. That makes a look library of thirty into a continuum, and it is the
 * control every photo app has because it is the one people reach for after
 * "which one" — "yes, but less".
 *
 * **A tint's hue does not interpolate; its strength does.** A hue is a position
 * on a circle, and dragging one towards zero takes the wrong way round — a blue
 * shadow would travel through green and amber on its way to nothing. The hue is
 * already the right hue at any strength.
 *
 * The result is a `Grade` like any other. Nothing stores the amount: the screen
 * uses this to produce a grade, and what gets saved is that grade. An intensity
 * kept alongside would mean a migration, and every reader — the shader, the
 * bake, `describeGrade` — would have to learn to multiply before looking.
 */
export function scaleGrade(grade: Grade, amount: number): Grade {
  const factor = clamp(amount, 0, 1);
  const scale = (value: number) => round(value * factor);
  const fade = (tint: GradeTint): GradeTint => ({
    hue: tint.hue,
    strength: round(tint.strength * factor),
  });

  return {
    exposure: scale(grade.exposure),
    contrast: scale(grade.contrast),
    lift: scale(grade.lift),
    saturation: scale(grade.saturation),
    temperature: scale(grade.temperature),
    tint: scale(grade.tint),
    shadowTint: fade(grade.shadowTint),
    highlightTint: fade(grade.highlightTint),
    vignette: scale(grade.vignette),
    grain: scale(grade.grain),
  };
}
```

> `clamp` and `round` are already defined in this module, above `gradeForAtmosphere`. Do not redefine them. `gradeSchema.parse` is deliberately not called here: every input is schema-valid and multiplying by a number in 0–1 cannot leave the bounds, so parsing again would be ceremony — the test asserts the property instead.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/domain && npx vitest run grading`
Expected: PASS.

- [ ] **Step 5: Run the whole domain suite and typecheck**

Run: `cd packages/domain && npx vitest run && npx tsc --noEmit`
Expected: PASS. `scaleGrade` is exported from the app's `@cw/domain` automatically — `index.ts` does `export * from './grading'`.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/grading.ts packages/domain/src/grading.test.ts
git commit -m "feat(domain): let a look be turned down without becoming another look

Interpolation towards the identity grade, except for tint hues — a hue is
a position on a circle and dragging it towards zero sends a blue shadow
through green on the way. Strength is the thing that means 'how much'."
```

---

### Task 7: The intensity slider

**Files:**

- Modify: `apps/mobile/src/features/grading/GradeScreen.tsx`
- Modify: `apps/mobile/src/localization/en.ts`, `vi.ts`

**Interfaces:**

- Consumes: `scaleGrade` (Task 6).

- [ ] **Step 1: Add the strings**

`en.ts`: `'grade.intensity': 'Intensity',`
`vi.ts`: `'grade.intensity': 'Cường độ',`

These are slider labels, not buttons — do not add them to `BUTTON_KEYS`.

- [ ] **Step 2: Restructure the screen's grade state**

In `GradeScreen.tsx`, replace:

```tsx
const [grade, setGrade] = useState<Grade | null>(null);
```

with:

```tsx
/**
 * The look, and how much of it.
 *
 * They are separate pieces of state because the slider has to be able to go
 * back up: scaling the shown grade in place would lose the look at 20% and
 * leave nothing to return to. `base` is what was chosen, `amount` is the dial,
 * and `current` is the only thing anything else on this screen sees.
 */
const [base, setBase] = useState<Grade | null>(null);
const [amount, setAmount] = useState(1);
```

Replace the `current`, `shown` and `choose` definitions with the block below. **Leave the `const exporter = useGradedExport(…)` line from Task 5 where it is** — it reads `current` and must stay below these three:

```tsx
const current = base ? scaleGrade(base, amount) : (palette?.grade ?? automatic);
const shown = comparing ? NEUTRAL_GRADE : current;

/**
 * Choosing a look resets the dial to full.
 *
 * Anything else means tapping a look and being shown a weakened version of it
 * for reasons invisible on screen.
 */
const choose = (next: Grade) => {
  setBase(next);
  setAmount(1);
  setSaved(false);
  void hapticsService.fire('colourPinned');
};
```

Add `scaleGrade` to the `@cw/domain` import list, and delete the now-unused `Grade` import only if nothing else in the file uses the type — `GradeSlider`'s props do, so keep it.

- [ ] **Step 3: Handle the manual sliders**

The eight `GradeSlider`s call `choose` with an edited copy of `current`. Since `current` is already scaled, `choose` sets that exact grade as the new base at full strength — the numbers on screen do not move, and the dial returns to 100% because a hand-edited grade _is_ the grade. That is the intended behaviour and needs no code change; add this comment above the `GradeSlider` list so the next reader does not "fix" it:

```tsx
{
  /*
        A manual edit takes over: `choose` receives the already-scaled grade and
        makes it the base at full strength. Nothing on screen jumps — the numbers
        are identical — and the dial honestly reads 100%, because a grade someone
        set by hand is not a percentage of anything.
      */
}
```

- [ ] **Step 4: Add the slider**

Insert between the film stock rail and the `grade.controls` section head:

```tsx
<Gutter style={styles.intensity}>
  <Slider
    label={t('grade.intensity')}
    maximumValue={1}
    minimumValue={0}
    onChange={(next) => {
      // A dial with no look under it has nothing to scale. Adopting the
      // automatic grade as the base is what the user is plainly asking
      // for by touching it.
      if (!base) setBase(automatic);
      setAmount(Math.round(next * 100) / 100);
      setSaved(false);
    }}
    value={amount}
    valueText={t('grade.amount', { value: Math.round(amount * 100) })}
  />
</Gutter>
```

Add the style: `intensity: { paddingTop: space.md },`

> The slider is outside the `canAdjust` branch on purpose. Intensity is free — it is what makes the automatic grade, which must stay free, into something adjustable rather than take-it-or-leave-it.

- [ ] **Step 5: Typecheck, lint, test, format**

Run: `cd apps/mobile && npx tsc --noEmit && npx expo lint && npx jest --runInBand && npx prettier --check src`
Expected: all PASS.

- [ ] **Step 6: Full workspace check**

Run: `cd /Users/tony/Chroma-workspace && pnpm check`
Expected: typecheck, lint, test and format:check all green across every package.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/features/grading/GradeScreen.tsx apps/mobile/src/localization/
git commit -m "feat(grade): give every look a dial

Six looks and a photograph that either takes one or does not. The dial is
free on purpose: the automatic grade has to stay free, and 'yes but less'
is the first thing anyone says to a look."
```

---

## Verification

After Task 7, the whole slice is done when all of these are true:

```bash
pnpm check                                          # typecheck + lint + test + format
cd apps/mobile && npx expo export --platform ios    # Metro resolves the native module
```

**On a device, after `pnpm prebuild:ios && pnpm ios`:**

1. Tools → Import → pick a photo → **Make cinematic** lands on the grade with the photograph and its automatic look.
2. The intensity dial moves the look continuously and reads 100% after tapping a film stock.
3. **Save photo** puts a full-resolution graded copy in the camera roll.
4. Refusing the photo permission shows the denial sentence, not a dead button.

**Nothing about whether a look reads as cinematic can be judged from this machine.** The tests protect the arithmetic, the sizes and the states. The look needs an eye.

## Not in this plan

Slices 4, 5 and 6 of the spec — the expanded look library, batch grading, and cinematic share frames — each get their own plan once this one is on a device. `scaleGrade` and `renderGraded` are the two things they all build on, and both land here.
