import type { CashTransaction, CashTransactionKind, GameState } from './types';

interface CashTransactionInput {
  readonly kind: CashTransactionKind;
  /** English, always written — the fallback for careers saved before `labelKey`. */
  readonly label: string;
  /** Catalog key for `label`, so an old career renders in the player's language. */
  readonly labelKey?: string;
  /** Raw values for the key's placeholders. Never pre-formatted text. */
  readonly labelParams?: Readonly<Record<string, string | number>>;
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
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  const history = state.cashTransactions ?? [];
  // Monotonic across the career rather than derived from the history's length,
  // so ids stay unique even if old entries are ever pruned. Saves written
  // before the counter existed seed it from the length that minted their
  // existing ids, which reproduces exactly the ids they would have issued.
  const issued =
    Math.max(state.cashTransactionIdCounter ?? 0, history.length) + 1;
  const transaction: CashTransaction = {
    id: `cash-transaction-${issued}`,
    season: state.season,
    week: state.week,
    kind: input.kind,
    label: input.label,
    ...(input.labelKey === undefined ? {} : { labelKey: input.labelKey }),
    ...(input.labelParams === undefined
      ? {}
      : { labelParams: input.labelParams }),
    amount: input.amount,
    balanceAfter: club.cash,
    ...(input.referenceId === undefined
      ? {}
      : { referenceId: input.referenceId }),
  };
  return {
    ...state,
    cashTransactions: [...history, transaction],
    cashTransactionIdCounter: issued,
  };
}
