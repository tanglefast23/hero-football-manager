import { createLaunchCareerSetup } from '../../application/launch';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';
import { createCareer, startNextSeason } from '../career';
import {
  applyBoardForcedSaleConsequences,
  boardForcedSaleAtDeadline,
} from '../board-ultimatum';
import {
  beginCareerTransferTalks,
  careerTransferTarget,
  sellCareerPlayer,
} from '../market-career';
import { synchronizeM2ActiveDivision } from '../m2-career';
import {
  aiClubHeroAssignments,
  generatedClubHeroCount,
  generatedClubPower,
} from '../power-catalog';
import { buildCareerMatchTeamDef } from '../squad';
import type { BoardUltimatumState, GameState } from '../types';

function saleSetup(full = false, twoD3Heroes = false) {
  const initial = createCareer(createLaunchCareerSetup(20261019));
  const starters = initial.lineups.find(
    (lineup) => lineup.clubId === initial.userClubId,
  )!.playerIds;
  const hero = initial.players.find(
    (player) =>
      player.clubId === initial.userClubId &&
      player.role === 'MID' &&
      !starters.includes(player.id),
  )!;
  const buyer = initial.clubs.find(
    (club) =>
      club.id !== initial.userClubId &&
      (!twoD3Heroes || generatedClubHeroCount(club.id, 3) === 2) &&
      !initial.players.some(
        (player) => player.clubId === club.id && player.power !== undefined,
      ),
  )!;
  const holders = initial.players
    .filter((player) => player.clubId === buyer.id && player.role === 'MID')
    .slice(0, 2)
    .map((player) => player.id);
  const state: GameState = {
    ...initial,
    clubs: initial.clubs.map((club) =>
      club.id === buyer.id ? { ...club, cash: 1_000_000 } : club,
    ),
    players: initial.players.map((player) =>
      player.id === hero.id
        ? {
            ...player,
            power: 'ICE_RINK',
            licensed: false,
            attrs: {
              pac: 200,
              sho: 200,
              pas: 200,
              def: 200,
              tec: 200,
              sta: 200,
              ref: 40,
            },
          }
        : full && holders.includes(player.id)
          ? { ...player, power: 'RALLY_CRY', licensed: true }
          : player,
    ),
  };
  return { state, heroId: hero.id, buyerId: buyer.id };
}

function finishSeason(
  state: GameState,
  promoteUser: boolean,
  buyerId = state.players.find((player) => player.ownsPower === true)!.clubId,
): GameState {
  return {
    ...state,
    phase: 'season-end',
    week: 30,
    players: state.players.map((player) =>
      player.clubId === state.userClubId
        ? { ...player, contractSeasonsRemaining: 3 }
        : player,
    ),
    fixtures: state.fixtures.map((fixture) => {
      const userHome = fixture.homeClubId === state.userClubId;
      const userAway = fixture.awayClubId === state.userClubId;
      const buyerHome = fixture.homeClubId === buyerId;
      const buyerAway = fixture.awayClubId === buyerId;
      const winner =
        userHome || userAway
          ? promoteUser
            ? state.userClubId
            : userHome
              ? fixture.awayClubId
              : fixture.homeClubId
          : buyerHome || buyerAway
            ? buyerId
            : undefined;
      return {
        ...fixture,
        status: 'played' as const,
        score:
          winner === undefined
            ? { homeGoals: 1, awayGoals: 1 }
            : {
                homeGoals: winner === fixture.homeClubId ? 3 : 0,
                awayGoals: winner === fixture.awayClubId ? 3 : 0,
              },
      };
    }),
  };
}

describe('AI transfer power identity', () => {
  test('keeps generated clubs unchanged and prevents an acquired ordinary player taking a power slot', () => {
    const state = createCareer(createLaunchCareerSetup(20261019));
    for (const division of state.m2!.pyramid.divisions) {
      for (const club of division.clubs) {
        if (club.id === state.userClubId) continue;
        let index = 0;
        const baseline = aiClubHeroAssignments(
          club.id,
          division.level,
          club.squad,
        );
        const withTransfer = aiClubHeroAssignments(club.id, division.level, [
          { id: 'former-user-player', role: 'MID' },
          ...club.squad,
        ]);
        for (const player of club.squad) {
          const eligible =
            player.role === 'MID' || player.role === 'FWD' ? index++ : -1;
          const expected =
            eligible >= 0 &&
            eligible < generatedClubHeroCount(club.id, division.level)
              ? generatedClubPower(club.id, eligible, player.role)
              : undefined;
          expect(baseline.get(player.id)).toEqual({
            ...(expected === undefined ? {} : { power: expected }),
            licensed: expected !== undefined,
          });
          expect(withTransfer.get(player.id)).toEqual(baseline.get(player.id));
        }
        expect(withTransfer.get('former-user-player')).toEqual({
          licensed: false,
        });
      }
    }
  });

  test('a full D2 ramp keeps native slots ahead of a powered arrival and a sold-back native keeps his index', () => {
    const initial = createCareer(createLaunchCareerSetup(20261019));
    const club = initial
      .m2!.pyramid.divisions.find((division) => division.level === 2)!
      .clubs.find(
        (candidate) => generatedClubHeroCount(candidate.id, 2) === 3,
      )!;
    const baseline = aiClubHeroAssignments(club.id, 2, club.squad);
    const assignments = aiClubHeroAssignments(club.id, 2, [
      { id: 'bought-powered-mid', role: 'MID', power: 'ICE_RINK' },
      ...club.squad,
    ]);
    for (const player of club.squad)
      expect(assignments.get(player.id)).toEqual(baseline.get(player.id));
    expect(assignments.get('bought-powered-mid')).toEqual({
      power: 'ICE_RINK',
      licensed: false,
    });
    const firstNativeHero = club.squad.find(
      (player) => baseline.get(player.id)?.power !== undefined,
    )!;
    const returned = aiClubHeroAssignments(
      club.id,
      2,
      club.squad.map((player) =>
        player.id === firstNativeHero.id
          ? { ...player, power: 'GUST' }
          : player,
      ),
    );
    expect(returned.get(firstNativeHero.id)).toEqual({
      power: 'GUST',
      licensed: true,
    });
    for (const player of club.squad.filter(
      (candidate) => candidate.id !== firstNativeHero.id,
    ))
      expect(returned.get(player.id)).toEqual(baseline.get(player.id));
  });

  test('keeps owned powers even when the club has more heroes than licenses', () => {
    const assignments = aiClubHeroAssignments('d5-club-01', 5, [
      { id: 'bought-1', role: 'MID', power: 'ICE_RINK' },
      { id: 'bought-2', role: 'FWD', power: 'THUNDER_STRIKE' },
      { id: 'bought-3', role: 'GK', power: 'GIANT_GK' },
    ]);
    expect([...assignments.values()]).toEqual([
      { power: 'ICE_RINK', licensed: true },
      { power: 'THUNDER_STRIKE', licensed: true },
      { power: 'GIANT_GK', licensed: false },
    ]);
  });

  test.each([false, true])(
    'normal sale licenses only when the buyer has room (full=%s)',
    (full) => {
      const { state, heroId, buyerId } = saleSetup(full);
      const sold = sellCareerPlayer(
        state,
        state.market!,
        heroId,
        buyerId,
      ).state;
      expect(sold.players.find((player) => player.id === heroId)).toMatchObject(
        {
          clubId: buyerId,
          power: 'ICE_RINK',
          ownsPower: true,
          licensed: !full,
        },
      );
      expect(() => buildCareerMatchTeamDef(sold, buyerId)).not.toThrow();
    },
  );

  test.each([false, true])(
    'forced sale uses the same ownership and licensing rule (full=%s)',
    (full) => {
      const { state, heroId, buyerId } = saleSetup(full);
      const ultimatum: BoardUltimatumState = {
        id: 'board-hero-identity-test',
        issuedSeason: state.season,
        issuedWeek: state.week,
        weeksRemaining: 1,
        targetCash: 0,
        consequence: 'FORCED_SALE',
        candidates: [
          {
            playerId: heroId,
            marketValue: 2,
            forcedSaleFee: 1,
            discountPercent: 30,
          },
        ],
      };
      const resolution = boardForcedSaleAtDeadline(state, ultimatum)!;
      expect(resolution.buyerClubId).toBe(buyerId);
      const sold = applyBoardForcedSaleConsequences(state, resolution);
      expect(sold.players.find((player) => player.id === heroId)).toMatchObject(
        {
          clubId: buyerId,
          power: 'ICE_RINK',
          ownsPower: true,
          licensed: !full,
        },
      );
      expect(() => buildCareerMatchTeamDef(sold, buyerId)).not.toThrow();
    },
  );

  test.each([false, true])(
    'keeps the power through save, sync, season start and %s active buyer',
    (activeBuyer) => {
      const { state, heroId, buyerId } = saleSetup();
      const sold = sellCareerPlayer(
        state,
        state.market!,
        heroId,
        buyerId,
      ).state;
      const synced = {
        ...sold,
        m2: synchronizeM2ActiveDivision(sold.m2!, {
          clubs: sold.clubs,
          players: sold.players,
        }),
      };
      const restored = parseStoredGameState(serializeGameState(synced));
      const next = startNextSeason(finishSeason(restored, activeBuyer));
      expect(next.clubs.some((club) => club.id === buyerId)).toBe(activeBuyer);
      const target = careerTransferTarget(next, heroId)!.player;
      expect(target).toMatchObject({
        power: 'ICE_RINK',
        ownsPower: true,
        licensed: true,
      });
      const team = buildCareerMatchTeamDef(next, buyerId);
      expect(team.players.find((player) => player.id === heroId)?.power).toBe(
        'ICE_RINK',
      );
    },
  );

  test('validates carried powers and still reads old saves without ownership fields', () => {
    const { state, heroId, buyerId } = saleSetup();
    expect(parseStoredGameState(serializeGameState(state)).schemaVersion).toBe(
      state.schemaVersion,
    );
    const sold = sellCareerPlayer(state, state.market!, heroId, buyerId).state;
    const synced = {
      ...sold,
      m2: synchronizeM2ActiveDivision(sold.m2!, {
        clubs: sold.clubs,
        players: sold.players,
      }),
    };
    const invalid = JSON.parse(serializeGameState(synced));
    const player = invalid.m2.pyramid.divisions
      .flatMap(
        (division: { clubs: { squad: { id: string; power?: string }[] }[] }) =>
          division.clubs,
      )
      .flatMap(
        (club: { squad: { id: string; power?: string }[] }) => club.squad,
      )
      .find((candidate: { id: string }) => candidate.id === heroId);
    expect(player.power).toBe('ICE_RINK');
    player.power = 'INVALID_POWER';
    expect(() => parseStoredGameState(JSON.stringify(invalid))).toThrow();
  });

  test('keeps a legacy transfer power and a native player sold back to his original club', () => {
    const { state, heroId, buyerId } = saleSetup();
    const sold = sellCareerPlayer(state, state.market!, heroId, buyerId).state;
    const legacy = {
      ...sold,
      players: sold.players.map((player) =>
        player.id === heroId ? { ...player, ownsPower: undefined } : player,
      ),
    };
    const legacySynced = synchronizeM2ActiveDivision(legacy.m2!, {
      clubs: legacy.clubs,
      players: legacy.players,
    });
    expect(
      legacySynced.pyramid.divisions
        .flatMap((division) => division.clubs)
        .find((club) => club.id === buyerId)!
        .squad.find((player) => player.id === heroId)?.power,
    ).toBe('ICE_RINK');

    const nextLegacy = startNextSeason(
      finishSeason({ ...legacy, m2: legacySynced }, false, buyerId),
    );
    expect(careerTransferTarget(nextLegacy, heroId)!.player.power).toBe(
      'ICE_RINK',
    );

    const native = sold.players.find(
      (player) =>
        player.clubId === buyerId &&
        player.role === 'MID' &&
        player.id.startsWith(`${buyerId}-p`),
    )!;
    const returned = {
      ...sold,
      players: sold.players.map((player) =>
        player.id === native.id
          ? { ...player, power: 'GUST' as const, ownsPower: true as const }
          : player,
      ),
    };
    const returnedSynced = synchronizeM2ActiveDivision(returned.m2!, {
      clubs: returned.clubs,
      players: returned.players,
    });
    expect(
      returnedSynced.pyramid.divisions
        .flatMap((division) => division.clubs)
        .find((club) => club.id === buyerId)!
        .squad.find((player) => player.id === native.id)?.power,
    ).toBe('GUST');
  });

  test('a full D3 special host keeps native priority and benches its owned hero', () => {
    const { state, heroId, buyerId } = saleSetup(false, true);
    const sold = sellCareerPlayer(state, state.market!, heroId, buyerId).state;
    const d4 = startNextSeason(finishSeason(sold, true));
    const firstNativeMid = d4.players.find(
      (player) =>
        player.clubId === buyerId &&
        player.role === 'MID' &&
        player.id.startsWith(`${buyerId}-p`),
    )!;
    const strongestBuyer = {
      ...d4,
      players: d4.players.map((player) =>
        player.clubId === buyerId
          ? {
              ...player,
              attrs: {
                pac: 300,
                sho: 300,
                pas: 300,
                def: 300,
                tec: 300,
                sta: 300,
                ref: 300,
              },
            }
          : player,
      ),
    };
    const next = startNextSeason(finishSeason(strongestBuyer, true));
    expect(
      next.players.some(
        (player) =>
          player.clubId === buyerId && player.id.startsWith('special-'),
      ),
    ).toBe(true);
    expect(next.players.find((player) => player.id === heroId)).toMatchObject({
      power: 'ICE_RINK',
      ownsPower: true,
      licensed: false,
    });
    expect(
      next.players.find((player) => player.id === firstNativeMid.id),
    ).toMatchObject({
      power: generatedClubPower(buyerId, 0, 'MID'),
      licensed: true,
    });
    const team = buildCareerMatchTeamDef(next, buyerId);
    expect(team.players).toHaveLength(11);
    expect(team.players.some((player) => player.id === heroId)).toBe(false);
  });

  test.each([false, true])(
    'does not sell native cover based on a potentially unlicensed owned hero (active=%s)',
    (active) => {
      const { state, heroId, buyerId } = saleSetup(true);
      const sold = sellCareerPlayer(
        state,
        state.market!,
        heroId,
        buyerId,
      ).state;
      const nativeForwards = sold.players
        .filter((player) => player.clubId === buyerId && player.role === 'FWD')
        .slice(0, 2);
      const thin: GameState = {
        ...sold,
        players: sold.players
          .filter(
            (player) =>
              player.clubId !== buyerId ||
              player.role !== 'FWD' ||
              nativeForwards.some((native) => native.id === player.id),
          )
          .map((player) =>
            player.id === heroId
              ? { ...player, role: 'FWD', power: 'THUNDER_STRIKE' }
              : player,
          ),
      };
      expect(
        thin.players.find((player) => player.id === heroId)?.licensed,
      ).toBe(false);
      const next = startNextSeason(finishSeason(thin, false));
      const source = active ? thin : next;
      expect(source.clubs.some((club) => club.id === buyerId)).toBe(active);
      const target = careerTransferTarget(source, nativeForwards[0].id)!.player;
      const report = {
        playerId: target.id,
        role: target.role,
        age: target.age ?? 24,
        statRanges: Object.fromEntries(
          Object.entries(target.attrs).map(([key, value]) => [
            key,
            { minimum: value, maximum: value },
          ]),
        ) as never,
        potentialRange: { minimum: 3 as const, maximum: 3 as const },
      };
      expect(() =>
        beginCareerTransferTalks(
          source,
          { ...source.market!, scoutReports: [report] },
          target.id,
        ),
      ).toThrow('will not sell');
      expect(() => buildCareerMatchTeamDef(source, buyerId)).not.toThrow();
    },
  );
});
