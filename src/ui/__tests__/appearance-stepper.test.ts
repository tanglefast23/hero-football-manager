import { stepChoice } from '../appearance-stepper';

describe('stepChoice', () => {
  it('wraps backward from the first option to the last', () => {
    expect(stepChoice(0, -1, 6)).toBe(5); // skin tone
    expect(stepChoice(0, -1, 7)).toBe(6); // hair
    expect(stepChoice(0, -1, 4)).toBe(3); // kit accent
  });

  it('wraps forward from the last option to the first', () => {
    expect(stepChoice(5, 1, 6)).toBe(0);
    expect(stepChoice(6, 1, 7)).toBe(0);
    expect(stepChoice(3, 1, 4)).toBe(0);
  });

  it('steps without wrapping in the middle of a range', () => {
    expect(stepChoice(2, 1, 6)).toBe(3);
    expect(stepChoice(2, -1, 6)).toBe(1);
  });
});
