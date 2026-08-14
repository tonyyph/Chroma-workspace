# Photo Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make picking a photo the app's front door — two taps, no camera
permission — and stop the camera screens from lying about their modes or
leaving their sessions running.

**Architecture:** The tab bar's `＋` opens a modal `SourceSheet` instead of the
viewfinder. A recents strip and an All-photos row both funnel through one
`useImportPhoto` hook to `GradeScreen`; Camera and Scan keep their own screens.
The point sampler moves off the main path to `/tools/pick`.

**Tech Stack:** Expo SDK 55, expo-router, expo-image-picker, expo-media-library,
react-native-vision-camera, Zustand, Jest + @testing-library/react-native.

## Global Constraints

- Read `https://docs.expo.dev/versions/v55.0.0/` before writing native code.
- `launchImageLibraryAsync` requires **no** permission — All photos must work in
  every permission state, including hard denial.
- Every new `ScrollView` carries `keyboardShouldPersistTaps="handled"`
  (`keyboard-taps` scan enforces it).
- Every new string lands in both `en.ts` and `vi.ts`; chip copy ≤16 chars VI and
  `en.length × 1.3 ≤ 16` (`localization.test.ts` enforces it).
- React Compiler is on but bails per-function; do not strip manual memoisation
  without running `scripts/react-compiler-healthcheck.mjs`.
- `pnpm check` green at every commit.

---

### Task 1: `useImportPhoto` — one uri in, one Palette out

**Files:**

- Create: `apps/mobile/src/features/capture/useImportPhoto.ts`
- Create: `apps/mobile/src/features/capture/useImportPhoto.test.tsx`

**Interfaces:**

- Consumes: `toDecodableUri`, `readPalette` (`ReadOutcome`), `useCaptureStore.begin`, `useCaptureCommit`
- Produces:

  ```ts
  export type ImportOutcome =
    { ok: true; palette: Palette } | { ok: false; reason: 'decode' | 'tooFewColours' | 'write' };
  export function useImportPhoto(): (uri: string) => Promise<ImportOutcome>;
  ```

- [ ] **Step 1:** Write failing tests: HEIC uri is converted before reading; a
      good read returns `{ ok: true }` with a written palette; `readPalette`
      failing returns `reason: 'decode'` and writes nothing; a read of one
      colour returns `reason: 'tooFewColours'`; a commit returning null returns
      `reason: 'write'`.
- [ ] **Step 2:** Run `pnpm --filter @cw/mobile test useImportPhoto` — expect module-not-found.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the test — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 2: `useRecentPhotos` — the permission state machine

**Files:**

- Create: `apps/mobile/src/features/capture/useRecentPhotos.ts`
- Create: `apps/mobile/src/features/capture/useRecentPhotos.test.tsx`
- Modify: `apps/mobile/app.json` (add `preventAutomaticLimitedAccessAlert: true`)

**Interfaces:**

- Consumes: `expo-media-library` (`usePermissions`, `getAssetsAsync`, `presentPermissionsPickerAsync`)
- Produces:

  ```ts
  export type RecentsState = 'unasked' | 'granted' | 'limited' | 'denied' | 'unavailable';
  export function useRecentPhotos(count?: number): {
    state: RecentsState;
    photos: readonly { id: string; uri: string }[];
    ask: () => void; // asks on tap, never on mount
    chooseMore: () => void; // presentPermissionsPickerAsync
  };
  ```

- [ ] **Step 1:** Failing tests for all five states; assert nothing is requested on mount.
- [ ] **Step 2:** Run — expect fail.
- [ ] **Step 3:** Implement. **Never call `requestPermission` from an effect.**
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 3: `SourceSheet` and the `/source` route

**Files:**

- Create: `apps/mobile/src/features/capture/SourceSheet.tsx`
- Create: `apps/mobile/src/app/source.tsx`
- Create: `apps/mobile/src/features/capture/sourceSheet.test.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx` (register with `presentation: 'modal'`)
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx:48` and
  `apps/mobile/src/features/library/LibraryScreen.tsx:233` (`/capture` → `/source`)
- Modify: `apps/mobile/src/localization/{en,vi}.ts`

- [ ] **Step 1:** Failing render tests — four strips for four states; All photos
      pressable under `denied`; each row routes where it claims.
- [ ] **Step 2:** Run — expect fail.
- [ ] **Step 3:** Implement on `ui/Sheet`. Horizontal `ScrollView` with
      `keyboardShouldPersistTaps="handled"`.
- [ ] **Step 4:** Run — expect PASS. Run `keyboard-taps` and `no-dead-controls`.
- [ ] **Step 5:** Commit.

---

### Task 4: `no-hot-cameras` scan and the three lifecycles

**Files:**

- Create: `apps/mobile/src/__tests__/no-hot-cameras.test.ts`
- Modify: `ViewfinderScreen.tsx:115`, `ScanScreen.tsx:102`, `CameraStudioScreen.tsx:152`

- [ ] **Step 1:** Write the scan using `jsxScan`'s `openingTags`; it must fail on
      the three current files.
- [ ] **Step 2:** Run — expect 3 failures naming the files.
- [ ] **Step 3:** Bind each `isActive` to `useIsFocused()`.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 5: Real modes, and a gate on Scan

**Files:**

- Modify: `apps/mobile/src/features/capture/ViewfinderScreen.tsx`
- Modify: `apps/mobile/src/features/tools/ScanScreen.tsx`
- Modify: `apps/mobile/src/app/tools/scan.tsx`
- Modify: `apps/mobile/src/localization/{en,vi}.ts`

- [ ] **Step 1:** Failing tests: the viewfinder renders no IMPORT/PHOTO control;
      mode selection calls `replace`, not `push`; ScanScreen with no permission
      renders a grantable gate.
- [ ] **Step 2:** Run — expect fail.
- [ ] **Step 3:** Remove the four fake tabs and both side buttons; add one
      `LIVE · SCAN · STUDIO` row using `router.replace`. Add `PermissionGate` to
      ScanScreen. Delete now-dead keys.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 6: The point sampler moves to `/tools/pick`

**Files:**

- Modify: `apps/mobile/src/features/tools/ImportPickScreen.tsx`
- Create: `apps/mobile/src/app/tools/pick.tsx`
- Delete: `apps/mobile/src/app/tools/import.tsx`
- Modify: `apps/mobile/src/features/tools/importCinematic.test.tsx`
- Modify: `apps/mobile/src/features/palette/PaletteWorkbench.tsx`
- Modify: `apps/mobile/src/features/grading/GradeScreen.tsx` (swatch strip)

- [ ] **Step 1:** Failing tests: the screen opens onto a given uri without
      launching a picker; the swatch strip on GradeScreen routes to `/tools/pick`.
- [ ] **Step 2:** Run — expect fail.
- [ ] **Step 3:** Make `uri` required, delete the auto-launch effect and the
      EXTRACT/CINEMATIC fork; one action returns colours to the open palette.
- [ ] **Step 4:** Run — expect PASS.
- [ ] **Step 5:** Commit.

---

### Task 7: The reachability test

**Files:**

- Create: `apps/mobile/src/__tests__/import-reachable.test.tsx`

- [ ] **Step 1:** With camera permission denied, assert a user can still reach
      the picker: `/source` renders and All photos is pressable.
- [ ] **Step 2:** Run — expect PASS (Task 3 made it true; this pins it).
- [ ] **Step 3:** Run `pnpm check` at the workspace root.
- [ ] **Step 4:** Commit.
