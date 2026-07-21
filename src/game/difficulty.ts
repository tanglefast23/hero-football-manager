import type { DifficultyMode, GameState } from './types';

export const DEFAULT_DIFFICULTY: DifficultyMode = 'COZY';

export interface DifficultyRules {
  seasonOneWageSubsidyPercent: number;
  sponsorIncomePercent: number;
  negativeWeeksBeforeIntervention: number;
  emergencyLoanAmount: number;
}

const RULES: Record<DifficultyMode, DifficultyRules> = {
  COZY: {
    seasonOneWageSubsidyPercent: 50,
    sponsorIncomePercent: 100,
    negativeWeeksBeforeIntervention: 4,
    emergencyLoanAmount: 20_000,
  },
  CHAIRMAN: {
    seasonOneWageSubsidyPercent: 0,
    sponsorIncomePercent: 85,
    negativeWeeksBeforeIntervention: 3,
    emergencyLoanAmount: 15_000,
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
