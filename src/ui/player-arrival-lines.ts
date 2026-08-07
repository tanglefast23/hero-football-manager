import { copyFor, type CopyFn } from '../i18n';
import type { PlayerSigningConfirmation } from './PlayerSigningOverlay';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 *
 * The same lazy shape `application/view-models.ts` uses, and lazy for the same
 * reason: `copyFor` reaches `loadLaunchContent`, a 40-80ms zod pass. Resolving
 * these lines at module scope would drag that parse into the import of anything
 * that touches `src/ui`, and would move a throwing parse in front of the error
 * boundary that exists to catch it.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * What a new signing says on their way in.
 *
 * The rookie has one fixed line, because the manager built that player and the
 * beat is about the two of them. A youth graduate is one of many, so they draw
 * from a pool — the walk-on only stays charming if the twelfth academy kid does
 * not say what the first one said.
 */
export const ROOKIE_ARRIVAL_LINE_KEY = 'playerArrival.rookie';

/** The rookie's line, in the given language. */
export function rookieArrivalLine(t: CopyFn = englishCopy()): string {
  return t(ROOKIE_ARRIVAL_LINE_KEY);
}

/**
 * Forty prospects, one line each — cocky, self-deprecating, earnest and odd,
 * deliberately interleaved so a run of signings does not land in a tonal rut.
 * Each is one bubble on a phone; see MAX_ARRIVAL_LINE_LENGTH.
 *
 * A career takes an intake every season, so the pool is read dozens of times
 * over. It is also read alongside the rostrum pools in
 * `content/award-ceremony-lines.json` — the same player can walk on here and
 * speak there — so a line that lands on a joke either pool already tells is
 * worse than no line at all.
 *
 * Order is load-bearing: a graduate's line is their id hashed onto an index, so
 * reordering this list moves every prospect in every existing career onto a
 * different line.
 */
export const YOUTH_ARRIVAL_LINE_KEYS: readonly string[] = [
  'playerArrival.youth.saveMeAShirtNumber',
  'playerArrival.youth.honestlyIThoughtThis',
  'playerArrival.youth.sameSocksEveryMatch',
  'playerArrival.youth.tellMeWhatToFix',
  'playerArrival.youth.doICallYouBoss',
  'playerArrival.youth.dontWorryGaffer',
  'playerArrival.youth.isThereACanteen',
  'playerArrival.youth.iBroughtMyOwnPen',
  'playerArrival.youth.iveWatchedFromTheStands',
  'playerArrival.youth.canIGetAPhoto',
  'playerArrival.youth.imQuickerThanILook',
  'playerArrival.youth.myMumSaysImTheBest',
  'playerArrival.youth.iTalkToMyselfOutThere',
  'playerArrival.youth.whateverTheBadgeNeeds',
  'playerArrival.youth.whereDoIPutMyBag',
  'playerArrival.youth.illTakeThePenalties',
  'playerArrival.youth.illRunUntilYouTellMe',
  'playerArrival.youth.iDreamtThisExactMoment',
  'playerArrival.youth.iToldTheWholeStreet',
  'playerArrival.youth.iveBeenAwakeSinceFour',
  'playerArrival.youth.youllWantToRenegotiate',
  'playerArrival.youth.imBetterThanMyHighlightReel',
  'playerArrival.youth.iCountedTheFloodlights',
  'playerArrival.youth.nobodyInMyFamilyHasSigned',
  'playerArrival.youth.isThePitchAlwaysThisBig',
  'playerArrival.youth.iveBeenReadyForTwoYears',
  'playerArrival.youth.ivePractisedMyCelebration',
  'playerArrival.youth.iveLearnedEveryonesName',
  'playerArrival.youth.nobodyTellMeTheWages',
  'playerArrival.youth.iKeepWaitingForSomebody',
  'playerArrival.youth.aScoutCalledMeUnteachable',
  'playerArrival.youth.iveGotAGoodFeeling',
  'playerArrival.youth.iveNeverSeenThisMany',
  'playerArrival.youth.imNotHereToMakeUpNumbers',
  'playerArrival.youth.iDontGetNervous',
  'playerArrival.youth.iPromiseNotToBreakAnything',
  'playerArrival.youth.firstProperBoots',
  'playerArrival.youth.giveMeAMatch',
  'playerArrival.youth.myLeftFootIsForStandingOn',
  'playerArrival.youth.putMeAnywhere',
];

/** The whole academy pool, in the given language and in pool order. */
export function youthArrivalLines(t: CopyFn = englishCopy()): readonly string[] {
  return YOUTH_ARRIVAL_LINE_KEYS.map(key => t(key));
}

/**
 * A speech bubble is 320pt wide at most, and a walk-on holds it for one beat.
 * Past this a line stops being a remark and starts being a paragraph.
 */
export const MAX_ARRIVAL_LINE_LENGTH = 64;

/**
 * The line this arrival speaks.
 *
 * Keyed on the player rather than rolled: the overlay re-renders on every
 * window resize, so a rolled line would change under the player mid-walk.
 * Forty lines means back-to-back signings repeat about one time in forty, which
 * is rarer than a player notices and cheaper than threading "what did the last
 * one say" through the store. Academy ids are near-identical by construction
 * (`youth-s3-1`, `youth-s3-2`), and FNV-1a spreads exactly those onto
 * consecutive lines, so an intake never repeats itself within one week.
 *
 * The hash picks the catalog key, not the sentence, so a graduate keeps the
 * same line through a language change instead of jumping to another prospect's.
 *
 * Only the rookie and the academy graduates walk on — a transfer gets the
 * receipt card — so everyone who is not the rookie draws from the youth pool.
 */
export function arrivalLine(
  player: Pick<PlayerSigningConfirmation, 'playerId' | 'source'>,
  t: CopyFn = englishCopy(),
): string {
  if (player.source === 'rookie') return t(ROOKIE_ARRIVAL_LINE_KEY);
  return t(YOUTH_ARRIVAL_LINE_KEYS[hashString(player.playerId) % YOUTH_ARRIVAL_LINE_KEYS.length]);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
