import {
  AUTO_ENERGY_USE_TICKS,
  AUTO_SUBSTITUTION_TICKS,
  applyAutomaticCoaching,
  automaticEnergyUse,
  automaticRoleValue,
  automaticTeams,
} from '../auto-coaching';
import { createMatch, envelopeFrom, runReplay, tick } from '../match';
import { ROVERS, UNITED } from '../teams';
import type { PlayerDef, TeamDef } from '../types';

function reserve(id: string, role: PlayerDef['role'], rating = 80): PlayerDef {
  return {
    id,
    name: `Reserve ${id}`,
    role,
    attrs: {
      pac: rating,
      sho: rating,
      pas: rating,
      def: rating,
      tec: rating,
      sta: rating,
      ref: rating,
    },
  };
}

function uniform(player: PlayerDef, rating: number): PlayerDef {
  return {
    ...player,
    attrs: {
      pac: rating,
      sho: rating,
      pas: rating,
      def: rating,
      tec: rating,
      sta: rating,
      ref: rating,
    },
  };
}

function withBench(team: TeamDef, prefix: string): TeamDef {
  return {
    ...team,
    bench: [
      reserve(`${prefix}-def`, 'DEF'),
      reserve(`${prefix}-def-b`, 'DEF'),
      reserve(`${prefix}-mid-a`, 'MID'),
      reserve(`${prefix}-mid-b`, 'MID'),
      reserve(`${prefix}-fwd`, 'FWD'),
    ],
  };
}

function setCheckpoint(
  match: ReturnType<typeof createMatch>,
  tick: number,
): void {
  match.tick = tick;
  match.half = 2;
}

function runToFullTime(match: ReturnType<typeof createMatch>): void {
  while (match.phase !== 'fulltime') tick(match);
}

describe('deterministic automatic coaching', () => {
  it('auto-manages only the opponent in a controlled match and both teams in an uncontrolled match', () => {
    const watchedHome = createMatch(1, ROVERS, UNITED, { controlledTeam: 0 });
    const watchedAway = createMatch(1, ROVERS, UNITED, { controlledTeam: 1 });
    const uncontrolled = createMatch(1, ROVERS, UNITED);
    expect(automaticTeams(watchedHome)).toEqual([1]);
    expect(automaticTeams(watchedAway)).toEqual([0]);
    expect(automaticTeams(uncontrolled)).toEqual([0, 1]);
  });

  it('uses one role-compatible opponent substitution at a checkpoint without logging an input', () => {
    const match = createMatch(
      2,
      withBench(ROVERS, 'h'),
      withBench(UNITED, 'a'),
      { controlledTeam: 0 },
    );
    match.players[12].condition = 20;
    match.players[5].condition = 10;
    setCheckpoint(match, AUTO_SUBSTITUTION_TICKS[0]);

    applyAutomaticCoaching(match);

    expect(match.players[12].def.id).toBe('a-def');
    expect(match.players[12].condition).toBe(100);
    expect(match.substitutionsUsed).toEqual([0, 1]);
    expect(match.inputLog).toEqual([]);
    expect(match.events).toContainEqual(
      expect.objectContaining({
        t: AUTO_SUBSTITUTION_TICKS[0],
        kind: 'SUBSTITUTION',
        team: 1,
        player: 12,
        inPlayerId: 'a-def',
      }),
    );
  });

  it('auto-substitutes both sides in an uncontrolled match and uses stable player-ID tie breaking', () => {
    const match = createMatch(
      3,
      withBench(ROVERS, 'h'),
      withBench(UNITED, 'a'),
    );
    match.players[1].condition = 20;
    match.players[2].condition = 20;
    match.players[12].condition = 20;
    setCheckpoint(match, AUTO_SUBSTITUTION_TICKS[0]);

    applyAutomaticCoaching(match);

    expect(match.players[1].def.id).toBe('h-def');
    expect(match.players[12].def.id).toBe('a-def');
    expect(match.substitutionsUsed).toEqual([1, 1]);
  });

  it('skips an incompatible red player and covers the next eligible red player', () => {
    const away = { ...UNITED, bench: [reserve('only-mid', 'MID')] };
    const match = createMatch(4, ROVERS, away, { controlledTeam: 0 });
    match.players[12].condition = 0;
    match.players[16].condition = 10;
    match.tick = AUTO_SUBSTITUTION_TICKS[0] - 1;

    applyAutomaticCoaching(match);

    expect(match.players[12].def.id).toBe('u1');
    expect(match.players[16].def.id).toBe('only-mid');
    expect(match.substitutionsUsed[1]).toBe(1);
  });

  it('immediately replaces a red opponent with a weaker fresh reserve between checkpoints', () => {
    const away = { ...UNITED, bench: [reserve('weaker-def', 'DEF', 1)] };
    const match = createMatch(13, ROVERS, away, { controlledTeam: 0 });
    match.players[12].condition = 30;
    match.tick = AUTO_SUBSTITUTION_TICKS[0] - 1;

    applyAutomaticCoaching(match);

    expect(match.players[12].def.id).toBe('weaker-def');
    expect(match.players[12].condition).toBe(100);
    expect(match.substitutionsUsed[1]).toBe(1);
    expect(match.inputLog).toEqual([]);
  });

  it('does not use a substitution to restore a sent-off slot', () => {
    const match = createMatch(12, ROVERS, withBench(UNITED, 'a'), {
      controlledTeam: 0,
    });
    match.players[12].condition = 0;
    match.players[12].outReason = 'redcard';
    match.players[12].outUntilTick = Number.MAX_SAFE_INTEGER;
    match.players[13].condition = 10;
    setCheckpoint(match, AUTO_SUBSTITUTION_TICKS[0]);

    applyAutomaticCoaching(match);

    expect(match.players[12].def.id).toBe('u1');
    expect(match.players[13].def.id).toBe('a-def');
    expect(match.substitutionsUsed[1]).toBe(1);
  });

  it('keeps the exported effort decision Balanced before the first 65-minute checkpoint', () => {
    const match = createMatch(8, ROVERS, UNITED, { controlledTeam: 0 });
    match.score = [2, 1];
    match.tick = AUTO_ENERGY_USE_TICKS[0] - 1;
    expect(automaticEnergyUse(match, 1)).toBe('BALANCED');
  });

  it('chooses All Out when trailing, Save Energy when leading late, and does not flicker between checkpoints', () => {
    const match = createMatch(
      5,
      withBench(ROVERS, 'h'),
      withBench(UNITED, 'a'),
      { controlledTeam: 0 },
    );
    match.score = [2, 1];
    setCheckpoint(match, AUTO_ENERGY_USE_TICKS[0]);
    applyAutomaticCoaching(match);
    expect(match.tactics[1].energyUse).toBe('ALL_OUT');

    match.score = [1, 2];
    match.tick = AUTO_ENERGY_USE_TICKS[1] - 1;
    applyAutomaticCoaching(match);
    expect(match.tactics[1].energyUse).toBe('ALL_OUT');
    match.tick = AUTO_ENERGY_USE_TICKS[1];
    applyAutomaticCoaching(match);
    expect(match.tactics[1].energyUse).toBe('SAVE_ENERGY');
  });

  it('protects an exhausted side with no substitutions even when trailing', () => {
    const match = createMatch(6, ROVERS, withBench(UNITED, 'a'), {
      controlledTeam: 0,
    });
    match.score = [2, 1];
    match.substitutionsUsed[1] = 5;
    for (let index = 11; index < 22; index += 1)
      match.players[index].condition = 30;
    setCheckpoint(match, AUTO_ENERGY_USE_TICKS[2]);

    applyAutomaticCoaching(match);

    expect(match.tactics[1].energyUse).toBe('SAVE_ENERGY');

    const noBench = createMatch(7, ROVERS, UNITED, { controlledTeam: 0 });
    noBench.score = [2, 1];
    for (let index = 11; index < 22; index += 1)
      noBench.players[index].condition = 30;
    setCheckpoint(noBench, AUTO_ENERGY_USE_TICKS[2]);
    applyAutomaticCoaching(noBench);
    expect(noBench.tactics[1].energyUse).toBe('SAVE_ENERGY');

    const unusableBench = createMatch(
      9,
      ROVERS,
      { ...UNITED, bench: [reserve('only-gk', 'GK', 1)] },
      { controlledTeam: 0 },
    );
    unusableBench.score = [2, 1];
    for (let index = 11; index < 22; index += 1)
      unusableBench.players[index].condition = 30;
    setCheckpoint(unusableBench, AUTO_ENERGY_USE_TICKS[2]);
    applyAutomaticCoaching(unusableBench);
    expect(unusableBench.tactics[1].energyUse).toBe('SAVE_ENERGY');
  });

  it('values fresh role players above the same exhausted player without using floats', () => {
    const player = reserve('value', 'MID', 70);
    expect(automaticRoleValue(player, 100)).toBeGreaterThan(
      automaticRoleValue(player, 20),
    );
    expect(Number.isSafeInteger(automaticRoleValue(player, 63))).toBe(true);
  });

  it('keeps the same role-value gap when every rating scales by ten', () => {
    const lowGap =
      automaticRoleValue(reserve('low-a', 'MID', 50), 100) -
      automaticRoleValue(reserve('low-b', 'MID', 45), 100);
    const highGap =
      automaticRoleValue(reserve('high-a', 'MID', 500), 100) -
      automaticRoleValue(reserve('high-b', 'MID', 450), 100);
    expect(Math.abs(lowGap - highGap)).toBeLessThanOrEqual(1);
  });

  it('accepts the exact three-point improvement, rejects less, and breaks bench ties by ID', () => {
    const exactAway: TeamDef = {
      ...UNITED,
      players: UNITED.players.map((player, index) =>
        index === 1 ? uniform(player, 50) : player,
      ),
      bench: [reserve('z-def', 'DEF', 48), reserve('a-def', 'DEF', 48)],
    };
    const exact = createMatch(10, ROVERS, exactAway, { controlledTeam: 0 });
    exact.players[12].condition = 60;
    setCheckpoint(exact, AUTO_SUBSTITUTION_TICKS[0]);
    applyAutomaticCoaching(exact);
    expect(exact.players[12].def.id).toBe('a-def');

    const belowAway = {
      ...exactAway,
      bench: [reserve('below-def', 'DEF', 47)],
    };
    const below = createMatch(10, ROVERS, belowAway, { controlledTeam: 0 });
    below.players[12].condition = 60;
    setCheckpoint(below, AUTO_SUBSTITUTION_TICKS[0]);
    applyAutomaticCoaching(below);
    expect(below.players[12].def.id).toBe('u1');
  });

  it('does not cascade substitutions through an exhausted bench (m2.1 freshness gate)', () => {
    const home: TeamDef = {
      ...ROVERS,
      players: ROVERS.players.map((player, index) =>
        index === 5
          ? { ...player, startingCondition: 28 }
          : index === 8
            ? { ...player, startingCondition: 29 }
            : player,
      ),
      bench: [22, 23, 24, 25, 26].map((startingCondition, index) => ({
        ...reserve(`tired-mid-${index}`, 'MID'),
        startingCondition,
      })),
    };
    const match = createMatch(7, home, UNITED);

    for (let i = 0; i < 6; i += 1) tick(match);

    expect(
      match.events.filter((event) => event.kind === 'SUBSTITUTION'),
    ).toEqual([]);
    expect(match.substitutionsUsed).toEqual([0, 0]);
  });

  it('still makes an immediate emergency substitution when the reserve is genuinely fresh', () => {
    const home: TeamDef = {
      ...ROVERS,
      players: ROVERS.players.map((player, index) =>
        index === 5 ? { ...player, startingCondition: 28 } : player,
      ),
      bench: [reserve('fresh-mid', 'MID')],
    };
    const match = createMatch(7, home, UNITED);

    tick(match);

    expect(match.players[5].def.id).toBe('fresh-mid');
    expect(match.players[5].condition).toBeGreaterThan(99); // entered fresh, minus one tick of drain
    expect(match.substitutionsUsed).toEqual([1, 0]);
  });

  it('rates a scheduled replacement at his real entry condition, not a hardcoded 100', () => {
    // A fresh 48-rated reserve sits exactly on the three-point margin over a
    // tired 50-rated starter (see the boundary test above). The same reserve
    // arriving at 90 condition must fall below it.
    const away: TeamDef = {
      ...UNITED,
      players: UNITED.players.map((player, index) =>
        index === 1 ? uniform(player, 50) : player,
      ),
      bench: [{ ...reserve('worn-def', 'DEF', 48), startingCondition: 90 }],
    };
    const match = createMatch(10, ROVERS, away, { controlledTeam: 0 });
    match.players[12].condition = 60;
    setCheckpoint(match, AUTO_SUBSTITUTION_TICKS[0]);

    applyAutomaticCoaching(match);

    expect(match.players[12].def.id).toBe('u1');
    expect(match.substitutionsUsed).toEqual([0, 0]);
  });

  it.each([
    ['watched home', { controlledTeam: 0 as const }, [0, 5]],
    ['watched away', { controlledTeam: 1 as const }, [5, 0]],
    ['uncontrolled match', {}, [5, 5]],
  ])(
    'regenerates %s automatic coaching during replay without fake inputs',
    (_label, opts, expectedSubs) => {
      const match = createMatch(
        77,
        withBench(ROVERS, 'h'),
        withBench(UNITED, 'a'),
        opts,
      );
      runToFullTime(match);
      expect(match.substitutionsUsed).toEqual(expectedSubs);
      expect(match.inputLog).toEqual([]);

      const replayed = runReplay(envelopeFrom(match));
      expect(replayed.score).toEqual(match.score);
      expect(replayed.events).toEqual(match.events);
    },
  );
});
