import catalog from '../../../content/training.json';
import { trainingDrillTier } from '../promotion-progression';

describe('training catalog is TP-only with rebalanced costs', () => {
  test('every focus drill costs no money', () => {
    // The TAP stays TP-only; money buys the tier, not the session.
    for (const drill of catalog.focusDrills) {
      expect(drill.moneyCost).toBe(0);
    }
  });

  test('TP cost rises about 1.5x per tier', () => {
    const byTier: Record<number, number> = {
      1: 7,
      2: 11,
      3: 17,
      4: 26,
      5: 39,
    };
    for (const drill of catalog.focusDrills) {
      expect(drill.tpCost).toBe(byTier[trainingDrillTier(drill.id)]);
    }
  });
});
