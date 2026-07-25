import type { DifficultyMode, GameState } from './types';

export const DEFAULT_DIFFICULTY: DifficultyMode = 'COZY';

export interface DifficultyRules {
  seasonOneWageSubsidyPercent: number;
  sponsorIncomePercent: number;
  negativeWeeksBeforeIntervention: number;
  emergencyLoanAmount: number;
  /**
   * Seasons the league needs to gain one rating point. Lower means the field
   * pulls away faster, which is the only lever that makes a mode harder to PLAY
   * rather than merely harder to afford.
   */
  opponentGrowthSeasonsPerPoint: number;
  /** Ceiling on cumulative league growth, so a long career cannot run away. */
  opponentGrowthCap: number;
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
    opponentGrowthSeasonsPerPoint: 2,
    opponentGrowthCap: 8,
  },
  CHAIRMAN: {
    seasonOneWageSubsidyPercent: 0,
    sponsorIncomePercent: 80,
    negativeWeeksBeforeIntervention: 2,
    emergencyLoanAmount: 10_000,
    opponentGrowthSeasonsPerPoint: 1,
    opponentGrowthCap: 10,
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
