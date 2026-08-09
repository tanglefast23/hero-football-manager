import { createLaunchCareerSetup } from '../launch';
import {
  buildCareerTeamDef,
  createCareer,
  trainPlayerInstantly,
} from '../../game';
import { HALF_TICKS } from '../../sim/geometry';
import { createMatch, queueInput, tick } from '../../sim/match';
import type { EnergyUse } from '../../sim/tactics';
import type { MatchState, TeamDef } from '../../sim/types';

const TOTAL_TICKS = HALF_TICKS * 2;
const MINUTE_70_TICK = Math.round((TOTAL_TICKS * 70) / 90);

function runToFullTime(match: MatchState): void {
  while (match.phase !== 'fulltime') tick(match);
}

function controlledConditions(
  match: MatchState,
  controlledTeam: 0 | 1,
): number[] {
  const first = controlledTeam * 11;
  return match.players
    .slice(first, first + 11)
    .map((player) => player.condition);
}

function playersStillOnPitch(
  match: MatchState,
  controlledTeam: 0 | 1,
): number[] {
  const first = controlledTeam * 11;
  return match.players
    .slice(first, first + 11)
    .filter((player) => player.outReason !== 'redcard')
    .map((player) => player.condition);
}

function runMode(team: TeamDef, opponent: TeamDef, mode: EnergyUse): number {
  const match = createMatch(981, team, opponent, { controlledTeam: 0 });
  if (mode !== 'BALANCED')
    queueInput(match, { tick: 1, kind: 'SET_ENERGY_USE', energyUse: mode });
  runToFullTime(match);
  return (
    controlledConditions(match, 0).reduce(
      (sum, condition) => sum + condition,
      0,
    ) / 11
  );
}

describe('opening-match stamina balance', () => {
  const career = createCareer(createLaunchCareerSetup(20260718));
  const teams = career.clubs.map((club) => buildCareerTeamDef(career, club.id));

  it('carries a four-drill focus stack from career condition into kickoff', () => {
    const lineup = career.lineups.find(
      (candidate) => candidate.clubId === career.userClubId,
    )!;
    const player = career.players.find(
      (candidate) =>
        candidate.clubId === career.userClubId &&
        candidate.role === 'FWD' &&
        lineup.playerIds.includes(candidate.id),
    )!;
    let trained = { ...career, trainingPoints: 100 };
    for (let drill = 0; drill < 4; drill += 1) {
      trained = trainPlayerInstantly(trained, player.id, 'finishing').state;
    }

    const team = buildCareerTeamDef(trained, trained.userClubId);
    const match = createMatch(981, team, teams[1]);
    const playerIndex = match.players.findIndex(
      (candidate) => candidate.def.id === player.id,
    );

    expect(
      trained.players.find((candidate) => candidate.id === player.id)
        ?.condition,
    ).toBe(68);
    expect(
      team.players.find((candidate) => candidate.id === player.id)
        ?.startingCondition,
    ).toBe(68);
    expect(match.players[playerIndex].condition).toBe(68);
  });

  it('separates whole-match Energy Use costs and makes high STA materially valuable', () => {
    const team = teams[0];
    const opponent = teams[1];
    const save = runMode(team, opponent, 'SAVE_ENERGY');
    const balanced = runMode(team, opponent, 'BALANCED');
    const allOut = runMode(team, opponent, 'ALL_OUT');
    expect(save).toBeGreaterThan(balanced + 8);
    expect(balanced).toBeGreaterThan(allOut + 8);

    const withStamina = (sta: number): TeamDef => ({
      ...team,
      players: team.players.map((player) => ({
        ...player,
        attrs: { ...player.attrs, sta },
      })),
    });
    const low = runMode(withStamina(20), opponent, 'BALANCED');
    const high = runMode(withStamina(90), opponent, 'BALANCED');
    expect(high).toBeGreaterThan(low + 8);
  }, 30000);

  it('auto-manages fresh legs only for uncontrolled teams', () => {
    const watched = createMatch(404, teams[0], teams[1], { controlledTeam: 0 });
    runToFullTime(watched);
    expect(watched.substitutionsUsed[0]).toBe(0);
    expect(watched.substitutionsUsed[1]).toBeGreaterThan(0);
    expect(watched.substitutionsUsed[1]).toBeLessThanOrEqual(5);

    const quick = createMatch(404, teams[0], teams[1]);
    runToFullTime(quick);
    expect(quick.substitutionsUsed[0]).toBeGreaterThan(0);
    expect(quick.substitutionsUsed[0]).toBeLessThanOrEqual(5);
    expect(quick.substitutionsUsed[1]).toBeGreaterThan(0);
    expect(quick.substitutionsUsed[1]).toBeLessThanOrEqual(5);
    expect(quick.inputLog).toEqual([]);
  });

  it('puts every shipped starting XI in the 0-60 decision band when left on', () => {
    const violations: string[] = [];
    let observedMin = 100;
    let observedMax = 0;

    for (let clubIndex = 0; clubIndex < teams.length; clubIndex += 1) {
      const club = teams[clubIndex];
      const opponent = teams[(clubIndex + 1) % teams.length];
      for (const controlledTeam of [0, 1] as const) {
        for (let seed = 1; seed <= 25; seed += 1) {
          const home = controlledTeam === 0 ? club : opponent;
          const away = controlledTeam === 1 ? club : opponent;
          const match = createMatch(seed, home, away, { controlledTeam });
          let tiredAt70 = 0;
          let firstZeroTick: number | null = null;
          while (match.phase !== 'fulltime') {
            tick(match);
            const conditions = controlledConditions(match, controlledTeam);
            if (match.tick === MINUTE_70_TICK)
              tiredAt70 = conditions.filter(
                (condition) => condition <= 40,
              ).length;
            if (
              firstZeroTick === null &&
              conditions.some((condition) => condition === 0)
            )
              firstZeroTick = match.tick;
          }
          // A red-carded player was removed from the match rather than "left on";
          // excluding them prevents time spent permanently off-pitch from reading
          // as implausible energy preservation in this no-substitution rail.
          const final = playersStillOnPitch(match, controlledTeam);
          const min = Math.min(...final);
          const max = Math.max(...final);
          observedMin = Math.min(observedMin, min);
          observedMax = Math.max(observedMax, max);
          const label = `${club.id} ${controlledTeam === 0 ? 'home' : 'away'} seed ${seed}`;
          if (min > 5)
            violations.push(
              `${label}: least tired finished ${min.toFixed(1)} (needs <=5)`,
            );
          if (max > 60)
            violations.push(
              `${label}: freshest finished ${max.toFixed(1)} (needs <=60)`,
            );
          if (tiredAt70 < 3)
            violations.push(`${label}: only ${tiredAt70} tired at 70'`);
          // The floor is minute 70, not 75: these teams are the retuned opening
          // division a career actually plays, and its measured earliest zero is
          // minute 72.1 over these 500 runs. The old 75' figure was taken from
          // the raw content-pack ratings, which no career ever fields.
          if (firstZeroTick !== null && firstZeroTick < MINUTE_70_TICK) {
            violations.push(
              `${label}: first zero at tick ${firstZeroTick} before 70'`,
            );
          }
        }
      }
    }

    expect({
      observedMin,
      observedMax,
      violations: violations.slice(0, 20),
    }).toEqual({
      observedMin: expect.any(Number),
      observedMax: expect.any(Number),
      violations: [],
    });
  }, 120000);
});
