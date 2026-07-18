import { nextMatchSpeed } from '../match-speed';

describe('watched-match playback speed', () => {
  it('cycles through 1x, 2x, and 3x', () => {
    expect(nextMatchSpeed(1)).toBe(2);
    expect(nextMatchSpeed(2)).toBe(3);
    expect(nextMatchSpeed(3)).toBe(1);
  });
});
