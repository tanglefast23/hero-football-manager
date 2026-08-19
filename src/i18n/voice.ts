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
  'event.',
  'bert.',
  'tip.',
  'glossary.',
  'story.',
  'ceremony.',
  // The gaffer's full-time verdict and his blaming line. Both are drawn in the
  // same speech bubble Bert speaks out of (`src/ui/speech-bubble.tsx`), which
  // sets no `fontFamily` — platform sans, like every other paragraph.
  'coach.',
  // The players' agent, in that same bubble, for the same reason.
  'agent.',
  // The winning division rival mocks the coach in the report's speech bubble.
  'rivalHeroVictory.',
  // Disabled contract-promise explanations render as wrapping sans paragraphs
  // under each row (`MarketScreen.tsx`), not in the pixel label above them.
  'market.promiseBlocked',
  // The Hero License reclaim question and its consequence line, both plain
  // `<Text>` paragraphs inside the chooser (`MarketScreen.tsx`). The two names
  // ABOVE them -- `market.reclaimHolderStarting` / `...Bench` -- are `PixelText`
  // and deliberately fall outside this prefix, so they stay glyph-checked.
  'market.reclaimHeroLicense',
  // Sponsor offer lines and objective sentences. The BRAND above them is the
  // pixel line on the card (`ClubFinancesScreen.tsx:1040`, `:1085`,
  // `SeasonEndScreen.tsx:148` — all `PixelText`) and stays English anyway, so
  // nothing under this prefix is ever drawn in the pixel face: the offer line is
  // a plain `<Text>` at ClubFinancesScreen.tsx:1041 and :1086, and the objective
  // at :1052, :1094 and SeasonEndScreen.tsx:155. Defaulting them to `display`
  // would glyph-gate advertising prose against a face it never renders in.
  'sponsor.',
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
  // Reached through a VIEW MODEL, not a `t()` call in the component — which is
  // why the render-site scan that produced the five above reported zero of
  // these. The scan looks for literals in a pixel neighbourhood; these arrive
  // as `alert.title` / `note.title`, already resolved. The drift test in
  // `display-leaves.test.ts` documents that exact blind spot, and it was still
  // trusted over reading the screen. Found by an outside audit.
  /^tip\.[^.]+\.title$/, //                   ClubHomeScreen.tsx:283    PixelText uppercase
  /^bert\.guide\.[^.]+\.inbox\.title$/, //     ClubHomeScreen.tsx:254    PixelText uppercase
  /^bert\.fiction\.[^.]+\.title$/, //         Scorecard.tsx:71          PixelText uppercase
];

/**
 * The leaves inside a display namespace that are drawn in the platform sans.
 *
 * The mirror image of `DISPLAY_LEAVES`, and needed for the same reason: a
 * namespace is one prop-name away from holding both voices. A confirmation
 * sheet's heading is `font-pixel text-xl uppercase`, and the paragraph directly
 * under it sets no `fontFamily` at all — one dialog, two faces.
 *
 * Getting this wrong is not cosmetic. A `display` classification glyph-gates a
 * whole explanatory sentence against a 328-glyph pixel face and hands it the
 * tight `boxed` character budget, which is how translated prose gets mangled to
 * fit a box it never renders in.
 *
 * Same rule as the other list: every entry cites the render site it was read
 * from.
 */
const BODY_LEAVES: readonly RegExp[] = [
  /^confirm\.[^.]+\.detail[A-Za-z]*$/, // ConfirmationSheet.tsx:195  <Text className="mt-3 text-base leading-6">
  /^confirm\.facilityClose\.(netCash|shortfall)$/, // interpolated into detailStaffed
  /^confirm\.sponsor\.(contract|objective)$/, // joined into the same paragraph
  /^confirm\.hireCoach\.replaceNote$/, // joined into the same paragraph
  /^trainingDrill\.notEnoughTpDetail$/, // TrainingDrillModal.tsx:1295  <Text className="mt-2 text-center text-sm">
  /^market\.promiseNeedsHeroLicenseChoice$/, // App.tsx:4890  FeedbackNotice  <Text className="flex-1 text-sm font-bold text-ink">
];

export function voiceOf(key: string): Voice {
  // Checked BEFORE the prefixes, because these live inside body namespaces.
  if (DISPLAY_LEAVES.some((leaf) => leaf.test(key))) return 'display';
  if (BODY_LEAVES.some((leaf) => leaf.test(key))) return 'body';
  if (BODY_PREFIXES.some((prefix) => key.startsWith(prefix))) return 'body';
  if (DATA_PREFIXES.some((prefix) => key.startsWith(prefix))) return 'data';
  return 'display';
}

/** The face a key will actually be drawn in, or `null` for the platform sans. */
export function faceForKey(key: string, faces: LocaleFaces): string | null {
  const voice = voiceOf(key);
  return voice === 'body' ? null : faces[voice];
}
