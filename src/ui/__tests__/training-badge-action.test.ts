import { trainingBadgeAction } from '../training-badge-action';

describe('training badge action', () => {
  it('manages an already-assigned player without toggling', () => {
    expect(trainingBadgeAction(true, 3, 3)).toBe('manage');
    expect(trainingBadgeAction(true, 1, 3)).toBe('manage');
  });

  it('assigns and opens the drill picker while a slot is free', () => {
    expect(trainingBadgeAction(false, 0, 3)).toBe('assign-and-pick');
    expect(trainingBadgeAction(false, 2, 3)).toBe('assign-and-pick');
  });

  it('rejects a fourth player when every slot is taken', () => {
    expect(trainingBadgeAction(false, 3, 3)).toBe('reject-full');
  });
});
