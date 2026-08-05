import type { Language } from '@chromawave/domain';
import { en, type MessageKey } from './en';
import { vi } from './vi';

export type { MessageKey };

const catalogues: Record<Language, Record<MessageKey, string>> = { en, vi };

/**
 * Resolves a key for a language, substituting `{name}` placeholders.
 *
 * A missing Vietnamese string falls back to English rather than rendering the
 * key — a raw key on screen is worse than an untranslated sentence. The
 * `Record<MessageKey, string>` type on `vi` makes that unreachable in practice;
 * the fallback exists for a hot-swapped catalogue.
 */
export function translate(
  language: Language,
  key: MessageKey,
  parameters?: Readonly<Record<string, string | number>>,
): string {
  const template = catalogues[language]?.[key] ?? en[key] ?? key;
  if (!parameters) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in parameters ? String(parameters[name]) : match,
  );
}

/** Every key, for the expansion-headroom test and any tooling. */
export const messageKeys = Object.keys(en) as MessageKey[];

export { en, vi };
