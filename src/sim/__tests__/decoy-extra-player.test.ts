import {
  attackingDecision,
  launchPass,
  movementTick,
  possessionTick,
  restartKickoff,
} from '../engine';
import { HOME_DECOY_INDEX, AWAY_DECOY_INDEX, playerAt } from '../entities';
import { createMatch, ENGINE_VERSION, runReplay } from '../match';
import { activatePower, dismissDecoyClone, powerTick } from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, TeamDef } from '../types';

function decoyTeams(both = false): [TeamDef, TeamDef] {
  return [
    {
      ...ROVERS,
      players: ROVERS.players.map((player, index) => ({
        ...player,
        attrs: { ...player.attrs },
        power: index === 5 ? 'DECOY_DOUBLE' as const : undefined,
      })),
    },
    {
      ...UNITED,
      players: UNITED.players.map((player, index) => ({
        ...player,
        attrs: { ...player.attrs },
        power: both && index === 5 ? 'DECOY_DOUBLE' as const : undefined,
      })),
    },
  ];
}

function placeHomeDecoyContext(match: MatchState): void {
  match.ball = { kind: 'held', by: 6 };
  match.players[6].pos = { x: 2600, y: 4000 };
  match.players[5].pos = { x: 3400, y: 4300 };
  match.players[9].pos = { x: 2200, y: 3100 };
  match.players[10].pos = { x: 3500, y: 3600 };
  match.players[12].pos = { x: 2700, y: 3700 };
  for (let index = 11; index < 22; index += 1) {
    if (index !== 12) match.players[index].pos = { x: 6500, y: 9000 };
  }
}

function spawnHomeDecoy(match: MatchState): void {
  placeHomeDecoyContext(match);
  activatePower(match, 5, 1);
  if (match.decoyClones[0] === null) throw new Error('expected home Decoy clone');
}

function forcePassArrival(match: MatchState): void {
  if (match.ball.kind !== 'pass') throw new Error('expected pass');
  const targetIdx = match.ball.willSucceed ? match.ball.to : match.ball.interceptor;
  const target = match.ball.arrivalPos ?? playerAt(match, targetIdx)?.pos;
  if (target === undefined) throw new Error('expected live pass target');
  match.ball.pos = { ...target };
  match.ball.z = 0;
  match.ball.vz = 0;
  possessionTick(match);
}

describe('Decoy Double genuine temporary player', () => {
  it('copies the chosen forward stats into stable reserved identity 22', () => {
    const match = createMatch(1818, ...decoyTeams());
    const baseIdentities = [...match.players];
    spawnHomeDecoy(match);
    const clone = match.decoyClones[0]!;
    const source = match.players[clone.sourceIdx];

    expect(HOME_DECOY_INDEX).toBe(22);
    expect(clone.ownerIdx).toBe(5);
    expect(clone.def.role).toBe('FWD');
    expect(clone.def.attrs).toEqual(source.def.attrs);
    expect(clone.condition).toBe(source.condition);
    expect(clone.def.power).toBeUndefined();
    expect(match.players).toHaveLength(22);
    expect(match.players.every((player, index) => player === baseIdentities[index])).toBe(true);
    expect(playerAt(match, HOME_DECOY_INDEX)).toBe(clone);
  });

  it('receives, carries, passes, and shoots through ordinary engine paths', () => {
    const match = createMatch(1818, ...decoyTeams());
    spawnHomeDecoy(match);
    const clone = match.decoyClones[0]!;

    launchPass(match, 6, HOME_DECOY_INDEX, false, true);
    expect(match.ball).toMatchObject({
      kind: 'pass',
      from: 6,
      to: HOME_DECOY_INDEX,
      decoyReceiverPlayerId: clone.def.id,
    });
    forcePassArrival(match);
    expect(match.ball).toEqual({ kind: 'held', by: HOME_DECOY_INDEX });

    const beforeCarry = { ...clone.pos };
    movementTick(match);
    expect(clone.pos).not.toEqual(beforeCarry);

    launchPass(match, HOME_DECOY_INDEX, 9, false, true);
    expect(match.events.at(-1)).toMatchObject({
      kind: 'PASS', from: HOME_DECOY_INDEX, to: 9, ok: true,
    });
    expect(match.ball).toMatchObject({ kind: 'pass', from: HOME_DECOY_INDEX, to: 9 });
    forcePassArrival(match);
    expect(match.ball).toEqual({ kind: 'held', by: 9 });

    clone.pos = { x: 3400, y: 1500 };
    match.ball = { kind: 'held', by: HOME_DECOY_INDEX };
    match.tick = 5;
    for (let index = 11; index < 22; index += 1) match.players[index].pos = { x: 500, y: 9000 };
    expect(attackingDecision(match, HOME_DECOY_INDEX).kind).toBe('shoot');
    possessionTick(match);
    expect(match.ball).toMatchObject({ kind: 'shot', pos: { x: 3400, y: 1500 } });
    expect(match.events.at(-1)).toMatchObject({
      kind: 'SHOT', by: clone.sourceIdx, actor: HOME_DECOY_INDEX,
    });
  });

  it('pops exactly once on expiry without disturbing a real-player carrier', () => {
    const match = createMatch(1818, ...decoyTeams());
    spawnHomeDecoy(match);
    const untilTick = match.decoyClones[0]!.untilTick;
    match.ball = { kind: 'held', by: 6 };
    match.tick = untilTick;
    powerTick(match);

    expect(match.decoyClones[0]).toBeNull();
    expect(match.ball).toEqual({ kind: 'held', by: 6 });
    expect(match.events.filter(event => event.kind === 'DECOY_POP')).toEqual([
      expect.objectContaining({ clone: HOME_DECOY_INDEX, source: 9, reason: 'expired' }),
    ]);
    expect(dismissDecoyClone(match, 0, 'invalid')).toBe(false);
    expect(match.events.filter(event => event.kind === 'DECOY_POP')).toHaveLength(1);
  });

  it('leaves the ball loose at the exact clone location when expiry catches it carrying', () => {
    const match = createMatch(1818, ...decoyTeams());
    spawnHomeDecoy(match);
    const clone = match.decoyClones[0]!;
    clone.pos = { x: 3123, y: 2789 };
    match.ball = { kind: 'held', by: HOME_DECOY_INDEX };
    match.tick = clone.untilTick;
    powerTick(match);

    expect(match.ball).toEqual({
      kind: 'loose', pos: { x: 3123, y: 2789 }, vel: { x: 0, y: 0 }, z: 0, vz: 0,
    });
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'DECOY_POP',
      clone: HOME_DECOY_INDEX,
      pos: { x: 3123, y: 2789 },
      reason: 'expired',
    }));
  });

  it('ends on opponent possession and reserves a separate stable slot for each team', () => {
    const match = createMatch(1818, ...decoyTeams(true));
    spawnHomeDecoy(match);

    match.ball = { kind: 'held', by: 17 };
    match.players[17].pos = { x: 4200, y: 6500 };
    match.players[16].pos = { x: 3300, y: 6200 };
    match.players[20].pos = { x: 2200, y: 7000 };
    match.players[21].pos = { x: 3500, y: 6800 };
    match.players[1].pos = { x: 4100, y: 6800 };
    for (let index = 0; index < 11; index += 1) {
      if (index !== 1) match.players[index].pos = { x: 300, y: 1200 };
    }
    activatePower(match, 16, 1);
    expect(match.decoyClones[0]).not.toBeNull();
    expect(match.decoyClones[1]).not.toBeNull();
    expect(playerAt(match, HOME_DECOY_INDEX)?.team).toBe(0);
    expect(playerAt(match, AWAY_DECOY_INDEX)?.team).toBe(1);

    powerTick(match);
    expect(match.decoyClones[0]).toBeNull();
    expect(match.decoyClones[1]).not.toBeNull();
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'DECOY_POP', clone: HOME_DECOY_INDEX, reason: 'turnover',
    }));
  });

  it('clears safely on restart and invalid identity without shifting base slots', () => {
    const restarted = createMatch(1818, ...decoyTeams());
    const baseIds = restarted.players.map(player => player.def.id);
    spawnHomeDecoy(restarted);
    restartKickoff(restarted, 0);
    expect(restarted.decoyClones[0]).toBeNull();
    expect(restarted.players.map(player => player.def.id)).toEqual(baseIds);
    expect(restarted.events.filter(event => event.kind === 'DECOY_POP')).toEqual([
      expect.objectContaining({ clone: HOME_DECOY_INDEX, reason: 'restart' }),
    ]);

    const invalid = createMatch(1818, ...decoyTeams());
    spawnHomeDecoy(invalid);
    invalid.decoyClones[0]!.sourcePlayerId = 'stale-source';
    powerTick(invalid);
    expect(invalid.decoyClones[0]).toBeNull();
    expect(invalid.events.filter(event => event.kind === 'DECOY_POP')).toEqual([
      expect.objectContaining({ clone: HOME_DECOY_INDEX, reason: 'invalid' }),
    ]);
  });

  it('is byte-identical for the same seed and action sequence', () => {
    function deterministicRun(): string {
      const match = createMatch(404, ...decoyTeams());
      spawnHomeDecoy(match);
      launchPass(match, 6, HOME_DECOY_INDEX, false, true);
      forcePassArrival(match);
      for (let step = 0; step < 8; step += 1) {
        match.tick += 1;
        movementTick(match);
        possessionTick(match);
      }
      const clone = match.decoyClones[0];
      if (clone === null) throw new Error('clone ended before deterministic expiry');
      match.tick = clone.untilTick;
      powerTick(match);
      return JSON.stringify({ ball: match.ball, events: match.events, players: match.players, clones: match.decoyClones });
    }

    expect(deterministicRun()).toBe(deterministicRun());
  });

  it('replays a naturally fired Decoy match byte-for-byte', () => {
    const [home, away] = decoyTeams();
    let replayWithDecoy: ReturnType<typeof runReplay> | null = null;
    for (let seed = 1; seed <= 30 && replayWithDecoy === null; seed += 1) {
      const envelope = {
        schemaVersion: 1 as const,
        engineVersion: ENGINE_VERSION,
        seed,
        home,
        away,
        inputs: [],
        opts: { homePolicy: 'FIRE_WHEN_READY' as const, awayPolicy: 'FIRE_WHEN_READY' as const },
      };
      const first = runReplay(envelope);
      if (!first.events.some(event => event.kind === 'DECOY_POP')) continue;
      const second = runReplay(JSON.parse(JSON.stringify(envelope)));
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      replayWithDecoy = first;
    }
    expect(replayWithDecoy).not.toBeNull();
  });
});
