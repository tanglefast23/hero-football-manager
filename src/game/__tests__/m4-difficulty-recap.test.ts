import { createLaunchCareerSetup } from '../../application/launch';
import { parseStoredGameState, serializeGameState } from '../../persistence/game-state-codec';
import { activeCareerMatchday, advanceWeek, completeMatchday, createCareer, startNextSeason } from '../career';
import { difficultyRules } from '../difficulty';
import { buildSeasonRecap } from '../season-recap';
import type { DifficultyMode, GameState } from '../types';

function career(difficulty: DifficultyMode): GameState {
  return createCareer(createLaunchCareerSetup(20260721, undefined, undefined, difficulty));
}

function settleThroughWeekFour(state: GameState): GameState {
  let next = state;
  while (next.week <= 4) {
    if (next.phase === 'manage') {
      next = advanceWeek(next);
      continue;
    }
    const matchday = activeCareerMatchday(next);
    if (matchday === undefined) throw new Error('expected an active fixture');
    next = completeMatchday(next, matchday.fixtures.map(fixture => ({
      fixtureId: fixture.id,
      homeGoals: 0,
      awayGoals: 0,
    })));
  }
  return next;
}

function finishSeason(state: GameState): GameState {
  let next = state;
  while (next.phase !== 'season-end' && next.phase !== 'complete') {
    if (next.phase === 'manage') {
      next = advanceWeek(next);
    } else if (next.phase === 'matchday') {
      const matchday = activeCareerMatchday(next);
      if (matchday === undefined) throw new Error('expected an active fixture');
      next = completeMatchday(next, matchday.fixtures.map(fixture => ({
        fixtureId: fixture.id,
        homeGoals: fixture.homeClubId === next.userClubId ? 2 : 0,
        awayGoals: fixture.awayClubId === next.userClubId ? 2 : 0,
      })));
    } else {
      throw new Error(`unexpected season phase ${String(next.phase)}`);
    }
  }
  return next;
}

describe('M4 difficulty and season recap', () => {
  it('keeps Cozy fail-soft while Chairman removes subsidy and trims sponsors', () => {
    const cozy = settleThroughWeekFour(career('COZY'));
    const chairman = settleThroughWeekFour(career('CHAIRMAN'));
    const cozyLines = cozy.ledgers.find(ledger => ledger.week === 4)!.lines;
    const chairmanLines = chairman.ledgers.find(ledger => ledger.week === 4)!.lines;

    expect(cozyLines.find(line => line.kind === 'subsidy')?.amount).toBeGreaterThan(0);
    expect(chairmanLines.some(line => line.kind === 'subsidy')).toBe(false);
    // Derived from the rules, not a pinned 0.85: this asserts the difficulty
    // actually reaches the ledger, and survives retuning the percentage.
    expect(chairmanLines.find(line => line.kind === 'sponsor')?.amount)
      .toBe(Math.floor(
        (cozyLines.find(line => line.kind === 'sponsor')?.amount ?? 0)
        * difficultyRules(chairman).sponsorIncomePercent / 100,
      ));
    expect(difficultyRules(cozy).negativeWeeksBeforeIntervention).toBe(4);
    expect(difficultyRules(chairman).negativeWeeksBeforeIntervention)
      .toBeLessThan(difficultyRules(cozy).negativeWeeksBeforeIntervention);
    expect(difficultyRules(chairman).emergencyLoanAmount).toBeLessThan(difficultyRules(cozy).emergencyLoanAmount);
    // Chairman must be a harder GAME, not only a leaner budget.
    expect(difficultyRules(chairman).opponentGrowthSeasonsPerPoint)
      .toBeLessThan(difficultyRules(cozy).opponentGrowthSeasonsPerPoint);
    expect(difficultyRules(chairman).opponentGrowthCap)
      .toBeGreaterThan(difficultyRules(cozy).opponentGrowthCap);
  });

  it('records and reloads the complete deterministic season cabinet', () => {
    const finished = finishSeason(career('COZY'));
    const recap = finished.seasonRecaps?.[0];

    expect(recap).toMatchObject({
      season: 1,
      division: 5,
      played: 18,
      won: 18,
      drawn: 0,
      lost: 0,
      goalsFor: 36,
      goalsAgainst: 0,
      cupResult: expect.any(String),
      closingCash: expect.any(Number),
      cashChange: expect.any(Number),
    });
    expect(recap?.playerOfSeason).toBeDefined();
    // These fixtures are settled with fabricated scores and no scorer
    // attribution, so the season has goals but no creditable Golden Boot.
    expect(recap?.topScorer).toBeUndefined();
    expect(parseStoredGameState(serializeGameState(finished)).seasonRecaps).toEqual(finished.seasonRecaps);
  });

  it('includes immediate event and transfer-style cash movement in the recap', () => {
    const initial = career('COZY');
    const userClub = initial.clubs.find(club => club.id === initial.userClubId)!;
    const changed: GameState = {
      ...initial,
      clubs: initial.clubs.map(club => club.id === initial.userClubId
        ? { ...club, cash: club.cash + 1_250 }
        : club),
      cashTransactions: [{
        id: 'm4-recap-test',
        season: 1,
        week: 1,
        kind: 'transfer-sell',
        amount: 1_000,
        label: 'Test transfer',
        balanceAfter: userClub.cash + 1_250,
      }],
    };
    const finished = finishSeason(changed);
    const recap = finished.seasonRecaps?.[0];

    expect(recap?.closingCash).toBe(userClub.cash + recap!.cashChange);
    expect(recap!.cashChange).toBe(finished.clubs.find(club => club.id === initial.userClubId)!.cash - initial.seasonOpeningCash!);
  });

  it('withholds the Golden Boot when nobody on the roster scored', () => {
    const recap = buildSeasonRecap(career('COZY'));

    expect(recap.topScorer).toBeUndefined();
    expect(recap.playerOfSeason).toBeDefined();
  });

  it('awards the Golden Boot to the season top scorer', () => {
    const initial = career('COZY');
    const scorer = initial.players.find(player => player.clubId === initial.userClubId)!;
    const recap = buildSeasonRecap({
      ...initial,
      seasonGoalTallies: [{ season: 1, playerId: scorer.id, goals: 7 }],
    });

    expect(recap.topScorer).toMatchObject({ playerId: scorer.id, detail: '7 goals' });
  });

});
