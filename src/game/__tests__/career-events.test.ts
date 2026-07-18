import { createLaunchCareerSetup } from '../../application/launch';
import { advanceWeek, createCareer } from '../career';
import {
  applyCareerEventOutcome,
  chooseAwakeningPower,
  dismissCareerEvent,
  offerCareerEvent,
  selectCareerEventPlayer,
} from '../career-events';

describe('content-driven awakening powers', () => {
  it('selects deterministically from the content order without mutating it', () => {
    const powers = Object.freeze(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'] as const);

    expect(chooseAwakeningPower(powers, 0)).toBe('SUPER_SPEED');
    expect(chooseAwakeningPower(powers, 1)).toBe('SUPER_STRENGTH');
    expect(chooseAwakeningPower(powers, 2)).toBe('FIRE_TORCH');
    expect(powers).toEqual(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']);
  });

  it('rejects empty, duplicate, unknown, and out-of-range selections', () => {
    expect(() => chooseAwakeningPower([], 0)).toThrow('at least one power');
    expect(() => chooseAwakeningPower(['SUPER_SPEED', 'SUPER_SPEED'], 0)).toThrow('duplicate');
    expect(() => chooseAwakeningPower(['NOT_A_POWER' as 'SUPER_SPEED'], 0)).toThrow('unknown');
    expect(() => chooseAwakeningPower(['SUPER_SPEED'], -1)).toThrow('integer from 0 to 0');
    expect(() => chooseAwakeningPower(['SUPER_SPEED'], 1)).toThrow('integer from 0 to 0');
  });
});

describe('career event state', () => {
  it('persists the selected player, applies effects, and closes a resolved event', () => {
    const initial = createCareer(createLaunchCareerSetup());
    const playerId = 'bramble-rovers-p13';
    const pending = selectCareerEventPlayer(
      offerCareerEvent(initial, 'spider-training-day'),
      playerId,
    );
    const resolved = applyCareerEventOutcome(
      pending,
      'approach-spider',
      'A heroic bite requires two weeks of ice packs.',
      {
        moneyDelta: -100,
        fanDelta: 20,
        flags: ['spider-adopted'],
        playerEffect: { playerId, injuryWeeks: 2, moraleDelta: 5, attribute: 'pac', attributeDelta: 2 },
      },
    );

    expect(resolved.pendingEvent).toMatchObject({
      eventId: 'spider-training-day',
      selectedPlayerId: playerId,
      resolvedChoiceId: 'approach-spider',
    });
    expect(resolved.players.find(player => player.id === playerId)).toMatchObject({
      injuryWeeks: 2,
      morale: 55,
      attrs: { pac: 67 },
    });
    expect(resolved.eventFlags).toContain('spider-adopted');

    const dismissed = dismissCareerEvent(resolved);
    expect(dismissed.pendingEvent).toBeUndefined();
    expect(dismissed.resolvedEventIds).toContain('spider-training-day');
    expect(() => offerCareerEvent(dismissed, 'spider-training-day')).toThrow('already resolved');
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
