import { loadLaunchContent } from '../../content';
import { activeCareerMatchday, advanceWeek, completeMatchday, createCareer } from '../career';
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

  it('carries a Motivator coach Heat bonus through the sim-team boundary', () => {
    const state = createCareer({ ...setup(), careerMode: 'full' });
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
    const state = createCareer({ ...setup(), careerMode: 'full' });
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

    // This M1 fixture never gates a tier by division, so each path resolves
    // to its highest (tier III) drill: 15 TP and +8 gain per tap. M1 careers
    // apply the plain drill gain, so a SUPER roll cannot disturb these exact
    // values only if it misses — probe nonces to keep both taps ordinary.
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
    expect(trained.trainingPoints).toBe(70);
    expect(trained.players.find(player => player.id.endsWith('-p9'))?.attrs.pac).toBe(58);
    expect(trained.players.find(player => player.id.endsWith('-p9'))?.attrs.def).toBe(50);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p1`)?.attrs.pac).toBe(50);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p1`)?.attrs.def).toBe(58);
    expect(trained.players.find(player => player.id === `${CLUB_IDS[0]}-p2`)?.attrs.def).toBe(50);
    // Training is TP-only; weekly settlement never charges money for it.
    expect(advanceWeek(trained).ledgers[0].lines.some(line => line.kind === 'training')).toBe(false);
  });

  it('starts the two-week training-ground build and pays its first 10 TP the week after completion', () => {
    const built = buildTrainingGround(career());
    expect(built.clubs[0].cash).toBe(42000);
    expect(built.facilities.trainingGroundBuilt).toBe(false);
    expect(built.facilities.grid?.construction).toMatchObject({
      type: 'training-pitch',
      weeksRemaining: 2,
    });
    expect(() => buildTrainingGround(built)).toThrow(/construction project/);

    const stillBuilding = advanceWeek(built);
    expect(stillBuilding.week).toBe(2);
    expect(stillBuilding.trainingPoints).toBe(100);
    expect(stillBuilding.facilities.trainingGroundBuilt).toBe(false);
    expect(stillBuilding.facilities.grid?.construction).toMatchObject({
      type: 'training-pitch',
      weeksRemaining: 1,
    });

    const completed = advanceWeek(stillBuilding);
    expect(completed.week).toBe(3);
    expect(completed.trainingPoints).toBe(100);
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
    expect(activeWeek.trainingPoints).toBe(110);
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
      .toThrow(/needs 15 TP/);

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
});
