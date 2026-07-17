import { createMatch, queueInput, runMatch, tick } from '../match';
import { speedFor } from '../engine';
import { activatePower, interruptWindup, ZONE_WINDOW_TICKS } from '../powers';
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

  it('high heat rolls a Zone entry (POWER_READY, now meaning "entered the Zone")', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].gauge = 199; // near the heat cap maximizes the per-tick entry roll
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_READY' && (e as { player: number }).player === SPEEDSTER), 300);
    expect(m.events.some(e => e.kind === 'POWER_READY' && (e as { player: number }).player === SPEEDSTER)).toBe(true);
    expect(m.players[SPEEDSTER].powerState.kind).toBe('zone');
    expect(m.players[SPEEDSTER].gauge).toBe(0); // heat resets on entry
  });

  it('a tap fires at strength 1.0 after the windup (rigged directly into the Zone)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER));
    const fired = m.events.find(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER) as { strength: number; power: string };
    expect(fired.power).toBe('SUPER_SPEED');
    expect(fired.strength).toBe(1);
  });

  it('a SAVE_FOR_TAP hero who is not tapped in time gets POWER_EXPIRED, decays to 50 heat, and never auto-fires', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_EXPIRED' && (e as { player: number }).player === SPEEDSTER), ZONE_WINDOW_TICKS + 5);
    expect(m.events.some(e => e.kind === 'POWER_EXPIRED' && (e as { player: number }).player === SPEEDSTER)).toBe(true);
    expect(m.players[SPEEDSTER].powerState.kind).toBe('idle');
    expect(m.players[SPEEDSTER].gauge).toBe(50);
    expect(m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === SPEEDSTER)).toBe(false);
  });

  it('the rival auto-fires only via context (0.85) — never a targetless 0.75 lapse, never 1.0', () => {
    // SUPER_STRENGTH requires a target (Task 12.2 ruling): its zone either finds a
    // context (which guarantees a lock) and fires 0.85, or expires. Zone entry is a
    // probabilistic roll, so a single seed may have zero rival fires — scan seeds
    // 1-20 (this task's empirical range) for existence plus the strength invariant.
    let fires = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const r = runMatch(seed, ROVERS, UNITED);
      for (const e of r.events) {
        if (e.kind === 'POWER_FIRED' && (e as { player: number }).player === RIVAL) {
          fires++;
          expect((e as { strength: number }).strength).toBe(0.85);
        }
      }
    }
    expect(fires).toBeGreaterThan(0);
  });

  it('a FIRE_WHEN_READY SUPER_STRENGTH hero with no lockable target expires instead of firing targetless', () => {
    const m = createMatch(42, ROVERS, UNITED);
    // Every opponent is out: the only possible opposing "carrier" is the out kickoff
    // holder frozen at midfield (~2900+ from Rex's anchor), so no opposing carrier can
    // enter STRENGTH_LOCK_RANGE at any point in the window — no context, ever.
    for (let i = 0; i < 11; i++) {
      m.players[i].outUntilTick = 10_000;
      m.players[i].outReason = 'ko';
    }
    m.ball = { kind: 'held', by: 16 }; // United's own carrier is never a context for Rex
    m.players[RIVAL].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_EXPIRED' && (e as { player: number }).player === RIVAL), ZONE_WINDOW_TICKS + 5);
    expect(m.events.some(e => e.kind === 'POWER_EXPIRED' && (e as { player: number }).player === RIVAL)).toBe(true);
    expect(m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === RIVAL)).toBe(false);
    expect(m.players[RIVAL].powerState.kind).toBe('idle');
    expect(m.players[RIVAL].gauge).toBe(50);
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

describe('power effects', () => {
  it('SUPER_SPEED multiplies speed while active — read through the authoritative speedFor(state, idx)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const base = speedFor(m, SPEEDSTER);
    m.players[SPEEDSTER].powerState = { kind: 'active', untilTick: m.tick + 40, strength: 1 };
    expect(speedFor(m, SPEEDSTER)).toBe(Math.round((base / 1) * 2.2));
  });

  it('FIRE_TORCH ignites the nearest opponent, who is later extinguished', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const torch = 9;
    // Rig at midfield: Dario already carries the kickoff at center (outside shot range);
    // a presser starts just outside tackle range and pressing keeps him inside 800
    // through the windup.
    m.ball = { kind: 'held', by: torch };
    m.players[17].pos = { x: 3400, y: 5550 };
    m.players[torch].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: torch });
    tickUntil(m, () => m.events.some(e => e.kind === 'IGNITED'), 300);
    const ignited = m.events.find(e => e.kind === 'IGNITED') as { player: number };
    expect(ignited.player).toBeGreaterThanOrEqual(11);
    tickUntil(m, () => m.events.some(e => e.kind === 'EXTINGUISHED'), 300);
    expect(m.events.some(e => e.kind === 'EXTINGUISHED')).toBe(true);
  });

  it('igniting the ball carrier releases the ball (knockOut) instead of freezing possession', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const torch = 9;
    const oppCarrier = 11;
    const pos = { x: 3400, y: 5250 };
    m.ball = { kind: 'held', by: oppCarrier };
    m.players[torch].pos = { ...pos };
    m.players[oppCarrier].pos = { ...pos }; // co-located with torch: guaranteed "nearest opponent"
    for (const idx of [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) m.players[idx].pos = { x: 200, y: 9000 };
    activatePower(m, torch, 1); // direct call — no tick() pipeline, so nothing can re-pick-up the ball before we assert
    const ignited = m.events.find(e => e.kind === 'IGNITED') as { player: number } | undefined;
    expect(ignited?.player).toBe(oppCarrier);
    expect(m.ball).toEqual({ kind: 'loose', pos, vel: { x: 0, y: 0 } });
  });

  it('rival SUPER_STRENGTH locks its target at windup start, charges, and flattens them', () => {
    const m = createMatch(42, ROVERS, UNITED);
    // Rig at midfield (outside shot range): Zip carries on top of Rex; zone set directly
    // so the lock happens at this windup's start. The flatten must land even though Zip
    // releases the ball during the charge (hadBall false is fine — that IS the counterplay).
    m.ball = { kind: 'held', by: SPEEDSTER };
    m.players[SPEEDSTER].pos = { x: 3400, y: 5250 };
    m.players[RIVAL].pos = { x: 3400, y: 5250 };
    m.players[RIVAL].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    tickUntil(m, () => m.events.some(e => e.kind === 'POWER_FIRED' && (e as { player: number }).player === RIVAL), 200);
    expect(m.players[SPEEDSTER].outReason).toBe('ko');
    expect(m.players[SPEEDSTER].outUntilTick).toBeGreaterThan(m.tick);
    expect(m.events.some(e => e.kind === 'TACKLE' && (e as { by: number }).by === RIVAL)).toBe(true);
  });

  it('one-active-per-team: a winding/active teammate freezes the others Zone timer and heat', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const torch = 9;
    m.players[torch].powerState = { kind: 'winding', untilTick: m.tick + 200, strength: 1 };
    m.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
    m.players[SPEEDSTER].gauge = 0;
    for (let i = 0; i < 30; i++) tick(m);
    expect(m.players[torch].powerState.kind).toBe('winding'); // still busy — untilTick (200) not reached
    expect(m.players[SPEEDSTER].powerState).toEqual({ kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS });
    expect(m.players[SPEEDSTER].gauge).toBe(0);
  });

  it('cards appear across many seeds', () => {
    let sawCard = false;
    for (let seed = 1; seed <= 60 && !sawCard; seed++) {
      sawCard = runMatch(seed, ROVERS, UNITED).events.some(e => e.kind === 'CARD');
    }
    expect(sawCard).toBe(true);
  });

  it('a second yellow card sends the player off (red + permanent out)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.players[9].cards = 1;
    m.rng = () => 0.10; // forces the yellow branch for FIRE_TORCH (redP 0, yellowP 0.15)
    activatePower(m, 9, 1);
    const cards = m.events.filter(e => e.kind === 'CARD' && (e as { player: number }).player === 9) as Array<{ color: string }>;
    expect(cards.map(c => c.color)).toEqual(['yellow', 'red']);
    expect(m.players[9].outUntilTick).toBe(Number.MAX_SAFE_INTEGER);
    expect(m.players[9].outReason).toBe('redcard');
  });
});
