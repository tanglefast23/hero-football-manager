import { createMatch, queueInput, runMatch, tick } from '../match';
import { interruptWindup } from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState } from '../types';

const SPEEDSTER = 10; // Zip Vela (SAVE_FOR_TAP by default)
const RIVAL = 14;     // Rex Bould, United SUPER_STRENGTH (FIRE_WHEN_READY by default)

function tickUntil(m: MatchState, pred: () => boolean, max = 500): void {
  for (let i = 0; i < max && !pred(); i++) tick(m);
}

describe('hero gauge and firing', () => {
  it('non-heroes never gain gauge; heroes trickle up', () => {
    const m = createMatch(42, ROVERS, UNITED);
    for (let i = 0; i < 200; i++) tick(m);
    expect(m.players[1].gauge).toBe(0);
    expect(m.players[SPEEDSTER].gauge).toBeGreaterThan(0);
  });

  it('gauge 100 emits POWER_READY', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].gauge = 99.9;
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_READY' && (e as { player: number }).player === SPEEDSTER), 100);
    expect(m.events.some(e => e.kind === 'POWER_READY')).toBe(true);
  });

  it('a tap fires at strength 1.0 after the windup', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].gauge = 99.9;
    tickUntil(m, () => m.players[SPEEDSTER].powerState.kind === 'ready', 100);
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER));
    const fired = m.events.find(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER) as { strength: number; power: string };
    expect(fired.power).toBe('SUPER_SPEED');
    expect(fired.strength).toBe(1);
  });

  it('an ignored SAVE_FOR_TAP window auto-fires at 0.75', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].gauge = 99.9;
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER), 400);
    const fired = m.events.find(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER) as { strength: number };
    expect(fired.strength).toBe(0.75);
  });

  it('the rival hero fires on its own at 0.85 (FIRE_WHEN_READY, contextual)', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const rivalFired = r.events.filter(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === RIVAL) as Array<{ strength: number }>;
    expect(rivalFired.length).toBeGreaterThan(0);
    expect(rivalFired.every(f => f.strength === 0.85)).toBe(true);
  });
});

describe('windup interrupts and input guards', () => {
  it('interruptWindup: winding → idle at gauge 50 with the event', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[10].powerState = { kind: 'winding', untilTick: m.tick + 15, strength: 1 };
    interruptWindup(m, 10);
    expect(m.players[10].powerState.kind).toBe('idle');
    expect(m.players[10].gauge).toBe(50);
    expect(m.events.some(e => e.kind === 'POWER_INTERRUPTED' && (e as { player: number }).player === 10)).toBe(true);
  });

  it('a tackle during windup interrupts the power (integration through tackleTick)', () => {
    // Seed 7, not 42: the tackle contest is decided by the match's first rng draw
    // (nothing upstream consumes rng). Seed 42's first draw (0.6011) loses the
    // 65v62 contest (p=0.5622) and the tick-5 pass then takes the ball away for
    // good; seed 7's first draw (0.0117) wins it decisively.
    const m = createMatch(7, ROVERS, UNITED);
    m.ball = { kind: 'held', by: 10 };
    m.players[10].pos = { x: 3400, y: 6000 };
    m.players[10].powerState = { kind: 'winding', untilTick: m.tick + 500, strength: 1 };
    m.players[14].pos = { x: 3400, y: 6100 };
    for (const idx of [11, 12, 13, 15, 16, 17, 18, 19, 20, 21]) m.players[idx].pos = { x: 200, y: 400 };
    let interrupted = false;
    for (let i = 0; i < 120 && !interrupted; i++) {
      tick(m);
      interrupted = m.events.some(e => e.kind === 'POWER_INTERRUPTED' && (e as { player: number }).player === 10);
    }
    expect(interrupted).toBe(true);
    expect(m.players[10].gauge).toBe(50);
  });

  it('taps on rivals, non-heroes, and bad indices are rejected', () => {
    const m = createMatch(42, ROVERS, UNITED);
    expect(() => queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: 14 })).toThrow('own heroes');
    expect(() => queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: 5 })).toThrow('own heroes');
    expect(() => queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: 99 })).toThrow('own heroes');
    expect(m.inputLog).toHaveLength(0);
  });
});
