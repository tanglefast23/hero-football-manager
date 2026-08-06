/**
 * OPT-IN BALANCE PROBE:
 *   npm run test:probe -- src/audit/__tests__/division-award-prize-probe.test.ts
 *
 * Answers one question: what is a division award worth against the TP a club
 * actually earns in a season?
 *
 * Run this before changing DIVISION_AWARD_PRIZE_AT_D5,
 * DIVISION_AWARD_PRIZE_PER_TIER or DIVISION_AWARD_PRIZE_TAPER_PERCENT. The
 * numbers quoted in those constants' comments came from here, and a comment
 * rots the moment a constant moves while this probe re-derives itself.
 *
 * The denominator is the honest part. Season-1 ambient income comes from the
 * mini balance harness rather than arithmetic, so it carries the real cost of
 * the weeks a Training Pitch spends under construction — 50.1 TP/week measured
 * against the 52 the finished Level-1 pitch nominally pays. That measured season
 * is also the SMALLEST sensible denominator, which makes every ratio below a
 * worst case: a club still in D5 is the one on a Level-1 pitch, and by the time
 * it reaches D1 it will have built further, so read the D1 row against the
 * Level-2 and Level-3 columns rather than the measured one.
 *
 * The rails this has to respect: one board should be a couple of weeks of
 * income, and a four-board sweep should stay under roughly a quarter of a
 * season. Flat pay per board failed the second (31.9% at D5), which is what
 * produced the taper.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { runMiniBalanceHarness, type MiniBalanceScenario } from '../../game/balance';
import {
  DIVISION_AWARD_PRIZE_TAPER_PERCENT,
  TRAINING_POINT_CASH_VALUE,
  divisionAwardPrizeCashPerCategory,
  divisionAwardPrizePerCategory,
  divisionAwardPrizeTotal,
} from '../../game/division-award-prize';
import { BASE_WEEKLY_TRAINING_POINTS, TRAINING_PITCH_TP_PER_LEVEL } from '../../game/facilities';
import { CREATED_PLAYER_ROOKIE_WAGE } from '../../game/onboarding/player-creation';
import { SEASON_WEEKS } from '../../game/types';

const DIVISIONS = [5, 4, 3, 2, 1] as const;
const content = loadLaunchContent();
// Mirrors src/game/__tests__/balance.test.ts exactly, so the denominator here is
// the same season the CI rails are measured against.
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

test('division award prize against a season of TP income', () => {
  const metrics = runMiniBalanceHarness(LAUNCH_SCENARIO);
  const measuredSeason = metrics.meanAmbientTrainingPointsPerWeek * SEASON_WEEKS;
  const seasonAtPitchLevel = (level: number): number =>
    (BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL * level) * SEASON_WEEKS;

  const lines: string[] = [
    `measured season-1 ambient income: ${metrics.meanAmbientTrainingPointsPerWeek.toFixed(2)}`
    + ` TP/week x ${SEASON_WEEKS} weeks = ${measuredSeason.toFixed(0)} TP`
    + ` (${metrics.careerSeeds} seeds, Level-1 Training Pitch)`,
    `steady-state seasons: L1 ${seasonAtPitchLevel(1)} TP,`
    + ` L2 ${seasonAtPitchLevel(2)} TP, L3 ${seasonAtPitchLevel(3)} TP`,
    '',
    `taper: ${DIVISION_AWARD_PRIZE_TAPER_PERCENT.join('% / ')}% of the division rate`,
    '',
    'boards won, as cash (TP-equivalent share of the measured season):',
    'div | rate | 1 board | 2 boards | 3 boards | sweep | sweep/L2 | sweep/L3',
  ];
  for (const division of DIVISIONS) {
    const totals = [1, 2, 3, 4].map(count => divisionAwardPrizeTotal(division, count));
    const sweep = totals[3];
    lines.push([
      `D${division}`,
      String(divisionAwardPrizePerCategory(division)),
      ...totals.map(total => `$${total} (${share(total / TRAINING_POINT_CASH_VALUE, measuredSeason)})`),
      share(sweep / TRAINING_POINT_CASH_VALUE, seasonAtPitchLevel(2)),
      share(sweep / TRAINING_POINT_CASH_VALUE, seasonAtPitchLevel(3)),
    ].join(' | '));
  }
  // eslint-disable-next-line no-console
  console.log(`\n${lines.join('\n')}\n`);

  // Not a rail — the probe reports, the constants decide. This only pins the
  // property the taper exists to create, so a probe run that silently stopped
  // tapering would fail here instead of printing a reassuring table.
  for (const division of DIVISIONS) {
    // Cash against cash: the payout moved off TP, so the per-category TP rate
    // is a sizing unit now and comparing the two would be comparing currencies.
    expect(divisionAwardPrizeTotal(division, 4))
      .toBeLessThan(divisionAwardPrizeCashPerCategory(division) * 4);
  }
});

function share(value: number, season: number): string {
  return `${(100 * value / season).toFixed(1)}%`;
}
