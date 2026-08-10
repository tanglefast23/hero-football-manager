import catalog from '../../../content/training.json';
import { trainingDrillTier } from '../promotion-progression';

describe('training catalog is TP-only with rebalanced costs', () => {
  test('every focus drill costs no money', () => {
    // The TAP stays TP-only; money buys the tier, not the session.
    for (const drill of catalog.focusDrills) {
      expect(drill.moneyCost).toBe(0);
    }
  });

  test('TP cost is 7/12/18/25/35 by tier', () => {
    const byTier: Record<number, number> = {
      1: 7,
      2: 12,
      3: 18,
      4: 25,
      5: 35,
    };
    for (const drill of catalog.focusDrills) {
      expect(drill.tpCost).toBe(byTier[trainingDrillTier(drill.id)]);
    }
  });
});
