import { localeMeta, type Locale } from './locales';
import { voiceOf } from './voice';
import { loadGlossary } from './load-catalogs';

/**
 * How much longer than its English source a translation may run.
 *
 * **Why this is not one number.** The budget began as a single rule — English
 * length times a per-language expansion — standing in for two different things
 * at once: the owner's "simple and succinct, always", and the fact that a pixel
 * word in a bordered box cannot wrap. Applied to all 13,692 strings it squeezed
 * copy that had a whole screen to breathe in, and it was still too loose for the
 * places that genuinely cannot grow.
 *
 * Measured before splitting it: 3.2% of translations sat within two characters
 * of the old ceiling, and the largest group among them was `*.a11y.*` — labels a
 * screen reader SPEAKS and nothing draws. Those had been shortened for a width
 * constraint that does not exist, which is the opposite of what an accessibility
 * label needs.
 *
 * So there are three kinds of string, and they want three different rules.
 */
export type BudgetClass = 'spoken' | 'prose' | 'boxed';

/**
 * Keys read aloud rather than drawn.
 *
 * `.a11y` is the convention across the whole catalog. A screen reader has no
 * width, so the only wrong length here is one too short to be understood — a
 * clipped VoiceOver label is a worse bug than a long one.
 *
 * The segment is matched rather than the literal `.a11y.` it started as: nine
 * keys append the qualifier to the segment instead of adding one, and a plain
 * `includes('.a11y.')` missed every one of them — `hallOfFame.a11yTitle`,
 * `hallOfFame.a11yLocked`, `hallOfFame.a11yCompletedIn`, `settings.language.a11y`,
 * `settings.difficulty.a11y`, `settings.textSize.a11y` and the three
 * `settings.powerLabels.a11y*`. They were taking the tight boxed ceiling, which
 * is the exact "shortened for a width constraint that does not exist" bug this
 * split exists to end, and being glyph-checked against a face nothing draws
 * them in. `[A-Z]` catches the appended form and `$` the bare tail.
 */
const isSpoken = (key: string): boolean => /\.a11y(\.|[A-Z]|$)/.test(key);

/**
 * Character speech, which shares the wrapping bubble Bert speaks out of.
 *
 * `voiceOf` cannot see these from a prefix alone: `playerRequest.<id>.line` is a
 * player talking in `CharacterSpeechOverlay`, while `playerRequest.<id>.title`
 * is a heading on the decision card behind them. Same namespace, different
 * surfaces, so the rule keys on the leaf.
 */
const isSpeech = (key: string): boolean =>
  /^playerRequest\.[^.]+\.line$/.test(key)
  || key.startsWith('playerArrival.')
  || key.startsWith('titlePlayerPop.bubble.')
  || key.startsWith('characterSpeech.');

export function budgetClass(key: string): BudgetClass {
  if (isSpoken(key)) return 'spoken';
  if (voiceOf(key) === 'body' || isSpeech(key)) return 'prose';
  return 'boxed';
}

/**
 * The ceiling, in characters, for one key in one language.
 *
 * - **spoken** — effectively unbounded. Kept as a number rather than `Infinity`
 *   so a runaway paragraph in an aria-label still trips something, but nothing
 *   here should ever be trimmed to fit.
 * - **prose** — wraps freely, so the budget is a guard against sprawl rather
 *   than a fitting rule. Generous enough that a translator never has to choose
 *   between accuracy and the gate.
 * - **boxed** — a pixel word inside a border that cannot reflow. Tighter than
 *   the source's own expansion allows, because the box was measured for
 *   English. **Point-form is correct here**: a button that reads "Woche ›" beats
 *   one that reads "Woche weiter ›" and clips.
 *
 * Every class keeps a flat floor for short sources: "Fans" is four characters
 * and no language has a five-character word for it.
 */
/**
 * The shortest approved form of any coined term the English source contains.
 *
 * Without this, two gates contradict each other. "Fan Shop" is eight characters,
 * so the boxed budget allows twelve — but the glossary's only approved
 * Portuguese form is "Loja do Clube", which is thirteen, and the whole string
 * IS the term. There is nothing else in it to shorten. A translator asked to fit
 * can only mangle the term, which gate 9 then rejects. Same impossibility in
 * Spanish ("Tienda del Club", 15) and French ("Boutique du Club", 16).
 *
 * So a coined term sets a floor. The budget still constrains everything AROUND
 * it — a longer sentence containing the term is still trimmed — but it can no
 * longer demand a term shorter than the one the glossary insists on.
 */
function coinedTermFloor(source: string, locale: Locale): number {
  let floor = 0;
  for (const term of loadGlossary(locale).terms) {
    if (!new RegExp(term.englishPattern).test(source)) continue;
    const shortest = term.allowedForms.reduce<number>(
      (best, form) => Math.min(best, form.length),
      Number.POSITIVE_INFINITY,
    );
    if (Number.isFinite(shortest)) floor = Math.max(floor, shortest);
  }
  return floor;
}

export function copyBudget(key: string, source: string, locale: Locale): number {
  const n = source.length;
  const expansion = localeMeta(locale).expansion;
  switch (budgetClass(key)) {
    case 'spoken':
      return Math.max(Math.ceil(n * 3), n + 40);
    case 'prose':
      return Math.max(Math.ceil(n * (expansion + 0.35)) + 4, n + 16);
    case 'boxed':
    default:
      // The language's own expansion, unchanged from the rule that shipped.
      //
      // A tighter number was tried and reverted. The theory was that a pixel
      // word in a border cannot reflow, so chrome should be squeezed harder
      // than prose. The theory is right; the evidence was never gathered. No
      // one measured a container overflowing — the looser rule had been
      // shipping these strings and device screenshots looked correct.
      //
      // What the squeeze actually cost, in one pass: German `Einstellungen`
      // became `Optionen` while nine other strings still said Einstellungen;
      // Spanish `Campo de Entrenamiento` became `Campo de Entreno` against five
      // that did not; French `Notoriété` became `renommée`, contradicting its
      // own glossary. Vocabulary drift across a catalog is a worse bug than a
      // label that might be a few pixels wide, and it is certain rather than
      // hypothetical.
      //
      // Tighten this again only with a measured overflow to point at. The tool
      // exists — `advance.ts` reads real em widths — but it needs a container
      // width to compare against, which only gates 8 and 8b currently have.
      return Math.max(
        Math.ceil(n * expansion) + 2,
        n + 8,
        // A term the glossary requires cannot also be forbidden by width.
        coinedTermFloor(source, locale) + 2,
      );
  }
}
