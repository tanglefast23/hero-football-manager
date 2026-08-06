import { loadLaunchContent } from '../../content';
import { activeCareerMatchday, advanceWeek, completeMatchday, createCareer, startNextSeason } from '../career';
import {
  buildCareerTeamDef,
  buildTrainingGround,
  releaseCareerPlayer,
  renewCareerPlayer,
  selectCareerLicensedHeroes,
  setCareerLineup,
  swapCareerLineupPlayer,
} from '../squad';
import { trainPlayerInstantly } from '../training';
import { BASE_WEEKLY_TRAINING_POINTS, TRAINING_PITCH_TP_PER_LEVEL } from '../facilities';
import type { CareerPlayer, CareerSetup, GameState } from '../types';

const CLUB_IDS = Array.from({ length: 10 }, (_, index) => `club-${index}`);

function makePlayer(clubId: string, index: number): CareerPlayer {
  const isUser = clubId === CLUB_IDS[0];
  const role = index === 0 ? 'GK' : index <= 4 ? 'DEF' : index <= 8 ? 'MID' : 'FWD';
  const power = isUser && index === 9
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
    players: CLUB_IDS.flatMap(clubId =>
      Array.from({ length: 13 }, (_, index) => makePlayer(clubId, index)),
    ),
    lineups: CLUB_IDS.map(clubId => ({
      clubId,
      playerIds: Array.from({ length: 11 }, (_, index) => `${clubId}-p${index}`),
    })),
    startingTrainingPoints: 100,
    trainingRules: loadLaunchContent().training,
  };
}

function career(): GameState {
  return createCareer(setup());
}

describe('away players', () => {
  function withAway(state: GameState, playerId: string, weeks: number): GameState {
    return {
      ...state,
      players: state.players.map(player => (player.id === playerId
        ? { ...player, awayWeeks: weeks }
        : player)),
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

    expect(() => swapCareerLineupPlayer(away, starterId, replacementId)).toThrow();
  });

  it('keeps an away player off the bench the sim is handed', () => {
    const benchId = `${CLUB_IDS[0]}-p12`;
    const away = withAway(career(), benchId, 1);

    expect((buildCareerTeamDef(away, CLUB_IDS[0]).bench ?? []).map(player => player.id))
      .not.toContain(benchId);
  });

  it('refuses to train an away player', () => {
    const playerId = `${CLUB_IDS[0]}-p10`;
    const away = withAway(career(), playerId, 1);

    expect(() => trainPlayerInstantly(away, playerId, 'sprints'))
      .toThrow('is away and cannot train');
  });
});

describe('career squad integration', () => {
  it('turns the persistent lineup into a valid sim team and supports hero-slot competition', () => {
    const initial = career();
    expect(buildCareerTeamDef(initial, CLUB_IDS[0]).players.filter(player => player.power)).toHaveLength(2);

    const relicensed = selectCareerLicensedHeroes(initial, [
      `${CLUB_IDS[0]}-p9`,
      `${CLUB_IDS[0]}-p11`,
    ]);
    expect(() => buildCareerTeamDef(relicensed, CLUB_IDS[0])).toThrow('licensed or benched');

    const lineup = relicensed.lineups[0].playerIds.map(id =>
      id === `${CLUB_IDS[0]}-p10` ? `${CLUB_IDS[0]}-p11` : id,
    );
    const swapped = setCareerLineup(relicensed, lineup);
    expect(buildCareerTeamDef(swapped, CLUB_IDS[0]).players.filter(player => player.power)).toHaveLength(2);
  });

  it('persists same-role bench swaps and rejects unavailable replacements', () => {
    const initial = career();
    const starterId = `${CLUB_IDS[0]}-p10`;
    const replacementId = `${CLUB_IDS[0]}-p12`;

    const swapped = swapCareerLineupPlayer(initial, starterId, replacementId);
    const userLineup = swapped.lineups.find(lineup => lineup.clubId === swapped.userClubId)!;
    expect(userLineup.playerIds).toContain(replacementId);
    expect(userLineup.playerIds).not.toContain(starterId);
    expect(buildCareerTeamDef(swapped, swapped.userClubId).players.map(player => player.id))
      .toContain(replacementId);

    const crossRole = swapCareerLineupPlayer(swapped, `${CLUB_IDS[0]}-p8`, starterId);
    const crossRoleLineup = crossRole.lineups.find(lineup => lineup.clubId === crossRole.userClubId)!;
    expect(crossRoleLineup.playerIds[8]).toBe(starterId);
    expect(() => swapCareerLineupPlayer(initial, starterId, `${CLUB_IDS[0]}-p11`))
      .toThrow('Hero License');

    const injured = {
      ...initial,
      players: initial.players.map(player => player.id === replacementId
        ? { ...player, injuryWeeks: 3 }
        : player),
    };
    expect(() => swapCareerLineupPlayer(injured, starterId, replacementId))
      .toThrow('injured and unavailable');
  });

  it('applies the low-morale penalty at the sim boundary and never rewards high morale', () => {
    const playerId = `${CLUB_IDS[0]}-p0`;
    const withMorale = (state: GameState, morale: number): GameState => ({
      ...state,
      players: state.players.map(player => player.id === playerId
        ? { ...player, morale }
        : player),
    });
    const demoralized = withMorale(career(), 0);

    expect(buildCareerTeamDef(demoralized, CLUB_IDS[0]).players[0].attrs.pac).toBe(45);
    // The penalty belongs to the match adapter; the career attribute is untouched.
    expect(demoralized.players.find(player => player.id === playerId)?.attrs.pac).toBe(50);

    // Morale is a penalty with a neutral band, never a high-morale stat bonus.
    expect(buildCareerTeamDef(withMorale(demoralized, 100), CLUB_IDS[0]).players[0].attrs.pac)
      .toBe(50);
  });

  it('carries a Motivator coach Heat bonus through the sim-team boundary', () => {
    const state = createCareer({ ...setup() });
    const coach = state.market!.coachCandidates[0];
    const coached = {
      ...state,
      market: {
        ...state.market!,
        headCoach: { ...coach, level: 4 as const, specialties: ['MOTIVATOR', 'ATTACK'] as const },
      },
    };

    expect(buildCareerTeamDef(coached, coached.userClubId).heroGaugeRatePercent).toBe(120);
    expect(buildCareerTeamDef(coached, coached.clubs[1].id).heroGaugeRatePercent).toBeUndefined();
  });

  it('gives a Level 1 assistant Motivator a half-strength Hero Gauge bonus', () => {
    const state = createCareer({ ...setup() });
    const assistant = state.market!.coachCandidates[0];
    const coached = {
      ...state,
      market: {
        ...state.market!,
        assistantCoach: { ...assistant, level: 1 as const, specialties: ['MOTIVATOR', 'ATTACK'] as const },
      },
    };

    expect(buildCareerTeamDef(coached, coached.userClubId).heroGaugeRatePercent).toBe(102.5);
  });

  it('trains each tapped drill for only its own player and stat', () => {
    const initial = career();
    expect(initial.clubs[0].cash).toBe(50000);
    expect(initial.trainingPoints).toBe(100);
    expect(initial.players.find(player => player.id.endsWith('-p9'))?.attrs.pac).toBe(50);

    // A Division 5 career unlocks tiers I and II, so each path resolves to its
    // 10 TP tier-II tap for +5. A SUPER roll would disturb these exact values,
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
        if (!result.isSuper) { trained = result.state; break; }
      }
    }
    expect(trained.trainingPoints).toBe(80);
    expect(trained.players.find(player => player.id.endsWith('-p9'))?.attrs.pac).toBe(54);
    expect(trained.players.find(player => player.id.endsWith('-p9'))?.attrs.def).toBe(50);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p1`)?.attrs.pac).toBe(50);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p1`)?.attrs.def).toBe(54);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p2`)?.attrs.def).toBe(50);
    // Training is TP-only; weekly settlement never charges money for it.
    expect(advanceWeek(trained).ledgers[0].lines.some(line => line.kind === 'training')).toBe(false);
  });

  it('starts the two-week training-ground build and pays its first pitch TP after completion', () => {
    const built = buildTrainingGround(career());
    expect(built.clubs[0].cash).toBe(42000);
    expect(built.facilities.trainingGroundBuilt).toBe(false);
    expect(built.facilities.grid?.construction).toMatchObject({
      type: 'training-pitch',
      weeksRemaining: 2,
    });
    expect(() => buildTrainingGround(built)).toThrow(/Training Pitch is already built/);

    // Each week banks the club's unconditional baseline; only the pitch's own
    // +28 waits for construction to finish.
    const stillBuilding = advanceWeek(built);
    expect(stillBuilding.week).toBe(2);
    expect(stillBuilding.trainingPoints).toBe(100 + BASE_WEEKLY_TRAINING_POINTS);
    expect(stillBuilding.facilities.trainingGroundBuilt).toBe(false);
    expect(stillBuilding.facilities.grid?.construction).toMatchObject({
      type: 'training-pitch',
      weeksRemaining: 1,
    });

    const completed = advanceWeek(stillBuilding);
    expect(completed.week).toBe(3);
    expect(completed.trainingPoints).toBe(100 + BASE_WEEKLY_TRAINING_POINTS * 2);
    expect(completed.facilities.trainingGroundBuilt).toBe(true);

    // Week 3 is the first match week, so settle it through the matchday path.
    const matchday = advanceWeek(completed);
    expect(matchday.phase).toBe('matchday');
    const activeWeek = completeMatchday(
      matchday,
      activeCareerMatchday(matchday)!.fixtures.map(fixture => (
        { fixtureId: fixture.id, homeGoals: 1, awayGoals: 1 }
      )),
    );
    expect(activeWeek.trainingPoints).toBe(
      100 + BASE_WEEKLY_TRAINING_POINTS * 3 + TRAINING_PITCH_TP_PER_LEVEL,
    );
  });

  it('rejects an unaffordable drill at tap time without blocking weekly settlement', () => {
    const broke = {
      ...career(),
      trainingPoints: 0,
      clubs: career().clubs.map(club => club.id === CLUB_IDS[0]
        ? { ...club, cash: 0 }
        : club),
    };

    expect(() => trainPlayerInstantly(broke, `${CLUB_IDS[0]}-p9`, 'sprints'))
      .toThrow(/needs 10 TP/);

    const settled = advanceWeek(broke);
    expect(settled.week).toBe(2);
    expect(settled.players.find(player => player.id === `${CLUB_IDS[0]}-p9`)?.attrs.pac).toBe(50);
    expect(settled.ledgers[0].lines.some(line => line.kind === 'training')).toBe(false);
  });

  it('expires contracts at season end and applies the hero wage cliff only on renewal', () => {
    const heroId = `${CLUB_IDS[0]}-p9`;
    const atFinalWeek = { ...career(), week: 30 as const };
    const ended = advanceWeek(atFinalWeek);
    expect(ended.phase).toBe('season-end');
    expect(ended.players.find(player => player.id === heroId)?.contractSeasonsRemaining).toBe(0);
    expect(ended.players.find(player => player.id === heroId)?.weeklyWage).toBe(100);

    const renewed = renewCareerPlayer(ended, heroId, 4, 1);
    expect(renewed.players.find(player => player.id === heroId)?.weeklyWage).toBe(400);
    expect(renewed.players.find(player => player.id === heroId)?.onHeroWage).toBe(true);
    expect(renewed.clubs[0].weeklyWages).toBe(1600);

    const released = releaseCareerPlayer(ended, `${CLUB_IDS[0]}-p11`);
    expect(released.players.some(player => player.id === `${CLUB_IDS[0]}-p11`)).toBe(false);
    expect(released.clubs[0].weeklyWages).toBe(1200);
  });

  it('lets an expired starter leave when the only cover is a licensed hero', () => {
    // A licensed hero is a legal starter; only an UNLICENSED one is bench-only.
    // Barring every powered player trapped the expired starter on the books.
    const heroId = `${CLUB_IDS[0]}-p9`;
    const coverId = `${CLUB_IDS[0]}-p12`;
    const ended = advanceWeek({ ...career(), week: 30 as const });
    // p12 takes the licence the released p9 gives up, so the club never holds
    // more licensed heroes than the cap allows, and keeps a year on his deal —
    // a replacement whose own contract has expired is ineligible for its own
    // reason and would not isolate this rule.
    const withHeroCover: GameState = {
      ...ended,
      players: ended.players.map(player => player.id === coverId
        ? {
            ...player,
            power: 'SUPER_SPEED' as const,
            powerTier: 1 as const,
            licensed: true,
            contractSeasonsRemaining: 1,
          }
        : player),
    };

    const released = releaseCareerPlayer(withHeroCover, heroId);

    expect(released.players.some(player => player.id === heroId)).toBe(false);
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
    const ended = advanceWeek({ ...career(), week: 30 as const });
    expect(ended.phase).toBe('season-end');

    const released = releaseCareerPlayer(ended, keeperId);

    const youth = released.players.find(player => (
      player.clubId === CLUB_IDS[0]
      && !ended.players.some(existing => existing.id === player.id)
    ));
    expect(youth).toMatchObject({ role: 'GK', contractSeasonsRemaining: 2 });
    expect(released.players.some(player => player.id === keeperId)).toBe(false);
    expect(released.lineups[0].playerIds[0]).toBe(youth!.id);
    expect(released.clubs[0].weeklyWages).toBe(1300 - 100 + youth!.weeklyWage);
    expect(() => buildCareerTeamDef(released, CLUB_IDS[0])).not.toThrow();
    // Same state, same relief: the replacement is deterministic.
    expect(releaseCareerPlayer(ended, keeperId).players.some(player => player.id === youth!.id))
      .toBe(true);
  });

  it('unblocks the season transition after a forced release with no cover', () => {
    const keeperId = `${CLUB_IDS[0]}-p0`;
    const ended = advanceWeek({ ...career(), week: 30 as const });
    // Every other expired deal is renewed, so the keeper alone holds the gate.
    const onlyKeeperExpired: GameState = {
      ...ended,
      players: ended.players.map(player => (
        player.clubId === CLUB_IDS[0] && player.id !== keeperId
          ? { ...player, contractSeasonsRemaining: 1 }
          : player
      )),
    };
    expect(() => startNextSeason(onlyKeeperExpired)).toThrow('expired contract');

    const released = releaseCareerPlayer(onlyKeeperExpired, keeperId);

    expect(startNextSeason(released).season).toBe(2);
  });
});
