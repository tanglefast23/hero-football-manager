import { superTrainingChancePercent } from '../archetype-caps';

describe('superTrainingChancePercent', () => {
  it('is 5% at E- and 33% at A+', () => {
    expect(superTrainingChancePercent('E-')).toBe(5);
    expect(superTrainingChancePercent('A+')).toBe(33);
  });

  it('adds exactly 2 points per grade step', () => {
    expect(superTrainingChancePercent('E')).toBe(7);
    expect(superTrainingChancePercent('D-')).toBe(11);
    expect(superTrainingChancePercent('B-')).toBe(23);
  });
});
