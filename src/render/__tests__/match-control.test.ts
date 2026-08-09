import {
  matchPoliciesForControlledTeam,
  retainedCarrierIndex,
} from '../match-control';

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
  it('uses contextual automatic powers for a watched home side and its opponent', () => {
    expect(matchPoliciesForControlledTeam(0)).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 0,
      homeFormation: '4-4-2',
    });
  });

  it('uses contextual automatic powers for a watched away side without reversing fixture order', () => {
    expect(matchPoliciesForControlledTeam(1)).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 1,
      awayFormation: '4-4-2',
    });
  });

  it('keeps the selected opening formation while powers remain automatic', () => {
    expect(matchPoliciesForControlledTeam(1, '4-3-3')).toEqual({
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
      controlledTeam: 1,
      awayFormation: '4-3-3',
    });
  });
});
