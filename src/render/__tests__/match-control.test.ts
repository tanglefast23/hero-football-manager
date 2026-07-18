import { matchPoliciesForControlledTeam, retainedCarrierIndex } from '../match-control';

describe('retainedCarrierIndex', () => {
  it('holds the last carrier through passes, shots, and loose-ball frames', () => {
    let displayed: number | null = null;
    displayed = retainedCarrierIndex(9, displayed);
    expect(displayed).toBe(9);
    displayed = retainedCarrierIndex(-1, displayed);
    expect(displayed).toBe(9);
    displayed = retainedCarrierIndex(-1, displayed);
    expect(displayed).toBe(9);
    displayed = retainedCarrierIndex(5, displayed);
    expect(displayed).toBe(5);
  });
});

describe('matchPoliciesForControlledTeam', () => {
  it('keeps a watched home side manual and the opponent automatic', () => {
    expect(matchPoliciesForControlledTeam(0)).toEqual({
      homePolicy: 'SAVE_FOR_TAP',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 0,
      homeFormation: '4-4-2',
    });
  });

  it('keeps a watched away side manual without reversing fixture order', () => {
    expect(matchPoliciesForControlledTeam(1)).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'SAVE_FOR_TAP',
      controlledTeam: 1,
      awayFormation: '4-4-2',
    });
  });

  it('keeps both teams automatic when the controlled side enables Auto Powers', () => {
    expect(matchPoliciesForControlledTeam(1, true, '4-3-3')).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 1,
      awayFormation: '4-3-3',
    });
  });
});
