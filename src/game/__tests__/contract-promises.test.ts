import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  applyCareerContractPromise,
  hasActiveCareerContractPromise,
} from '../contract-promises';
import { setCareerLineup } from '../squad';

function career(seed: number) {
  return createCareer(createLaunchCareerSetup(seed));
}

describe('career contract promises', () => {
  test('a guaranteed starter is inserted and cannot be benched while fit', () => {
    const state = career(9401);
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const starterSet = new Set(lineup.playerIds);
    const reserve = state.players.find(player => (
      player.clubId === state.userClubId
      && !starterSet.has(player.id)
      && player.role !== 'GK'
    ))!;
    const promised = applyCareerContractPromise(state, reserve.id, 'GUARANTEED_STARTER');
    const promisedLineup = promised.lineups.find(candidate => candidate.clubId === state.userClubId)!;

    expect(promisedLineup.playerIds).toContain(reserve.id);
    expect(hasActiveCareerContractPromise(
      promised.players.find(player => player.id === reserve.id)!,
      'GUARANTEED_STARTER',
    )).toBe(true);
    expect(() => setCareerLineup(promised, lineup.playerIds))
      .toThrow(`${reserve.name} was promised a place in the starting XI`);

    const injured = {
      ...promised,
      players: promised.players.map(player => player.id === reserve.id
        ? { ...player, injuryWeeks: 2 }
        : player),
    };
    expect(setCareerLineup(injured, lineup.playerIds)
      .lineups.find(candidate => candidate.clubId === state.userClubId)?.playerIds)
      .toEqual(lineup.playerIds);
  });

  test('a guaranteed starter replaces the weakest same-role player by role overall', () => {
    const state = career(9405);
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const starterSet = new Set(lineup.playerIds);
    const starters = lineup.playerIds.map(id => state.players.find(player => player.id === id)!);
    const sameRolePair = starters.flatMap((player, index) => (
      player.role === 'GK'
        ? []
        : starters.slice(index + 1)
          .filter(candidate => candidate.role === player.role)
          .map(candidate => [player, candidate] as const)
    ))[0];
    if (sameRolePair === undefined) throw new Error('expected two same-role outfield starters');
    const reserve = state.players.find(player => (
      player.clubId === state.userClubId
      && !starterSet.has(player.id)
      && player.role !== 'GK'
    ));
    if (reserve === undefined) throw new Error('expected an outfield reserve');
    const [weaker, stronger] = sameRolePair;
    const roleAware = {
      ...state,
      players: state.players.map(player => {
        if (player.id === weaker.id) {
          return {
            ...player,
            attrs: { pac: 20, sho: 20, pas: 20, def: 20, tec: 20, sta: 20, ref: 99 },
          };
        }
        if (player.id === stronger.id) {
          return {
            ...player,
            attrs: { pac: 30, sho: 30, pas: 30, def: 30, tec: 30, sta: 30, ref: 1 },
          };
        }
        return player.id === reserve.id ? { ...player, role: weaker.role } : player;
      }),
    };

    const promised = applyCareerContractPromise(
      roleAware,
      reserve.id,
      'GUARANTEED_STARTER',
    );
    const promisedIds = promised.lineups.find(candidate => (
      candidate.clubId === state.userClubId
    ))!.playerIds;

    // The weaker player's irrelevant REF makes their raw seven-stat total
    // larger, so this catches regressions back to role-unaware replacement.
    expect(promisedIds).toContain(reserve.id);
    expect(promisedIds).not.toContain(weaker.id);
    expect(promisedIds).toContain(stronger.id);
  });

  test('captaincy and shirt ten are unique, persisted player roles', () => {
    const state = career(9402);
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const captain = applyCareerContractPromise(state, roster[0].id, 'CAPTAINCY');
    const shirtTen = applyCareerContractPromise(captain, roster[1].id, 'JERSEY_10');
    const replacedCaptain = applyCareerContractPromise(shirtTen, roster[2].id, 'CAPTAINCY');

    expect(replacedCaptain.players.filter(player => player.isCaptain === true).map(player => player.id))
      .toEqual([roster[2].id]);
    expect(replacedCaptain.players.filter(player => player.shirtNumber === 10).map(player => player.id))
      .toEqual([roster[1].id]);
    expect(replacedCaptain.players.find(player => player.id === roster[1].id)?.contractPromise)
      .toEqual({ perk: 'JERSEY_10', agreedSeason: state.season });
  });

  test('training priority persists as a promise with no slot side effects', () => {
    const state = career(9403);
    const trainee = state.players.find(player => player.clubId === state.userClubId)!;

    const promised = applyCareerContractPromise(state, trainee.id, 'TRAINING_PRIORITY');

    // Drills resolve instantly on tap now, so the promise needs no slot,
    // bump prompt, or plan mutation to already be true for everyone.
    expect(hasActiveCareerContractPromise(
      promised.players.find(player => player.id === trainee.id)!,
      'TRAINING_PRIORITY',
    )).toBe(true);
    expect(promised.lineups).toEqual(state.lineups);
  });

  test('a promised hero uses an available license and never creates an invalid lineup', () => {
    const state = career(9404);
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const starters = new Set(lineup.playerIds);
    const reserve = state.players.find(player => (
      player.clubId === state.userClubId
      && !starters.has(player.id)
      && player.role !== 'GK'
    ))!;
    const powered = {
      ...state,
      players: state.players.map(player => player.id === reserve.id
        ? { ...player, power: 'SUPER_SPEED' as const, licensed: false }
        : { ...player, licensed: false }),
    };
    const promised = applyCareerContractPromise(powered, reserve.id, 'GUARANTEED_STARTER');

    expect(promised.players.find(player => player.id === reserve.id)?.licensed).toBe(true);
    expect(promised.lineups.find(candidate => candidate.clubId === state.userClubId)?.playerIds)
      .toContain(reserve.id);
  });
});
