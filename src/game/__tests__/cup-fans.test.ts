import { divisionFans } from '../full-career';
import {
  nationalCupRoundSettlementAwards,
  resolveWeeklySettlementAwards,
} from '../weekly-settlement-awards';

/**
 * The Hero Cup remains the largest discrete way to grow the gate, so its fan
 * rewards are pinned here against the promotion step they must stay under.
 */
describe('Hero Cup fan rewards', () => {
  const FANS_BY_ROUND = {
    'Play-in': 6,
    'Round of 32': 10,
    'Round of 16': 16,
    'Quarter-final': 24,
    'Semi-final': 36,
    Final: 120,
  } as const;

  it('pays more the further a club goes', () => {
    const run = Object.values(FANS_BY_ROUND);
    for (let i = 1; i < run.length; i += 1) expect(run[i]).toBeGreaterThan(run[i - 1]);
  });

  it('stays under the step a promotion gives, so the league stays the main driver', () => {
    const fullRun = Object.values(FANS_BY_ROUND).reduce((total, fans) => total + fans, 0);
    // One division is worth 500 fans; a whole cup run is worth less than two.
    const oneDivisionStep = divisionFans(4) - divisionFans(5);
    expect(oneDivisionStep).toBe(500);
    // Well under one division step. Fans compound through the gate every home
    // match of every remaining season, so even a few hundred permanent fans
    // breaks the active-manager economy rail.
    expect(fullRun).toBeLessThan(oneDivisionStep / 2);
  });

  it('matches the schedule the career actually awards', () => {
    const rounds = Object.keys(FANS_BY_ROUND) as Array<keyof typeof FANS_BY_ROUND>;
    for (const [index, round] of rounds.entries()) {
      const awards = nationalCupRoundSettlementAwards({
        clubId: 'bramble-rovers',
        season: 3,
        roundNumber: index + 1,
        roundLabel: round,
      });
      expect(resolveWeeklySettlementAwards([], awards).fanGain).toBe(FANS_BY_ROUND[round]);
    }
  });
});
