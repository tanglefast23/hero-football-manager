import type { CupGiantKillingCelebration, GameState } from './types';
import type { NationalCupFixture } from './pyramid';

export const ONE_DIVISION_CUP_UPSET_COPY = {
  title: "You've toppled a favourite",
  body: "Boss, that was magnificent! We've just sent a club from the division above packing. That's a proper Cup upset — enjoy this one.",
} as const;

export const GIANT_KILLING_CUP_UPSET_COPY = {
  title: 'GIANT-KILLERS!',
  body: "Boss... we've just killed a giant. A result like this happens only once or twice in a hundred tries. What this club has just achieved is extraordinary.",
} as const;

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
  const copy = divisionGap === 1
    ? ONE_DIVISION_CUP_UPSET_COPY
    : GIANT_KILLING_CUP_UPSET_COPY;
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
