import { loadLaunchContent } from '../../content';
import { createLaunchCareerSetup } from '../../application/launch';
import { CREATED_PLAYER_ROOKIE_WAGE } from '../onboarding/player-creation';
import {
  MINI_BALANCE_RAILS,
  runMiniBalanceHarness,
  type MiniBalanceScenario,
} from '../balance';

const content = loadLaunchContent();
const { seed: _launchSeed, ...launchCareerSetup } = createLaunchCareerSetup(1);
const LAUNCH_SCENARIO: MiniBalanceScenario = {
  careerSetup: {
    ...launchCareerSetup,
    clubs: launchCareerSetup.clubs.map(club => ({
      ...club,
      weeklyWages: club.weeklyWages
        + (club.id === 'bramble-rovers' ? CREATED_PLAYER_ROOKIE_WAGE : 0),
    })),
  },
  representativeDrills: content.training.focusDrills.filter(drill =>
    ['sprints', 'finishing', 'rondo'].includes(drill.id),
  ),
  spendingPolicy: {
    trainingGroundCost: 8000,
    assignedPlayerIds: ['bramble-rovers-p13'],
    weeklyFocusDrillIds: ['sprints'],
  },
  awakening: {
    chancePercent: content.powers.awakening.postMatchChancePercent,
    minimumMatchesBetween: content.powers.awakening.minimumMatchesBetween,
    seasonMatches: 18,
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

    // Focus drills are TP-only now (no money cost), so discretionary spend
    // is just the $8,000 pitch build.
    expect(metrics.meanSeasonOneDiscretionarySpend).toBe(8000);
    expect(metrics.seasonOneBankruptcyRate)
      .toBeLessThan(MINI_BALANCE_RAILS.maximumSeasonOneBankruptcyRate);
  });

  test('creates the Level-1 Training Pitch TP every settled week after construction', () => {
    const metrics = runMiniBalanceHarness(LAUNCH_SCENARIO);

    expect(metrics.meanAmbientTrainingPointsPerWeek)
      .toBeGreaterThanOrEqual(MINI_BALANCE_RAILS.minimumMeanAmbientTrainingPointsPerWeek);
    expect(metrics.meanAmbientTrainingPointsPerWeek)
      .toBeLessThanOrEqual(MINI_BALANCE_RAILS.maximumMeanAmbientTrainingPointsPerWeek);
  });

  test('models the shipped post-match chance without a hidden pity guarantee', () => {
    const metrics = runMiniBalanceHarness(LAUNCH_SCENARIO);

    expect(metrics.meanAwakeningMatch)
      .toBeGreaterThanOrEqual(MINI_BALANCE_RAILS.minimumMeanAwakeningMatch);
    expect(metrics.meanAwakeningMatch)
      .toBeLessThanOrEqual(MINI_BALANCE_RAILS.maximumMeanAwakeningMatch);
    expect(metrics.awakeningByDeadlineRate)
      .toBeGreaterThanOrEqual(MINI_BALANCE_RAILS.minimumAwakeningBySeasonEndRate);
    expect(metrics.awakeningByDeadlineRate)
      .toBeLessThanOrEqual(MINI_BALANCE_RAILS.maximumAwakeningBySeasonEndRate);
    expect(metrics.awakeningDeadlineMatch).toBe(18);
  });

  test('rejects invalid sample sizes', () => {
    expect(() => runMiniBalanceHarness(LAUNCH_SCENARIO, { careerSeeds: 0 })).toThrow('careerSeeds');
    expect(() => runMiniBalanceHarness(LAUNCH_SCENARIO, { awakeningSeeds: 10001 })).toThrow('awakeningSeeds');
  });
});
