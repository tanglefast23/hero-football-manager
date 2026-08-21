import { createMatch, queueInput, tick } from '../match';
import { speedFor } from '../engine';
import { fullConditionMovementSpeed } from '../attributes';
import {
  activatePower,
  addGauge,
  inUsefulContext,
  interruptWindup,
  knockOut,
  MAX_ZONES_PER_PLAYER,
  powerTick,
  ZONE_WINDOW_TICKS,
} from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PowerId } from '../types';

const SPEEDSTER = 10; // Zip Vela (home hero, pinned to SAVE_FOR_TAP below)
const RIVAL = 14; // Rex Bould, United SUPER_STRENGTH (FIRE_WHEN_READY by default)

// The engine defaults both teams to the shipped FIRE_WHEN_READY policy (m2.1).
// These tests drive home powers by hand, so they pin the home side to the
// SAVE_FOR_TAP test instrumentation policy explicitly.
const TAP_HOME = { homePolicy: 'SAVE_FOR_TAP' } as const;

function tickUntil(m: MatchState, pred: () => boolean, max = 500): void {
  for (let i = 0; i < max && !pred(); i++) tick(m);
}

describe('hero gauge and firing', () => {
  it('non-heroes never gain gauge; heroes trickle up', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    for (let i = 0; i < 200; i++) tick(m);
    expect(m.players[1].gauge).toBe(0);
    expect(m.players[SPEEDSTER].gauge).toBeGreaterThan(0);
  });

  it('applies the team Heat-rate modifier to every gauge reward', () => {
    const boosted = createMatch(
      42,
      { ...ROVERS, heroGaugeRatePercent: 125 },
      UNITED,
    );
    addGauge(boosted, SPEEDSTER, 20);
    expect(boosted.players[SPEEDSTER].gauge).toBe(25);
  });

  it('rewards an interception far above a routine pass reception', () => {
    // A midfielder's decisive act is winning the ball in flight. Crediting it
    // the same 2 Heat as being passed to is why MID carriers never reach the
    // Zone threshold at all (M4 gate: 0.00 zones/match).
    const received = createMatch(42, ROVERS, UNITED, TAP_HOME);
    received.ball = {
      kind: 'pass',
      from: 9,
      fromPlayerId: received.players[9].def.id,
      to: SPEEDSTER,
      pos: { ...received.players[SPEEDSTER].pos },
      speed: 200,
      willSucceed: true,
      interceptor: -1,
      z: 0,
      vz: 0,
    };
    tick(received);
    const receptionHeat = received.players[SPEEDSTER].gauge;

    const stolen = createMatch(42, ROVERS, UNITED, TAP_HOME);
    stolen.ball = {
      kind: 'pass',
      from: 14,
      fromPlayerId: stolen.players[14].def.id,
      to: 15,
      pos: { ...stolen.players[SPEEDSTER].pos },
      speed: 200,
      willSucceed: false,
      interceptor: SPEEDSTER,
      z: 0,
      vz: 0,
    };
    tick(stolen);
    const interceptionHeat = stolen.players[SPEEDSTER].gauge;

    expect(receptionHeat).toBeGreaterThan(0);
    expect(interceptionHeat).toBeGreaterThanOrEqual(receptionHeat * 4);
  });

  it('waits through a usable-but-not-ideal moment and fires once the ideal one arrives', () => {
    // Engine m1.27 replaced the late-window 0.75 lapse with patience. The problem
    // the lapse solved (M4 gate: seven of twelve powers firing in 0-17% of
    // matches) is now solved better — a charged power holds indefinitely instead
    // of settling for a worse moment. Blink Run is usable from 45% attacking
    // progress but its ideal context waits for 55%, so this carrier starts
    // usable-but-not-ideal.
    const m = createMatch(
      42,
      {
        ...ROVERS,
        players: ROVERS.players.map((pl, i) =>
          i === SPEEDSTER
            ? { ...pl, power: 'BLINK_RUN' as const }
            : { ...pl, power: undefined },
        ),
      },
      UNITED,
      { homePolicy: 'FIRE_WHEN_READY' },
    );
    const hero = m.players[SPEEDSTER];
    hero.powerState = { kind: 'zone', remainingTicks: 3 };
    hero.pos = { x: 2250, y: 5500 };
    m.ball = { kind: 'held', by: SPEEDSTER };

    expect(inUsefulContext(m, SPEEDSTER)).toBe(false);
    powerTick(m);

    // Held, not spent, and never wasted.
    expect(m.players[SPEEDSTER].powerState.kind).toBe('zone');
    expect(m.events.some((e) => e.kind === 'POWER_EXPIRED')).toBe(false);
    expect(m.events.some((e) => e.kind === 'POWER_FIRED')).toBe(false);

    // Advance the carrier into the ideal context; now it converts, at full
    // contextual strength rather than the old discounted lapse grade.
    m.players[SPEEDSTER].pos = { x: 2250, y: 3800 };
    m.ball = { kind: 'held', by: SPEEDSTER };
    expect(inUsefulContext(m, SPEEDSTER)).toBe(true);
    powerTick(m);

    // Committing means leaving the Zone for the wind-up; POWER_FIRED itself is
    // emitted later, when activatePower resolves at the end of that wind-up.
    expect(m.players[SPEEDSTER].powerState.kind).toBe('winding');
    expect(m.events.some((e) => e.kind === 'POWER_EXPIRED')).toBe(false);
  });

  it('accepts an assistant Motivator half-percent Heat modifier', () => {
    const boosted = createMatch(
      42,
      { ...ROVERS, heroGaugeRatePercent: 102.5 },
      UNITED,
    );
    addGauge(boosted, SPEEDSTER, 20);
    expect(boosted.players[SPEEDSTER].gauge).toBe(20.5);
  });

  it('converts a full bar the moment it fills, with nothing else required', () => {
    // The m2.8 inversion, stated as plainly as it can be. Before this, a hero
    // could sit at 199 Heat — more than three times the threshold — and stay
    // idle because their power's authored setup was not on the pitch. The
    // manager saw a full bar and no button, for minutes, with no explanation
    // available anywhere in the game.
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].gauge = 199;
    // An opponent has the ball at the far end: nothing this power wants.
    m.ball = { kind: 'held', by: 9 };
    powerTick(m);

    expect(m.players[SPEEDSTER].powerState.kind).toBe('zone');
    expect(m.players[SPEEDSTER].gauge).toBe(0); // heat resets on entry
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_READY' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(true);
    // Armed is not fired. The authored moment still gates the power itself.
    expect(inUsefulContext(m, SPEEDSTER)).toBe(false);
  });

  it('caps each hero at three Zone opportunities in one match', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    const hero = m.players[SPEEDSTER];
    hero.zonesOpened = MAX_ZONES_PER_PLAYER - 1;
    hero.gauge = 60;
    hero.pos = { x: 2250, y: 3500 };
    m.ball = { kind: 'held', by: SPEEDSTER };

    powerTick(m);
    expect(hero.powerState.kind).toBe('zone');
    expect(hero.zonesOpened).toBe(MAX_ZONES_PER_PLAYER);

    hero.powerState = { kind: 'idle' };
    addGauge(m, SPEEDSTER, 200);
    powerTick(m);
    expect(hero.gauge).toBe(0);
    expect(hero.powerState.kind).toBe('idle');

    // Expiry refunds and old saved matches can already contain banked Heat.
    // The cap belongs on Zone conversion too, not only on addGauge().
    hero.gauge = 50;
    powerTick(m);
    expect(hero.powerState.kind).toBe('idle');
    expect(
      m.events.filter(
        (event) => event.kind === 'POWER_READY' && event.player === SPEEDSTER,
      ),
    ).toHaveLength(1);
  });

  it('a tap fires at strength 1.0 after the windup (rigged directly into the Zone)', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    m.players[SPEEDSTER].pos = { x: 2250, y: 3500 };
    m.ball = { kind: 'held', by: SPEEDSTER };
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });
    tickUntil(m, () =>
      m.events.some(
        (e) =>
          e.kind === 'POWER_FIRED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    );
    const fired = m.events.find(
      (e) =>
        e.kind === 'POWER_FIRED' &&
        (e as { player: number }).player === SPEEDSTER,
    ) as { strength: number; power: string };
    expect(fired.power).toBe('SUPER_SPEED');
    expect(fired.strength).toBe(1);
  });

  it('an early tap is a no-op and a later useful tap fires at full strength', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].powerState = { kind: 'zone', remainingTicks: 5 };
    m.ball = { kind: 'held', by: 9 };

    powerTick(m, [{ tick: m.tick, kind: 'POWER_TAP', player: SPEEDSTER }]);
    expect(m.players[SPEEDSTER].powerState).toEqual({
      kind: 'zone',
      remainingTicks: 5,
    });

    m.players[SPEEDSTER].pos = { x: 2250, y: 3500 };
    m.ball = { kind: 'held', by: SPEEDSTER };
    powerTick(m, [{ tick: m.tick, kind: 'POWER_TAP', player: SPEEDSTER }]);
    expect(m.players[SPEEDSTER].powerState).toMatchObject({
      kind: 'winding',
      strength: 1,
    });
  });

  it('a SAVE_FOR_TAP hero holds its Zone indefinitely and never auto-fires', () => {
    // SAVE_FOR_TAP survives only as test instrumentation (docs/04). Since m1.27
    // its Zone no longer expires either, so the guarantee that still matters is
    // that it never fires on its own.
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    for (let i = 0; i < ZONE_WINDOW_TICKS + 20; i += 1) tick(m);
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_FIRED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(false);
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_EXPIRED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(false);
  });

  it('the rival auto-fires only via context (0.85) — never a targetless 0.75 lapse, never 1.0', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.ball = { kind: 'held', by: SPEEDSTER };
    m.players[SPEEDSTER].pos = { x: 3400, y: 5250 };
    m.players[RIVAL].pos = { ...m.players[SPEEDSTER].pos };
    m.players[RIVAL].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };

    tickUntil(
      m,
      () =>
        m.events.some((e) => e.kind === 'POWER_FIRED' && e.player === RIVAL),
      60,
    );

    const fired = m.events.find(
      (e) => e.kind === 'POWER_FIRED' && e.player === RIVAL,
    );
    expect(fired).toMatchObject({
      player: RIVAL,
      power: 'SUPER_STRENGTH',
      strength: 0.85,
    });
  });

  it('a FIRE_WHEN_READY SUPER_STRENGTH hero with no lockable target holds instead of firing targetless', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    // Every opponent is out: the only possible opposing "carrier" is the out kickoff
    // holder frozen at midfield (~2900+ from Rex's anchor), so no opposing carrier can
    // enter STRENGTH_LOCK_RANGE at any point in the window — no context, ever.
    for (let i = 0; i < 11; i++) {
      m.players[i].outUntilTick = 10_000;
      m.players[i].outReason = 'ko';
    }
    m.ball = { kind: 'held', by: 16 }; // United's own carrier is never a context for Rex
    m.players[RIVAL].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    for (let i = 0; i < ZONE_WINDOW_TICKS + 20; i += 1) tick(m);
    // Since m1.27 the Zone holds instead of decaying, so the guarantee is simply
    // that a power needing a victim never fires without one.
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_FIRED' &&
          (e as { player: number }).player === RIVAL,
      ),
    ).toBe(false);
    expect(m.players[RIVAL].powerState.kind).toBe('zone');
  });

  it('recognizes decisive carries, nearby loose balls, and a goal-side Torch marker during an attacking run', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].pos = { x: 3400, y: 4000 };
    m.ball = { kind: 'held', by: SPEEDSTER };
    expect(inUsefulContext(m, SPEEDSTER)).toBe(true);
    m.players[SPEEDSTER].pos = { x: 3400, y: 7000 };
    expect(inUsefulContext(m, SPEEDSTER)).toBe(false);

    m.ball = {
      kind: 'loose',
      pos: { x: 3400, y: 4100 },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    };
    m.players[SPEEDSTER].pos = { x: 3400, y: 4500 };
    expect(inUsefulContext(m, SPEEDSTER)).toBe(true);

    m.ball = { kind: 'held', by: 9 };
    m.players[9].pos = { x: 3400, y: 4000 };
    for (let index = 11; index < 22; index += 1)
      m.players[index].pos = { x: 200, y: 9000 };
    m.players[12].pos = { x: 3400, y: 3500 };
    expect(inUsefulContext(m, 9)).toBe(true);
    m.ball = { kind: 'held', by: 8 };
    expect(inUsefulContext(m, 9)).toBe(false);
    m.ball = { kind: 'held', by: 9 };
    m.players[12].pos = { x: 3400, y: 4600 };
    expect(inUsefulContext(m, 9)).toBe(false);
    m.players[12].pos = { x: 3400, y: 9000 };
    for (let index = 12; index < 22; index += 1)
      m.players[index].pos = { x: 200, y: 9000 };
    expect(inUsefulContext(m, 9)).toBe(false);
  });
});

describe('windup interrupts and input guards', () => {
  it('interruptWindup: winding → idle at gauge 50 with the event', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[10].powerState = {
      kind: 'winding',
      untilTick: m.tick + 15,
      strength: 1,
    };
    interruptWindup(m, 10);
    expect(m.players[10].powerState.kind).toBe('idle');
    expect(m.players[10].gauge).toBe(50);
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_INTERRUPTED' &&
          (e as { player: number }).player === 10,
      ),
    ).toBe(true);
  });

  it('a tackle during windup interrupts the power (integration through tackleTick)', () => {
    // Seed 7, not 42: the tackle contest is decided by the match's first rng draw
    // (nothing upstream consumes rng). Seed 42's first draw (0.6011) loses the
    // 65v62 contest (p=0.5622) and the tick-5 pass then takes the ball away for
    // good; seed 7's first draw (0.0117) wins it decisively.
    const m = createMatch(7, ROVERS, UNITED, TAP_HOME);
    m.ball = { kind: 'held', by: 10 };
    m.players[10].pos = { x: 3400, y: 6000 };
    m.players[10].powerState = {
      kind: 'winding',
      untilTick: m.tick + 500,
      strength: 1,
    };
    m.players[14].pos = { x: 3400, y: 6100 };
    for (const idx of [11, 12, 13, 15, 16, 17, 18, 19, 20, 21])
      m.players[idx].pos = { x: 200, y: 400 };
    let interrupted = false;
    for (let i = 0; i < 120 && !interrupted; i++) {
      tick(m);
      interrupted = m.events.some(
        (e) =>
          e.kind === 'POWER_INTERRUPTED' &&
          (e as { player: number }).player === 10,
      );
    }
    expect(interrupted).toBe(true);
    expect(m.players[10].gauge).toBe(50);
  });

  it('taps on rivals, non-heroes, and bad indices are rejected', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    expect(() =>
      queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: 14 }),
    ).toThrow('manually controlled team');
    expect(() =>
      queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: 5 }),
    ).toThrow('manually controlled team');
    expect(() =>
      queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: 99 }),
    ).toThrow('manually controlled team');
    expect(m.inputLog).toHaveLength(0);
  });

  it('accepts a tap for a manually controlled away hero', () => {
    const m = createMatch(42, ROVERS, UNITED, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'SAVE_FOR_TAP',
    });
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: RIVAL });
    expect(m.inputLog).toEqual([{ tick: 1, kind: 'POWER_TAP', player: RIVAL }]);
  });
});

describe('power effects', () => {
  it('SUPER_SPEED multiplies speed while active — read through the authoritative speedFor(state, idx)', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    const base = speedFor(m, SPEEDSTER);
    m.players[SPEEDSTER].powerState = {
      kind: 'active',
      untilTick: m.tick + 40,
      strength: 1,
    };
    expect(speedFor(m, SPEEDSTER)).toBeGreaterThanOrEqual(
      Math.round(base * 2.3),
    );
    expect(speedFor(m, SPEEDSTER)).toBeLessThanOrEqual(Math.round(base * 2.35));
  });

  it('allows a power to exceed the trained-only 999 PAC movement endpoint', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].def.attrs.pac = 999;
    const trainedMaximum = speedFor(m, SPEEDSTER);
    expect(trainedMaximum).toBe(Math.round(fullConditionMovementSpeed(999)));

    m.players[SPEEDSTER].powerState = {
      kind: 'active',
      untilTick: m.tick + 40,
      strength: 1,
    };
    expect(speedFor(m, SPEEDSTER)).toBeGreaterThan(trainedMaximum);
  });

  it('FIRE_TORCH ignites the nearest opponent, who is later extinguished', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    const torch = 9;
    // Rig an attacking carry with a marker between Dario and goal.
    m.ball = { kind: 'held', by: torch };
    m.players[torch].pos = { x: 3400, y: 4000 };
    m.players[12].pos = { x: 3400, y: 3400 };
    activatePower(m, torch, 1);
    const ignited = m.events.find((e) => e.kind === 'IGNITED') as {
      player: number;
    };
    expect(ignited.player).toBeGreaterThanOrEqual(11);
    tickUntil(m, () => m.events.some((e) => e.kind === 'EXTINGUISHED'), 800);
    expect(m.events.some((e) => e.kind === 'EXTINGUISHED')).toBe(true);
  });

  it('FIRE_TORCH uses the shared visible acquisition radius at every tier', () => {
    const firesAt = (distance: number) => {
      const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
      const torch = 9;
      m.ball = { kind: 'held', by: torch };
      m.players[torch].pos = { x: 2000, y: 4000 };
      m.players[12].pos = { x: 2000 + distance, y: 4000 };
      for (let index = 11; index < 22; index++) {
        if (index !== 12) m.players[index].pos = { x: 200, y: 9000 };
      }
      activatePower(m, torch, 0.85);
      return m.events.some((event) => event.kind === 'IGNITED');
    };

    expect(firesAt(1850)).toBe(true);
    expect(firesAt(1950)).toBe(false);
  });

  it('knocking out the ball carrier releases the ball instead of freezing possession', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    const oppCarrier = 11;
    const pos = { x: 3400, y: 5250 };
    m.ball = { kind: 'held', by: oppCarrier };
    m.players[oppCarrier].pos = { ...pos }; // co-located with torch: guaranteed "nearest opponent"
    knockOut(m, oppCarrier, m.tick + 100, 'ko');
    expect(m.ball).toEqual({
      kind: 'loose',
      pos,
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    });
  });

  it('rival SUPER_STRENGTH locks its target at windup start, charges, and flattens them', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    // Rig at midfield (far from a valuable shot): Zip carries on top of Rex; zone set directly
    // so the lock happens at this windup's start. The flatten must land even though Zip
    // releases the ball during the charge (hadBall false is fine — that IS the counterplay).
    m.ball = { kind: 'held', by: SPEEDSTER };
    m.players[SPEEDSTER].pos = { x: 3400, y: 5250 };
    m.players[RIVAL].pos = { x: 3400, y: 5250 };
    m.players[RIVAL].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    tickUntil(
      m,
      () =>
        m.events.some(
          (e) =>
            e.kind === 'POWER_FIRED' &&
            (e as { player: number }).player === RIVAL,
        ),
      200,
    );
    expect(m.players[SPEEDSTER].outReason).toBe('ko');
    expect(m.players[SPEEDSTER].outUntilTick).toBeGreaterThan(m.tick);
    expect(
      m.events.some(
        (e) => e.kind === 'TACKLE' && (e as { by: number }).by === RIVAL,
      ),
    ).toBe(true);
  });

  it("simultaneous teammate powers do not freeze another hero's Zone or Heat", () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    const torch = 9;
    m.players[torch].powerState = {
      kind: 'winding',
      untilTick: m.tick + 200,
      strength: 1,
    };
    m.players[SPEEDSTER].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    m.players[SPEEDSTER].gauge = 0;
    for (let i = 0; i < 30; i++) tick(m);
    expect(m.players[torch].powerState.kind).toBe('winding'); // still busy — untilTick (200) not reached
    // The Zone no longer counts down; what this guards is that a teammate's
    // in-progress power does not clear or freeze this hero's own Zone or Heat.
    expect(m.players[SPEEDSTER].powerState.kind).toBe('zone');
    expect(m.players[SPEEDSTER].gauge).toBe(0);
    m.players[SPEEDSTER].powerState = { kind: 'idle' };
    addGauge(m, SPEEDSTER, 20);
    expect(m.players[SPEEDSTER].gauge).toBe(20);
  });

  // Hero License canon (docs/04): a licensed power is legal play, so using one
  // can never book its user. Both teams get the same free pass.
  it.each([
    ['FIRE_TORCH', 9],
    ['SUPER_STRENGTH', 2],
  ])('%s never books its user, at any roll', (power, slot) => {
    for (const roll of [0, 0.04, 0.1, 0.149, 0.24, 0.29, 0.99]) {
      const home = {
        ...ROVERS,
        players: ROVERS.players.map((p, i) =>
          i === slot
            ? { ...p, power: power as PowerId }
            : { ...p, power: undefined },
        ),
      };
      const m = createMatch(42, home, UNITED, TAP_HOME);
      m.rng = () => roll;
      activatePower(m, slot, 1);
      expect(m.events.some((e) => e.kind === 'CARD')).toBe(false);
      expect(m.players[slot].outReason).not.toBe('redcard');
      expect(m.players[slot].cards).toBe(0);
    }
  });
});

describe('zone/knockout (canon docs/04: a knocked-down hero stays hot — the Zone pauses and resumes)', () => {
  it('knockOut on a zoned hero preserves the window (no POWER_EXPIRED, heat untouched) and freezes it while down', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    m.players[SPEEDSTER].gauge = 0; // heat already spent on Zone entry
    knockOut(m, SPEEDSTER, m.tick + 5, 'ko');
    // The window is paused, not spent: still 'zone', no expiry event, heat not decayed to 50.
    expect(m.players[SPEEDSTER].powerState).toEqual({
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    });
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_EXPIRED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(false);
    expect(m.players[SPEEDSTER].gauge).toBe(0);

    // Before any press, the frozen Zone does not tick down.
    tick(m);
    expect(m.players[SPEEDSTER].powerState).toEqual({
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    });
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_INTERRUPTED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(false);
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_FIRED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(false);
  });

  it('the window resumes on recovery — a tap after standing up still fires the preserved Zone', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    m.players[SPEEDSTER].gauge = 0;
    knockOut(m, SPEEDSTER, m.tick + 3, 'ko');
    // Run out the knockdown; the hero recovers still in the Zone.
    tickUntil(m, () => m.players[SPEEDSTER].outUntilTick <= m.tick, 10);
    expect(m.players[SPEEDSTER].powerState.kind).toBe('zone');
    // Tapping the resumed window converts it into a fire, exactly as an un-interrupted Zone would.
    m.players[SPEEDSTER].pos = { x: 2250, y: 3500 };
    m.ball = { kind: 'held', by: SPEEDSTER };
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });
    tickUntil(
      m,
      () =>
        m.events.some(
          (e) =>
            e.kind === 'POWER_FIRED' &&
            (e as { player: number }).player === SPEEDSTER,
        ),
      ZONE_WINDOW_TICKS + 40,
    );
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_FIRED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(true);
  });

  it('a due press on a downed hero is a recorded no-op', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    m.players[SPEEDSTER].outUntilTick = m.tick + 200;
    m.players[SPEEDSTER].outReason = 'ko';
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });
    tick(m);
    expect(m.players[SPEEDSTER].powerState).toEqual({
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    });
    expect(m.pendingInputs).toHaveLength(0);
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_INTERRUPTED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(false);
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_FIRED' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(false);
  });

  it('a tap during tackle recovery is a recorded no-op', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[SPEEDSTER].powerState = {
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    };
    m.players[SPEEDSTER].tackleRecoveryUntil = m.tick + 2;
    queueInput(m, { tick: m.tick + 1, kind: 'POWER_TAP', player: SPEEDSTER });

    tick(m);
    expect(m.players[SPEEDSTER].powerState).toEqual({
      kind: 'zone',
      remainingTicks: ZONE_WINDOW_TICKS,
    });
    expect(m.pendingInputs).toHaveLength(0);
  });
});

describe('frozen-team bug: knockOut clears an active/winding power instead of freezing the team', () => {
  it('knockOut on an active hero reverts them to idle, freeing the team for their teammate to Zone in', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    m.players[9].powerState = {
      kind: 'active',
      untilTick: m.tick + 60,
      strength: 1,
    };
    knockOut(m, 9, m.tick + 100, 'ko');
    expect(m.players[9].powerState.kind).toBe('idle');

    // Pre-fix, player 9 stuck 'active' forever would hold teamPowerBusy true,
    // so player 10 (same team) could never enter a Zone.
    m.players[SPEEDSTER].gauge = 99.9;
    m.players[SPEEDSTER].pos = { x: 2250, y: 3500 };
    m.ball = { kind: 'held', by: SPEEDSTER };
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      tick(m);
      ready = m.events.some(
        (e) =>
          e.kind === 'POWER_READY' &&
          (e as { player: number }).player === SPEEDSTER,
      );
    }
    expect(ready).toBe(true);
  });

  // Cards no longer exist (Hero License free pass), so a permanent removal is
  // now reached by being ignited rather than sent off. The team-freeing
  // behaviour under test is unchanged.
  it('a permanently removed hero frees the team so Zip can still enter the Zone', () => {
    const m = createMatch(42, ROVERS, UNITED, TAP_HOME);
    activatePower(m, 9, 1);
    knockOut(m, 9, Number.MAX_SAFE_INTEGER, 'ignited');
    expect(m.players[9].outReason).toBe('ignited');
    expect(m.players[9].powerState.kind).toBe('idle');

    m.players[SPEEDSTER].gauge = 199;
    m.players[SPEEDSTER].pos = { x: 2250, y: 3500 };
    m.ball = { kind: 'held', by: SPEEDSTER };
    tickUntil(
      m,
      () =>
        m.events.some(
          (e) =>
            e.kind === 'POWER_READY' &&
            (e as { player: number }).player === SPEEDSTER,
        ),
      100,
    );
    expect(
      m.events.some(
        (e) =>
          e.kind === 'POWER_READY' &&
          (e as { player: number }).player === SPEEDSTER,
      ),
    ).toBe(true);
  });
});
