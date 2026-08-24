import {
  GOAL_CONFETTI_PIECE_COUNT,
  GOAL_CONFETTI_SPARSE_PIECE_COUNT,
  makeGoalConfetti,
} from '../goal-confetti';

describe('goal confetti scatter', () => {
  it('keeps every piece fully on screen', () => {
    const pieces = makeGoalConfetti(390, 844);
    expect(pieces).toHaveLength(GOAL_CONFETTI_PIECE_COUNT);
    for (const piece of pieces) {
      expect(piece.left).toBeGreaterThanOrEqual(0);
      expect(piece.top).toBeGreaterThanOrEqual(0);
      expect(piece.left + piece.width).toBeLessThanOrEqual(390);
      expect(piece.top + piece.height).toBeLessThanOrEqual(844);
    }
  });

  it('uses 60 pieces spread across the full screen for the 3x burst', () => {
    const pieces = makeGoalConfetti(390, 844, GOAL_CONFETTI_SPARSE_PIECE_COUNT);
    expect(pieces).toHaveLength(60);
    const quarters = [0, 0, 0, 0];
    for (const piece of pieces) {
      quarters[Math.min(3, Math.floor((piece.top / 844) * 4))] += 1;
    }
    for (const count of quarters) expect(count).toBeGreaterThan(10);
  });

  it('covers the whole screen rather than clumping in one band', () => {
    const pieces = makeGoalConfetti(390, 844);
    // Four vertical quarters: the burst has to read as "everywhere".
    const quarters = [0, 0, 0, 0];
    for (const piece of pieces) {
      quarters[Math.min(3, Math.floor((piece.top / 844) * 4))] += 1;
    }
    for (const count of quarters) expect(count).toBeGreaterThan(15);
  });

  it('survives a degenerate window without producing negative offsets', () => {
    for (const piece of makeGoalConfetti(0, 0)) {
      expect(piece.left).toBeGreaterThanOrEqual(0);
      expect(piece.top).toBeGreaterThanOrEqual(0);
    }
  });
});
