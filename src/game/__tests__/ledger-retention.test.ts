import { createLaunchCareerSetup } from '../../application/launch';
import { RETAINED_LEDGER_SEASONS } from '../career';
import { runHeadlessFullCareer } from '../headless';
import { serializeGameState } from '../../persistence/game-state-codec';

/**
 * Ledgers were the one growing slice of the save with no retention rule.
 *
 * Measured on the real career loop: a season-100 save reached 2.07 MB with
 * 1.42 MB of it ledgers — 3% of a season-1 save, 69% of a season-100 one —
 * and the whole blob is re-stringified into SQLite at every settlement. The
 * Hero Cup brackets were given `RETAINED_CUP_BRACKET_SEASONS` for exactly this
 * and are flat as a result; this is the same rule for the slice that grew four
 * times faster.
 */
describe('weekly ledger retention', () => {
  const SEASONS = RETAINED_LEDGER_SEASONS + 4;
  const state = runHeadlessFullCareer(createLaunchCareerSetup(8_311), SEASONS);
  const seasons = [...new Set(state.ledgers.map((ledger) => ledger.season))]
    .slice()
    .sort((left, right) => left - right);

  test('keeps exactly the retention window of seasons', () => {
    expect(state.season).toBeGreaterThan(RETAINED_LEDGER_SEASONS);
    expect(seasons).toEqual(
      Array.from(
        { length: RETAINED_LEDGER_SEASONS },
        (unused, index) => state.season - index,
      ).reverse(),
    );
  });

  test('never drops the current season, whose weeks the desk still reads', () => {
    const current = state.ledgers.filter(
      (ledger) => ledger.season === state.season,
    );

    expect(current.map((ledger) => ledger.week)).toEqual(
      Array.from({ length: 30 }, (unused, index) => index + 1),
    );
  });

  /**
   * The number that failed before: unbounded growth. Without the window this
   * career serialises about four times this much ledger, and the multiple keeps
   * climbing for as long as the career runs.
   */
  test('bounds the ledger share of a long save', () => {
    const bytes = serializeGameState(state).length;
    const ledgerBytes = JSON.stringify(state.ledgers).length;

    expect(state.ledgers.length).toBeLessThanOrEqual(
      RETAINED_LEDGER_SEASONS * 30,
    );
    expect(ledgerBytes / bytes).toBeLessThan(0.5);
  });
});
