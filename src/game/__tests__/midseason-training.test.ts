import { createLaunchCareerSetup } from '../../application/launch';
import { MAX_PLAYER_ATTRIBUTE } from '../../sim/attributes';
import { createCareer } from '../career';
import {
  acceptGreenBullTraining,
  acceptMidseasonTraining,
  completeMidseasonTraining,
  declineMidseasonTraining,
  greenBullTrainingAcceptedFlag,
  greenBullTrainingOffer,
  midseasonTrainingAcceptedFlag,
  midseasonTrainingCaptain,
  midseasonTrainingCompleteFlag,
  midseasonTrainingGainForDivision,
  midseasonTrainingStatus,
  MIDSEASON_TRAINING_CONDITION_COST,
} from '../midseason-training';
import { weeklyAmbientTrainingPoints } from '../career';
import { trainPlayerInstantly } from '../training';
import type { DivisionLevel, PyramidClub } from '../pyramid';
import type { GameState } from '../types';

function weekNineteen(division: DivisionLevel = 5): GameState {
  const base = createCareer(createLaunchCareerSetup(20260811));
  if (base.m2 === undefined) throw new Error('launch career has no pyramid');
  const userClub = base.m2.pyramid.divisions
    .flatMap((entry) => entry.clubs)
    .find((club) => club.id === base.userClubId);
  if (userClub === undefined) throw new Error('user pyramid club missing');

  return {
    ...base,
    week: 19,
    trainingPoints: 37,
    m2: {
      ...base.m2,
      pyramid: {
        ...base.m2.pyramid,
        divisions: base.m2.pyramid.divisions.map((entry) => ({
          ...entry,
          clubs: [
            ...entry.clubs.filter((club) => club.id !== base.userClubId),
            ...(entry.level === division ? [userClub as PyramidClub] : []),
          ],
        })),
      },
    },
  };
}

describe('Week 19 mid-season team trip', () => {
  it('offers once in Week 19 of every season', () => {
    const first = weekNineteen();
    expect(midseasonTrainingStatus(first)).toBe('prompt');
    expect(midseasonTrainingStatus({ ...first, week: 18 })).toBeUndefined();
    expect(midseasonTrainingStatus({ ...first, week: 20 })).toBeUndefined();

    const declined = declineMidseasonTraining(first);
    expect(midseasonTrainingStatus(declined)).toBe('complete');
    expect(declined.eventFlags).toContain(midseasonTrainingCompleteFlag(1));

    const nextSeason = { ...declined, season: 2, week: 19 };
    expect(midseasonTrainingStatus(nextSeason)).toBe('prompt');
  });

  it('maps D5 through D1 to +1 through +5', () => {
    expect(
      ([5, 4, 3, 2, 1] as const).map(midseasonTrainingGainForDivision),
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it('moves D3-D1 from the automatic Week 19 prompt to paid Green Bull training', () => {
    expect(midseasonTrainingStatus(weekNineteen(4))).toBe('prompt');
    expect(midseasonTrainingStatus(weekNineteen(3))).toBeUndefined();
    expect(greenBullTrainingOffer(weekNineteen(4))).toBeUndefined();
    expect(
      ([3, 2, 1] as const).map(
        (division) => greenBullTrainingOffer(weekNineteen(division))?.cost,
      ),
    ).toEqual([50_000, 50_000, 50_000]);
  });

  it.each([
    [5, 1],
    [4, 2],
  ] as const)(
    'spends all TP, costs 10 condition, and gives D%s players +%s to every stat',
    (division, gain) => {
      const state = weekNineteen(division);
      const userBefore = state.players.filter(
        (player) => player.clubId === state.userClubId,
      );
      const rivalBefore = state.players.find(
        (player) => player.clubId !== state.userClubId,
      )!;
      const accepted = acceptMidseasonTraining(state);

      expect(accepted.trainingPoints).toBe(0);
      expect(accepted.eventFlags).toContain(midseasonTrainingAcceptedFlag(1));
      expect(midseasonTrainingStatus(accepted)).toBe('celebration');
      for (const before of userBefore) {
        const after = accepted.players.find(
          (player) => player.id === before.id,
        )!;
        for (const key of Object.keys(
          before.attrs,
        ) as (keyof typeof before.attrs)[]) {
          expect(after.attrs[key]).toBe(
            Math.min(MAX_PLAYER_ATTRIBUTE, before.attrs[key] + gain),
          );
        }
        expect(after.condition).toBe(
          Math.max(
            0,
            (before.condition ?? 100) - MIDSEASON_TRAINING_CONDITION_COST,
          ),
        );
      }
      expect(
        accepted.players.find((player) => player.id === rivalBefore.id),
      ).toBe(rivalBefore);
    },
  );

  it('clamps at 999 and cannot charge or reward twice', () => {
    const base = weekNineteen(5);
    const userId = base.players.find(
      (player) => player.clubId === base.userClubId,
    )!.id;
    const capped = {
      ...base,
      players: base.players.map((player) =>
        player.id === userId
          ? { ...player, attrs: { ...player.attrs, pac: 998, ref: 999 } }
          : player,
      ),
    };
    const accepted = acceptMidseasonTraining(capped);
    expect(
      accepted.players.find((player) => player.id === userId)?.attrs,
    ).toMatchObject({ pac: 999, ref: 999 });
    expect(acceptMidseasonTraining(accepted)).toBe(accepted);
  });

  it('clamps the trip condition cost at zero', () => {
    const state = weekNineteen();
    const userId = state.players.find(
      (player) => player.clubId === state.userClubId,
    )!.id;
    const tired = {
      ...state,
      players: state.players.map((player) =>
        player.id === userId ? { ...player, condition: 4 } : player,
      ),
    };

    expect(
      acceptMidseasonTraining(tired).players.find(
        (player) => player.id === userId,
      )?.condition,
    ).toBe(0);
  });

  it('keeps an accepted celebration resumable until explicit completion', () => {
    const accepted = acceptMidseasonTraining(weekNineteen());
    const movedWeek = { ...accepted, week: 20 };
    expect(midseasonTrainingStatus(movedWeek)).toBe('celebration');

    const completed = completeMidseasonTraining(movedWeek);
    expect(completed.eventFlags).toContain(midseasonTrainingCompleteFlag(1));
    expect(midseasonTrainingStatus(completed)).toBe('complete');
    expect(completeMidseasonTraining(completed)).toBe(completed);
  });

  it('refuses without spending TP or changing player stats', () => {
    const state = weekNineteen();
    const declined = declineMidseasonTraining(state);
    expect(declined.trainingPoints).toBe(37);
    expect(declined.players).toBe(state.players);
  });

  it('uses the real captain and falls back to the first starter for old saves', () => {
    const state = weekNineteen();
    const captain = state.players.find(
      (player) => player.clubId === state.userClubId,
    )!;
    const withCaptain = {
      ...state,
      players: state.players.map((player) => ({
        ...player,
        isCaptain: player.id === captain.id,
      })),
    };
    expect(midseasonTrainingCaptain(withCaptain)?.id).toBe(captain.id);

    const legacy = {
      ...state,
      players: state.players.map((player) => ({
        ...player,
        isCaptain: undefined,
      })),
    };
    const firstStarter = legacy.lineups.find(
      (lineup) => lineup.clubId === legacy.userClubId,
    )?.playerIds[0];
    expect(midseasonTrainingCaptain(legacy)?.id).toBe(firstStarter);
  });
});

describe('paid Green Bull training', () => {
  function fundedD3(): GameState {
    const base = weekNineteen(3);
    return {
      ...base,
      week: 12,
      trainingPoints: weeklyAmbientTrainingPoints(base),
      clubs: base.clubs.map((club) =>
        club.id === base.userClubId ? { ...club, cash: 90_000 } : club,
      ),
    };
  }

  it('raises each trip by $50,000 after the $300,000 trip', () => {
    const state = fundedD3();
    const costAfterTrips = (previousTrips: number) =>
      greenBullTrainingOffer({
        ...state,
        eventFlags: Array.from({ length: previousTrips }, (_, index) =>
          greenBullTrainingAcceptedFlag(1, index + 1),
        ),
      })?.cost;

    expect([9, 10, 11, 12].map(costAfterTrips)).toEqual([
      275_000, 300_000, 350_000, 400_000,
    ]);
  });

  it('requires one full week of TP and enough cash', () => {
    const state = fundedD3();
    const required = weeklyAmbientTrainingPoints(state);
    expect(
      greenBullTrainingOffer({ ...state, trainingPoints: required - 1 }),
    ).toMatchObject({ blockedReason: 'NOT_ENOUGH_TP' });
    expect(
      greenBullTrainingOffer({
        ...state,
        clubs: state.clubs.map((club) =>
          club.id === state.userClubId ? { ...club, cash: 49_999 } : club,
        ),
      }),
    ).toMatchObject({ blockedReason: 'NOT_ENOUGH_CASH' });
  });

  it('waits until next week after any individual drill', () => {
    const state = {
      ...fundedD3(),
      trainingPoints: weeklyAmbientTrainingPoints(fundedD3()) + 20,
    };
    const player = state.players.find(
      (candidate) =>
        candidate.clubId === state.userClubId && candidate.role !== 'GK',
    )!;
    const drilled = trainPlayerInstantly(state, player.id, 'sprints').state;

    expect(greenBullTrainingOffer(drilled)).toMatchObject({
      blockedReason: 'INDIVIDUAL_TRAINING_USED',
    });
    expect(acceptGreenBullTraining(drilled)).toBe(drilled);
    expect(
      greenBullTrainingOffer({ ...drilled, week: drilled.week + 1 })
        ?.blockedReason,
    ).toBeUndefined();
  });

  it('costs D3 cash, spends all TP, gives +2 all stats, and works once per week', () => {
    const state = fundedD3();
    const player = state.players.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const accepted = acceptGreenBullTraining(state);
    const trained = accepted.players.find(
      (candidate) => candidate.id === player.id,
    )!;

    expect(accepted.trainingPoints).toBe(0);
    expect(
      accepted.clubs.find((club) => club.id === state.userClubId)?.cash,
    ).toBe(40_000);
    expect(accepted.eventFlags).toContain(
      greenBullTrainingAcceptedFlag(state.season, state.week),
    );
    expect(accepted.cashTransactions?.at(-1)).toMatchObject({
      amount: -50_000,
      balanceAfter: 40_000,
    });
    expect(trained.condition).toBe(
      (player.condition ?? 100) - MIDSEASON_TRAINING_CONDITION_COST,
    );
    for (const key of Object.keys(
      player.attrs,
    ) as (keyof typeof player.attrs)[]) {
      expect(trained.attrs[key]).toBe(player.attrs[key] + 2);
    }
    expect(midseasonTrainingStatus(accepted)).toBe('celebration');
    expect(acceptGreenBullTraining(accepted)).toBe(accepted);

    const completed = completeMidseasonTraining(accepted);
    expect(greenBullTrainingOffer(completed)).toMatchObject({
      blockedReason: 'USED_THIS_WEEK',
    });
    const nextDivision = weekNineteen(2).m2!;
    const nextOffer = greenBullTrainingOffer({
      ...completed,
      season: completed.season + 1,
      week: completed.week + 1,
      m2: nextDivision,
      trainingPoints: weeklyAmbientTrainingPoints(completed),
      clubs: completed.clubs.map((club) =>
        club.id === completed.userClubId ? { ...club, cash: 100_000 } : club,
      ),
    });
    expect(nextOffer).toMatchObject({ cost: 75_000 });
    expect(nextOffer?.blockedReason).toBeUndefined();
  });
});
