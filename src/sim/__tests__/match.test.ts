import { createMatch, tick, runMatch, envelopeFrom, runReplay, queueInput } from '../match';
import { restartKickoff } from '../engine';
import { ROVERS, UNITED } from '../teams';
import { HALF_TICKS } from '../geometry';

describe('match skeleton', () => {
  it('creates 22 players with correct fire policies', () => {
    const m = createMatch(42, ROVERS, UNITED);
    expect(m.players).toHaveLength(22);
    expect(m.players[10].firePolicy).toBe('SAVE_FOR_TAP');   // your hero
    expect(m.players[14].firePolicy).toBe('FIRE_WHEN_READY'); // rival hero
    expect(m.ball.kind).toBe('held');
    expect(m.events[0]).toMatchObject({ kind: 'KICKOFF', half: 1 });
  });

  it('runs to FULL_TIME with HALF_TIME inside the stoppage window', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const kinds = r.events.map(e => e.kind);
    expect(kinds.filter(k => k === 'KICKOFF').length).toBeGreaterThanOrEqual(2);
    expect(kinds[kinds.length - 1]).toBe('FULL_TIME');
    const ht = r.events.find(e => e.kind === 'HALF_TIME')?.t ?? -1;
    expect(ht).toBeGreaterThanOrEqual(HALF_TICKS);
    expect(ht).toBeLessThanOrEqual(HALF_TICKS + 50);
  });

  it('is deterministic: same seed → identical stream and score', () => {
    const a = runMatch(7, ROVERS, UNITED);
    const b = runMatch(7, ROVERS, UNITED);
    expect(a.events).toEqual(b.events);
    expect(a.score).toEqual(b.score);
  });

  it('players move each tick', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const before = m.players.map(p => ({ ...p.pos }));
    for (let i = 0; i < 50; i++) tick(m);
    const moved = m.players.filter((p, i) => p.pos.x !== before[i].x || p.pos.y !== before[i].y);
    expect(moved.length).toBeGreaterThan(10);
  });

  it('kickoff never hands the ball to an out player', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[9].outUntilTick = m.tick + 500;
    m.players[9].outReason = 'ko';
    restartKickoff(m, 0);
    expect(m.ball.kind).toBe('held');
    if (m.ball.kind === 'held') {
      expect(m.ball.by).not.toBe(9);
      expect(m.players[m.ball.by].outUntilTick).toBeLessThanOrEqual(m.tick);
      expect(m.players[m.ball.by].team).toBe(0);
    }
  });

  it('createMatch rejects malformed squads', () => {
    const tenMen = { ...ROVERS, players: ROVERS.players.slice(0, 10) };
    expect(() => createMatch(1, tenMen, UNITED)).toThrow('teams must have 11 players');
  });

  it('createMatch deep-copies teams: mutating the source cannot affect a running match', () => {
    const src = { ...ROVERS, players: ROVERS.players.map(p => ({ ...p, attrs: { ...p.attrs } })) };
    const m = createMatch(1, src, UNITED);
    src.players[9].attrs.pac = 1;
    src.players[9].name = 'Corrupted';
    expect(m.players[9].def.attrs.pac).toBe(66);
    expect(m.players[9].def.name).toBe('Dario Flint');
  });

  it('restarts do not teleport unavailable players back into formation', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[5].outUntilTick = m.tick + 500;
    m.players[5].outReason = 'ko';
    const where = { ...m.players[5].pos };
    restartKickoff(m, 1);
    expect(m.players[5].pos).toEqual(where);
  });

  it('envelopeFrom captures inputs and opts for a faithful replay', () => {
    const m = createMatch(9, ROVERS, UNITED, { homePolicy: 'FIRE_WHEN_READY' });
    queueInput(m, { tick: 100, kind: 'POWER_TAP', player: 10 });
    while (m.phase !== 'fulltime') tick(m);
    const env = envelopeFrom(m);
    expect(env.inputs).toHaveLength(1);
    expect(env.opts?.homePolicy).toBe('FIRE_WHEN_READY');
    const replayed = runReplay(env);
    expect(replayed.events).toEqual(m.events);
    expect(replayed.score).toEqual(m.score);
  });

  it('queueInput rejects past-stamped inputs (replay-fidelity invariant)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    for (let i = 0; i < 10; i++) tick(m);
    expect(() => queueInput(m, { tick: 5, kind: 'POWER_TAP', player: 10 })).toThrow('future-stamped');
    expect(m.inputLog).toHaveLength(0);
  });
});
