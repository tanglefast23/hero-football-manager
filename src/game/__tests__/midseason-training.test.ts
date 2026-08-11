import { createLaunchCareerSetup } from '../../application/launch';
import { MAX_PLAYER_ATTRIBUTE } from '../../sim/attributes';
import { createCareer } from '../career';
import {
  acceptMidseasonTraining,
  completeMidseasonTraining,
  declineMidseasonTraining,
  midseasonTrainingAcceptedFlag,
  midseasonTrainingCaptain,
  midseasonTrainingCompleteFlag,
  midseasonTrainingGainForDivision,
  midseasonTrainingStatus,
} from '../midseason-training';
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

  it.each([
    [5, 1],
    [4, 2],
    [3, 3],
    [2, 4],
    [1, 5],
  ] as const)(
    'spends all TP and gives D%s players +%s to every stat',
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
      }
      expect(
        accepted.players.find((player) => player.id === rivalBefore.id),
      ).toBe(rivalBefore);
    },
  );

  it('clamps at 999 and cannot charge or reward twice', () => {
    const base = weekNineteen(1);
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
