import catalog from '../../../content/training.json';
import { trainingDrillTier } from '../promotion-progression';

describe('training catalog is TP-only with rebalanced costs', () => {
  test('every focus drill costs no money', () => {
    for (const drill of catalog.focusDrills) {
      expect(drill.moneyCost).toBe(0);
    }
  });

  test('TP cost is 10/15 by tier', () => {
    // The old 6 TP rung is gone: it could never be selected, because the engine
    // resolves the best UNLOCKED drill and the 10 TP rung opened at D5.
    const byTier: Record<number, number> = { 1: 10, 2: 15 };
    for (const drill of catalog.focusDrills) {
      expect(drill.tpCost).toBe(byTier[trainingDrillTier(drill.id)]);
    }
  });
});
