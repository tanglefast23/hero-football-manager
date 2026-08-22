import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  applyCareerContractPromise,
  careerContractPromiseBlockedReason,
  ContractPromiseBlockedError,
  hasActiveCareerContractPromise,
  reclaimableHeroLicenseHolders,
  restoreCareerContractPromiseLineup,
} from '../contract-promises';
import {
  buildCareerTeamDef,
  careerHeroLimit,
  reconcileCareerLineupLicenses,
  selectCareerLicensedHeroes,
  setCareerLineup,
} from '../squad';
import type { CareerPlayer, GameState } from '../types';

function career(seed: number) {
  return createCareer(createLaunchCareerSetup(seed));
}

describe('career contract promises', () => {
  test('a guaranteed starter is inserted and cannot be benched while fit', () => {
    const state = career(9401);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const starterSet = new Set(lineup.playerIds);
    const reserve = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        !starterSet.has(player.id) &&
        player.role !== 'GK',
    )!;
    const promised = applyCareerContractPromise(
      state,
      reserve.id,
      'GUARANTEED_STARTER',
    );
    const promisedLineup = promised.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;

    expect(promisedLineup.playerIds).toContain(reserve.id);
    expect(
      hasActiveCareerContractPromise(
        promised.players.find((player) => player.id === reserve.id)!,
        'GUARANTEED_STARTER',
      ),
    ).toBe(true);
    expect(() => setCareerLineup(promised, lineup.playerIds)).toThrow(
      `${reserve.name} was promised a place in the starting XI`,
    );

    const injured = {
      ...promised,
      players: promised.players.map((player) =>
        player.id === reserve.id ? { ...player, injuryWeeks: 2 } : player,
      ),
    };
    expect(
      setCareerLineup(injured, lineup.playerIds).lineups.find(
        (candidate) => candidate.clubId === state.userClubId,
      )?.playerIds,
    ).toEqual(lineup.playerIds);
  });

  test('a guaranteed starter replaces the weakest same-role player by role overall', () => {
    const state = career(9405);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const starterSet = new Set(lineup.playerIds);
    const starters = lineup.playerIds.map((id) =>
      state.players.find((player) => player.id === id)!,
    );
    const sameRolePair = starters.flatMap((player, index) =>
      player.role === 'GK'
        ? []
        : starters
            .slice(index + 1)
            .filter((candidate) => candidate.role === player.role)
            .map((candidate) => [player, candidate] as const),
    )[0];
    if (sameRolePair === undefined)
      throw new Error('expected two same-role outfield starters');
    const reserve = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        !starterSet.has(player.id) &&
        player.role !== 'GK',
    );
    if (reserve === undefined) throw new Error('expected an outfield reserve');
    const [weaker, stronger] = sameRolePair;
    const roleAware = {
      ...state,
      players: state.players.map((player) => {
        if (player.id === weaker.id) {
          return {
            ...player,
            attrs: {
              pac: 20,
              sho: 20,
              pas: 20,
              def: 20,
              tec: 20,
              sta: 20,
              ref: 99,
            },
          };
        }
        if (player.id === stronger.id) {
          return {
            ...player,
            attrs: {
              pac: 30,
              sho: 30,
              pas: 30,
              def: 30,
              tec: 30,
              sta: 30,
              ref: 1,
            },
          };
        }
        return player.id === reserve.id
          ? { ...player, role: weaker.role }
          : player;
      }),
    };

    const promised = applyCareerContractPromise(
      roleAware,
      reserve.id,
      'GUARANTEED_STARTER',
    );
    const promisedIds = promised.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!.playerIds;

    // The weaker player's irrelevant REF makes their raw seven-stat total
    // larger, so this catches regressions back to role-unaware replacement.
    expect(promisedIds).toContain(reserve.id);
    expect(promisedIds).not.toContain(weaker.id);
    expect(promisedIds).toContain(stronger.id);
  });

  test('a starting promise never replaces a player from another role', () => {
    const state = career(9406);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const starters = new Set(lineup.playerIds);
    const reserve = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        !starters.has(player.id) &&
        player.role !== 'GK',
    )!;
    const noMatchingSlot: GameState = {
      ...state,
      players: state.players.map((player) => {
        if (player.id === reserve.id) {
          return {
            ...player,
            role: 'FWD' as const,
            contractSeasonsRemaining: 2,
            contractPromise: {
              perk: 'GUARANTEED_STARTER' as const,
              agreedSeason: state.season,
            },
          };
        }
        return starters.has(player.id) && player.role === 'FWD'
          ? { ...player, role: 'DEF' as const }
          : player;
      }),
    };

    const restored = restoreCareerContractPromiseLineup(noMatchingSlot);

    expect(
      restored.lineups.find(
        (candidate) => candidate.clubId === restored.userClubId,
      )?.playerIds,
    ).not.toContain(reserve.id);
    expect(() =>
      setCareerLineup(noMatchingSlot, lineup.playerIds),
    ).not.toThrow();
  });

  test('captaincy and shirt ten are unique, persisted player roles', () => {
    const state = career(9402);
    const roster = state.players.filter(
      (player) => player.clubId === state.userClubId,
    );
    const captain = applyCareerContractPromise(
      state,
      roster[0].id,
      'CAPTAINCY',
    );
    const shirtTen = applyCareerContractPromise(
      captain,
      roster[1].id,
      'JERSEY_10',
    );
    const replacedCaptain = applyCareerContractPromise(
      shirtTen,
      roster[2].id,
      'CAPTAINCY',
    );

    expect(
      replacedCaptain.players
        .filter((player) => player.isCaptain === true)
        .map((player) => player.id),
    ).toEqual([roster[2].id]);
    expect(
      replacedCaptain.players
        .filter((player) => player.shirtNumber === 10)
        .map((player) => player.id),
    ).toEqual([roster[1].id]);
    expect(
      replacedCaptain.players.find((player) => player.id === roster[1].id)
        ?.contractPromise,
    ).toEqual({ perk: 'JERSEY_10', agreedSeason: state.season });
  });

  test('training priority persists as a promise with no slot side effects', () => {
    const state = career(9403);
    const trainee = state.players.find(
      (player) => player.clubId === state.userClubId,
    )!;

    const promised = applyCareerContractPromise(
      state,
      trainee.id,
      'TRAINING_PRIORITY',
    );

    // Drills resolve instantly on tap now, so the promise needs no slot,
    // bump prompt, or plan mutation to already be true for everyone.
    expect(
      hasActiveCareerContractPromise(
        promised.players.find((player) => player.id === trainee.id)!,
        'TRAINING_PRIORITY',
      ),
    ).toBe(true);
    expect(promised.lineups).toEqual(state.lineups);
  });

  test('a promised hero uses an available license and never creates an invalid lineup', () => {
    const state = career(9404);
    const lineup = state.lineups.find(
      (candidate) => candidate.clubId === state.userClubId,
    )!;
    const starters = new Set(lineup.playerIds);
    const reserve = state.players.find(
      (player) =>
        player.clubId === state.userClubId &&
        !starters.has(player.id) &&
        player.role !== 'GK',
    )!;
    const powered = {
      ...state,
      players: state.players.map((player) =>
        player.id === reserve.id
          ? { ...player, power: 'SUPER_SPEED' as const, licensed: false }
          : { ...player, licensed: false },
      ),
    };
    const promised = applyCareerContractPromise(
      powered,
      reserve.id,
      'GUARANTEED_STARTER',
    );

    expect(
      promised.players.find((player) => player.id === reserve.id)?.licensed,
    ).toBe(true);
    expect(
      promised.lineups.find(
        (candidate) => candidate.clubId === state.userClubId,
      )?.playerIds,
    ).toContain(reserve.id);
  });

  describe('hero license reclaim', () => {
    /**
     * A squad whose Hero License cap is full, with every license on a starter.
     * `heroIds[0]` is unpromised (so reclaimable) and `heroIds[1]` is promised
     * a starting place (so protected).
     */
    function fullLicenseCap(seed: number) {
      const state = career(seed);
      const limit = careerHeroLimit(state);
      const lineup = state.lineups.find(
        (candidate) => candidate.clubId === state.userClubId,
      )!;
      const starterSet = new Set(lineup.playerIds);
      const heroIds = state.players
        .filter(
          (player) =>
            player.clubId === state.userClubId &&
            starterSet.has(player.id) &&
            player.role !== 'GK',
        )
        .slice(0, limit)
        .map((player) => player.id);
      expect(heroIds).toHaveLength(limit);
      const withHeroes: GameState = {
        ...state,
        players: state.players.map((player) =>
          heroIds.includes(player.id)
            ? {
                ...player,
                power: 'SUPER_SPEED' as const,
                powerTier: 1 as const,
                licensed: true,
              }
            : player,
        ),
      };
      const signing = withHeroes.players.find(
        (player) =>
          player.clubId === withHeroes.userClubId &&
          !starterSet.has(player.id) &&
          player.role !== 'GK',
      )!;
      const incoming: CareerPlayer = {
        ...signing,
        power: 'THUNDER_STRIKE',
        powerTier: 1,
        licensed: false,
        contractSeasonsRemaining: 2,
      };
      return {
        limit,
        heroIds,
        state: {
          ...withHeroes,
          players: withHeroes.players.map((player) =>
            player.id === incoming.id ? incoming : player,
          ),
        } satisfies GameState,
        incoming,
      };
    }

    /** Protects `playerId` behind a starting promise the club has already made. */
    function promiseStarter(state: GameState, playerId: string): GameState {
      return {
        ...state,
        players: state.players.map((player) =>
          player.id === playerId
            ? {
                ...player,
                contractSeasonsRemaining: 2,
                contractPromise: {
                  perk: 'GUARANTEED_STARTER' as const,
                  agreedSeason: state.season,
                },
              }
            : player,
        ),
      };
    }

    test('offers only unpromised license holders, weakest first', () => {
      const { state, heroIds, incoming } = fullLicenseCap(9411);
      const protectedState = promiseStarter(state, heroIds[1]);
      const holders = reclaimableHeroLicenseHolders(protectedState, incoming);

      expect(holders.map((holder) => holder.id)).toEqual([heroIds[0]]);
    });

    test('a rival hero does not count as already licensed', () => {
      const { state, limit, incoming } = fullLicenseCap(9412);
      // Every AI-club hero carries `licensed: true`, because the generated
      // squads mint their own. Reading that flag bare let a Starter promise
      // reach ACCEPTED with the cap full, and completion then threw the deal
      // away -- so the panel reset as though the manager had never spoken.
      const rival = state.players.find(
        (player) =>
          player.clubId !== state.userClubId && player.power !== undefined,
      )!;
      expect(rival.licensed).toBe(true);
      expect(
        reclaimableHeroLicenseHolders(state, rival).length,
      ).toBeGreaterThan(0);
      expect(
        state.players.filter(
          (player) => player.clubId === state.userClubId && player.licensed,
        ),
      ).toHaveLength(limit);
      expect(incoming.licensed).toBe(false);
    });

    test('benches the chosen holder and starts the newly promised hero', () => {
      const { state, heroIds, incoming } = fullLicenseCap(9413);
      const originalLineup = state.lineups.find(
        (candidate) => candidate.clubId === state.userClubId,
      )!;
      const reclaimedSlot = originalLineup.playerIds.indexOf(heroIds[0]);
      const promised = applyCareerContractPromise(
        state,
        incoming.id,
        'GUARANTEED_STARTER',
        undefined,
        heroIds[0],
      );
      const lineup = promised.lineups.find(
        (candidate) => candidate.clubId === promised.userClubId,
      )!;

      expect(
        promised.players.find((player) => player.id === heroIds[0])?.licensed,
      ).toBe(false);
      expect(
        promised.players.find((player) => player.id === incoming.id)?.licensed,
      ).toBe(true);
      expect(lineup.playerIds).not.toContain(heroIds[0]);
      expect(lineup.playerIds).toContain(incoming.id);
      expect(lineup.playerIds[reclaimedSlot]).toBe(incoming.id);
      expect(() =>
        buildCareerTeamDef(promised, promised.userClubId),
      ).not.toThrow();
    });

    test('reclaiming a bench license does not invent a second handoff', () => {
      const { state, heroIds, incoming } = fullLicenseCap(9419);
      const lineup = state.lineups.find(
        (candidate) => candidate.clubId === state.userClubId,
      )!;
      const starterSet = new Set(lineup.playerIds);
      const benchHolder = state.players.find(
        (player) =>
          player.clubId === state.userClubId &&
          !starterSet.has(player.id) &&
          player.id !== incoming.id &&
          player.role !== 'GK',
      )!;
      const withBenchHolder: GameState = {
        ...state,
        players: state.players.map((player) => {
          if (player.id === heroIds[0]) {
            return { ...player, power: undefined, licensed: false };
          }
          return player.id === benchHolder.id
            ? {
                ...player,
                power: 'SUPER_SPEED' as const,
                powerTier: 1 as const,
                licensed: true,
              }
            : player;
        }),
      };

      const promised = applyCareerContractPromise(
        withBenchHolder,
        incoming.id,
        'GUARANTEED_STARTER',
        undefined,
        benchHolder.id,
      );
      const promisedIds = promised.lineups.find(
        (candidate) => candidate.clubId === promised.userClubId,
      )!.playerIds;

      expect(
        promised.players.find((player) => player.id === benchHolder.id)
          ?.licensed,
      ).toBe(false);
      expect(
        promised.players.find((player) => player.id === heroIds[1])?.licensed,
      ).toBe(true);
      expect(promisedIds).toContain(heroIds[1]);
      expect(promisedIds).toContain(incoming.id);
      expect(
        promisedIds.filter((id) => !lineup.playerIds.includes(id)),
      ).toEqual([incoming.id]);
    });

    test('refuses a promised holder as the source of the license', () => {
      const { state, heroIds, incoming } = fullLicenseCap(9414);
      const protectedState = promiseStarter(state, heroIds[1]);

      expect(() =>
        applyCareerContractPromise(
          protectedState,
          incoming.id,
          'GUARANTEED_STARTER',
          undefined,
          heroIds[1],
        ),
      ).toThrow('requires an available Hero License');
    });

    test('blocks the promise outright once every holder is protected', () => {
      const { state, heroIds, limit, incoming } = fullLicenseCap(9415);
      const allProtected = heroIds.reduce(promiseStarter, state);

      expect(reclaimableHeroLicenseHolders(allProtected, incoming)).toEqual([]);
      expect(
        careerContractPromiseBlockedReason(
          allProtected,
          incoming,
          'GUARANTEED_STARTER',
          limit,
        )?.key,
      ).toBe('market.promiseBlockedHeroLicense');
    });

    test('leaves an unlicensed promised hero on the bench rather than in the XI', () => {
      const state = career(9416);
      const lineup = state.lineups.find(
        (candidate) => candidate.clubId === state.userClubId,
      )!;
      const starterSet = new Set(lineup.playerIds);
      const benched = state.players.find(
        (player) =>
          player.clubId === state.userClubId &&
          !starterSet.has(player.id) &&
          player.role !== 'GK',
      )!;
      const withPromise: GameState = {
        ...state,
        players: state.players.map((player) =>
          player.id === benched.id
            ? {
                ...player,
                power: 'SUPER_SPEED' as const,
                powerTier: 1 as const,
                licensed: false,
                contractSeasonsRemaining: 2,
                contractPromise: {
                  perk: 'GUARANTEED_STARTER' as const,
                  agreedSeason: state.season,
                },
              }
            : player,
        ),
      };
      const restored = restoreCareerContractPromiseLineup(withPromise);

      expect(
        restored.lineups.find(
          (candidate) => candidate.clubId === restored.userClubId,
        )?.playerIds,
      ).not.toContain(benched.id);
      expect(() =>
        buildCareerTeamDef(restored, restored.userClubId),
      ).not.toThrow();
    });

    test('benches a hero the moment their license is taken away', () => {
      const { state, heroIds } = fullLicenseCap(9417);
      const revoked = selectCareerLicensedHeroes(state, heroIds.slice(1));

      expect(
        revoked.lineups.find(
          (candidate) => candidate.clubId === revoked.userClubId,
        )?.playerIds,
      ).not.toContain(heroIds[0]);
      expect(() =>
        buildCareerTeamDef(revoked, revoked.userClubId),
      ).not.toThrow();
    });

    test.each([
      ['GUARANTEED_STARTER', 'GUARANTEED_STARTER'],
      ['CAPTAINCY', 'CAPTAINCY'],
    ] as const)(
      'names the active %s promise when its Hero License cannot be removed',
      (perk, keySuffix) => {
        const { state, heroIds } = fullLicenseCap(9419);
        const promised = {
          ...state,
          players: state.players.map((player) =>
            player.id === heroIds[0]
              ? {
                  ...player,
                  contractSeasonsRemaining: 2,
                  contractPromise: {
                    perk,
                    agreedSeason: state.season,
                  },
                }
              : player,
          ),
        } satisfies GameState;

        try {
          selectCareerLicensedHeroes(promised, heroIds.slice(1));
          throw new Error('expected Hero License removal to be blocked');
        } catch (error) {
          expect(error).toBeInstanceOf(ContractPromiseBlockedError);
          expect((error as ContractPromiseBlockedError).key).toBe(
            `store.heroLicensePromiseRequired.${keySuffix}`,
          );
          expect((error as ContractPromiseBlockedError).params).toMatchObject({
            season: state.season,
          });
        }
      },
    );

    test('repairs a legacy save that already strands an unlicensed starter', () => {
      const { state, heroIds } = fullLicenseCap(9418);
      // The shape an old save carries: license gone, shirt kept. Match launch
      // died on "must be licensed or benched" with nothing the player could do.
      const stranded: GameState = {
        ...state,
        players: state.players.map((player) =>
          player.id === heroIds[0] ? { ...player, licensed: false } : player,
        ),
      };
      expect(() => buildCareerTeamDef(stranded, stranded.userClubId)).toThrow(
        'must be licensed or benched',
      );

      const repaired = reconcileCareerLineupLicenses(stranded);
      expect(
        repaired.lineups.find(
          (candidate) => candidate.clubId === repaired.userClubId,
        )?.playerIds,
      ).not.toContain(heroIds[0]);
      expect(() =>
        buildCareerTeamDef(repaired, repaired.userClubId),
      ).not.toThrow();
      expect(reconcileCareerLineupLicenses(repaired)).toBe(repaired);
    });
  });
});
