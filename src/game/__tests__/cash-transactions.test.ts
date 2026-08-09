import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '..';
import { recordCashTransaction } from '../cash-transactions';

describe('cash transaction ids', () => {
  const entry = {
    kind: 'scouting' as const,
    label: 'Scout trip',
    amount: -100,
  };

  test('ids are monotonic and survive a pruned history without colliding', () => {
    const initial = createCareer(createLaunchCareerSetup(20260805));
    const first = recordCashTransaction(initial, entry);
    const second = recordCashTransaction(first, entry);

    expect(
      second.cashTransactions?.map((transaction) => transaction.id),
    ).toEqual(['cash-transaction-1', 'cash-transaction-2']);
    expect(second.cashTransactionIdCounter).toBe(2);

    // A future prune of old entries must not re-mint their ids: persistence
    // requires every id in the history to be unique.
    const pruned = { ...second, cashTransactions: [] };
    const afterPrune = recordCashTransaction(pruned, entry);
    expect(
      afterPrune.cashTransactions?.map((transaction) => transaction.id),
    ).toEqual(['cash-transaction-3']);
    expect(afterPrune.cashTransactionIdCounter).toBe(3);
  });

  test('a save from before the counter seeds it from the ids it already issued', () => {
    const initial = createCareer(createLaunchCareerSetup(20260806));
    const second = recordCashTransaction(
      recordCashTransaction(initial, entry),
      entry,
    );
    const { cashTransactionIdCounter: _legacyOmits, ...legacy } = second;

    const migrated = recordCashTransaction(legacy, entry);

    expect(
      migrated.cashTransactions?.map((transaction) => transaction.id),
    ).toEqual([
      'cash-transaction-1',
      'cash-transaction-2',
      'cash-transaction-3',
    ]);
    expect(migrated.cashTransactionIdCounter).toBe(3);
  });
});
