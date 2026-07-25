import type {
  CashTransaction,
  CashTransactionKind,
  GameState,
} from './types';

export interface CashTransactionInput {
  readonly kind: CashTransactionKind;
  readonly label: string;
  readonly amount: number;
  readonly referenceId?: string;
}

/**
 * Records one already-applied user-club cash mutation without touching weekly
 * ledgers.
 */
export function recordCashTransaction(
  state: GameState,
  input: CashTransactionInput,
): GameState {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new Error('cash transaction amount must be a non-zero safe integer');
  }
  if (input.label.trim().length === 0) {
    throw new Error('cash transaction label must be a non-empty string');
  }
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const history = state.cashTransactions ?? [];
  const transaction: CashTransaction = {
    id: `cash-transaction-${history.length + 1}`,
    season: state.season,
    week: state.week,
    kind: input.kind,
    label: input.label,
    amount: input.amount,
    balanceAfter: club.cash,
    ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
  };
  return { ...state, cashTransactions: [...history, transaction] };
}
