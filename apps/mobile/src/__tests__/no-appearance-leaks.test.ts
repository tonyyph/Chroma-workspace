import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Screens must not know what the app looks like.
 *
 * Every value below used to be written into a screen: a violet accent, a
 * near-black scrim, a corner radius. All of them describe *chroma*, and a
 * second skin made them wrong rather than merely hardcoded. The system that
 * replaced them only holds if new screens go through it too, and nothing about
 * `import { ui }` looks like a mistake at review time — which is what this is
 * for.
 *
 * Deliberately a source scan rather than a render test: the failure mode is a
 * screen looking wrong under one appearance, which no unit test would catch and
 * only a device would show.
 */

const ROOT = join(__dirname, '..');

/** Where screens live. `ui/` is exempt: primitives *are* the ones allowed to
 *  read a skin, and they do it through `useSkin`. */
const SCREEN_DIRS = ['features', 'app'];

/** Tokens that describe appearance. Layout and motion are shared by both skins. */
const FORBIDDEN_TOKENS = ['ui', 'round', 'tint', 'elevation', 'glass', 'uiShadow', 'typeExtra'];

/** Chroma's ground, ink and violet, in every form a stop can be written in. */
const CHROMA_VALUES =
  /rgba\(\s*8,\s*7,\s*14|rgba\(\s*237,\s*234,\s*227|rgba\(\s*124,\s*92,\s*255|rgba\(\s*18,\s*17,\s*25|#7C5CFF|#08070E|#0C0B18/i;

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.tsx?$/.test(full) && !full.includes('.test.')) out.push(full);
  }
  return out;
}

const files = SCREEN_DIRS.flatMap((dir) => sources(join(ROOT, dir)));

/** A file may opt out by naming its reason, which review can then argue with. */
const EXEMPT = /appearance-exempt/;

describe('screens do not read appearance directly', () => {
  it('scans a meaningful number of files, so a broken glob cannot pass silently', () => {
    expect(files.length).toBeGreaterThan(25);
  });

  it('imports no appearance token from the design system', () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const match = /import \{([^}]*)\} from '@chromawave\/design-tokens';/.exec(source);
      if (!match) return [];
      const leaked = match[1]!
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name && FORBIDDEN_TOKENS.includes(name.split(' ').pop()!));
      return leaked.length ? [`${file.replace(ROOT, '')}: ${leaked.join(', ')}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it('writes none of chromas own colours as a literal', () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      if (EXEMPT.test(source)) return [];
      return source
        .split('\n')
        .flatMap((line, index) =>
          CHROMA_VALUES.test(line) ? [`${file.replace(ROOT, '')}:${index + 1}`] : [],
        );
    });
    expect(offenders).toEqual([]);
  });
});
