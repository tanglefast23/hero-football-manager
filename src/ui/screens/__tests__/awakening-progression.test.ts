import {
  awakeningViewportHeight,
  nextAwakeningAction,
} from '../awakening-progression';

describe('awakening cutscene progression', () => {
  it('keeps the final story card as a usable way to leave the cutscene', () => {
    expect(nextAwakeningAction(1)).toBe(2);
    expect(nextAwakeningAction(2)).toBe(3);
    expect(nextAwakeningAction(3)).toBe('continue');
  });

  it('reserves room for the final action on the reported phone size', () => {
    expect(awakeningViewportHeight(393, 852)).toBeLessThanOrEqual(375);
  });
});
