import {
  maximumAffordableTrainingRuns,
  maximumSafeTrainingRuns,
  riskyTrainingRunCount,
} from '../training-repeat';

describe('repeat training safety', () => {
  it('only offers the drills the manager can afford, up to nine', () => {
    expect(maximumAffordableTrainingRuns(80, 10)).toBe(8);
    expect(maximumAffordableTrainingRuns(100, 10)).toBe(9);
    expect(maximumAffordableTrainingRuns(9, 10)).toBe(0);
  });

  it('treats 30% as the last safe starting condition', () => {
    expect(maximumSafeTrainingRuns(29)).toBe(0);
    expect(maximumSafeTrainingRuns(30)).toBe(1);
    expect(maximumSafeTrainingRuns(37)).toBe(1);
    expect(maximumSafeTrainingRuns(38)).toBe(2);
    expect(maximumSafeTrainingRuns(100)).toBe(9);
  });

  it('counts each selected drill that starts below the safety line', () => {
    expect(riskyTrainingRunCount(46, 3)).toBe(0);
    expect(riskyTrainingRunCount(46, 4)).toBe(1);
    expect(riskyTrainingRunCount(29, 3)).toBe(3);
  });
});
