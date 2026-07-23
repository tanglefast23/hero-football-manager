import catalog from '../../../content/training.json';
import { trainingDrillTier } from '../promotion-progression';

describe('training catalog is TP-only with rebalanced costs', () => {
  test('every focus drill costs no money', () => {
    for (const drill of catalog.focusDrills) {
      expect(drill.moneyCost).toBe(0);
    }
  });

  test('TP cost is 6/10/15 by tier', () => {
    const byTier: Record<number, number> = { 1: 6, 2: 10, 3: 15 };
    for (const drill of catalog.focusDrills) {
      expect(drill.tpCost).toBe(byTier[trainingDrillTier(drill.id)]);
    }
  });
});
