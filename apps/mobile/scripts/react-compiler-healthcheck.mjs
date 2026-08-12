/**
 * Reports which components React Compiler can actually optimise.
 *
 * **Why this exists.** `app.json` turns the compiler on, which invites the
 * conclusion that every hand-written `useMemo` and `useCallback` is now dead
 * weight. That is only true of components the compiler *compiles*. It bails out
 * of a whole function on constructs it cannot lower — a `finally` clause is the
 * common one here — and a bailed-out component keeps re-computing everything on
 * every render. Deleting its manual memoisation is a silent regression.
 *
 * Run it before touching memo hooks:
 *
 *     node scripts/react-compiler-healthcheck.mjs
 *
 * Exit code is always 0: bailouts are information, not failures. Several here
 * are the price of code that is correct — a `try/finally` that always clears a
 * busy flag is better than two copies of the same reset.
 */
import { createRequire } from 'node:module';
import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Resolved through babel-preset-expo, which is what actually builds this app and
// carries all three as dependencies. pnpm keeps them out of the app's own tree.
const local = createRequire(import.meta.url);
const viaPreset = createRequire(
  local.resolve('babel-preset-expo/package.json', { paths: [projectRoot] }),
);
const babel = viaPreset('@babel/core');
const reactCompiler = viaPreset('babel-plugin-react-compiler');
const typescript = viaPreset.resolve('@babel/preset-typescript');

const files = globSync('src/**/*.{ts,tsx}', { cwd: projectRoot })
  .filter((file) => !file.includes('.test.') && !file.includes('__tests__'))
  .map((file) => resolve(projectRoot, file));

let compiled = 0;
const bailouts = [];

for (const file of files) {
  const events = [];
  try {
    babel.transformSync(readFileSync(file, 'utf8'), {
      filename: file,
      configFile: false,
      babelrc: false,
      presets: [[typescript, { isTSX: true, allExtensions: true }]],
      plugins: [
        [
          reactCompiler,
          {
            // Report every bailout rather than stopping at the first.
            panicThreshold: 'none',
            logger: {
              logEvent(_filename, event) {
                if (event.kind === 'CompileSuccess') events.push(null);
                if (event.kind === 'CompileError') {
                  events.push(event.detail?.reason ?? event.detail?.description ?? 'unknown');
                }
              },
            },
          },
        ],
      ],
    });
  } catch (error) {
    bailouts.push([file, `could not parse: ${String(error).slice(0, 100)}`]);
    continue;
  }

  for (const reason of events) {
    if (reason === null) compiled += 1;
    else bailouts.push([file, reason]);
  }
}

const relative = (file) => file.slice(projectRoot.length + 1);

console.log(`files scanned:               ${files.length}`);
console.log(`components/hooks optimised:  ${compiled}`);
console.log(`bail-outs:                   ${bailouts.length}`);
if (bailouts.length) {
  console.log('\nNot optimised — manual useMemo/useCallback here is load-bearing:\n');
  for (const [file, reason] of bailouts) console.log(`  ${relative(file)}\n      ${reason}`);
}
