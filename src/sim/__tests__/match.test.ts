import { createMatch, tick, runMatch } from '../match';
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

  it('runs to FULL_TIME with HALF_TIME exactly at HALF_TICKS', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const kinds = r.events.map(e => e.kind);
    expect(kinds.filter(k => k === 'KICKOFF').length).toBeGreaterThanOrEqual(2);
    expect(kinds[kinds.length - 1]).toBe('FULL_TIME');
    expect(r.events.find(e => e.kind === 'HALF_TIME')?.t).toBe(HALF_TICKS);
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
});
