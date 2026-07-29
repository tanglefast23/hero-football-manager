import { createCareer } from '../career';
import {
  completeCupGiantKillingCelebration,
  cupGiantKillingCelebration,
  GIANT_KILLING_CUP_UPSET_COPY,
  ONE_DIVISION_CUP_UPSET_COPY,
  queueCupGiantKillingCelebration,
} from '../cup-giant-killing';
import { createLaunchCareerSetup } from '../../application/launch';

describe('Bert Cup giant-killing celebrations', () => {
  it('pins the exact enthusiastic and giant-killer copy', () => {
    expect(ONE_DIVISION_CUP_UPSET_COPY).toEqual({
      title: "You've toppled a favourite",
      body: "Boss, that was magnificent! We've just sent a club from the division above packing. That's a proper Cup upset — enjoy this one.",
    });
    expect(GIANT_KILLING_CUP_UPSET_COPY).toEqual({
      title: 'GIANT-KILLERS!',
      body: "Boss... we've just killed a giant. A result like this happens only once or twice in a hundred tries. What this club has just achieved is extraordinary.",
    });
  });

  it('uses frozen draw divisions and queues every qualifying player win FIFO', () => {
    let state = createCareer(createLaunchCareerSetup(20260729));
    const cup = state.m2!.nationalCups[0];
    const divisions = cup.seedDivisionByClubId!;
    const userDivision = divisions[state.userClubId];
    const opponentByGap = (gap: number) => Object.keys(divisions).find(
      clubId => divisions[clubId] === userDivision - gap,
    )!;
    const fixture = (opponentClubId: string, id: string) => ({
      id,
      season: 1,
      round: 1,
      homeClubId: state.userClubId,
      awayClubId: opponentClubId,
      matchSeed: 1,
      status: 'scheduled' as const,
    });
    const one = cupGiantKillingCelebration(
      state,
      fixture(opponentByGap(1), 'one-gap'),
      state.userClubId,
    );
    const two = cupGiantKillingCelebration(
      state,
      fixture(opponentByGap(2), 'two-gap'),
      state.userClubId,
    );
    const queued = queueCupGiantKillingCelebration(
      queueCupGiantKillingCelebration(state, one),
      two,
    );

    expect(one).toMatchObject({ divisionGap: 1, ...ONE_DIVISION_CUP_UPSET_COPY });
    expect(two).toMatchObject({ divisionGap: 2, ...GIANT_KILLING_CUP_UPSET_COPY });
    expect(queued.pendingCupGiantKillingCelebrations?.map(item => item.fixtureId))
      .toEqual(['one-gap', 'two-gap']);
    const afterOne = completeCupGiantKillingCelebration(queued);
    expect(afterOne.pendingCupGiantKillingCelebrations?.map(item => item.fixtureId))
      .toEqual(['two-gap']);
    expect(completeCupGiantKillingCelebration(afterOne).pendingCupGiantKillingCelebrations)
      .toBeUndefined();
  });

  it('does not interrupt for defeats, AI upsets, or same-division wins', () => {
    const state = createCareer(createLaunchCareerSetup(20260729));
    const started = state;
    const cup = started.m2!.nationalCups[0];
    const divisions = cup.seedDivisionByClubId!;
    const sameDivisionOpponent = Object.keys(divisions).find(clubId => (
      clubId !== state.userClubId && divisions[clubId] === divisions[state.userClubId]
    ))!;
    const fixture = {
      id: 'same',
      season: 1,
      round: 1,
      homeClubId: state.userClubId,
      awayClubId: sameDivisionOpponent,
      matchSeed: 1,
      status: 'scheduled' as const,
    };
    expect(cupGiantKillingCelebration(started, fixture, state.userClubId)).toBeUndefined();
    expect(cupGiantKillingCelebration(started, fixture, sameDivisionOpponent)).toBeUndefined();
  });
});
