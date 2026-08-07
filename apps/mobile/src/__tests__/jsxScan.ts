import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Where the walk starts, and what the offender paths are reported relative to. */
export const SOURCE_ROOT = join(__dirname, '..');

const SKIP = new Set(['__tests__', 'node_modules']);

/** Every `.tsx` under `src`, tests excluded. */
export function sources(directory: string = SOURCE_ROOT): string[] {
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
export function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  const opener = `<${name}`;

  for (
    let index = source.indexOf(opener);
    index !== -1;
    index = source.indexOf(opener, index + 1)
  ) {
    // `<Card` must not match `<CardGroup`.
    const following = source[index + opener.length];
    if (following && /[A-Za-z0-9.]/.test(following)) continue;

    // `useAnimatedRef<Animated.ScrollView>()` is a type argument, not an
    // element. A `<` that opens JSX never directly follows a name or a closing
    // bracket; one that opens a type argument list always does.
    const preceding = source[index - 1];
    if (preceding && /[A-Za-z0-9_)\]>]/.test(preceding)) continue;

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
