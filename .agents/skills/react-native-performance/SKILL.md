---
name: react-native-performance
description: Profile and improve React Native performance, especially lists, images, Reanimated motion, audio lifecycle and render behavior. Use for jank, memory, slow startup or animation issues.
---

Inspect the runtime path and locate measurable performance risks.

Start from the reported symptom and the screen that produces it. In CHROMAWAVE the
usual suspects are the memory timeline, full-resolution photos, palette extraction,
gradient and waveform animation, and track preview playback.

## Check

- **Unnecessary rerenders** — unstable props, inline objects and closures, context
  values recreated each render, selectors that return new references.
- **List virtualization** — timeline and discovery feeds: correct list primitive,
  stable `keyExtractor`, item size hints, no heavy work in `renderItem`, no nested
  scroll containers defeating recycling.
- **Image dimensions and caching** — never render a full-resolution capture into a
  thumbnail slot; use appropriate sizes, caching policy, and progressive loading.
- **Main-thread work** — color extraction, resizing and clustering must not block
  the UI thread. Move heavy work off the JS thread or into native/worker paths.
- **Reanimated worklets** — animations run on the UI thread, no `runOnJS` in hot
  paths, shared values not driving React state per frame, no layout thrashing.
- **JS/native bridge traffic** — chatty per-frame calls, large payloads crossing
  the boundary.
- **Audio resource cleanup** — preview playback stopped and unloaded on unmount,
  navigation away and backgrounding; no orphaned players accumulating.
- **Query cache behavior** — over-fetching, missing `staleTime`, cache keys that
  churn, refetch storms on focus.
- **Memory leaks** — retained subscriptions, timers, listeners, image caches,
  animation loops surviving unmount.
- **Startup work** — module side effects, eager provider initialization, synchronous
  storage reads, oversized fonts and assets on the critical path.
- **Large bundle contributors** — heavy dependencies pulled into the initial bundle.

## Method

Prefer evidence from profiling, logs or reproducible behavior over inspection alone.
State how each problem was observed and what improvement was measured.

- Do not add memoization blindly. `memo`, `useMemo` and `useCallback` have a cost;
  apply them where a measured render is expensive or a reference is genuinely unstable.
- Preserve behavior. A faster screen that drops a state or an animation is a regression.
- Add regression tests where practical, and note the before/after numbers.
