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
has. At the last measurement, 165 components and hooks were optimised and 13
bailed out, including `PreferencesProvider` — the provider every screen reads.
