import catalog from '../../../content/training.json';
import { trainingDrillTier } from '../promotion-progression';

describe('training catalog is TP-only with rebalanced costs', () => {
  test('every focus drill costs no money', () => {
    // The TAP stays TP-only; money buys the tier, not the session.
    for (const drill of catalog.focusDrills) {
      expect(drill.moneyCost).toBe(0);
    }
  });

  test('TP cost is 10/15/21/28/36 by tier', () => {
    const byTier: Record<number, number> = { 1: 10, 2: 15, 3: 21, 4: 28, 5: 36 };
    for (const drill of catalog.focusDrills) {
      expect(drill.tpCost).toBe(byTier[trainingDrillTier(drill.id)]);
    }
  });
});
