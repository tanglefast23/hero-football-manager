import { loadLaunchContent } from '../../content';
import { CREATED_PLAYER_ROOKIE_WAGE } from '../onboarding/player-creation';
import {
  MINI_BALANCE_RAILS,
  runMiniBalanceHarness,
  type MiniBalanceScenario,
} from '../balance';

const content = loadLaunchContent();
const spiderEvent = content.events.events.find(event => event.id === 'spider-training-day');
const spiderChoice = spiderEvent?.choices.find(choice => choice.id === 'approach-spider');
if (spiderEvent === undefined || spiderChoice === undefined || !spiderChoice.risky) {
  throw new Error('launch balance scenario requires the risky spider-training choice');
}
const LAUNCH_SCENARIO: MiniBalanceScenario = {
  careerSetup: {
    userClubId: 'bramble-rovers',
    startingTrainingPoints: 0,
    clubs: content.clubs.clubs.map(club => ({
      id: club.id,
      name: club.name,
      cash: club.startingCash,
      fans: club.fans,
      ticketPrice: club.ticketPrice,
      sponsorMonthlyFee: club.sponsorMonthlyFee,
      weeklyWages: club.players.reduce((sum, player) => sum + player.weeklyWage, 0)
        + (club.id === 'bramble-rovers' ? CREATED_PLAYER_ROOKIE_WAGE : 0),
    })),
  },
  representativeDrills: content.training.focusDrills.slice(0, 3),
  awakening: {
    season: spiderEvent.trigger.season,
    firstWeek: spiderEvent.trigger.minWeek,
    lastWeek: spiderEvent.trigger.maxWeek,
    // Adopting the spider is itself the first failed risky choice.
    initialFailedRiskyChoices: 1,
    choiceId: spiderChoice.id,
    baseChancePercent: content.events.tuning.baseAwakeningChancePercent,
    pityIncrementPercent: content.events.tuning.pityIncrementPercent,
  },
};

describe('M1 mini balance harness', () => {
  test('is deterministic for the same seeded sample sizes', () => {
    const first = runMiniBalanceHarness(LAUNCH_SCENARIO, { careerSeeds: 12, awakeningSeeds: 50 });
    const second = runMiniBalanceHarness(LAUNCH_SCENARIO, { careerSeeds: 12, awakeningSeeds: 50 });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.representativeDrillIds).toEqual(['sprints', 'finishing', 'rondo']);
  });

  test('keeps Season-1 Cozy bankruptcy below the two-percent design promise', () => {
    const metrics = runMiniBalanceHarness(LAUNCH_SCENARIO);

    expect(metrics.seasonOneBankruptcyRate)
      .toBeLessThan(MINI_BALANCE_RAILS.maximumSeasonOneBankruptcyRate);
  });

  test('keeps match-week TP income near two representative focus drills', () => {
    const metrics = runMiniBalanceHarness(LAUNCH_SCENARIO);

    expect(metrics.meanAffordableFocusDrillsPerMatchWeek)
      .toBeGreaterThanOrEqual(MINI_BALANCE_RAILS.minimumAffordableFocusDrillsPerMatchWeek);
    expect(metrics.meanAffordableFocusDrillsPerMatchWeek)
      .toBeLessThanOrEqual(MINI_BALANCE_RAILS.maximumAffordableFocusDrillsPerMatchWeek);
  });

  test('models the shipped weekly retry chain through its Week-24 deadline', () => {
    const metrics = runMiniBalanceHarness(LAUNCH_SCENARIO);

    expect(metrics.meanAwakeningWeek)
      .toBeGreaterThanOrEqual(MINI_BALANCE_RAILS.minimumMeanAwakeningWeek);
    expect(metrics.meanAwakeningWeek)
      .toBeLessThanOrEqual(MINI_BALANCE_RAILS.maximumMeanAwakeningWeek);
    expect(metrics.awakeningByDeadlineRate)
      .toBeGreaterThanOrEqual(MINI_BALANCE_RAILS.minimumAwakeningByDeadlineRate);
    expect(metrics.awakeningDeadlineWeek).toBe(24);
  });

  test('rejects invalid sample sizes', () => {
    expect(() => runMiniBalanceHarness(LAUNCH_SCENARIO, { careerSeeds: 0 })).toThrow('careerSeeds');
    expect(() => runMiniBalanceHarness(LAUNCH_SCENARIO, { awakeningSeeds: 10001 })).toThrow('awakeningSeeds');
  });
});
