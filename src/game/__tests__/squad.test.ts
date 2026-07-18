import { advanceWeek, createCareer } from '../career';
import {
  applyCareerTraining,
  buildCareerTeamDef,
  buildTrainingGround,
  renewCareerPlayer,
  resolveCareerAwakening,
  selectCareerLicensedHeroes,
  setCareerLineup,
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

  it('pairs each drill with one player and spends money plus TP once', () => {
    const trained = applyCareerTraining(
      career(),
      [`${CLUB_IDS[0]}-p9`, `${CLUB_IDS[0]}-p1`],
      [
        { id: 'sprint', moneyCost: 1000, tpCost: 10, gains: { pac: 2 } },
        { id: 'shield', moneyCost: 500, tpCost: 8, gains: { def: 3 } },
      ],
    );

    expect(trained.clubs[0].cash).toBe(48500);
    expect(trained.trainingPoints).toBe(82);
    expect(trained.players.find(player => player.id.endsWith('-p9'))?.attrs.pac).toBe(52);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p1`)?.attrs.def).toBe(53);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p2`)?.attrs.def).toBe(50);
  });

  it('makes the one-time training-ground decision pay five ambient TP each settled week', () => {
    const built = buildTrainingGround(career());
    expect(built.clubs[0].cash).toBe(42000);
    expect(built.facilities.trainingGroundBuilt).toBe(true);
    expect(() => buildTrainingGround(built)).toThrow('already built');

    const next = advanceWeek(built);
    expect(next.week).toBe(2);
    expect(next.trainingPoints).toBe(105);
  });

  it('persists awakening pity and resets it when hero #2 awakens', () => {
    const playerId = `${CLUB_IDS[0]}-p12`;
    const failed = resolveCareerAwakening(career(), playerId, 99, 'SUPER_STRENGTH');
    expect(failed.awakened).toBe(false);
    expect(failed.chancePercent).toBe(8);
    expect(failed.state.eventClock.riskyChoices).toBe(1);

    const awakened = resolveCareerAwakening(failed.state, playerId, 0, 'SUPER_STRENGTH');
    expect(awakened.awakened).toBe(true);
    expect(awakened.chancePercent).toBe(14);
    expect(awakened.state.eventClock.riskyChoices).toBe(0);
    expect(awakened.state.players.find(player => player.id === playerId)?.power)
      .toBe('SUPER_STRENGTH');
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
  });
});
