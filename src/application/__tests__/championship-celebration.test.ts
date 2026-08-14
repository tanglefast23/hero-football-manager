import { createLaunchCareerSetup } from '../launch';
import { createCareer } from '../../game';
import {
  championshipCelebrationFlag,
  championshipCelebrationViewModel,
  completeChampionshipCelebration,
  hasPendingChampionshipCelebration,
} from '../championship-celebration';
import { playerLookId } from '../../render/sprites/player-look';
import type { AwardCompetition, PlayerSeasonStatLine } from '../../game/types';
import { copyFor } from '../../i18n';

function statLine(
  playerId: string,
  competition: AwardCompetition,
  goals: number,
): PlayerSeasonStatLine {
  return {
    season: 1,
    playerId,
    clubId: 'bramble-rovers',
    competition,
    goals,
    assists: 0,
    tacklesWon: 0,
    saves: 0,
    passesCompleted: 0,
  };
}

function championState() {
  const state = createCareer(createLaunchCareerSetup(777));
  const fixtures = state.fixtures.map((fixture) => {
    const userIsHome = fixture.homeClubId === state.userClubId;
    const userIsAway = fixture.awayClubId === state.userClubId;
    return {
      ...fixture,
      status: 'played' as const,
      score: userIsHome
        ? { homeGoals: 2, awayGoals: 0 }
        : userIsAway
          ? { homeGoals: 0, awayGoals: 2 }
          : { homeGoals: 0, awayGoals: 0 },
    };
  });
  return {
    ...state,
    week: 30,
    phase: 'season-end' as const,
    fixtures,
    // The star's 12 are split across both competitions: the parade counts every
    // goal he scored for the club, not only the league ones.
    seasonStatLines: [
      statLine('bramble-rovers-p10', 'league', 9),
      statLine('bramble-rovers-p10', 'cup', 3),
      statLine('bramble-rovers-p13', 'league', 9),
    ],
  };
}

describe('league championship celebration', () => {
  it('labels the parade total as season goals, not the league Golden Boot', () => {
    expect(
      copyFor('en')('championshipCelebration.seasonGoals', { n: 12 }),
    ).toBe('Season goals · 12 goals');
  });

  it('selects the actual leading scorer and includes the rest of the squad', () => {
    const state = championState();
    const finalFixture = state.fixtures
      .filter(
        (fixture) =>
          fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId,
      )
      .sort((left, right) => right.week - left.week)[0]!;
    const finalMatchSide =
      finalFixture.homeClubId === state.userClubId ? 'r' : 'u';
    const leadingScorer = state.players.find(
      (player) => player.id === 'bramble-rovers-p10',
    )!;

    expect(hasPendingChampionshipCelebration(state)).toBe(true);
    expect(championshipCelebrationViewModel(state, 'Bert Rudge')).toMatchObject(
      {
        clubName: 'Bramble Rovers',
        assistantName: 'Bert Rudge',
        star: {
          id: 'bramble-rovers-p10',
          goals: 12,
          hasRecordedGoals: true,
          spriteKey: `${finalMatchSide}:${playerLookId(leadingScorer.id, leadingScorer.role)}:run0`,
        },
        squad: expect.arrayContaining([
          expect.objectContaining({ id: 'bramble-rovers-p13' }),
        ]),
      },
    );
    expect(
      championshipCelebrationViewModel(state, 'Bert Rudge').squad,
    ).toHaveLength(
      state.players.filter((player) => player.clubId === state.userClubId)
        .length - 1,
    );
  });

  it('uses the same atlas characters as the final match lineup', () => {
    const state = championState();
    const viewModel = championshipCelebrationViewModel(state, 'Bert Rudge');
    const players = [viewModel.star, ...viewModel.squad];
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const finalFixture = state.fixtures
      .filter(
        (fixture) =>
          fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId,
      )
      .sort((left, right) => right.week - left.week)[0]!;
    const side = finalFixture.homeClubId === state.userClubId ? 'r' : 'u';

    lineup.playerIds.forEach((playerId) => {
      const careerPlayer = state.players.find(
        (player) => player.id === playerId,
      )!;
      expect(players.find((player) => player.id === playerId)?.spriteKey).toBe(
        `${side}:${playerLookId(careerPlayer.id, careerPlayer.role)}:run0`,
      );
    });
  });

  it('marks each season celebration once without changing the league result', () => {
    const state = championState();
    const completed = completeChampionshipCelebration(state);

    expect(completed.eventFlags).toContain(championshipCelebrationFlag(1));
    expect(hasPendingChampionshipCelebration(completed)).toBe(false);
    expect(completeChampionshipCelebration(completed)).toBe(completed);
  });

  it('is total: renders without a pending celebration instead of throwing', () => {
    const state = createCareer(createLaunchCareerSetup(777));

    expect(hasPendingChampionshipCelebration(state)).toBe(false);
    expect(() =>
      championshipCelebrationViewModel(state, 'Bert Rudge'),
    ).not.toThrow();
  });

  it('parades a stand-in star when a damaged save leaves the champions empty-handed', () => {
    const state = championState();
    // Hand-damaged: the pending check still fires, but the club has no squad,
    // no lineup and no recorded goals. The screen sits inside the season
    // transition, so the view model must render rather than strand the save.
    const damaged = {
      ...state,
      players: state.players.filter(
        (player) => player.clubId !== state.userClubId,
      ),
      lineups: [],
      seasonStatLines: [],
    };

    expect(hasPendingChampionshipCelebration(damaged)).toBe(true);
    const viewModel = championshipCelebrationViewModel(damaged, 'Bert Rudge');
    expect(viewModel.star.name).toBe('Your captain');
    expect(viewModel.star.goals).toBe(0);
    expect(viewModel.star.hasRecordedGoals).toBe(false);
    expect(viewModel.squad).toHaveLength(0);
    // The way off the screen stays reachable too.
    expect(completeChampionshipCelebration(damaged).eventFlags).toContain(
      championshipCelebrationFlag(1),
    );
  });

  it('does not trigger for a club that did not win the division', () => {
    const state = championState();
    const losingFixtures = state.fixtures.map((fixture) => {
      if (
        fixture.homeClubId !== state.userClubId &&
        fixture.awayClubId !== state.userClubId
      ) {
        return fixture;
      }
      return {
        ...fixture,
        score:
          fixture.homeClubId === state.userClubId
            ? { homeGoals: 0, awayGoals: 3 }
            : { homeGoals: 3, awayGoals: 0 },
      };
    });

    expect(
      hasPendingChampionshipCelebration({ ...state, fixtures: losingFixtures }),
    ).toBe(false);
  });
});
