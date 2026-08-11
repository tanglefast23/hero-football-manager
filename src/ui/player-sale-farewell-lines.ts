import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/** Five plainly sad farewells. Each selected line stays in one emotional lane. */
export const SAD_PLAYER_FAREWELL_KEYS: readonly string[] = [
  'playerFarewell.sad.moreTime',
  'playerFarewell.sad.lastMatch',
  'playerFarewell.sad.dressingRoom',
  'playerFarewell.sad.tellTheLads',
  'playerFarewell.sad.keptMyShirt',
];

/** Five warm, sentimental farewells. */
export const SENTIMENTAL_PLAYER_FAREWELL_KEYS: readonly string[] = [
  'playerFarewell.sentimental.everyMinute',
  'playerFarewell.sentimental.gaveMeAChance',
  'playerFarewell.sentimental.family',
  'playerFarewell.sentimental.checkResults',
  'playerFarewell.sentimental.saveASeat',
];

/** Five lines that make the manager feel the cost of selling the player. */
export const GUILT_PLAYER_FAREWELL_KEYS: readonly string[] = [
  'playerFarewell.guilt.feeMatteredMore',
  'playerFarewell.guilt.wageBill',
  'playerFarewell.guilt.otherClubToldMe',
  'playerFarewell.guilt.gaveEverything',
  'playerFarewell.guilt.lookRelieved',
];

export const PLAYER_FAREWELL_KEYS: readonly string[] = [
  ...SAD_PLAYER_FAREWELL_KEYS,
  ...SENTIMENTAL_PLAYER_FAREWELL_KEYS,
  ...GUILT_PLAYER_FAREWELL_KEYS,
];

/**
 * One random-looking choice that cannot change during a re-render.
 *
 * The sale supplies career, season, week and player id as `selectionKey`.
 * Hashing that key gives each sale an even choice from all 15 lines without
 * using Math.random or letting a window resize change the words mid-bubble.
 */
export function playerSaleFarewellLine(
  selectionKey: string,
  t: CopyFn = englishCopy(),
): string {
  const key =
    PLAYER_FAREWELL_KEYS[
      hashString(selectionKey) % PLAYER_FAREWELL_KEYS.length
    ];
  return t(key);
}

export function playerSaleFarewellLines(
  t: CopyFn = englishCopy(),
): readonly string[] {
  return PLAYER_FAREWELL_KEYS.map((key) => t(key));
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
