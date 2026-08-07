import type { LocaleFaces } from './locales';

/**
 * Which of the three type voices a key is drawn in.
 *
 * The glyph gate needs this because the voices use different faces, and one of
 * them uses no pixel face at all. `PixelText` documents the rule: long prose is
 * deliberately NOT pixel type, because "pixel fonts are exhausting to read", so
 * `body` renders in the platform sans and may legitimately contain characters
 * Silkscreen has never heard of — an em dash in an event paragraph is fine.
 *
 * Checking the whole catalog against one pixel face would therefore be wrong in
 * both directions: it would reject valid body copy and, if relaxed, would miss
 * an invalid glyph in a button.
 */
export type Voice = 'display' | 'data' | 'body';

/**
 * Long-form prose namespaces. Everything else is chrome, and chrome is pixel
 * type.
 */
const BODY_PREFIXES = [
  'event.', 'bert.', 'tip.', 'glossary.', 'story.', 'ceremony.',
  // The gaffer's full-time verdict and his blaming line. Both are drawn in the
  // same speech bubble Bert speaks out of (`src/ui/speech-bubble.tsx`), which
  // sets no `fontFamily` — platform sans, like every other paragraph.
  'coach.',
];

/** Numbers and anything that lines up in a column. */
const DATA_PREFIXES = ['col.', 'money.', 'stat.'];

export function voiceOf(key: string): Voice {
  if (BODY_PREFIXES.some(prefix => key.startsWith(prefix))) return 'body';
  if (DATA_PREFIXES.some(prefix => key.startsWith(prefix))) return 'data';
  return 'display';
}

/** The face a key will actually be drawn in, or `null` for the platform sans. */
export function faceForKey(key: string, faces: LocaleFaces): string | null {
  const voice = voiceOf(key);
  return voice === 'body' ? null : faces[voice];
}
