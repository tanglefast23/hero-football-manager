import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { playerAttributeCaps } from '../archetype-caps';
import {
  applyCareerContractPromise,
  hasActiveCareerContractPromise,
  resolveTrainingPromiseBump,
} from '../contract-promises';
import { setCareerLineup } from '../squad';
import { setCareerTrainingPlan } from '../training';

function career(seed: number) {
  return createCareer(createLaunchCareerSetup(seed, undefined, undefined, 'full'));
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

  test('training priority is enforced by the repeating-plan boundary', () => {
    const state = career(9403);
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainable = roster.find(player => player.attrs.sta < playerAttributeCaps(player).sta);
    if (trainable === undefined) throw new Error('expected a player below their STA ceiling');
    const other = roster.find(player => player.id !== trainable.id)!;
    const priority = applyCareerContractPromise(state, trainable.id, 'TRAINING_PRIORITY');

    expect(() => setCareerTrainingPlan(priority, [{ playerId: other.id, pathId: 'circuit' }]))
      .toThrow(`${trainable.name} was promised training priority`);
    expect(setCareerTrainingPlan(priority, [{ playerId: trainable.id, pathId: 'circuit' }]).trainingPlan)
      .toMatchObject({ slots: [{ playerId: trainable.id, pathId: 'circuit' }] });
  });

  test('training priority auto-adds a slot on the biggest-room stat when the plan has room', () => {
    const state = career(9406);
    const trainee = state.players.find(player => player.clubId === state.userClubId)!;
    const withRoomAndWeakDef = {
      ...state,
      players: state.players.map(player => player.id === trainee.id
        ? {
            ...player,
            archetype: 'All-Rounder' as const,
            potentialCeiling: 90,
            attrs: { pac: 50, sho: 50, pas: 50, def: 10, tec: 50, sta: 50, ref: 50 },
          }
        : player),
      trainingPlan: { slots: [] },
    };

    const promised = applyCareerContractPromise(withRoomAndWeakDef, trainee.id, 'TRAINING_PRIORITY');

    expect(promised.trainingPlan?.slots).toEqual([{ playerId: trainee.id, pathId: 'duels' }]);
    expect(promised.pendingTrainingPromiseBump).toBeUndefined();
  });

  test('training priority sets a pending bump signal when the plan is already full', () => {
    const state = career(9407);
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = {
      ...roster[0],
      archetype: 'All-Rounder' as const,
      potentialCeiling: 90,
      attrs: { pac: 50, sho: 50, pas: 50, def: 10, tec: 50, sta: 50, ref: 50 },
    };
    const fullSlots = [
      { playerId: roster[1].id, pathId: 'sprints' },
      { playerId: roster[2].id, pathId: 'rondo' },
      { playerId: roster[3].id, pathId: 'first-touch' },
    ];
    const full = {
      ...state,
      players: state.players.map(player => player.id === trainee.id ? trainee : player),
      trainingPlan: { slots: fullSlots },
    };

    const promised = applyCareerContractPromise(full, trainee.id, 'TRAINING_PRIORITY');

    expect(promised.trainingPlan?.slots).toEqual(fullSlots);
    expect(promised.pendingTrainingPromiseBump).toEqual({ promisedPlayerId: trainee.id });
  });

  test('resolveTrainingPromiseBump frees the bumped slot for the promised player', () => {
    const state = career(9407);
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const trainee = {
      ...roster[0],
      archetype: 'All-Rounder' as const,
      potentialCeiling: 90,
      attrs: { pac: 50, sho: 50, pas: 50, def: 10, tec: 50, sta: 50, ref: 50 },
    };
    const fullSlots = [
      { playerId: roster[1].id, pathId: 'sprints' },
      { playerId: roster[2].id, pathId: 'rondo' },
      { playerId: roster[3].id, pathId: 'first-touch' },
    ];
    const full = {
      ...state,
      players: state.players.map(player => player.id === trainee.id ? trainee : player),
      trainingPlan: { slots: fullSlots },
    };
    const promised = applyCareerContractPromise(full, trainee.id, 'TRAINING_PRIORITY');

    const resolved = resolveTrainingPromiseBump(promised, roster[1].id);

    expect(resolved.pendingTrainingPromiseBump).toBeUndefined();
    expect(resolved.trainingPlan?.slots).toEqual([
      { playerId: roster[2].id, pathId: 'rondo' },
      { playerId: roster[3].id, pathId: 'first-touch' },
      { playerId: trainee.id, pathId: 'duels' },
    ]);
  });

  test('a fully-capped promised player does not raise a pending bump signal', () => {
    const state = career(9407);
    const roster = state.players.filter(player => player.clubId === state.userClubId);
    const cappedAttrs = { pac: 88, sho: 88, pas: 88, def: 88, tec: 88, sta: 88, ref: 88 };
    const trainee = {
      ...roster[0],
      archetype: 'All-Rounder' as const,
      potentialCeiling: 88,
      attrs: cappedAttrs,
    };
    const fullSlots = [
      { playerId: roster[1].id, pathId: 'sprints' },
      { playerId: roster[2].id, pathId: 'rondo' },
      { playerId: roster[3].id, pathId: 'first-touch' },
    ];
    const full = {
      ...state,
      players: state.players.map(player => player.id === trainee.id ? trainee : player),
      trainingPlan: { slots: fullSlots },
    };

    const promised = applyCareerContractPromise(full, trainee.id, 'TRAINING_PRIORITY');

    expect(promised.pendingTrainingPromiseBump).toBeUndefined();
    expect(promised.trainingPlan?.slots).toEqual(fullSlots);
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
