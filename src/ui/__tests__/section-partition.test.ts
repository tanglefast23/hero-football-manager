import { balancedSplitIndex } from '../layout/section-partition';

describe('balancedSplitIndex', () => {
  it('returns 0 for no sections', () => {
    expect(balancedSplitIndex([])).toBe(0);
  });

  it('puts a lone section in the first column', () => {
    expect(balancedSplitIndex([5])).toBe(1);
  });

  it('splits an equal pair evenly', () => {
    expect(balancedSplitIndex([1, 1])).toBe(1);
  });

  it('prefers the taller first column on ties', () => {
    expect(balancedSplitIndex([1, 1, 1])).toBe(2);
  });

  it('keeps a heavy leading section alone in column one', () => {
    expect(balancedSplitIndex([5, 1, 1])).toBe(1);
  });

  it('never strands a heavy trailing section by overfilling column one', () => {
    expect(balancedSplitIndex([1, 1, 5])).toBe(2);
  });

  it('balances a realistic club-home mix', () => {
    // next match 7 · inbox 6 · board ultimatum 10 · table 12 → [7,6]=13 vs [10,12]=22
    // is the closest whole-section split (13 vs 22 beats 23 vs 12).
    expect(balancedSplitIndex([7, 6, 10, 12])).toBe(2);
  });
});
