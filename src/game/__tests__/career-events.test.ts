import { createLaunchCareerSetup } from '../../application/launch';
import { advanceWeek, createCareer } from '../career';
import {
  applyCareerEventOutcome,
  awakeningPowerRollSize,
  chooseStatWeightedAwakeningPower,
  dismissCareerEvent,
  offerCareerEvent,
  selectCareerEventPlayer,
} from '../career-events';

describe('content-driven awakening powers', () => {
  it('selects deterministically from stat-weighted ranges without mutating content', () => {
    const powers = Object.freeze(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'] as const);
    const attrs = { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 };

    expect(awakeningPowerRollSize(powers, attrs)).toBe(780);
    expect(chooseStatWeightedAwakeningPower(powers, attrs, 0)).toBe('SUPER_SPEED');
    expect(chooseStatWeightedAwakeningPower(powers, attrs, 260)).toBe('SUPER_STRENGTH');
    expect(chooseStatWeightedAwakeningPower(powers, attrs, 520)).toBe('FIRE_TORCH');
    expect(powers).toEqual(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']);
  });

  it('rejects empty, duplicate, unknown, and out-of-range selections', () => {
    const attrs = { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 };
    expect(() => chooseStatWeightedAwakeningPower([], attrs, 0)).toThrow('at least one power');
    expect(() => chooseStatWeightedAwakeningPower(['SUPER_SPEED', 'SUPER_SPEED'], attrs, 0)).toThrow('duplicate');
    expect(() => chooseStatWeightedAwakeningPower(['NOT_A_POWER' as 'SUPER_SPEED'], attrs, 0)).toThrow('unknown');
    expect(() => chooseStatWeightedAwakeningPower(['SUPER_SPEED'], attrs, -1)).toThrow('integer from 0 to 259');
    expect(() => chooseStatWeightedAwakeningPower(['SUPER_SPEED'], attrs, 260)).toThrow('integer from 0 to 259');
  });

  it('changes the likely power range when the player build changes', () => {
    const powers = ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'] as const;
    const speedBuild = { pac: 99, sho: 10, pas: 10, def: 10, tec: 10, sta: 10, ref: 10 };
    const strengthBuild = { pac: 10, sho: 10, pas: 10, def: 99, tec: 10, sta: 99, ref: 10 };
    const fireBuild = { pac: 10, sho: 99, pas: 10, def: 10, tec: 10, sta: 10, ref: 10 };

    expect(chooseStatWeightedAwakeningPower(powers, speedBuild, 250)).toBe('SUPER_SPEED');
    expect(chooseStatWeightedAwakeningPower(powers, strengthBuild, 250)).toBe('SUPER_STRENGTH');
    expect(chooseStatWeightedAwakeningPower(powers, fireBuild, 250)).toBe('FIRE_TORCH');
  });
});

describe('career event state', () => {
  it('persists the selected player, applies effects, and closes a resolved event', () => {
    const initial = createCareer(createLaunchCareerSetup());
    const playerId = 'bramble-rovers-p13';
    const pending = selectCareerEventPlayer(
      offerCareerEvent(initial, 'giant-spider-arrives'),
      playerId,
    );
    const resolved = applyCareerEventOutcome(
      pending,
      'adopt-spider',
      'The mascot meeting requires two weeks of ice packs.',
      {
        moneyDelta: -100,
        fanDelta: 20,
        flags: ['spider-adopted'],
        playerEffect: { playerId, injuryWeeks: 2, moraleDelta: 5, attribute: 'pac', attributeDelta: 2 },
      },
      { outcomeIndex: 0, risky: true, success: true, nextEventId: 'community-mural' },
    );

    expect(resolved.pendingEvent).toMatchObject({
      eventId: 'giant-spider-arrives',
      selectedPlayerId: playerId,
      resolvedChoiceId: 'adopt-spider',
      resolvedOutcomeIndex: 0,
      resolvedRisky: true,
      resolvedSuccess: true,
      resolvedNextEventId: 'community-mural',
    });
    expect(resolved.players.find(player => player.id === playerId)).toMatchObject({
      injuryWeeks: 2,
      morale: 55,
      attrs: { pac: 67 },
    });
    expect(resolved.eventFlags).toContain('spider-adopted');

    const dismissed = dismissCareerEvent(resolved);
    expect(dismissed.pendingEvent).toBeUndefined();
    expect(dismissed.resolvedEventIds).toContain('giant-spider-arrives');
    expect(dismissed.resolvedEventHistory).toEqual([
      { eventId: 'giant-spider-arrives', season: 1, week: 1 },
    ]);
    expect(() => offerCareerEvent(dismissed, 'giant-spider-arrives')).toThrow('already resolved');
  });

  it('recovers one injury week whenever a management week settles', () => {
    const initial = createCareer(createLaunchCareerSetup());
    const playerId = 'bramble-rovers-p13';
    const withInjury = applyCareerEventOutcome(
      selectCareerEventPlayer(offerCareerEvent(initial, 'test-event'), playerId),
      'risk',
      'Ouch.',
      { playerEffect: { playerId, injuryWeeks: 2 } },
    );
    const dismissed = dismissCareerEvent(withInjury);
    const next = advanceWeek(dismissed);
    expect(next.players.find(player => player.id === playerId)?.injuryWeeks).toBe(1);
  });
});
