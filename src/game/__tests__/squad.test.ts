import { advanceWeek, createCareer } from '../career';
import {
  applyCareerTraining,
  buildCareerTeamDef,
  buildTrainingGround,
  releaseCareerPlayer,
  renewCareerPlayer,
  selectCareerLicensedHeroes,
  setCareerLineup,
  swapCareerLineupPlayer,
} from '../squad';
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
  };
}

function career(): GameState {
  return createCareer(setup());
}

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

    expect(() => swapCareerLineupPlayer(swapped, `${CLUB_IDS[0]}-p8`, starterId))
      .toThrow('preserve the formation');
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

  it('uses M2 low-morale penalties without changing the M1 match adapter', () => {
    const playerId = `${CLUB_IDS[0]}-p0`;
    const lowMorale = (state: GameState): GameState => ({
      ...state,
      players: state.players.map(player => player.id === playerId
        ? { ...player, morale: 0 }
        : player),
    });
    const m1 = lowMorale(career());
    const m2 = lowMorale(createCareer({ ...setup(), careerMode: 'full' }));

    expect(buildCareerTeamDef(m1, CLUB_IDS[0]).players[0].attrs.pac).toBe(45);
    expect(buildCareerTeamDef(m2, CLUB_IDS[0]).players[0].attrs.pac).toBe(45);
    expect(m2.players.find(player => player.id === playerId)?.attrs.pac).toBe(50);

    const highMoraleM1 = {
      ...m1,
      players: m1.players.map(player => player.id === playerId
        ? { ...player, morale: 100 }
        : player),
    };
    const highMoraleM2 = {
      ...m2,
      players: m2.players.map(player => player.id === playerId
        ? { ...player, morale: 100 }
        : player),
    };
    expect(buildCareerTeamDef(highMoraleM1, CLUB_IDS[0]).players[0].attrs.pac).toBe(55);
    expect(buildCareerTeamDef(highMoraleM2, CLUB_IDS[0]).players[0].attrs.pac).toBe(50);
  });

  it('stores one weekly plan and applies every drill to every assigned player once', () => {
    const planned = applyCareerTraining(
      career(),
      [`${CLUB_IDS[0]}-p9`, `${CLUB_IDS[0]}-p1`],
      [
        { id: 'sprint', moneyCost: 1000, tpCost: 10, gains: { pac: 2 } },
        { id: 'shield', moneyCost: 500, tpCost: 8, gains: { def: 3 } },
      ],
    );

    expect(planned.clubs[0].cash).toBe(50000);
    expect(planned.trainingPoints).toBe(100);
    expect(planned.players.find(player => player.id.endsWith('-p9'))?.attrs.pac).toBe(50);

    const trained = advanceWeek(planned);
    expect(trained.clubs[0].cash).toBe(47850);
    expect(trained.trainingPoints).toBe(82);
    expect(trained.ledgers[0].lines).toContainEqual({
      kind: 'training',
      label: 'Weekly focus training',
      amount: -1500,
    });
    expect(trained.players.find(player => player.id.endsWith('-p9'))?.attrs.pac).toBe(52);
    expect(trained.players.find(player => player.id.endsWith('-p9'))?.attrs.def).toBe(53);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p1`)?.attrs.pac).toBe(52);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p1`)?.attrs.def).toBe(53);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p2`)?.attrs.def).toBe(50);
  });

  it('starts the one-week training-ground build before paying ambient TP', () => {
    const built = buildTrainingGround(career());
    expect(built.clubs[0].cash).toBe(42000);
    expect(built.facilities.trainingGroundBuilt).toBe(false);
    expect(built.facilities.grid?.construction).toMatchObject({
      type: 'training-pitch',
      weeksRemaining: 1,
    });
    expect(() => buildTrainingGround(built)).toThrow(/construction project/);

    const completed = advanceWeek(built);
    expect(completed.week).toBe(2);
    expect(completed.trainingPoints).toBe(100);
    expect(completed.facilities.trainingGroundBuilt).toBe(true);

    const activeWeek = advanceWeek(completed);
    expect(activeWeek.trainingPoints).toBe(105);
  });

  it('skips an unaffordable repeating focus plan without blocking weekly settlement', () => {
    const planned = applyCareerTraining(
      career(),
      [`${CLUB_IDS[0]}-p9`],
      [{ id: 'sprint', moneyCost: 1000, tpCost: 10, gains: { pac: 2 } }],
    );
    const broke = {
      ...planned,
      trainingPoints: 0,
      clubs: planned.clubs.map(club => club.id === planned.userClubId
        ? { ...club, cash: 0 }
        : club),
    };

    const settled = advanceWeek(broke);

    expect(settled.week).toBe(2);
    expect(settled.players.find(player => player.id === `${CLUB_IDS[0]}-p9`)?.attrs.pac).toBe(50);
    expect(settled.trainingPlan).toEqual(planned.trainingPlan);
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
});
