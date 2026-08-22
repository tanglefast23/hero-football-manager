import { loadLaunchContent } from '../../content';
import { formationRoleForSlot } from '../../sim/tactics';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  startNextSeason,
} from '../career';
import {
  buildCareerMatchTeamDef,
  buildCareerTeamDef,
  arrangeCareerLineupForFormation,
  matchFormPercent,
  rosterForClub,
  buildTrainingGround,
  releaseCareerPlayer,
  renewCareerPlayer,
  repairCareerLineupForInjuries,
  selectCareerLicensedHeroes,
  setCareerLineup,
  swapCareerLineupPlayer,
  tryRepairCareerLineupForInjuries,
} from '../squad';
import { buildTeamDef } from '../lineup';
import { enableFullCareer } from '../full-career';
import { trainPlayerInstantly } from '../training';
import {
  BASE_WEEKLY_TRAINING_POINTS,
  TRAINING_PITCH_TP_PER_LEVEL,
} from '../facilities';
import type { CareerPlayer, CareerSetup, GameState } from '../types';

const CLUB_IDS = Array.from({ length: 10 }, (_, index) => `club-${index}`);

function makePlayer(clubId: string, index: number): CareerPlayer {
  const isUser = clubId === CLUB_IDS[0];
  const role =
    index === 0 ? 'GK' : index <= 4 ? 'DEF' : index <= 8 ? 'MID' : 'FWD';
  const power =
    isUser && index === 9
      ? 'SUPER_SPEED'
      : isUser && index === 10
        ? 'FIRE_TORCH'
        : isUser && index === 11
          ? 'SUPER_STRENGTH'
          : undefined;

  return {
    id: `${clubId}-p${index}`,
    clubId,
    name: `Player ${clubId}-${index}`,
    role,
    attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
    ...(power ? { power } : {}),
    licensed: power !== undefined && index !== 11,
    weeklyWage: 100,
    onHeroWage: false,
    contractSeasonsRemaining: 1,
    morale: 50,
    injuryWeeks: 0,
  };
}

function setup(): CareerSetup {
  return {
    seed: 42,
    userClubId: CLUB_IDS[0],
    clubs: CLUB_IDS.map((id, index) => ({
      id,
      name: `Club ${index}`,
      cash: 50000,
      fans: 1000,
      ticketPrice: 10,
      sponsorMonthlyFee: 2000,
      weeklyWages: 1300,
    })),
    players: CLUB_IDS.flatMap((clubId) =>
      Array.from({ length: 13 }, (_, index) => makePlayer(clubId, index)),
    ),
    lineups: CLUB_IDS.map((clubId) => ({
      clubId,
      playerIds: Array.from(
        { length: 11 },
        (_, index) => `${clubId}-p${index}`,
      ),
    })),
    startingTrainingPoints: 100,
    trainingRules: loadLaunchContent().training,
  };
}

function career(): GameState {
  return createCareer(setup());
}

/**
 * The season-end state, reached the only way the calendar allows.
 *
 * Week 30 is the final league round, so advancing into it opens a matchday
 * rather than settling the season. The season ends when that match is played.
 */
function playedToSeasonEnd(state: GameState = career()): GameState {
  const opened = advanceWeek({ ...state, week: 30 as const });
  const matchday = activeCareerMatchday(opened);
  if (matchday === undefined)
    throw new Error('week 30 must hold the season finale');
  return completeMatchday(
    opened,
    matchday.fixtures.map((fixture) => ({
      fixtureId: fixture.id,
      homeGoals: 1,
      awayGoals: 1,
    })),
  );
}

describe('away players', () => {
  function withAway(
    state: GameState,
    playerId: string,
    weeks: number,
  ): GameState {
    return {
      ...state,
      players: state.players.map((player) =>
        player.id === playerId ? { ...player, awayWeeks: weeks } : player,
      ),
    };
  }

  it('refuses to build a team with an away player still in the starting XI', () => {
    const starterId = `${CLUB_IDS[0]}-p10`;
    const away = withAway(career(), starterId, 2);

    // Without this the guard only tested injuryWeeks, so a player on holiday
    // did not error — they silently played the match.
    expect(() => buildCareerTeamDef(away, CLUB_IDS[0])).toThrow('unavailable');
  });

  it('will not accept an away player as a bench replacement', () => {
    const initial = career();
    const starterId = `${CLUB_IDS[0]}-p10`;
    const replacementId = `${CLUB_IDS[0]}-p12`;
    const away = withAway(initial, replacementId, 1);

    expect(() =>
      swapCareerLineupPlayer(away, starterId, replacementId),
    ).toThrow();
  });

  it('keeps an away player off the bench the sim is handed', () => {
    const benchId = `${CLUB_IDS[0]}-p12`;
    const away = withAway(career(), benchId, 1);

    expect(
      (buildCareerTeamDef(away, CLUB_IDS[0]).bench ?? []).map(
        (player) => player.id,
      ),
    ).not.toContain(benchId);
  });

  it('refuses to train an away player', () => {
    const playerId = `${CLUB_IDS[0]}-p10`;
    const away = withAway(career(), playerId, 1);

    expect(() => trainPlayerInstantly(away, playerId, 'sprints')).toThrow(
      'is away and cannot train',
    );
  });

  it('restores the original starter to the exact slot after several replacements', () => {
    const initial = career();
    const slot = 6;
    const originalId = initial.lineups[0].playerIds[slot];
    const withExtraCover: GameState = {
      ...withAway(initial, originalId, 3),
      players: [
        ...withAway(initial, originalId, 3).players,
        makePlayer(CLUB_IDS[0], 13),
        makePlayer(CLUB_IDS[0], 14),
      ],
    };

    const first = repairCareerLineupForInjuries(withExtraCover);
    const firstReplacementId = first.lineups[0].playerIds[slot];
    const second = repairCareerLineupForInjuries({
      ...first,
      players: first.players.map((player) =>
        player.id === firstReplacementId
          ? { ...player, injuryWeeks: 2 }
          : player,
      ),
    });
    const secondReplacementId = second.lineups[0].playerIds[slot];
    const third = repairCareerLineupForInjuries({
      ...second,
      players: second.players.map((player) =>
        player.id === secondReplacementId
          ? { ...player, injuryWeeks: 2 }
          : player,
      ),
    });
    const finalReplacementId = third.lineups[0].playerIds[slot];

    expect(
      new Set([firstReplacementId, secondReplacementId, finalReplacementId])
        .size,
    ).toBe(3);
    expect(
      third.players.find((player) => player.id === originalId)
        ?.returnLineupSlot,
    ).toBe(slot);

    const returned = repairCareerLineupForInjuries({
      ...third,
      players: third.players.map((player) =>
        player.id === originalId ? { ...player, awayWeeks: 0 } : player,
      ),
    });

    expect(returned.lineups[0].playerIds[slot]).toBe(originalId);
    expect(returned.lineups[0].playerIds).not.toContain(finalReplacementId);
    expect(
      returned.players.find((player) => player.id === originalId)
        ?.returnLineupSlot,
    ).toBeUndefined();
  });
});

describe('career squad integration', () => {
  it('turns the persistent lineup into a valid sim team and supports hero-slot competition', () => {
    const initial = career();
    expect(
      buildCareerTeamDef(initial, CLUB_IDS[0]).players.filter(
        (player) => player.power,
      ),
    ).toHaveLength(2);

    // Taking p10's license benches him in the same step. Leaving him standing
    // in the eleven used to make every later `buildCareerTeamDef` throw
    // "must be licensed or benched", with no way out of the save.
    const relicensed = selectCareerLicensedHeroes(initial, [
      `${CLUB_IDS[0]}-p9`,
      `${CLUB_IDS[0]}-p11`,
    ]);
    expect(relicensed.lineups[0].playerIds).not.toContain(`${CLUB_IDS[0]}-p10`);
    expect(() => buildCareerTeamDef(relicensed, CLUB_IDS[0])).not.toThrow();

    // p11 now holds the freed license, so he can take the slot p10 vacated.
    const vacatedSlot = initial.lineups[0].playerIds.indexOf(
      `${CLUB_IDS[0]}-p10`,
    );
    const swapped = setCareerLineup(
      relicensed,
      relicensed.lineups[0].playerIds.map((id, slot) =>
        slot === vacatedSlot ? `${CLUB_IDS[0]}-p11` : id,
      ),
    );
    expect(
      buildCareerTeamDef(swapped, CLUB_IDS[0]).players.filter(
        (player) => player.power,
      ),
    ).toHaveLength(2);
  });

  it('lets computer clubs bench a tired starter for a fresher same-role player', () => {
    const state = career();
    const opponentId = CLUB_IDS[1];
    const tiredStarterId = `${opponentId}-p9`;
    const freshReserveId = `${opponentId}-p11`;
    const prepared = {
      ...state,
      players: state.players.map((player) =>
        player.id === tiredStarterId
          ? { ...player, condition: 0 }
          : player.id === freshReserveId
            ? { ...player, condition: 100 }
            : player,
      ),
    };

    const selectedIds = buildCareerTeamDef(prepared, opponentId).players.map(
      (player) => player.id,
    );
    expect(selectedIds).toContain(freshReserveId);
    expect(selectedIds).not.toContain(tiredStarterId);
  });

  it('persists same-role bench swaps and rejects unavailable replacements', () => {
    const initial = career();
    const starterId = `${CLUB_IDS[0]}-p10`;
    const replacementId = `${CLUB_IDS[0]}-p12`;

    const swapped = swapCareerLineupPlayer(initial, starterId, replacementId);
    const userLineup = swapped.lineups.find(
      (lineup) => lineup.clubId === swapped.userClubId,
    )!;
    expect(userLineup.playerIds).toContain(replacementId);
    expect(userLineup.playerIds).not.toContain(starterId);
    expect(
      buildCareerTeamDef(swapped, swapped.userClubId).players.map(
        (player) => player.id,
      ),
    ).toContain(replacementId);

    const crossRole = swapCareerLineupPlayer(
      swapped,
      `${CLUB_IDS[0]}-p8`,
      starterId,
    );
    const crossRoleLineup = crossRole.lineups.find(
      (lineup) => lineup.clubId === crossRole.userClubId,
    )!;
    expect(crossRoleLineup.playerIds[8]).toBe(starterId);
    expect(() =>
      swapCareerLineupPlayer(initial, starterId, `${CLUB_IDS[0]}-p11`),
    ).toThrow('Hero License');

    const injured = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === replacementId ? { ...player, injuryWeeks: 3 } : player,
      ),
    };
    expect(() =>
      swapCareerLineupPlayer(injured, starterId, replacementId),
    ).toThrow('injured and unavailable');
  });

  it('auto-arranges the strongest available players into natural roles', () => {
    const initial = career();
    const reserveId = `${CLUB_IDS[0]}-p12`;
    const withStrongReserve = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === reserveId
          ? {
              ...player,
              role: 'DEF' as const,
              attrs: { ...player.attrs, def: 90 },
            }
          : player,
      ),
    };

    const arranged = arrangeCareerLineupForFormation(
      withStrongReserve,
      '4-4-2',
    );
    const ids = arranged.lineups.find(
      (lineup) => lineup.clubId === arranged.userClubId,
    )!.playerIds;

    expect(ids).toContain(reserveId);
    ids.forEach((playerId, slot) => {
      const player = arranged.players.find(
        (candidate) => candidate.id === playerId,
      )!;
      expect(player.role).toBe(formationRoleForSlot('4-4-2', slot));
    });
  });

  it('refuses a formation the available squad cannot fill', () => {
    const initial = career();
    const withoutKeeper = {
      ...initial,
      players: initial.players.map((player) =>
        player.clubId === initial.userClubId && player.role === 'GK'
          ? { ...player, injuryWeeks: 3 }
          : player,
      ),
    };

    expect(() =>
      arrangeCareerLineupForFormation(withoutKeeper, '4-4-2'),
    ).toThrow('the squad cannot fill the selected formation');
  });

  it('uses condition, then a licensed-hero tie, with a stable result', () => {
    const initial = career();
    const regular = {
      ...makePlayer(CLUB_IDS[0], 13),
      role: 'DEF' as const,
      attrs: { pac: 80, sho: 80, pas: 80, def: 80, tec: 80, sta: 80, ref: 80 },
      condition: 100,
    };
    const hero = {
      ...makePlayer(CLUB_IDS[0], 14),
      role: 'DEF' as const,
      power: 'SUPER_STRENGTH' as const,
      licensed: true,
      attrs: { ...regular.attrs },
      condition: 100,
    };
    const candidate: GameState = {
      ...initial,
      players: [
        ...initial.players.map((player) => {
          if (player.id === `${CLUB_IDS[0]}-p9`) {
            return { ...player, licensed: false };
          }
          if (
            player.clubId === CLUB_IDS[0] &&
            ['p1', 'p2', 'p3'].some((suffix) => player.id.endsWith(suffix))
          ) {
            return {
              ...player,
              attrs: {
                pac: 90,
                sho: 90,
                pas: 90,
                def: 90,
                tec: 90,
                sta: 90,
                ref: 90,
              },
            };
          }
          if (player.id === `${CLUB_IDS[0]}-p4`) {
            return {
              ...player,
              attrs: {
                pac: 90,
                sho: 90,
                pas: 90,
                def: 90,
                tec: 90,
                sta: 90,
                ref: 90,
              },
              condition: 1,
            };
          }
          return player;
        }),
        regular,
        hero,
      ],
    };

    const first = arrangeCareerLineupForFormation(candidate, '4-4-2');
    const second = arrangeCareerLineupForFormation(candidate, '4-4-2');
    const ids = first.lineups.find(
      (lineup) => lineup.clubId === first.userClubId,
    )!.playerIds;

    expect(ids).toContain(hero.id);
    expect(ids).not.toContain(regular.id);
    expect(ids).not.toContain(`${CLUB_IDS[0]}-p4`);
    expect(second.lineups).toEqual(first.lineups);
  });

  it('trades formation slots when both players already start, never the keeper', () => {
    const initial = career();
    const lineup = initial.lineups.find(
      (candidate) => candidate.clubId === initial.userClubId,
    )!;
    const [keeperId, , outfieldA, , outfieldB] = lineup.playerIds;

    const swapped = swapCareerLineupPlayer(initial, outfieldA!, outfieldB!);
    const swappedIds = swapped.lineups.find(
      (candidate) => candidate.clubId === swapped.userClubId,
    )!.playerIds;
    expect(swappedIds[2]).toBe(outfieldB);
    expect(swappedIds[4]).toBe(outfieldA);
    expect([...swappedIds].sort()).toEqual([...lineup.playerIds].sort());

    expect(() =>
      swapCareerLineupPlayer(initial, keeperId!, outfieldA!),
    ).toThrow('goalkeeper cannot trade places');
  });

  it('repairs an unavailable starter with the strongest legal same-role reserve', () => {
    const initial = career();
    const injuredId = `${CLUB_IDS[0]}-p9`;
    const weakReserveId = `${CLUB_IDS[0]}-p12`;
    const strongReserveId = `${CLUB_IDS[0]}-p13`;
    const strongReserve = {
      ...makePlayer(CLUB_IDS[0], 13),
      attrs: {
        pac: 80,
        sho: 80,
        pas: 80,
        def: 80,
        tec: 80,
        sta: 80,
        ref: 80,
      },
    };
    const unavailable = {
      ...initial,
      players: [
        ...initial.players.map((player) =>
          player.id === injuredId
            ? { ...player, injuryWeeks: 2 }
            : player.id === weakReserveId
              ? {
                  ...player,
                  attrs: {
                    pac: 20,
                    sho: 20,
                    pas: 20,
                    def: 20,
                    tec: 20,
                    sta: 20,
                    ref: 20,
                  },
                }
              : player,
        ),
        strongReserve,
      ],
    };

    const repaired = repairCareerLineupForInjuries(unavailable);
    const lineup = repaired.lineups.find(
      (candidate) => candidate.clubId === repaired.userClubId,
    )!;

    expect(lineup.playerIds).toContain(strongReserveId);
    expect(lineup.playerIds).not.toContain(weakReserveId);
  });

  it('applies the low-morale penalty at the sim boundary and never rewards high morale', () => {
    const playerId = `${CLUB_IDS[0]}-p0`;
    const withMorale = (state: GameState, morale: number): GameState => ({
      ...state,
      players: state.players.map((player) =>
        player.id === playerId ? { ...player, morale } : player,
      ),
    });
    const demoralized = withMorale(career(), 0);

    expect(
      buildCareerTeamDef(demoralized, CLUB_IDS[0]).players[0].attrs.pac,
    ).toBe(45);
    // The penalty belongs to the match adapter; the career attribute is untouched.
    expect(
      demoralized.players.find((player) => player.id === playerId)?.attrs.pac,
    ).toBe(50);

    // Morale is a penalty with a neutral band, never a high-morale stat bonus.
    expect(
      buildCareerTeamDef(withMorale(demoralized, 100), CLUB_IDS[0]).players[0]
        .attrs.pac,
    ).toBe(50);
  });

  it('carries a Motivator coach Heat bonus through the sim-team boundary', () => {
    const state = createCareer({ ...setup() });
    const coach = state.market!.coachCandidates[0];
    const coached = {
      ...state,
      market: {
        ...state.market!,
        headCoach: {
          ...coach,
          level: 4 as const,
          specialties: ['MOTIVATOR', 'ATTACK'] as const,
        },
      },
    };

    expect(
      buildCareerTeamDef(coached, coached.userClubId).heroGaugeRatePercent,
    ).toBe(116);
    expect(
      buildCareerTeamDef(coached, coached.clubs[1].id).heroGaugeRatePercent,
    ).toBeUndefined();
  });

  it('gives a Level 1 assistant Motivator its smaller Hero Gauge bonus', () => {
    const state = createCareer({ ...setup() });
    const assistant = state.market!.coachCandidates[0];
    const coached = {
      ...state,
      market: {
        ...state.market!,
        assistantCoach: {
          ...assistant,
          level: 1 as const,
          specialties: ['MOTIVATOR', 'ATTACK'] as const,
        },
      },
    };

    expect(
      buildCareerTeamDef(coached, coached.userClubId).heroGaugeRatePercent,
    ).toBe(102);
  });

  it('trains each tapped drill for only its own player and stat', () => {
    const initial = career();
    expect(initial.clubs[0].cash).toBe(50000);
    expect(initial.trainingPoints).toBe(100);
    expect(
      initial.players.find((player) => player.id.endsWith('-p9'))?.attrs.pac,
    ).toBe(50);

    // A new Division 5 career owns tier I, so each path resolves to its
    // 7 TP tap for +3. A SUPER roll would disturb these exact values,
    // so probe nonces to keep both taps ordinary.
    let trained = initial;
    for (const tap of [
      { playerId: `${CLUB_IDS[0]}-p9`, pathId: 'sprints' },
      { playerId: `${CLUB_IDS[0]}-p1`, pathId: 'duels' },
    ]) {
      for (let nonce = trained.totalInstantDrills ?? 0; ; nonce += 1) {
        const result = trainPlayerInstantly(
          { ...trained, totalInstantDrills: nonce },
          tap.playerId,
          tap.pathId,
        );
        if (!result.isSuper) {
          trained = result.state;
          break;
        }
      }
    }
    expect(trained.trainingPoints).toBe(86);
    expect(
      trained.players.find((player) => player.id.endsWith('-p9'))?.attrs.pac,
    ).toBe(53);
    expect(
      trained.players.find((player) => player.id.endsWith('-p9'))?.attrs.def,
    ).toBe(50);
    expect(
      trained.players.find((player) => player.id === `${CLUB_IDS[0]}-p1`)?.attrs
        .pac,
    ).toBe(50);
    expect(
      trained.players.find((player) => player.id === `${CLUB_IDS[0]}-p1`)?.attrs
        .def,
    ).toBe(53);
    expect(
      trained.players.find((player) => player.id === `${CLUB_IDS[0]}-p2`)?.attrs
        .def,
    ).toBe(50);
    // Training is TP-only; weekly settlement never charges money for it.
    expect(
      advanceWeek(trained).ledgers[0].lines.some(
        (line) => line.kind === 'training',
      ),
    ).toBe(false);
  });

  it('starts the two-week training-ground build and pays its first pitch TP after completion', () => {
    const built = buildTrainingGround(career());
    expect(built.clubs[0].cash).toBe(42000);
    expect(built.facilities.trainingGroundBuilt).toBe(false);
    expect(built.facilities.grid?.construction).toMatchObject({
      type: 'training-pitch',
      weeksRemaining: 2,
    });
    expect(() => buildTrainingGround(built)).toThrow(
      /Training Pitch is already built/,
    );

    // Each week banks the club's unconditional baseline; only the pitch's own
    // per-level TP waits for construction to finish.
    const stillBuilding = advanceWeek(built);
    expect(stillBuilding.week).toBe(2);
    expect(stillBuilding.trainingPoints).toBe(
      100 + BASE_WEEKLY_TRAINING_POINTS,
    );
    expect(stillBuilding.facilities.trainingGroundBuilt).toBe(false);
    expect(stillBuilding.facilities.grid?.construction).toMatchObject({
      type: 'training-pitch',
      weeksRemaining: 1,
    });

    const completed = advanceWeek(stillBuilding);
    expect(completed.week).toBe(3);
    expect(completed.trainingPoints).toBe(
      100 + BASE_WEEKLY_TRAINING_POINTS * 2,
    );
    expect(completed.facilities.trainingGroundBuilt).toBe(true);

    // Week 3 is the first match week, so settle it through the matchday path.
    const matchday = advanceWeek(completed);
    expect(matchday.phase).toBe('matchday');
    const activeWeek = completeMatchday(
      matchday,
      activeCareerMatchday(matchday)!.fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        homeGoals: 1,
        awayGoals: 1,
      })),
    );
    expect(activeWeek.trainingPoints).toBe(
      100 + BASE_WEEKLY_TRAINING_POINTS * 3 + TRAINING_PITCH_TP_PER_LEVEL,
    );
  });

  it('rejects an unaffordable drill at tap time without blocking weekly settlement', () => {
    const broke = {
      ...career(),
      trainingPoints: 0,
      clubs: career().clubs.map((club) =>
        club.id === CLUB_IDS[0] ? { ...club, cash: 0 } : club,
      ),
    };

    expect(() =>
      trainPlayerInstantly(broke, `${CLUB_IDS[0]}-p9`, 'sprints'),
    ).toThrow(/needs 7 TP/);

    const settled = advanceWeek(broke);
    expect(settled.week).toBe(2);
    expect(
      settled.players.find((player) => player.id === `${CLUB_IDS[0]}-p9`)?.attrs
        .pac,
    ).toBe(50);
    expect(
      settled.ledgers[0].lines.some((line) => line.kind === 'training'),
    ).toBe(false);
  });

  it('expires contracts at season end and applies the hero wage cliff only on renewal', () => {
    const heroId = `${CLUB_IDS[0]}-p9`;
    const ended = playedToSeasonEnd();
    expect(ended.phase).toBe('season-end');
    expect(
      ended.players.find((player) => player.id === heroId)
        ?.contractSeasonsRemaining,
    ).toBe(0);
    expect(
      ended.players.find((player) => player.id === heroId)?.weeklyWage,
    ).toBe(100);

    const renewed = renewCareerPlayer(ended, heroId, 4, 1);
    expect(
      renewed.players.find((player) => player.id === heroId)?.weeklyWage,
    ).toBe(400);
    expect(
      renewed.players.find((player) => player.id === heroId)?.onHeroWage,
    ).toBe(true);
    expect(renewed.clubs[0].weeklyWages).toBe(1600);

    const released = releaseCareerPlayer(ended, `${CLUB_IDS[0]}-p11`);
    expect(
      released.players.some((player) => player.id === `${CLUB_IDS[0]}-p11`),
    ).toBe(false);
    expect(released.clubs[0].weeklyWages).toBe(1200);
  });

  it('lets an expired starter leave when the only cover is a licensed hero', () => {
    // A licensed hero is a legal starter; only an UNLICENSED one is bench-only.
    // Barring every powered player trapped the expired starter on the books.
    const heroId = `${CLUB_IDS[0]}-p9`;
    const coverId = `${CLUB_IDS[0]}-p12`;
    const ended = playedToSeasonEnd();
    // p12 takes the licence the released p9 gives up, so the club never holds
    // more licensed heroes than the cap allows, and keeps a year on his deal —
    // a replacement whose own contract has expired is ineligible for its own
    // reason and would not isolate this rule.
    const withHeroCover: GameState = {
      ...ended,
      players: ended.players.map((player) =>
        player.id === coverId
          ? {
              ...player,
              power: 'SUPER_SPEED' as const,
              powerTier: 1 as const,
              licensed: true,
              contractSeasonsRemaining: 1,
            }
          : player,
      ),
    };

    const released = releaseCareerPlayer(withHeroCover, heroId);

    expect(released.players.some((player) => player.id === heroId)).toBe(false);
    expect(released.lineups[0].playerIds).toContain(coverId);
    // The real proof: the repaired lineup still builds a legal match team.
    expect(() => buildCareerTeamDef(released, CLUB_IDS[0])).not.toThrow();
  });

  it('releases an expired starter with no cover by promoting an emergency youth', () => {
    // The fixture squad holds exactly one goalkeeper. The old guard threw here,
    // and once renewal is also locked out for the season (a walked-away agent,
    // loyalty below 30) the expired-contract gate could never clear — a
    // permanent season-end lock in a game whose canon is fail-soft, never game
    // over. The academy now sends a role-correct emergency youth instead, the
    // same relief a board-forced sale uses.
    const keeperId = `${CLUB_IDS[0]}-p0`;
    const ended = playedToSeasonEnd();
    expect(ended.phase).toBe('season-end');

    const released = releaseCareerPlayer(ended, keeperId);

    const youth = released.players.find(
      (player) =>
        player.clubId === CLUB_IDS[0] &&
        !ended.players.some((existing) => existing.id === player.id),
    );
    expect(youth).toMatchObject({ role: 'GK', contractSeasonsRemaining: 2 });
    expect(released.players.some((player) => player.id === keeperId)).toBe(
      false,
    );
    expect(released.lineups[0].playerIds[0]).toBe(youth!.id);
    expect(released.clubs[0].weeklyWages).toBe(1300 - 100 + youth!.weeklyWage);
    expect(() => buildCareerTeamDef(released, CLUB_IDS[0])).not.toThrow();
    // Same state, same relief: the replacement is deterministic.
    expect(
      releaseCareerPlayer(ended, keeperId).players.some(
        (player) => player.id === youth!.id,
      ),
    ).toBe(true);
  });

  it('unblocks the season transition after a forced release with no cover', () => {
    const keeperId = `${CLUB_IDS[0]}-p0`;
    const ended = playedToSeasonEnd();
    // Every other expired deal is renewed, so the keeper alone holds the gate.
    const onlyKeeperExpired: GameState = {
      ...ended,
      players: ended.players.map((player) =>
        player.clubId === CLUB_IDS[0] && player.id !== keeperId
          ? { ...player, contractSeasonsRemaining: 1 }
          : player,
      ),
    };
    expect(() => startNextSeason(onlyKeeperExpired)).toThrow(
      'expired contract',
    );

    const released = releaseCareerPlayer(onlyKeeperExpired, keeperId);

    expect(startNextSeason(released).season).toBe(2);
  });

  it('calls up an emergency keeper rather than dead-ending the week', () => {
    // Weekly settlement and match day both repair the lineup, so an outage the
    // bench cannot cover used to throw on Advance Week AND Play Match — an
    // unrecoverable save in a game that promises warnings and a forced sale but
    // never a game over. Unreachable through the shipped content today; the
    // guard is here because `applyPlayerEffect` already implements injuryWeeks
    // and one authored event would open it.
    const keeperId = `${CLUB_IDS[0]}-p0`;
    const initial = career();
    const noKeeper: GameState = {
      ...initial,
      players: initial.players.map((player) =>
        player.id === keeperId ? { ...player, injuryWeeks: 4 } : player,
      ),
    };

    // Nothing on the books can cover it: the honest answer is still "no".
    expect(tryRepairCareerLineupForInjuries(noKeeper)).toBeUndefined();

    const repaired = repairCareerLineupForInjuries(noKeeper);
    const lineup = repaired.lineups.find((l) => l.clubId === CLUB_IDS[0])!;
    const relief = repaired.players.find((p) => p.id === lineup.playerIds[0])!;

    expect(relief.id).not.toBe(keeperId);
    expect(relief.role).toBe('GK');
    expect(relief.injuryWeeks).toBe(0);
    expect(() => buildCareerTeamDef(repaired, CLUB_IDS[0])).not.toThrow();
    // The wage bill still agrees with the roster it pays.
    expect(repaired.clubs.find((c) => c.id === CLUB_IDS[0])!.weeklyWages).toBe(
      initial.clubs.find((c) => c.id === CLUB_IDS[0])!.weeklyWages +
        relief.weeklyWage,
    );
    // The two entry points that used to brick the save.
    expect(() => advanceWeek(noKeeper)).not.toThrow();
  });
});

describe('match-day form', () => {
  const state = career();

  it('is deterministic and stays inside the ±2% band', () => {
    const base = buildTeamDef(
      state.clubs.find((club) => club.id === CLUB_IDS[1])!,
      rosterForClub(state, CLUB_IDS[1]),
      state.lineups.find((lineup) => lineup.clubId === CLUB_IDS[1])!.playerIds,
      2,
    );
    const built = buildCareerTeamDef(state, CLUB_IDS[1]);
    expect(buildCareerTeamDef(state, CLUB_IDS[1])).toEqual(built);
    for (const [index, player] of built.players.entries()) {
      const before = base.players[index].attrs.pac;
      expect(player.attrs.pac).toBeGreaterThanOrEqual(
        Math.round(before * 0.98),
      );
      expect(player.attrs.pac).toBeLessThanOrEqual(Math.round(before * 1.02));
    }
  });

  it('moves between weeks rather than holding one figure all season', () => {
    const percents = new Set(
      Array.from({ length: 20 }, (_, index) =>
        matchFormPercent({ ...state, week: (index + 1) as never }, CLUB_IDS[1]),
      ),
    );
    expect(percents.size).toBeGreaterThan(1);
  });
});
