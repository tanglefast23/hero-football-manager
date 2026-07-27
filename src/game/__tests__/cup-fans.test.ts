import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { divisionFans } from '../full-career';

/**
 * The Global Cup is the only way to grow the gate without a promotion, so its
 * fan rewards are pinned here against the promotion step they must stay under.
 */
describe('Global Cup fan rewards', () => {
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
    const source = readFileSync(join(process.cwd(), 'src/game/career.ts'), 'utf8');
    for (const [round, fans] of Object.entries(FANS_BY_ROUND)) {
      expect(source).toContain(round === 'Final' ? `Final: ${fans},` : `'${round}': ${fans},`);
    }
    expect(source).toContain("fans: checkedAdd(club.fans, fansWon, 'Global Cup fans won')");
  });
});
