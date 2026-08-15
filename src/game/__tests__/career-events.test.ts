import { createLaunchCareerSetup } from '../../application/launch';
import { advanceWeek, createCareer } from '../career';
import {
  applyCareerEventOutcome,
  applyCareerFacilityFire,
  awakeningPowerRollSize,
  chooseStatWeightedAwakeningPower,
  dismissCareerEvent,
  offerCareerEvent,
  selectCareerEventPlayer,
} from '../career-events';
import type { GameState } from '../types';

describe('content-driven awakening powers', () => {
  it('selects deterministically from stat-weighted ranges without mutating content', () => {
    const powers = Object.freeze([
      'SUPER_SPEED',
      'SUPER_STRENGTH',
      'FIRE_TORCH',
    ] as const);
    const attrs = {
      pac: 50,
      sho: 50,
      pas: 50,
      def: 50,
      tec: 50,
      sta: 50,
      ref: 50,
    };

    expect(awakeningPowerRollSize(powers, attrs)).toBe(780);
    expect(chooseStatWeightedAwakeningPower(powers, attrs, 0)).toBe(
      'SUPER_SPEED',
    );
    expect(chooseStatWeightedAwakeningPower(powers, attrs, 260)).toBe(
      'SUPER_STRENGTH',
    );
    expect(chooseStatWeightedAwakeningPower(powers, attrs, 520)).toBe(
      'FIRE_TORCH',
    );
    expect(powers).toEqual(['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH']);
  });

  it('rejects empty, duplicate, unknown, and out-of-range selections', () => {
    const attrs = {
      pac: 50,
      sho: 50,
      pas: 50,
      def: 50,
      tec: 50,
      sta: 50,
      ref: 50,
    };
    expect(() => chooseStatWeightedAwakeningPower([], attrs, 0)).toThrow(
      'at least one power',
    );
    expect(() =>
      chooseStatWeightedAwakeningPower(
        ['SUPER_SPEED', 'SUPER_SPEED'],
        attrs,
        0,
      ),
    ).toThrow('duplicate');
    expect(() =>
      chooseStatWeightedAwakeningPower(
        ['NOT_A_POWER' as 'SUPER_SPEED'],
        attrs,
        0,
      ),
    ).toThrow('unknown');
    expect(() =>
      chooseStatWeightedAwakeningPower(['SUPER_SPEED'], attrs, -1),
    ).toThrow('integer from 0 to 259');
    expect(() =>
      chooseStatWeightedAwakeningPower(['SUPER_SPEED'], attrs, 260),
    ).toThrow('integer from 0 to 259');
  });

  it('changes the likely power range when the player build changes', () => {
    const powers = ['SUPER_SPEED', 'SUPER_STRENGTH', 'FIRE_TORCH'] as const;
    const speedBuild = {
      pac: 99,
      sho: 10,
      pas: 10,
      def: 10,
      tec: 10,
      sta: 10,
      ref: 10,
    };
    const strengthBuild = {
      pac: 10,
      sho: 10,
      pas: 10,
      def: 99,
      tec: 10,
      sta: 99,
      ref: 10,
    };
    const fireBuild = {
      pac: 10,
      sho: 99,
      pas: 10,
      def: 10,
      tec: 10,
      sta: 10,
      ref: 10,
    };

    expect(chooseStatWeightedAwakeningPower(powers, speedBuild, 250)).toBe(
      'SUPER_SPEED',
    );
    expect(chooseStatWeightedAwakeningPower(powers, strengthBuild, 250)).toBe(
      'SUPER_STRENGTH',
    );
    expect(chooseStatWeightedAwakeningPower(powers, fireBuild, 250)).toBe(
      'FIRE_TORCH',
    );
  });
});

describe('career event state', () => {
  it('burns two cheap small buildings safely or the highest-level fan shop', () => {
    const initial = createCareer(createLaunchCareerSetup());
    const grid = {
      ...initial.facilities.grid!,
      buildings: [
        {
          id: 'gym',
          type: 'gym' as const,
          level: 1 as const,
          capitalInvested: 7_000,
          x: 0,
          y: 0,
        },
        {
          id: 'dorm',
          type: 'dorm' as const,
          level: 1 as const,
          capitalInvested: 6_000,
          x: 1,
          y: 0,
        },
        {
          id: 'shop-low',
          type: 'fan-shop' as const,
          level: 1 as const,
          capitalInvested: 5_000,
          x: 2,
          y: 0,
        },
        {
          id: 'shop-high',
          type: 'fan-shop' as const,
          level: 3 as const,
          capitalInvested: 72_500,
          x: 3,
          y: 0,
        },
        {
          id: 'stand',
          type: 'stadium-stand' as const,
          level: 3 as const,
          capitalInvested: 110_000,
          x: 4,
          y: 0,
        },
      ],
    };
    const state = { ...initial, facilities: { ...initial.facilities, grid } };

    expect(
      applyCareerFacilityFire(
        state,
        'TWO_SMALL',
      ).facilities.grid?.buildings.map((building) => building.id),
    ).toEqual(['gym', 'shop-high', 'stand']);
    expect(
      applyCareerFacilityFire(state, 'PRIMARY').facilities.grid?.buildings.map(
        (building) => building.id,
      ),
    ).toEqual(['gym', 'dorm', 'shop-low', 'stand']);
  });

  it("holds an injured story starter's exact lineup slot for their return", () => {
    const initial = createCareer(createLaunchCareerSetup());
    const lineup = initial.lineups.find(
      (candidate) => candidate.clubId === initial.userClubId,
    )!;
    const slot = 6;
    const playerId = lineup.playerIds[slot];
    const resolved = applyCareerEventOutcome(
      selectCareerEventPlayer(
        offerCareerEvent(initial, 'test-career-event'),
        playerId,
      ),
      'risk',
      'Ouch.',
      { playerEffect: { playerId, injuryWeeks: 2 } },
    );

    expect(resolved.lineups[0].playerIds[slot]).not.toBe(playerId);
    expect(
      resolved.players.find((player) => player.id === playerId)
        ?.returnLineupSlot,
    ).toBe(slot);
  });

  it('persists the selected player, applies effects, and closes a resolved event', () => {
    const initial = createCareer(createLaunchCareerSetup());
    const playerId = 'bramble-rovers-p13';
    const pending = selectCareerEventPlayer(
      offerCareerEvent(initial, 'test-career-event'),
      playerId,
    );
    const resolved = applyCareerEventOutcome(
      pending,
      'test-risky-choice',
      'The event has a clear result.',
      {
        moneyDelta: -100,
        fanDelta: 20,
        flags: ['test-event-success'],
        playerEffect: {
          playerId,
          injuryWeeks: 2,
          moraleDelta: 5,
          attribute: 'pac',
          attributeDelta: 2,
        },
      },
      {
        outcomeIndex: 0,
        risky: true,
        success: true,
        nextEventId: 'community-mural',
      },
    );

    expect(resolved.pendingEvent).toMatchObject({
      eventId: 'test-career-event',
      selectedPlayerId: playerId,
      resolvedChoiceId: 'test-risky-choice',
      resolvedOutcomeIndex: 0,
      resolvedRisky: true,
      resolvedSuccess: true,
      resolvedNextEventId: 'community-mural',
    });
    expect(
      resolved.players.find((player) => player.id === playerId),
    ).toMatchObject({
      injuryWeeks: 2,
      morale: 55,
      attrs: { pac: 67 },
    });
    expect(resolved.eventFlags).toContain('test-event-success');

    const dismissed = dismissCareerEvent(resolved);
    expect(dismissed.pendingEvent).toBeUndefined();
    expect(dismissed.resolvedEventIds).toContain('test-career-event');
    expect(dismissed.resolvedEventHistory).toEqual([
      { eventId: 'test-career-event', season: 1, week: 1 },
    ]);
    expect(() => offerCareerEvent(dismissed, 'test-career-event')).toThrow(
      'already resolved',
    );
  });

  it('records event money in the cash-transaction history', () => {
    // Event cash used to mutate the balance silently, so the money history and
    // the pre-M4 recap fallback both misstated the season's cash change.
    const initial = createCareer(createLaunchCareerSetup());
    const cashBefore = initial.clubs.find(
      (club) => club.id === initial.userClubId,
    )!.cash;

    const spent = applyCareerEventOutcome(
      offerCareerEvent(initial, 'test-event'),
      'pay-up',
      'The club writes the cheque.',
      { moneyDelta: -1200 },
    );
    expect(spent.cashTransactions?.at(-1)).toMatchObject({
      kind: 'event',
      label: 'Story event',
      amount: -1200,
      balanceAfter: cashBefore - 1200,
      referenceId: 'test-event',
    });

    const paid = applyCareerEventOutcome(
      offerCareerEvent(initial, 'test-event'),
      'cash-in',
      'The sponsor pays out.',
      { moneyDelta: 4200 },
    );
    expect(paid.cashTransactions?.at(-1)).toMatchObject({
      kind: 'event',
      amount: 4200,
      balanceAfter: cashBefore + 4200,
    });

    // A money-free outcome writes no history line at all.
    const quiet = applyCareerEventOutcome(
      offerCareerEvent(initial, 'test-event'),
      'shrug',
      'Nothing changes hands.',
      { fanDelta: 5 },
    );
    expect(quiet.cashTransactions ?? []).toHaveLength(0);
  });

  it('floors a fan setback at zero instead of blocking a nearly abandoned club', () => {
    const initial = createCareer(createLaunchCareerSetup());
    const abandoned: GameState = {
      ...initial,
      clubs: initial.clubs.map((club) =>
        club.id === initial.userClubId ? { ...club, fans: 10 } : club,
      ),
    };
    const resolved = applyCareerEventOutcome(
      offerCareerEvent(abandoned, 'test-event'),
      'bait-whispering-agent',
      'The agent leaves with a grudge and takes some supporters with him.',
      { fanDelta: -25 },
    );

    expect(
      resolved.clubs.find((club) => club.id === resolved.userClubId)?.fans,
    ).toBe(0);
  });

  it('still refuses a training-point setback that outruns the balance', () => {
    const initial = createCareer(createLaunchCareerSetup());

    expect(() =>
      applyCareerEventOutcome(
        offerCareerEvent(initial, 'test-event'),
        'reckless',
        'That cost more than the club had.',
        { trainingPointDelta: -(initial.trainingPoints + 1) },
      ),
    ).toThrow('cannot make TP negative');
  });

  it('recovers one injury week whenever a management week settles', () => {
    const initial = createCareer(createLaunchCareerSetup());
    const playerId = 'bramble-rovers-p13';
    const withInjury = applyCareerEventOutcome(
      selectCareerEventPlayer(
        offerCareerEvent(initial, 'test-event'),
        playerId,
      ),
      'risk',
      'Ouch.',
      { playerEffect: { playerId, injuryWeeks: 2 } },
    );
    const dismissed = dismissCareerEvent(withInjury);
    const next = advanceWeek(dismissed);
    expect(
      next.players.find((player) => player.id === playerId)?.injuryWeeks,
    ).toBe(1);
  });
});
