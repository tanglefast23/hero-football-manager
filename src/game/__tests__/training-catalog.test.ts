import catalog from '../../../content/training.json';
import { trainingDrillTier } from '../promotion-progression';

describe('training catalog is TP-only with rebalanced costs', () => {
  test('every focus drill costs no money', () => {
    // The TAP stays TP-only; money buys the tier, not the session.
    for (const drill of catalog.focusDrills) {
      expect(drill.moneyCost).toBe(0);
    }
  });

  test('TP cost is 8/13/19/26/36 by tier', () => {
    const byTier: Record<number, number> = {
      1: 8,
      2: 13,
      3: 19,
      4: 26,
      5: 36,
    };
    for (const drill of catalog.focusDrills) {
      expect(drill.tpCost).toBe(byTier[trainingDrillTier(drill.id)]);
    }
  });
});
