import { runMatch } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';

/**
 * CI rail for the supply feeding the Midfielders division board.
 *
 * The board ranks assists, and an assist only exists because the engine stamps
 * `assistedById` on a GOAL (the last teammate to hold the ball before the
 * scorer, cleared on a turnover, a save or a restart). Nothing else in the suite
 * measures how OFTEN that stamp lands: `src/sim/__tests__/assists.test.ts`
 * proves the id is a real teammate and is never the scorer, which stays true
 * even if the rule fires once a season. If a future tuning pass quietly stops
 * crediting, the board still renders — empty — and no test says a word.
 *
 * WHY A SHARE OF GOALS RATHER THAN ASSISTS PER MATCH
 * There is at most one assist per goal, so the share is the fraction of goals
 * that carry one. Measured on these fixtures (2026-08-01):
 *
 *   ROVERS v UNITED, 20 seeds  44 goals  40 assists  90.9%   2.00 assists/match
 *   ROVERS v UNITED, 200 seeds 415 goals 375 assists 90.4%   1.88 assists/match
 *
 * The absolute rate is not a stable thing to assert. Swinging one side's
 * attributes by +/-20 — a far bigger move than any real balance pass — took the
 * same fixtures to 3.05 and 4.15 assists per match (goals per match 2.20 -> 3.65
 * and 5.05), while the share only moved to 83.6% and 82.2%. Goal-rate tuning is
 * exactly the kind of change that must NOT trip an assist rail, so the rail
 * divides it out. It also makes the band readable: 0.0 means no goal is ever
 * assisted, 1.0 means every goal is.
 *
 * WHERE THE BAND COMES FROM
 * 20 seeds yield ~44 goals, so binomial noise around a 0.91 share is about 4
 * points of standard deviation; measured 20-seed windows on other seed bases
 * ranged 80.0%-97.5%. Production division squads sit lower still (D5 94-96%,
 * D1 61%: stronger sides score more solo and power goals, which carry no
 * assist), so the floor is set well under today's value to leave room for the
 * engine drifting that way on purpose. The ceiling exists for the opposite
 * failure: a rule that stops clearing the candidate credits an assist to
 * whoever last touched the ball, however long ago, and saturates near 1.0.
 *
 * IF THIS RAIL FAILS
 * It is a design problem, not a test to widen. Below the floor, the assist rule
 * has become too strict (or has stopped stamping) and the Midfielders board is
 * being starved — diagnose with STAT_YIELD_PROBE=1. Above the ceiling, the
 * candidate is no longer being cleared and the board is crediting passes that
 * did not create the goal.
 */
const MINIMUM_ASSISTED_GOAL_SHARE = 0.55;
const MAXIMUM_ASSISTED_GOAL_SHARE = 0.99;
const SEEDS = 20;

/** Both sides auto-fire: the watched-match default is asymmetric by design. */
const POLICIES = { homePolicy: 'FIRE_WHEN_READY' as const, awayPolicy: 'FIRE_WHEN_READY' as const };

describe('assist yield rail', () => {
  it('keeps assisted goals inside the band the Midfielders board was built on', () => {
    let goals = 0;
    let assists = 0;
    for (let index = 0; index < SEEDS; index += 1) {
      const result = runMatch(900_000 + index * 7919, ROVERS, UNITED, [], POLICIES);
      for (const event of result.events) {
        if (event.kind !== 'GOAL') continue;
        goals += 1;
        if (event.assistedById !== undefined) assists += 1;
      }
    }

    // A share of nothing is not a measurement, so refuse to pass on an empty
    // sample: a change that stopped goals entirely must fail here too.
    expect(goals).toBeGreaterThanOrEqual(20);

    const share = assists / goals;
    // eslint-disable-next-line no-console
    console.log(`ASSIST YIELD RAIL: ${assists}/${goals} goals assisted`
      + ` (${(share * 100).toFixed(1)}%, ${(assists / SEEDS).toFixed(2)} assists/match)`
      + ` over ${SEEDS} seeds`);

    expect(share).toBeGreaterThanOrEqual(MINIMUM_ASSISTED_GOAL_SHARE);
    expect(share).toBeLessThanOrEqual(MAXIMUM_ASSISTED_GOAL_SHARE);
  }, 60_000);
});
