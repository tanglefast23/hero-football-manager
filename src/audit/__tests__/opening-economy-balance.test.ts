/**
 * D5 cash-flow approval harness.
 *
 * This is intentionally a 300-seed production-settlement cohort rather than a
 * tiny smoke sample: Chairman solvency is the reason the rebalance exists.
 */
import type { DifficultyMode } from '../../game';
import {
  runOpeningEconomy,
  type EconomyOutcomePolicy,
  type OpeningEconomyRun,
} from '../opening/economy-runner';

const SEEDS = 300;
const DIFFICULTIES: readonly DifficultyMode[] = ['COZY', 'CHAIRMAN'];

describe('D5 opening economy acceptance', () => {
  it('keeps the guided strong-play opening clear of every safety intervention', () => {
    for (const difficulty of DIFFICULTIES) {
      const runs = sample(difficulty, 'STRONG', false);
      expect(runs.every((run) => run.checkpointWeek === 12)).toBe(true);
      expect(
        runs.every((run) => run.leagueMatches === 7 && run.cupMatches === 1),
      ).toBe(true);
      expect(runs.every((run) => run.stadiumOperational)).toBe(true);
      expect(
        runs.every(
          (run) => !run.emergencyLoan && !run.forcedSale && !run.cashFloorTopUp,
        ),
      ).toBe(true);
      expect(
        percentile(
          runs.map((run) => run.endingCash),
          0.1,
        ),
      ).toBeGreaterThanOrEqual(10_000);
    }

    const representativeChairman = sample('CHAIRMAN', 'REPRESENTATIVE', false);
    const representativeP10 = percentile(
      representativeChairman.map((run) => run.endingCash),
      0.1,
    );
    expect(
      representativeChairman.every(
        (run) => !run.emergencyLoan && !run.forcedSale && !run.cashFloorTopUp,
      ),
    ).toBe(true);
    expect(representativeP10).toBeGreaterThanOrEqual(5_000);
  });

  it('keeps representative Season 1 solvent while preserving Chairman pressure', () => {
    const cozy = sample('COZY', 'REPRESENTATIVE', true);
    const chairman = sample('CHAIRMAN', 'REPRESENTATIVE', true);
    const cozyLoanRate = interventionRate(cozy);
    const chairmanLoanRate = interventionRate(chairman);
    const cozyP10 = percentile(
      cozy.map((run) => run.endingCash),
      0.1,
    );
    const chairmanMedian = percentile(
      chairman.map((run) => run.endingCash),
      0.5,
    );
    const cozyMedian = percentile(
      cozy.map((run) => run.endingCash),
      0.5,
    );

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '=== D5 OPENING ECONOMY (300 seeds per mode) ===',
        `Cozy: loan ${(cozyLoanRate * 100).toFixed(1)}%, P10 $${cozyP10}, median $${cozyMedian}`,
        `Chairman: loan ${(chairmanLoanRate * 100).toFixed(1)}%, median $${chairmanMedian}`,
        `No-prize/safety median: Cozy $${percentile(
          cozy.map((run) => run.endingCashBeforePrizesAndSafety),
          0.5,
        )}, Chairman $${percentile(
          chairman.map((run) => run.endingCashBeforePrizesAndSafety),
          0.5,
        )}`,
      ].join('\n'),
    );

    expect(cozyLoanRate).toBe(0);
    expect(cozyP10).toBeGreaterThanOrEqual(0);
    expect(cozyMedian).toBeGreaterThanOrEqual(5_000);
    expect(chairmanLoanRate).toBeLessThan(0.1);
    expect(chairmanMedian).toBeLessThanOrEqual(cozyMedian - 10_000);
  });
});

function sample(
  difficulty: DifficultyMode,
  outcomes: EconomyOutcomePolicy,
  throughSeasonEnd: boolean,
): OpeningEconomyRun[] {
  return Array.from({ length: SEEDS }, (_, index) =>
    runOpeningEconomy({
      seed: 5_000_003 + index * 104_729,
      difficulty,
      outcomes,
      throughSeasonEnd,
    }),
  );
}

function interventionRate(runs: readonly OpeningEconomyRun[]): number {
  return (
    runs.filter(
      (run) => run.emergencyLoan || run.forcedSale || run.cashFloorTopUp,
    ).length / runs.length
  );
}

function percentile(values: readonly number[], quantile: number): number {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor((ordered.length - 1) * quantile)];
}
