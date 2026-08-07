import type { AssistantGuideContent } from '../content/schemas';
import { copyFor, type CopyFn } from '../i18n';

/** The three standing notes Bert has filed, keyed by where each one is read. */
export type AssistantFictionSlot = keyof AssistantGuideContent['m4Fiction'];

/**
 * One of Bert's filed notes, in the reader's language.
 *
 * The screens that draw these take a `{ title, body }` pair and cannot tell
 * which note they were handed, so the pair is resolved at the call site where
 * the slot is still named. English lives in `assistant-guide.json` and is what
 * `bert.fiction.*` falls back to, so an untranslated locale reads exactly what
 * the content file says.
 */
export function assistantFiction(
  content: AssistantGuideContent,
  slot: AssistantFictionSlot,
  t: CopyFn = copyFor('en'),
): { title: string; body: string } {
  const authored = content.m4Fiction[slot];
  const resolve = (field: 'title' | 'body') => {
    const key = `bert.fiction.${slot}.${field}`;
    const translated = t(key);
    return translated === key ? authored[field] : translated;
  };
  return { title: resolve('title'), body: resolve('body') };
}
