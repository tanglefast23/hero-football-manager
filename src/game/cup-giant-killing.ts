import type { CupGiantKillingCelebration, GameState } from './types';
import type { NationalCupFixture } from './pyramid';

/**
 * One speech per division gap, and they escalate.
 *
 * The pyramid is five tiers, so a Cup tie can be won by one, two, three or four
 * divisions. Every one of those used to arrive as one of two speeches, with the
 * same words for a two-tier upset as for the rarest result in the competition —
 * including a claim about how often it happens, which cannot be true of both.
 *
 * `divisionGap` was already computed and already saved. It just was not read.
 *
 * Bert holds it together at one tier and loses it by four: composed, then
 * disbelieving, then shouting, then barely able to finish a sentence.
 *
 * @i18n-fallback English source for `cupUpset.<gap>.title` / `.body`. The
 * celebration is persisted whole and its snapshot has no key field, by design:
 * `divisionGap` is saved beside the words and already identifies which of the
 * four speeches this is, so `cupUpsetCopyKey` recovers the key from the save.
 */
export const ONE_DIVISION_CUP_UPSET_COPY = {
  title: "You've toppled a favourite",
  body: "Boss, that was magnificent! We've just sent a club from the division above packing. That's a proper Cup upset. Enjoy this one.",
} as const;

/** @i18n-fallback English source for `cupUpset.2.title` / `.body`. */
export const TWO_DIVISION_CUP_UPSET_COPY = {
  title: 'Two divisions up!',
  body: "Boss. Two divisions. TWO. Clubs like ours are not supposed to get past sides like that, and we just did it in front of everyone.",
} as const;

/** @i18n-fallback English source for `cupUpset.3.title` / `.body`. */
export const THREE_DIVISION_CUP_UPSET_COPY = {
  title: 'THREE DIVISIONS!',
  body: "Boss, I have run out of professional composure. Three divisions above us. Three! They will be talking about this one in the town for years.",
} as const;

/** @i18n-fallback English source for `cupUpset.4.title` / `.body`. */
export const GIANT_KILLING_CUP_UPSET_COPY = {
  title: 'GIANT-KILLERS!',
  body: "BOSS. Four divisions. The whole way up the pyramid, in one afternoon. Nobody does this. I have watched football my entire life and I have never, never seen anything like it.",
} as const;

/**
 * Indexed by gap, so a sixth tier would fail loudly here rather than silently
 * handing the widest upset the wrong words.
 */
const CUP_UPSET_COPY_BY_GAP = {
  1: ONE_DIVISION_CUP_UPSET_COPY,
  2: TWO_DIVISION_CUP_UPSET_COPY,
  3: THREE_DIVISION_CUP_UPSET_COPY,
  4: GIANT_KILLING_CUP_UPSET_COPY,
} as const;

/**
 * The catalog key for a saved celebration's words.
 *
 * Recovered from `divisionGap` rather than stored, so celebrations queued
 * before the catalog existed translate on sight and no migration is owed.
 */
export function cupUpsetCopyKey(divisionGap: number, part: 'title' | 'body'): string {
  return `cupUpset.${divisionGap}.${part}`;
}

/**
 * Uses the divisions frozen at the Cup draw, never the live post-season table.
 * This is pure presentation bookkeeping and consumes no match or career RNG.
 */
export function cupGiantKillingCelebration(
  state: GameState,
  fixture: NationalCupFixture,
  winnerClubId: string,
): CupGiantKillingCelebration | undefined {
  if (winnerClubId !== state.userClubId) return undefined;
  const cup = state.m2?.nationalCups.find(candidate => candidate.season === fixture.season);
  const divisions = cup?.seedDivisionByClubId;
  if (divisions === undefined) return undefined;
  const opponentClubId = fixture.homeClubId === state.userClubId
    ? fixture.awayClubId
    : fixture.homeClubId;
  const userDivision = divisions[state.userClubId];
  const opponentDivision = divisions[opponentClubId];
  if (userDivision === undefined || opponentDivision === undefined) return undefined;
  const divisionGap = userDivision - opponentDivision;
  if (divisionGap < 1) return undefined;
  const copy = CUP_UPSET_COPY_BY_GAP[divisionGap as keyof typeof CUP_UPSET_COPY_BY_GAP];
  if (copy === undefined) return undefined;
  return { fixtureId: fixture.id, divisionGap, ...copy };
}

export function queueCupGiantKillingCelebration(
  state: GameState,
  celebration: CupGiantKillingCelebration | undefined,
): GameState {
  if (celebration === undefined) return state;
  return {
    ...state,
    pendingCupGiantKillingCelebrations: [
      ...(state.pendingCupGiantKillingCelebrations ?? []),
      celebration,
    ],
  };
}

export function completeCupGiantKillingCelebration(state: GameState): GameState {
  const pending = state.pendingCupGiantKillingCelebrations ?? [];
  if (pending.length === 0) throw new Error('there is no Cup giant-killing celebration to complete');
  const remaining = pending.slice(1);
  if (remaining.length > 0) {
    return { ...state, pendingCupGiantKillingCelebrations: remaining };
  }
  const { pendingCupGiantKillingCelebrations: _pending, ...rest } = state;
  return rest;
}
