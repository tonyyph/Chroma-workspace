import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A source scan for controls that announce themselves as interactive and are not.
 *
 * The runtime test next door presses everything it can find, but it cannot tell
 * a handler that does nothing from a handler that is missing: React Native's
 * `Pressable` renders the same host element either way, responder props and all.
 * A screen reader, meanwhile, reads both as "button" and a user taps both.
 *
 * Every pattern below is one that actually shipped:
 *   - a `Pressable` labelled as a button with no `onPress` (B4's "•••" menu),
 *   - a `NavBar` with a trailing action and no `onTrailing` (C3's "EDIT"),
 *   - an `onPress` bound to an empty arrow function.
 */

const ROOT = join(__dirname, '..');
const SKIP = new Set(['__tests__', 'node_modules']);

function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (SKIP.has(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return entry.endsWith('.tsx') ? [path] : [];
  });
}

/**
 * The attribute text of every `<Name ...>` opening tag in a file.
 *
 * Scanning to the first `>` that is not inside a brace or a string keeps nested
 * JSX expressions — `onPress={() => f({ a: 1 })}` — from ending the tag early.
 */
function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  const opener = `<${name}`;

  for (
    let index = source.indexOf(opener);
    index !== -1;
    index = source.indexOf(opener, index + 1)
  ) {
    // `<Card` must not match `<CardGroup`.
    const following = source[index + opener.length];
    if (following && /[A-Za-z0-9]/.test(following)) continue;

    let depth = 0;
    let quote: string | null = null;
    let cursor = index + opener.length;
    for (; cursor < source.length; cursor++) {
      const character = source[cursor];
      if (quote) {
        if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'" || character === '`') quote = character;
      else if (character === '{') depth++;
      else if (character === '}') depth--;
      else if (character === '>' && depth === 0) break;
    }
    tags.push(source.slice(index + opener.length, cursor));
  }
  return tags;
}

const files = sources(ROOT);

describe('no control claims to be interactive without being interactive', () => {
  it('finds screens to scan at all', () => {
    // A broken walk would make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(15);
  });

  it('has no Pressable with a button role and no handler', () => {
    const offenders = files.flatMap((file) =>
      openingTags(readFileSync(file, 'utf8'), 'Pressable')
        .filter((tag) => tag.includes(`accessibilityRole="button"`) && !tag.includes('onPress'))
        .map(() => file.replace(ROOT, 'src')),
    );
    expect(offenders).toEqual([]);
  });

  it('has no NavBar action without its handler', () => {
    const offenders = files.flatMap((file) =>
      openingTags(readFileSync(file, 'utf8'), 'NavBar')
        .filter(
          (tag) =>
            (tag.includes('trailing=') && !tag.includes('onTrailing=')) ||
            (tag.includes('leading=') && !tag.includes('onLeading=')),
        )
        .map(() => file.replace(ROOT, 'src')),
    );
    expect(offenders).toEqual([]);
  });

  it('has no handler bound to an empty function', () => {
    const offenders = files
      .filter((file) => /on[A-Z]\w*=\{\(\)\s*=>\s*\{\s*\}\}/.test(readFileSync(file, 'utf8')))
      .map((file) => file.replace(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });
});
