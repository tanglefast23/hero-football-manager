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
  // The players' agent, in that same bubble, for the same reason.
  'agent.',
];

/** Numbers and anything that lines up in a column. */
const DATA_PREFIXES = ['col.', 'money.', 'stat.'];

/**
 * The leaves inside a body namespace that are nonetheless drawn in pixel type.
 *
 * A prefix cannot express "this namespace is prose EXCEPT its heading", and the
 * story-event and glossary screens are exactly that: a pixel headline over a
 * sans paragraph. Classifying the whole namespace `body` meant gate 5 never
 * glyph-checked **206 of the 508** `event.*`/`glossary.*` strings — including
 * the loudest line on the screen, the outcome headline. Nothing was broken when
 * this was found (the shipped cmaps were parsed; zero missing glyphs), but one
 * `…` typed into a Vietnamese event title would have shipped tofu with CI green.
 *
 * Every entry cites the render site it was READ FROM, not inferred from. That is
 * the condition for keeping a hand-maintained model at all: an override without
 * a citation is an assertion, and the first draft of this list — written by
 * reasoning about key names rather than reading components — was missing the
 * headline and the glossary category titles.
 *
 * The complement matters as much: `event.<id>.body`, the outcome `.text`, and
 * the glossary `.term`/`.definition` are drawn in the platform sans and MUST
 * stay `body`. Marking the namespace display would reject the em dashes and
 * curly quotes that prose legitimately contains.
 */
const DISPLAY_LEAVES: readonly RegExp[] = [
  /^event\.[^.]+\.title$/, //                  StoryEventScreen.tsx:277  font-pixel text-2xl
  /^event\.[^.]+\.[^.]+\.label$/, //           StoryEventScreen.tsx:412  PixelText
  /^event\.[^.]+\.[^.]+\.[^.]+\.headline$/, // StoryEventScreen.tsx:192  font-pixel text-2xl
  /^glossary\.clubHandbook$/, //               GlossaryPanel.tsx:42      PixelText
  /^glossary\.[^.]+\.title$/, //               GlossaryPanel.tsx:71      font-pixel
];

export function voiceOf(key: string): Voice {
  // Checked BEFORE the prefixes, because these live inside body namespaces.
  if (DISPLAY_LEAVES.some(leaf => leaf.test(key))) return 'display';
  if (BODY_PREFIXES.some(prefix => key.startsWith(prefix))) return 'body';
  if (DATA_PREFIXES.some(prefix => key.startsWith(prefix))) return 'data';
  return 'display';
}

/** The face a key will actually be drawn in, or `null` for the platform sans. */
export function faceForKey(key: string, faces: LocaleFaces): string | null {
  const voice = voiceOf(key);
  return voice === 'body' ? null : faces[voice];
}
