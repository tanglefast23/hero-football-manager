import { matchPoliciesForControlledTeam } from '../match-control';

describe('matchPoliciesForControlledTeam', () => {
  it('keeps a watched home side manual and the opponent automatic', () => {
    expect(matchPoliciesForControlledTeam(0)).toEqual({
      homePolicy: 'SAVE_FOR_TAP',
      awayPolicy: 'FIRE_WHEN_READY',
    });
  });

  it('keeps a watched away side manual without reversing fixture order', () => {
    expect(matchPoliciesForControlledTeam(1)).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'SAVE_FOR_TAP',
    });
  });
});
