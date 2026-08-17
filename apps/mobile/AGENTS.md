# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v55.0.0/ before writing any code.

# React Compiler is on, but not everywhere

`app.json` sets `experiments.reactCompiler`. That does **not** make every
hand-written `useMemo` and `useCallback` redundant: the compiler bails out of a
whole function on constructs it cannot lower — a `finally` clause is the common
one — and a bailed-out component memoises nothing at all.

Before removing any manual memoisation, run:

```sh
node scripts/react-compiler-healthcheck.mjs
```

If the file is listed as a bail-out, its memo hooks are the only memoisation it
has. At the last measurement, 191 components and hooks were optimised and 15
bailed out, including `PreferencesProvider` — the provider every screen reads.

These counts drift as files are added; run the script rather than trusting them.
What is stable is the _shape_ of the list:

- **`try { … } finally { … }` is the dominant cause** — 9 of the 15. The compiler
  cannot lower a `TryStatement` with a finalizer, and it gives up on the entire
  enclosing function, not just the statement. Several of these are deliberate:
  `PreferencesProvider` documents in place why clearing its busy flag in one
  `finally` beats duplicating it down every path, and pays for that with manual
  memoisation. **Do not "fix" those by restructuring the `finally` away** — the
  trade was made on purpose and written down.
- A bail-out that is _not_ a deliberate trade is worth fixing at the source.
  `useMemoryClock` was one: it assigned to a ref during render, which React
  forbids and which also bailed the hook out. Rewriting it to advance from a
  measured delta through a functional state updater removed both problems at
  once. Read the reason before assuming a bail-out is load-bearing.
