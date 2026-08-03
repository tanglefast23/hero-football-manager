import type { DifficultyMode, GameState } from './types';

/**
 * The mode a career plays at when it has no recorded difficulty: pre-difficulty
 * saves and the measurement fixtures that build a state directly. It is NOT the
 * new-game default — the first-hire picker leads with Chairman and always
 * commits a choice, so this never decides what a fresh career plays.
 *
 * Keep it Cozy. The balance rails read it as "the Cozy curve", so flipping it
 * silently re-points the Season-1 Cozy bankruptcy harness at Chairman.
 */
export const DEFAULT_DIFFICULTY: DifficultyMode = 'COZY';

export interface DifficultyRules {
  seasonOneWageSubsidyPercent: number;
  sponsorIncomePercent: number;
  negativeWeeksBeforeIntervention: number;
  emergencyLoanAmount: number;
  /** Annual percentage applied independently to all seven rival attributes. */
  opponentGrowthPercent: number;
  /** Hard attribute ceiling for generated rivals in endless careers. */
  opponentGrowthAttributeCap: number;
  /**
   * The furthest into the red a club can ever go. The board tops the balance
   * back up to this line whenever a week would end below it.
   *
   * This is what makes the economy genuinely fail-soft. The escalation above it
   * — warnings, one emergency loan, then board-enforced sales — is the part with
   * teeth, and it fires first. But every one of those is finite: measured in D5,
   * the loan is 20,000 and a forced sale raised 8,885, against a shortfall of
   * about 2,300 a week. Once they were spent nothing else happened, so a club
   * that stalled fell to -101,183 by season three and kept going. That is not a
   * game over, but it is not a safety net either — it is an unbounded number
   * with no route back and no signal that anything has gone wrong.
   */
  cashFloor: number;
}

/**
 * Chairman is meant to be a harder GAME, not just a leaner budget. It used to
 * differ only in money, so the league it faced was identical to Cozy's.
 *
 * It now also loses cushion (sponsor income, one fewer grace week before the
 * board steps in, a smaller emergency loan) AND faces a league that improves
 * every season instead of every other season, with a slightly higher ceiling.
 * That is deliberately a small step: one extra rating point a season, not a
 * different curve.
 */
const RULES: Record<DifficultyMode, DifficultyRules> = {
  COZY: {
    seasonOneWageSubsidyPercent: 50,
    sponsorIncomePercent: 100,
    negativeWeeksBeforeIntervention: 4,
    emergencyLoanAmount: 20_000,
    opponentGrowthPercent: 3,
    opponentGrowthAttributeCap: 700,
    cashFloor: -15_000,
  },
  CHAIRMAN: {
    seasonOneWageSubsidyPercent: 0,
    sponsorIncomePercent: 80,
    negativeWeeksBeforeIntervention: 2,
    emergencyLoanAmount: 10_000,
    opponentGrowthPercent: 4,
    opponentGrowthAttributeCap: 800,
    // Chairman is allowed to sink twice as deep before the board steps in, so
    // the danger zone lasts longer and the ultimatums bite harder. It is still
    // bounded — the mode is a harder game, not an unwinnable one.
    cashFloor: -30_000,
  },
};

export function careerDifficulty(state: Pick<GameState, 'difficulty'>): DifficultyMode {
  return state.difficulty ?? DEFAULT_DIFFICULTY;
}

export function difficultyRules(state: Pick<GameState, 'difficulty'>): DifficultyRules {
  return RULES[careerDifficulty(state)];
}

export function validateDifficulty(value: DifficultyMode): DifficultyMode {
  if (value !== 'COZY' && value !== 'CHAIRMAN') throw new Error(`unknown difficulty ${String(value)}`);
  return value;
}
