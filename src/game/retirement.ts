import { retirementAnnouncementAge } from './pyramid';
import type { CareerPlayer, PlayerPersonality } from './types';

/**
 * How much of a career is left, and who is allowed to know.
 *
 * Every number here is DERIVED from the career seed and the player's stable id
 * rather than stored, for the same reason loyalty is: players are built in six
 * separate modules, and a field initialised in five of them is a bug waiting for
 * the sixth. Deriving it means every player in every save — including saves
 * written before this feature — has an answer from the moment they exist.
 *
 * This module is the single source of truth. `personality` is optional on
 * `CareerPlayer` and the squad view model defaults it to 'Professional'; a
 * second call site choosing a different default would display one number while
 * the engine enforced another.
 */

/** Longest contract the game offers, from `validateContractOffer` in market.ts. */
const MAX_CONTRACT_TERM_SEASONS = 3;

/** Mirrors the squad view model's default for players predating M2 metadata. */
const DEFAULT_PERSONALITY: PlayerPersonality = 'Professional';
const DEFAULT_AGE = 24;

type RetirementPlayer = Pick<CareerPlayer, 'id'> &
  Partial<
    Pick<CareerPlayer, 'age' | 'personality' | 'retirementAnnouncementSeason'>
  >;

function retirementAgeFor(
  player: RetirementPlayer,
  careerSeed: number,
): number {
  return retirementAnnouncementAge(
    { id: player.id, personality: player.personality ?? DEFAULT_PERSONALITY },
    careerSeed,
  );
}

/**
 * Seasons this player can still be contracted for, counting from the next
 * season transition onward.
 *
 * Zero once retirement has been announced: the announcement already bought them
 * their one final season, and the next transition moves them to `retiredPlayers`.
 *
 * For everyone else the `max(1, ...)` is the true answer rather than a floor. A
 * player whose age already exceeds their retirement age — a 38-year-old signed
 * with a retirement age of 34 — has not announced yet, so the next transition
 * announces them and the lifecycle grants them one final season.
 */
export function seasonsBeforeRetirement(
  player: RetirementPlayer,
  careerSeed: number,
): number {
  if (player.retirementAnnouncementSeason !== undefined) return 0;
  return Math.max(
    1,
    retirementAgeFor(player, careerSeed) - (player.age ?? DEFAULT_AGE),
  );
}

/**
 * Longest renewal signable at season end, or zero for a player who has already
 * announced and may not be renewed at any length.
 *
 * The week-30 decrement has already run by the time renewals are offered, so a
 * term of T is decremented once per future season and must not exceed the
 * seasons that remain.
 */
export function maxRenewalTermSeasons(
  player: RetirementPlayer,
  careerSeed: number,
): 0 | 1 | 2 | 3 {
  return Math.min(
    MAX_CONTRACT_TERM_SEASONS,
    seasonsBeforeRetirement(player, careerSeed),
  ) as 0 | 1 | 2 | 3;
}

/**
 * Longest deal signable in a transfer window — one longer than a renewal,
 * because week 30 of the season in progress will decrement this contract once
 * more before the season ends, so the term also has to cover it.
 *
 * Never zero: even a player in their announced final season can be signed for
 * the remainder of that season.
 */
export function maxSigningTermSeasons(
  player: RetirementPlayer,
  careerSeed: number,
): 1 | 2 | 3 {
  return Math.min(
    MAX_CONTRACT_TERM_SEASONS,
    seasonsBeforeRetirement(player, careerSeed) + 1,
  ) as 1 | 2 | 3;
}

/** The terms a term selector may offer. Empty when the player may not re-sign at all. */
export function contractTermOptions(maxTerm: number): readonly (1 | 2 | 3)[] {
  return ([1, 2, 3] as const).filter((term) => term <= maxTerm);
}

/**
 * One sentence in both halves: the English this ring writes, and the catalog
 * key the screen renders instead.
 *
 * `src/game` is a pure ring and may not import `src/i18n`, so copy leaves it as
 * data and is resolved at the UI edge — the same dual write `LedgerLine.label`
 * uses. The English stays as the fallback for a key the catalog no longer has.
 */
export interface RetirementCopy {
  readonly text: string;
  readonly textKey: string;
  /** Raw values for the key's placeholders. Never pre-formatted text. */
  readonly textParams?: Readonly<Record<string, string | number>>;
}

/**
 * Squad-card status, or undefined while retirement is far enough away that the
 * card stays quiet. Deliberately narrower than the contract table, which is
 * allowed to be candid at any age.
 */
export function retirementCardCopy(
  player: RetirementPlayer,
  careerSeed: number,
): RetirementCopy | undefined {
  if (player.retirementAnnouncementSeason !== undefined) {
    return {
      text: 'Final season, retires in summer',
      textKey: 'retirement.finalSeason',
    };
  }
  return seasonsBeforeRetirement(player, careerSeed) === 1
    ? {
        text: 'Considering retirement in 1 year',
        textKey: 'retirement.consideringInOneYear',
      }
    : undefined;
}

/** True for exactly the players who will announce at this season's end. */
export function isConsideringRetirement(
  player: RetirementPlayer,
  careerSeed: number,
): boolean {
  return (
    player.retirementAnnouncementSeason === undefined &&
    seasonsBeforeRetirement(player, careerSeed) === 1
  );
}

/**
 * Refuses a contract that would outlive its holder.
 *
 * Both term selectors already offer only legal terms, so reaching this is an
 * invariant break rather than a user mistake. It is asserted at every point that
 * writes `contractSeasonsRemaining` from a negotiated or renewed deal —
 * `renewCareerPlayer`, `completeCareerRenewal` and `completeCareerTransfer` —
 * because those are the only three places a term becomes real, and the only ones
 * holding both the player and the career seed.
 *
 * The week-30 decrement is exempt: it only ever counts a contract down.
 */
export function assertContractTermFitsCareer(
  player: RetirementPlayer & { readonly name: string },
  termSeasons: number,
  careerSeed: number,
  kind: 'renewal' | 'signing',
): void {
  const cap =
    kind === 'renewal'
      ? maxRenewalTermSeasons(player, careerSeed)
      : maxSigningTermSeasons(player, careerSeed);
  if (cap === 0) {
    throw new Error(
      `${player.name} has announced their retirement and cannot re-sign.`,
    );
  }
  if (termSeasons > cap) {
    throw new Error(
      `${player.name} only has ${cap} season${cap === 1 ? '' : 's'} left and cannot sign for ${termSeasons}.`,
    );
  }
}

/**
 * The line under a capped term selector. Explains the short deal as the player's
 * own judgement rather than as a rule the UI is imposing.
 *
 * The term is a plural key rather than an interpolated "1 year" / "N years"
 * fragment: a language whose plural rules differ cannot rebuild the sentence
 * from a phrase that was already inflected in English.
 */
export function shortContractReasonCopy(
  age: number,
  maxTerm: number,
): RetirementCopy {
  /** @i18n-fallback English source for the `retirement.shortContract` plural. */
  const years = maxTerm === 1 ? '1 year' : `${maxTerm} years`;
  return {
    text: `He'll only put his name to ${years}. At ${age} he reckons that's about all he has left in him.`,
    textKey: 'retirement.shortContract',
    textParams: { n: maxTerm, count: maxTerm, age },
  };
}
