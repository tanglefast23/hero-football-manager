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

    // Circuit 2 (+5 STA) is the best tier unlocked at a D5 start. Age 20 scales
    // by 1.5 (round(7.5) = 8), age 25 by 1.0.
    expect(young.after).toBe(58);
    expect(prime.after).toBe(55);
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
          buildings: [{ id: 'facility-1', type: 'gym' as const, level: 3 as const, x: 0, y: 0 }],
        },
      },
    };

    const result = trainWithoutSuper(state, playerId, 'circuit');

    // Circuit 2's +5 STA doubles under the Lv3 Gym to +10; Engine's 15% (150
    // hundredths) releases one whole point and banks 50. No growth wall at 90.
    expect(result.after).toBe(101);
    expect(result.state.players.find(p => p.id === playerId)?.trainingBonusRemainders?.sta).toBe(50);
  });

  test('banks fractional archetype bonuses until repeat drills earn a whole point', () => {
    const initial = createCareer({ ...createLaunchCareerSetup(90214) });
    const playerId = initial.players.find(player => player.clubId === initial.userClubId)!.id;
    // Anchor gives +15% DEF; a FWD earns no position bonus on DEF, and there is
    // no coach, so each +5 Duels 2 drill banks exactly 75 hundredths.
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

    expect(gains).toEqual([5, 6, 6]);
    expect(state.players.find(p => p.id === playerId)?.trainingBonusRemainders?.def).toBe(25);
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

  test('unlocks drill tiers from the permanent best division reached', () => {
    const initial = {
      ...createCareer({ ...createLaunchCareerSetup(90219) }),
      trainingPoints: 100,
    };

    // Tier 2 is open from the D5 start; only tier 3 still waits for a promotion.
    expect(trainingDrillBlockedReason(initial, 'sprints-ii')).toBeUndefined();

    // The active pyramid is still Division 5: the stored best division keeps
    // the earned tier unlocked after relegation.
    const reachedDivisionFour = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 4 as const },
    };
    expect(trainingDrillBlockedReason(reachedDivisionFour, 'sprints-ii')).toBeUndefined();
    expect(trainingDrillBlockedReason(reachedDivisionFour, 'sprints-iii'))
      .toBe('Tier 3 drills unlock in D2 · National Championship.');

    const reachedDivisionTwo = {
      ...initial,
      m2: { ...initial.m2!, highestDivisionReached: 2 as const },
    };
    expect(trainingDrillBlockedReason(reachedDivisionTwo, 'sprints-iii')).toBeUndefined();
  });
});
