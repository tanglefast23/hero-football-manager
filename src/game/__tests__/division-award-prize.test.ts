import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '..';
import { leagueStandings } from '../career';
import {
  DIVISION_AWARD_PRIZE_PER_TIER,
  divisionAwardPrize,
  divisionAwardPrizePerCategory,
} from '../division-award-prize';
import { startNextFullCareerSeason } from '../full-career';
import { currentUserDivision } from '../m2-career';
import type {
  AwardCategoryId,
  DivisionAwardPlacement,
  GameState,
  SeasonRecap,
} from '../types';

const USER_CLUB = 'user-club';
const RIVAL_CLUB = 'rival-club';
const CATEGORIES: readonly AwardCategoryId[] = [
  'goals',
  'passesCompleted',
  'tacklesWon',
  'saves',
];

describe('divisionAwardPrize', () => {
  test('a club that topped no board is paid nothing', () => {
    const prize = divisionAwardPrize({
      recap: recapWonBy([]),
      userClubId: USER_CLUB,
      targetDivision: 5,
    });

    expect(prize).toEqual({ trainingPoints: 0, categoriesWon: [] });
  });

  test('one board pays the entered division rate once', () => {
    const prize = divisionAwardPrize({
      recap: recapWonBy(['tacklesWon']),
      userClubId: USER_CLUB,
      targetDivision: 5,
    });

    expect(prize).toEqual({ trainingPoints: 120, categoriesWon: ['tacklesWon'] });
  });

  test('a sweep pays four times the rate', () => {
    const prize = divisionAwardPrize({
      recap: recapWonBy(CATEGORIES),
      userClubId: USER_CLUB,
      targetDivision: 5,
    });

    expect(prize.trainingPoints).toBe(120 * 4);
    expect(prize.categoriesWon).toEqual(CATEGORIES);
  });

  test('a rival top placing pays nothing, even with our man second', () => {
    // Every podium in the fixture carries a user player in second, so a prize
    // here would mean the board is being read by club membership rather than by
    // who actually won it.
    const prize = divisionAwardPrize({
      recap: recapWonBy(['goals']),
      userClubId: USER_CLUB,
      targetDivision: 5,
    });

    expect(prize).toEqual({ trainingPoints: 120, categoriesWon: ['goals'] });
  });

  test('a save written before the boards existed pays nothing', () => {
    const { divisionAwards, ...withoutAwards } = recapWonBy(CATEGORIES);

    expect(divisionAwardPrize({
      recap: withoutAwards,
      userClubId: USER_CLUB,
      targetDivision: 5,
    })).toEqual({ trainingPoints: 0, categoriesWon: [] });
  });

  test('the same sweep is worth more promoted than relegated', () => {
    const recap = recapWonBy(CATEGORIES);

    const promoted = divisionAwardPrize({ recap, userClubId: USER_CLUB, targetDivision: 3 });
    const relegated = divisionAwardPrize({ recap, userClubId: USER_CLUB, targetDivision: 5 });

    expect(promoted.trainingPoints - relegated.trainingPoints)
      .toBe(DIVISION_AWARD_PRIZE_PER_TIER * 2 * CATEGORIES.length);
  });

  test('every tier of the pyramid is priced, and nothing outside it is', () => {
    expect([5, 4, 3, 2, 1].map(divisionAwardPrizePerCategory))
      .toEqual([120, 140, 160, 180, 200]);
    expect(() => divisionAwardPrizePerCategory(0)).toThrow('division 0');
    expect(() => divisionAwardPrizePerCategory(6)).toThrow('division 6');
  });

  test('is pure: repeatable, and it reads no clock and no randomness', () => {
    const recap = recapWonBy(['goals', 'saves']);
    const before = JSON.stringify(recap);
    const random = jest.spyOn(Math, 'random');
    const now = jest.spyOn(Date, 'now');
    try {
      const results = Array.from({ length: 20 }, () => divisionAwardPrize({
        recap,
        userClubId: USER_CLUB,
        targetDivision: 4,
      }));

      for (const result of results) expect(result).toEqual(results[0]);
      expect(random).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
      expect(JSON.stringify(recap)).toBe(before);
    } finally {
      random.mockRestore();
      now.mockRestore();
    }
  });
});

describe('banking the prize at the season transition', () => {
  test('the transition pays the entered division rate and stamps the recap', () => {
    const state = careerWithRecap(20260801, ['goals']);
    const recapBefore = state.seasonRecaps![0];

    const next = promoteAndStartNextSeason(state);

    const entered = currentUserDivision(next.m2!);
    // The club went up, so paying the played division would be a different
    // number: this is what pins the rate to the division being entered.
    expect(entered).toBeLessThan(recapBefore.division);
    expect(next.trainingPoints - state.trainingPoints)
      .toBe(divisionAwardPrizePerCategory(entered));
  });

  test('the granted figure is recorded on the season it was won in', () => {
    const state = careerWithRecap(20260801, ['goals', 'saves']);

    const next = promoteAndStartNextSeason(state);

    const stamped = next.seasonRecaps!.find(recap => recap.season === state.season)!;
    expect(stamped.divisionAwardPrize).toEqual({
      trainingPoints: divisionAwardPrizePerCategory(currentUserDivision(next.m2!)) * 2,
      categoriesWon: ['goals', 'saves'],
    });
  });

  test('a season that won nothing is stamped with a zero rather than left blank', () => {
    // Absent means "not yet paid". A blank on a season already transitioned
    // through would let a re-entering ceremony read it as a projection to grant.
    const state = careerWithRecap(20260801, []);

    const next = promoteAndStartNextSeason(state);

    expect(next.trainingPoints).toBe(state.trainingPoints);
    expect(next.seasonRecaps!.find(recap => recap.season === state.season)!.divisionAwardPrize)
      .toEqual({ trainingPoints: 0, categoriesWon: [] });
  });
});

function promoteAndStartNextSeason(state: GameState): GameState {
  const rows = leagueStandings(state);
  const user = rows.find(row => row.clubId === state.userClubId)!;
  const others = rows.filter(row => row.clubId !== state.userClubId);
  return startNextFullCareerSeason(state, [user, ...others]);
}

function careerWithRecap(seed: number, won: readonly AwardCategoryId[]): GameState {
  const career = createCareer(createLaunchCareerSetup(seed));
  const recap: SeasonRecap = {
    ...recapWonBy(won, career.userClubId),
    season: career.season,
    division: currentUserDivision(career.m2!),
  };
  return { ...career, seasonRecaps: [recap] };
}

/**
 * A recap whose four podiums are topped by the user's club in exactly the named
 * categories. Second place is always the user's club, so a prize that counted
 * placings rather than wins would show up immediately.
 */
function recapWonBy(
  won: readonly AwardCategoryId[],
  userClubId: string = USER_CLUB,
): SeasonRecap {
  const divisionAwards = Object.fromEntries(CATEGORIES.map(category => [
    category,
    podium(won.includes(category) ? userClubId : RIVAL_CLUB, userClubId),
  ])) as Record<AwardCategoryId, DivisionAwardPlacement[]>;
  return {
    season: 1,
    division: 5,
    finalPosition: 4,
    played: 18,
    won: 9,
    drawn: 4,
    lost: 5,
    goalsFor: 31,
    goalsAgainst: 24,
    cashChange: 4_200,
    closingCash: 21_500,
    trainingCapsReached: 0,
    cupResult: 'Round of 16',
    divisionAwards,
  };
}

function podium(winnerClubId: string, userClubId: string): DivisionAwardPlacement[] {
  return [
    { playerId: 'p_first', playerName: 'First Place', clubId: winnerClubId, value: 21 },
    { playerId: 'p_second', playerName: 'Second Place', clubId: userClubId, value: 14 },
    { playerId: 'p_third', playerName: 'Third Place', clubId: RIVAL_CLUB, value: 9 },
  ];
}
