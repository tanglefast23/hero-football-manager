import { createMatch, queueInput, runMatch, tick } from '../match';
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
