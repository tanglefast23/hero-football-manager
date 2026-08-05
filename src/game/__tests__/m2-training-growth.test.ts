import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { trainingDrillBlockedReason } from '../promotion-progression';
import { trainPlayerInstantly, type InstantDrillResolution } from '../training';
import type { GameState } from '../types';

/**
 * Retries the drill at successive RNG nonces until the SUPER roll misses, so
 * exact-value growth assertions are not disturbed by a lucky 1.5x session.
 */
function trainWithoutSuper(
  state: GameState,
  playerId: string,
  pathId: string,
): InstantDrillResolution {
  for (let nonce = state.totalInstantDrills ?? 0; nonce < 1_000; nonce += 1) {
    const result = trainPlayerInstantly({ ...state, totalInstantDrills: nonce }, playerId, pathId);
    if (!result.isSuper) return result;
  }
  throw new Error('no non-SUPER nonce found within 1000 attempts');
}

describe('M2 player-specific instant training growth', () => {
  test('applies the age curve to deliberate stamina training', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90210) });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const prepare = (age: number) => ({
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => player.id === playerId
        ? {
            ...player,
            age,
            archetype: 'All-Rounder' as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, sta: 50 },
          }
        : player),
    });

    const young = trainWithoutSuper(prepare(20), playerId, 'circuit');
    const prime = trainWithoutSuper(prepare(25), playerId, 'circuit');

    // Circuit 1 (+4 STA) is the tier every career owns from the start. Age 20
    // scales by 1.3 (round(5.2) = 5), age 25 by 1.0.
    expect(young.after).toBe(55);
    expect(prime.after).toBe(54);
  });

  test('uses the matching facility level without a high-stat growth wall', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90211) });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    const state = {
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => player.id === playerId
        ? {
            ...player,
            age: 25,
            role: 'FWD' as const,
            archetype: 'Engine' as const,
            potentialCeiling: 99,
            attrs: { ...player.attrs, sta: 90 },
          }
        : player),
      facilities: {
        ...initial.facilities,
        grid: {
          ...initial.facilities.grid!,
          nextBuildingId: 2,
          buildings: [{
            id: 'facility-1',
            type: 'gym' as const,
            level: 3 as const,
            capitalInvested: 32_000,
            x: 0,
            y: 0,
          }],
        },
      },
    };

    const result = trainWithoutSuper(state, playerId, 'circuit');

    // Circuit 1's +4 STA doubles under the Lv3 Gym to +8; Engine's 15% (120
    // hundredths) releases one whole point and banks 20. No growth wall at 90.
    expect(result.after).toBe(99);
    expect(result.state.players.find(p => p.id === playerId)?.trainingBonusRemainders?.sta).toBe(20);
  });

  test('banks fractional archetype bonuses until repeat drills earn a whole point', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90214) });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    // Anchor gives +15% DEF; a FWD earns no position bonus on DEF, and there is
    // no coach, so each +4 Duels 1 drill banks exactly 60 hundredths.
    let state: GameState = {
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => player.id === playerId
        ? {
            ...player,
            age: 25,
            role: 'FWD' as const,
            archetype: 'Anchor' as const,
            potentialCeiling: 99,
            condition: 100,
            attrs: { ...player.attrs, def: 50 },
          }
        : player),
      market: undefined,
    };
    const gains: number[] = [];
    for (let drill = 0; drill < 3; drill += 1) {
      const result = trainWithoutSuper(state, playerId, 'duels');
      gains.push(result.after - result.before);
      state = { ...result.state, players: result.state.players.map(p => p.id === playerId
        ? { ...p, condition: 100 }
        : p) };
    }

    expect(gains).toEqual([4, 5, 4]);
    expect(state.players.find(p => p.id === playerId)?.trainingBonusRemainders?.def).toBe(80);
  });

  test('allows gains through 99 and stops only at the universal 999 ceiling', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90213) });
    const roster = initial.players.filter(player => player.clubId === initial.userClubId);
    const state = {
      ...initial,
      trainingPoints: 100,
      players: initial.players.map(player => {
        if (player.id === roster[0].id) {
          return { ...player, age: 20, attrs: { ...player.attrs, sho: 98 } };
        }
        if (player.id === roster[1].id) {
          return { ...player, age: 20, attrs: { ...player.attrs, sho: 998 } };
        }
        return player;
      }),
    };

    const growing = trainWithoutSuper(state, roster[0].id, 'finishing');
    expect(growing.after).toBeGreaterThan(99);

    const maximum = trainWithoutSuper(state, roster[1].id, 'finishing');
    expect(maximum.after).toBe(999);
  });

  test('puts one drill tier on sale per division reached', () => {
    const initial = {
      ...createCareer({ ...createLaunchCareerSetup(90219) }),
      trainingPoints: 100,
    };

    // Tier 1 is owned from the D5 start; tier 2 waits for the first promotion.
    expect(trainingDrillBlockedReason(initial, 'sprints')).toBeUndefined();
    expect(trainingDrillBlockedReason(initial, 'sprints-ii'))
      .toBe('Tier 2 drills unlock in D4 · County League.');

    // The active pyramid is still Division 5: the stored best division keeps
    // an earned tier on the shelf after relegation.
    const reachedDivisionFour = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 4 as const },
    };
    expect(trainingDrillBlockedReason(reachedDivisionFour, 'sprints-ii')).toBeUndefined();
    expect(trainingDrillBlockedReason(reachedDivisionFour, 'sprints-iii'))
      .toBe('Tier 3 drills unlock in D3 · Regional League.');

    const reachedDivisionTwo = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 2 as const },
    };
    expect(trainingDrillBlockedReason(reachedDivisionTwo, 'sprints-iv')).toBeUndefined();
    expect(trainingDrillBlockedReason(reachedDivisionTwo, 'sprints-v'))
      .toBe('Tier 5 drills unlock in D1 · Global League.');
  });
});
