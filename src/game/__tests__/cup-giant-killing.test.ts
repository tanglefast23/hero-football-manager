import { createCareer } from '../career';
import {
  completeCupGiantKillingCelebration,
  cupGiantKillingCelebration,
  GIANT_KILLING_CUP_UPSET_COPY,
  ONE_DIVISION_CUP_UPSET_COPY,
  queueCupGiantKillingCelebration,
  THREE_DIVISION_CUP_UPSET_COPY,
  TWO_DIVISION_CUP_UPSET_COPY,
} from '../cup-giant-killing';
import { createLaunchCareerSetup } from '../../application/launch';

describe('Bert Cup giant-killing celebrations', () => {
  it('pins one distinct speech per division gap', () => {
    expect(ONE_DIVISION_CUP_UPSET_COPY).toEqual({
      title: "You've toppled a favourite",
      body: "Boss, that was magnificent! We've just sent a club from the division above packing. That's a proper Cup upset. Enjoy this one.",
    });
    expect(TWO_DIVISION_CUP_UPSET_COPY).toEqual({
      title: 'Two divisions up!',
      body: 'Boss. Two divisions. TWO. Clubs like ours are not supposed to get past sides like that, and we just did it in front of everyone.',
    });
    expect(THREE_DIVISION_CUP_UPSET_COPY).toEqual({
      title: 'THREE DIVISIONS!',
      body: 'Boss, I have run out of professional composure. Three divisions above us. Three! They will be talking about this one in the town for years.',
    });
    expect(GIANT_KILLING_CUP_UPSET_COPY).toEqual({
      title: 'GIANT-KILLERS!',
      body: 'BOSS. Four divisions. The whole way up the pyramid, in one afternoon. Nobody does this. I have watched football my entire life and I have never, never seen anything like it.',
    });
  });

  it('never repeats a speech across the four gaps the pyramid allows', () => {
    // The defect this replaced: gaps of 2, 3 and 4 shared one speech, so the
    // rarest result in the competition read exactly like the commonest upset —
    // including a claim about how often it happens, which cannot be true of all
    // three. `divisionGap` was computed and saved the whole time; nothing read it.
    const copies = [
      ONE_DIVISION_CUP_UPSET_COPY,
      TWO_DIVISION_CUP_UPSET_COPY,
      THREE_DIVISION_CUP_UPSET_COPY,
      GIANT_KILLING_CUP_UPSET_COPY,
    ];
    expect(new Set(copies.map((copy) => copy.title)).size).toBe(4);
    expect(new Set(copies.map((copy) => copy.body)).size).toBe(4);
  });

  it('uses frozen draw divisions and queues every qualifying player win FIFO', () => {
    let state = createCareer(createLaunchCareerSetup(20260729));
    const cup = state.m2!.nationalCups[0];
    const divisions = cup.seedDivisionByClubId!;
    const userDivision = divisions[state.userClubId];
    const opponentByGap = (gap: number) =>
      Object.keys(divisions).find(
        (clubId) => divisions[clubId] === userDivision - gap,
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

    expect(one).toMatchObject({
      divisionGap: 1,
      ...ONE_DIVISION_CUP_UPSET_COPY,
    });
    expect(two).toMatchObject({
      divisionGap: 2,
      ...TWO_DIVISION_CUP_UPSET_COPY,
    });
    expect(
      queued.pendingCupGiantKillingCelebrations?.map((item) => item.fixtureId),
    ).toEqual(['one-gap', 'two-gap']);
    const afterOne = completeCupGiantKillingCelebration(queued);
    expect(
      afterOne.pendingCupGiantKillingCelebrations?.map(
        (item) => item.fixtureId,
      ),
    ).toEqual(['two-gap']);
    expect(
      completeCupGiantKillingCelebration(afterOne)
        .pendingCupGiantKillingCelebrations,
    ).toBeUndefined();
  });

  it('does not interrupt for defeats, AI upsets, or same-division wins', () => {
    const state = createCareer(createLaunchCareerSetup(20260729));
    const started = state;
    const cup = started.m2!.nationalCups[0];
    const divisions = cup.seedDivisionByClubId!;
    const sameDivisionOpponent = Object.keys(divisions).find(
      (clubId) =>
        clubId !== state.userClubId &&
        divisions[clubId] === divisions[state.userClubId],
    )!;
    const fixture = {
      id: 'same',
      season: 1,
      round: 1,
      homeClubId: state.userClubId,
      awayClubId: sameDivisionOpponent,
      matchSeed: 1,
      status: 'scheduled' as const,
    };
    expect(
      cupGiantKillingCelebration(started, fixture, state.userClubId),
    ).toBeUndefined();
    expect(
      cupGiantKillingCelebration(started, fixture, sameDivisionOpponent),
    ).toBeUndefined();
  });
});
