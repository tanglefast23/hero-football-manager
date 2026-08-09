import { createMatch, runMatch, tick } from '../match';
import {
  BEATEN_FALL_TICKS,
  BEATEN_STREAK_STALE_TICKS,
  contestStat,
  decisionStat,
  drainStamina,
  executionStat,
  keeperSaveProbability,
  launchPass,
  movementStat,
  movementTick,
  possessionTick,
  restartKickoff,
  speedFor,
  tackleTick,
} from '../engine';
import { ROVERS, UNITED } from '../teams';
import type { BallState } from '../types';
import { activatePower, powerTick } from '../powers';

describe('possession', () => {
  it('keeps Shadow Mark burrowed for two seconds, then guarantees its hunted steal', () => {
    const match = createMatch(42, ROVERS, UNITED);
    const carrier = 5;
    const shadow = 13;
    match.players[carrier].pos = { x: 2250, y: 3000 };
    match.players[shadow].pos = { x: 2250, y: 3200 };
    match.players[shadow].def.power = 'SHADOW_MARK';
    match.ball = { kind: 'held', by: carrier };
    match.rng = () => 0.99;

    activatePower(match, shadow, 1);

    expect(match.ball).toEqual({ kind: 'held', by: carrier });
    expect(match.players[shadow].powerState.kind).toBe('active');
    tackleTick(match);
    expect(match.events).not.toContainEqual(
      expect.objectContaining({ kind: 'TACKLE', by: shadow }),
    );
    match.tick = 20;
    powerTick(match);
    expect(match.events).toContainEqual(
      expect.objectContaining({
        kind: 'TACKLE',
        by: shadow,
        on: carrier,
        style: 'power',
        contact: false,
        won: true,
      }),
    );
    expect(match.ball).toEqual({ kind: 'held', by: shadow });
    expect(match.players[shadow].powerState.kind).toBe('idle');
  });

  it('passes happen and both teams touch the ball', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const passes = r.events.filter((e) => e.kind === 'PASS');
    expect(passes.length).toBeGreaterThan(10);
    const passers = new Set(passes.map((e) => (e as { from: number }).from));
    expect([...passers].some((i) => i < 11)).toBe(true);
    expect([...passers].some((i) => i >= 11)).toBe(true);
  });

  it('some passes fail (interceptions exist)', () => {
    const r = runMatch(42, ROVERS, UNITED);
    expect(
      r.events.some((e) => e.kind === 'PASS' && !(e as { ok: boolean }).ok),
    ).toBe(true);
  });

  it('passes TRAVEL — the ball is observably in a pass state between launch and arrival', () => {
    const m = createMatch(42, ROVERS, UNITED);
    let sawFlight = false;
    for (let i = 0; i < 600 && !sawFlight; i++) {
      tick(m);
      if (m.ball.kind === 'pass') sawFlight = true;
    }
    expect(sawFlight).toBe(true);
  });

  it('can turn an ordinary failed pass into a deterministic loose-ball contest', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const passer = 5;
    const receiver = 6;
    const interceptor = 13;
    m.ball = { kind: 'held', by: passer };
    m.players[passer].pos = { x: 1000, y: 5000 };
    m.players[receiver].pos = { x: 3000, y: 5000 };
    for (let index = 11; index < 22; index++)
      m.players[index].pos = { x: 6500, y: 10000 };
    m.players[interceptor].pos = { ...m.players[receiver].pos };
    m.players[passer].def.attrs.pas = 1;
    m.players[interceptor].def.attrs.def = 99;
    const rolls = [0.99, 0];
    m.rng = () => rolls.shift() ?? 0;

    launchPass(m, passer, receiver, false);

    expect(m.ball).toMatchObject({
      kind: 'pass',
      willSucceed: false,
      interceptor,
      looseOnArrival: true,
    });
    const failedFlight = m.ball as BallState;
    if (failedFlight.kind !== 'pass') throw new Error('pass did not launch');
    failedFlight.pos = { ...m.players[interceptor].pos };
    possessionTick(m);
    expect(m.ball).toMatchObject({ kind: 'loose' });
  });

  it('delivers a successful pass cleanly when there is no eligible interceptor', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const passer = 5;
    const receiver = 6;
    m.ball = { kind: 'held', by: passer };
    for (let index = 11; index < 22; index++) {
      m.players[index].outUntilTick = 100;
      m.players[index].outReason = 'ko';
    }
    m.rng = () => 0;

    launchPass(m, passer, receiver, false);

    expect(m.events.at(-1)).toMatchObject({
      kind: 'PASS',
      from: passer,
      to: receiver,
      ok: true,
    });
    expect(m.ball).toMatchObject({
      kind: 'pass',
      willSucceed: true,
      interceptor: -1,
      looseOnArrival: false,
    });
    const flight = m.ball as BallState;
    if (flight.kind !== 'pass') throw new Error('pass did not launch');
    flight.pos = { ...m.players[receiver].pos };
    possessionTick(m);
    expect(m.ball).toEqual({ kind: 'held', by: receiver });
  });

  it('remains deterministic', () => {
    expect(runMatch(9, ROVERS, UNITED).events).toEqual(
      runMatch(9, ROVERS, UNITED).events,
    );
  });

  it('loose balls decay and get picked up by the nearest available player', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = {
      kind: 'loose',
      pos: { x: 3400, y: 5250 },
      vel: { x: 200, y: 0 },
      z: 0,
      vz: 0,
    } as BallState;
    const before = m.ball.kind === 'loose' ? { ...m.ball.vel } : { x: 0, y: 0 };
    tick(m);
    if (m.ball.kind === 'loose') {
      expect(Math.abs(m.ball.vel.x)).toBeLessThan(Math.abs(before.x));
    }
    let picked = false;
    for (let i = 0; i < 100 && !picked; i++) {
      tick(m);
      if (m.ball.kind === 'held') picked = true;
    }
    expect(picked).toBe(true);
  });

  it('out players cannot pick up a loose ball', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const nearIdx = 6;
    m.ball = {
      kind: 'loose',
      pos: { ...m.players[nearIdx].pos },
      vel: { x: 0, y: 0 },
      z: 0,
      vz: 0,
    } as BallState;
    m.players[nearIdx].outUntilTick = m.tick + 500;
    m.players[nearIdx].outReason = 'ko';
    tick(m);
    if (m.ball.kind === 'held') {
      expect(m.ball.by).not.toBe(nearIdx);
    }
  });

  it("a pass target KO'd mid-flight cannot receive the ball unconscious (phantom-pass bug)", () => {
    const m = createMatch(42, ROVERS, UNITED);
    const targetPos = { ...m.players[6].pos };
    m.ball = {
      kind: 'pass',
      pos: { x: targetPos.x - 2000, y: targetPos.y },
      from: 5,
      to: 6,
      willSucceed: true,
      interceptor: -1,
      z: 0,
      vz: 0,
      speed: 250,
    } as BallState;
    m.players[6].outUntilTick = m.tick + 300;
    m.players[6].outReason = 'ko';
    let flying = true;
    for (let i = 0; i < 200 && flying; i++) {
      tick(m);
      flying = m.ball.kind === 'pass';
    }
    expect(flying).toBe(false);
    if (m.ball.kind === 'held') {
      expect(m.ball.by).not.toBe(6);
    } else {
      expect(m.ball.kind).toBe('loose');
    }
  });
});

describe('tackling', () => {
  function rigChallenge(distance: number, condition = 100) {
    const m = createMatch(42, ROVERS, UNITED);
    const carrierIdx = 9;
    const tacklerIdx = 13;
    m.ball = { kind: 'held', by: carrierIdx };
    m.players[carrierIdx].pos = { x: 3400, y: 3000 };
    // Rovers attack toward y=0, so this is goal-side rather than a lunge from
    // behind. The tackler slides down-screen toward the carrier.
    m.players[tacklerIdx].pos = { x: 3400, y: 3000 - distance };
    m.players[tacklerIdx].condition = condition;
    for (let i = 11; i < 22; i++) {
      if (i !== tacklerIdx) m.players[i].pos = { x: 200, y: 9000 };
    }
    return { m, carrierIdx, tacklerIdx };
  }

  it('tackles occur, some won and some lost', () => {
    const r = runMatch(42, ROVERS, UNITED);
    const tackles = r.events.filter((e) => e.kind === 'TACKLE') as Array<{
      won: boolean;
    }>;
    expect(tackles.length).toBeGreaterThan(5);
    expect(tackles.some((t) => t.won)).toBe(true);
    expect(tackles.some((t) => !t.won)).toBe(true);
  });

  it('uses a standing tackle inside 2m instead of turning every challenge into a slide', () => {
    const { m, tacklerIdx } = rigChallenge(150);
    tackleTick(m);
    const tackle = m.events.find((e) => e.kind === 'TACKLE');
    expect(tackle).toMatchObject({
      kind: 'TACKLE',
      by: tacklerIdx,
      style: 'standing',
      contact: true,
    });
    expect(m.players[tacklerIdx].slideTackle).toBeUndefined();
  });

  it('launches a visibly long slide from range, moves the real sim coordinate faster than running, and recovers where it lands', () => {
    const { m, carrierIdx, tacklerIdx } = rigChallenge(1000, 90);
    m.players[tacklerIdx].def.attrs.def = 99;
    m.players[carrierIdx].def.attrs.tec = 1;
    const ordinarySpeed = speedFor(m, tacklerIdx);
    const conditionBefore = m.players[tacklerIdx].condition;

    tackleTick(m);
    expect(m.events.at(-1)).toMatchObject({
      kind: 'SLIDE_STARTED',
      by: tacklerIdx,
      on: carrierIdx,
    });
    expect(m.players[tacklerIdx].slideTackle).toBeDefined();
    expect(m.players[tacklerIdx].condition).toBeLessThan(conditionBefore);
    expect(m.players[tacklerIdx].tackleCooldownUntil).toBeGreaterThanOrEqual(
      m.tick + 20,
    );

    const launchPos = { ...m.players[tacklerIdx].pos };
    m.tick++;
    movementTick(m);
    const firstStep = Math.hypot(
      m.players[tacklerIdx].pos.x - launchPos.x,
      m.players[tacklerIdx].pos.y - launchPos.y,
    );
    expect(firstStep).toBeGreaterThan(ordinarySpeed);
    tackleTick(m);
    for (let i = 0; i < 5 && m.players[tacklerIdx].slideTackle; i++) {
      m.tick++;
      movementTick(m);
      tackleTick(m);
    }

    const resolved = m.events.find(
      (e) => e.kind === 'TACKLE' && e.style === 'slide',
    );
    expect(resolved).toMatchObject({
      by: tacklerIdx,
      on: carrierIdx,
      won: true,
      contact: true,
    });
    expect(m.players[tacklerIdx].slideTackle).toBeUndefined();
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBeGreaterThan(m.tick);

    const landingPos = { ...m.players[tacklerIdx].pos };
    expect(
      Math.hypot(landingPos.x - launchPos.x, landingPos.y - launchPos.y),
    ).toBeGreaterThanOrEqual(800);
    m.tick++;
    movementTick(m);
    expect(m.players[tacklerIdx].pos).toEqual(landingPos);
    expect(m.players[tacklerIdx].pos).not.toEqual(launchPos);
  });

  it('finishes the committed long travel when the target releases the ball', () => {
    const { m, tacklerIdx } = rigChallenge(1000, 90);
    tackleTick(m);
    const launchPos = { ...m.players[tacklerIdx].pos };
    m.ball = { kind: 'held', by: 8 };

    for (let i = 0; i < 8 && m.players[tacklerIdx].slideTackle; i++) {
      m.tick++;
      movementTick(m);
      tackleTick(m);
    }

    expect(
      Math.hypot(
        m.players[tacklerIdx].pos.x - launchPos.x,
        m.players[tacklerIdx].pos.y - launchPos.y,
      ),
    ).toBeGreaterThanOrEqual(800);
    expect(m.events.at(-1)).toMatchObject({
      kind: 'TACKLE',
      by: tacklerIdx,
      won: false,
      style: 'slide',
      contact: false,
    });
  });

  it('treats 80% as the preferred slide band, narrows reach below it, and keeps a 30% hard floor', () => {
    const tired = rigChallenge(400, 29);
    tackleTick(tired.m);
    expect(tired.m.players[tired.tacklerIdx].slideTackle).toBeUndefined();

    const middling = rigChallenge(1050, 60);
    middling.m.players[middling.tacklerIdx].def.attrs.def = 1;
    middling.m.players[middling.carrierIdx].def.attrs.tec = 99;
    tackleTick(middling.m);
    expect(middling.m.players[middling.tacklerIdx].slideTackle).toBeUndefined();

    const closerMiddling = rigChallenge(950, 60);
    closerMiddling.m.players[closerMiddling.tacklerIdx].def.attrs.def = 1;
    closerMiddling.m.players[closerMiddling.carrierIdx].def.attrs.tec = 99;
    tackleTick(closerMiddling.m);
    expect(
      closerMiddling.m.players[closerMiddling.tacklerIdx].slideTackle,
    ).toBeDefined();

    const emergency = rigChallenge(900, 40);
    emergency.m.players[emergency.carrierIdx].pos = { x: 3400, y: 1000 };
    emergency.m.players[emergency.tacklerIdx].pos = { x: 3400, y: 100 };
    emergency.m.players[emergency.tacklerIdx].def.attrs.def = 99;
    emergency.m.players[emergency.carrierIdx].def.attrs.tec = 1;
    tackleTick(emergency.m);
    expect(emergency.m.players[emergency.tacklerIdx].slideTackle).toBeDefined();
  });

  it('the nearest defender presses the carrier (closes distance while possession is held)', () => {
    const m = createMatch(42, ROVERS, UNITED);
    for (let i = 0; i < 5 && m.ball.kind !== 'held'; i++) tick(m);
    expect(m.ball.kind).toBe('held');
    if (m.ball.kind !== 'held') return;
    const carrier = m.ball.by;
    const presser = m.players
      .map((p, i) => ({
        i,
        d:
          p.team !== m.players[carrier].team
            ? Math.hypot(
                p.pos.x - m.players[carrier].pos.x,
                p.pos.y - m.players[carrier].pos.y,
              )
            : Infinity,
      }))
      .sort((a, b) => a.d - b.d)[0];
    const dBefore = presser.d;
    for (
      let i = 0;
      i < 20 && m.ball.kind === 'held' && m.ball.by === carrier;
      i++
    )
      tick(m);
    const dAfter = Math.hypot(
      m.players[presser.i].pos.x - m.players[carrier].pos.x,
      m.players[presser.i].pos.y - m.players[carrier].pos.y,
    );
    expect(dAfter).toBeLessThan(dBefore);
  });

  it('the nearest eligible defender makes the tackle attempt, not the lowest index', () => {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'held', by: 9 };
    m.players[9].pos = { x: 3400, y: 3000 };
    m.players[11].pos = { x: 3400, y: 3240 };
    m.players[16].pos = { x: 3400, y: 3100 };
    for (const idx of [12, 13, 14, 15, 17, 18, 19, 20, 21]) {
      m.players[idx].pos = { x: 200, y: 9000 };
    }
    m.players[11].tackleCooldownUntil = 0;
    m.players[16].tackleCooldownUntil = 0;
    tick(m);
    const tackle = m.events.filter((e) => e.kind === 'TACKLE').pop() as
      { by: number } | undefined;
    expect(tackle).toBeDefined();
    expect(tackle?.by).toBe(16);
  });
});

describe('beaten defenders go down', () => {
  const CARRIER = 5; // Rovers MID, no power — keeps the duel free of power interactions
  const DEFENDER = 13; // United DEF u2
  const MIDFIELDER = 16; // United MID u5
  const KEEPER = 11;

  /**
   * Carrier at a fixed point with exactly one opponent inside standing-tackle
   * range, stats matched so the contest is an exact coin flip (delta 0 => p 0.5)
   * and the drop threshold is therefore a predictable 1 - 0.5 * dropChance.
   */
  function rigEvenDuel(tacklerIdx = DEFENDER) {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'held', by: CARRIER };
    m.players[CARRIER].pos = { x: 3400, y: 3000 };
    m.players[CARRIER].def.attrs.tec = 50;
    m.players[CARRIER].condition = 100;
    for (let i = 11; i < 22; i++) m.players[i].pos = { x: 200, y: 9000 };
    m.players[tacklerIdx].pos = { x: 3400, y: 3120 };
    m.players[tacklerIdx].def.attrs.def = 50;
    m.players[tacklerIdx].condition = 100;
    m.players[tacklerIdx].tackleCooldownUntil = 0;
    return { m, tacklerIdx };
  }

  /** Advance past the standing-tackle cooldown without running a whole tick. */
  function readyForNextChallenge(
    m: ReturnType<typeof createMatch>,
    tacklerIdx: number,
  ) {
    m.tick += 10;
    m.players[tacklerIdx].tackleCooldownUntil = m.tick;
  }

  it('puts a comprehensively beaten defender on the floor', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    m.rng = () => 0.99; // lost the contest, and lost it in the top slice

    tackleTick(m);

    expect(m.events.at(-1)).toMatchObject({
      kind: 'TACKLE',
      by: tacklerIdx,
      on: CARRIER,
      won: false,
      style: 'standing',
      dropped: true,
    });
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBe(
      m.tick + BEATEN_FALL_TICKS,
    );
    expect(m.players[tacklerIdx].tackleCooldownUntil).toBeGreaterThan(
      m.tick + BEATEN_FALL_TICKS,
    );
    expect(m.ball).toEqual({ kind: 'held', by: CARRIER });
  });

  it('leaves a narrowly beaten defender on his feet', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    m.rng = () => 0.6; // lost (0.6 > p 0.5) but nowhere near the 0.875 drop threshold

    tackleTick(m);

    const tackle = m.events.at(-1);
    expect(tackle).toMatchObject({
      kind: 'TACKLE',
      won: false,
      style: 'standing',
    });
    expect(tackle).not.toHaveProperty('dropped');
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBe(0);
  });

  it('always drops him on the third consecutive failure against the same carrier', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    m.rng = () => 0.6; // never enough to drop him on the roll alone

    tackleTick(m);
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBe(0);
    readyForNextChallenge(m, tacklerIdx);
    tackleTick(m);
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBe(0);
    readyForNextChallenge(m, tacklerIdx);
    tackleTick(m);

    expect(m.events.at(-1)).toMatchObject({
      kind: 'TACKLE',
      won: false,
      dropped: true,
    });
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBe(
      m.tick + BEATEN_FALL_TICKS,
    );
  });

  it('restarts the count when the defender turns to a different carrier', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    m.rng = () => 0.6;

    tackleTick(m);
    readyForNextChallenge(m, tacklerIdx);
    tackleTick(m);
    expect(m.players[tacklerIdx].beatenStreak?.count).toBe(2);

    // A different carrier picks the ball up in the same place.
    const otherCarrier = 6;
    m.players[otherCarrier].pos = { ...m.players[CARRIER].pos };
    m.players[otherCarrier].def.attrs.tec = 50;
    m.ball = { kind: 'held', by: otherCarrier };
    readyForNextChallenge(m, tacklerIdx);
    tackleTick(m);

    expect(m.players[tacklerIdx].beatenStreak).toMatchObject({
      targetIdx: otherCarrier,
      count: 1,
    });
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBe(0);
  });

  it('lets a stale streak expire so an old duel cannot fell him in a fresh one', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    m.rng = () => 0.6;

    tackleTick(m);
    readyForNextChallenge(m, tacklerIdx);
    tackleTick(m);
    expect(m.players[tacklerIdx].beatenStreak?.count).toBe(2);

    m.tick += BEATEN_STREAK_STALE_TICKS + 1;
    m.players[tacklerIdx].tackleCooldownUntil = m.tick;
    tackleTick(m);

    expect(m.players[tacklerIdx].beatenStreak?.count).toBe(1);
    expect(m.players[tacklerIdx].tackleRecoveryUntil).toBe(0);
  });

  it('never drops a goalkeeper, who would otherwise concede an open goal while prone', () => {
    const { m } = rigEvenDuel(KEEPER);
    m.rng = () => 0.99;

    tackleTick(m);

    expect(m.events.at(-1)).toMatchObject({
      kind: 'TACKLE',
      by: KEEPER,
      won: false,
    });
    expect(m.events.at(-1)).not.toHaveProperty('dropped');
    expect(m.players[KEEPER].tackleRecoveryUntil).toBe(0);
  });

  it('stops a floored defender from challenging or moving until he is up', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    m.rng = () => 0.99;
    tackleTick(m);
    const tackleCount = m.events.filter((e) => e.kind === 'TACKLE').length;
    const floorPos = { ...m.players[tacklerIdx].pos };

    m.tick += 1;
    movementTick(m);
    tackleTick(m);

    expect(m.players[tacklerIdx].pos).toEqual(floorPos);
    expect(m.events.filter((e) => e.kind === 'TACKLE')).toHaveLength(
      tackleCount,
    );
  });

  it('hands the press to the covering defender on the tick after the drop', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    const cover = MIDFIELDER;
    m.players[cover].pos = { x: 3400, y: 3900 };
    m.movement = {
      ...m.movement,
      presserIdx: tacklerIdx,
      presserSinceTick: m.tick,
    };
    m.rng = () => 0.99;

    tackleTick(m);
    // tackleTick runs AFTER movementTick, so the lease is still the beaten man's.
    expect(m.movement.presserIdx).toBe(tacklerIdx);

    m.tick += 1;
    movementTick(m);

    expect(m.movement.presserIdx).toBe(cover);
  });

  it('clears the streak at a restart so it cannot survive a kickoff', () => {
    const { m, tacklerIdx } = rigEvenDuel();
    m.rng = () => 0.6;
    tackleTick(m);
    expect(m.players[tacklerIdx].beatenStreak).toBeDefined();

    restartKickoff(m, 0);

    expect(m.players[tacklerIdx].beatenStreak).toBeUndefined();
  });
});

/**
 * Sliding stays a defender's tool, and these pin that against a specific
 * temptation: letting midfielders lunge on the breakaway beat was built and cut
 * (see the note above slideLaunchRange). Unrestricted it broke the +20 blowout
 * rail; restricted enough to pass, it produced 0.10 slides a match. The slide
 * increase this feature wanted arrived from defenders instead — breakaway
 * carriers keep the ball, so committed slides connect (17% -> 44% contact).
 */
describe('only defenders slide, even on a breakaway', () => {
  const CARRIER = 5;
  const MIDFIELDER = 16; // United MID
  const FORWARD = 20; // United FWD
  const FLOORED = 13; // United DEF, already on the grass

  function rigLaunchOpportunity(sliderIdx: number) {
    const m = createMatch(42, ROVERS, UNITED);
    m.ball = { kind: 'held', by: CARRIER };
    m.players[CARRIER].pos = { x: 3400, y: 3000 };
    for (let i = 11; i < 22; i++) m.players[i].pos = { x: 200, y: 9000 };
    // Goal-side (Rovers attack toward y=0) and inside the 8-11m launch band —
    // every geometric condition a defender would need.
    m.players[sliderIdx].pos = { x: 3400, y: 3000 - 950 };
    m.players[sliderIdx].condition = 100;
    m.players[sliderIdx].tackleCooldownUntil = 0;
    // A beaten marker on the grass beside the carrier: the breakaway picture.
    m.players[FLOORED].pos = { x: 3450, y: 3050 };
    m.players[FLOORED].tackleRecoveryUntil = m.tick + 6;
    return m;
  }

  it('launches the slide when the opportunity falls to a defender', () => {
    const m = rigLaunchOpportunity(12);

    tackleTick(m);

    expect(m.players[12].slideTackle).toBeDefined();
    expect(m.events.at(-1)).toMatchObject({
      kind: 'SLIDE_STARTED',
      by: 12,
      on: CARRIER,
    });
  });

  it('refuses the same opportunity to a midfielder', () => {
    const m = rigLaunchOpportunity(MIDFIELDER);

    tackleTick(m);

    expect(m.players[MIDFIELDER].slideTackle).toBeUndefined();
    expect(m.events.filter((e) => e.kind === 'SLIDE_STARTED')).toHaveLength(0);
  });

  it('refuses the same opportunity to a forward', () => {
    const m = rigLaunchOpportunity(FORWARD);

    tackleTick(m);

    expect(m.players[FORWARD].slideTackle).toBeUndefined();
  });
});

describe('condition and STA', () => {
  it('uses log-ratio condition for contest/execution/decision while movement remains legacy until A3', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const idx = 5;
    m.players[idx].condition = 100;
    const fullContest = contestStat(m, idx, 'def');
    const freshSpeed = speedFor(m, idx);
    m.players[idx].condition = 0;
    const conditioned = Math.round(m.players[idx].def.attrs.def * 0.75);
    expect(contestStat(m, idx, 'def')).toBeLessThan(fullContest);
    expect(executionStat(m, idx, 'def')).toBe(contestStat(m, idx, 'def'));
    expect(decisionStat(m, idx, 'def')).toBe(contestStat(m, idx, 'def'));
    expect(movementStat(m, idx, 'def')).toBe(conditioned);
    expect(speedFor(m, idx)).toBeLessThan(freshSpeed);
  });

  it('makes low-STA players drain condition faster for the same movement', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const low = m.players[5];
    const high = m.players[6];
    low.def.attrs.sta = 20;
    high.def.attrs.sta = 90;
    low.condition = high.condition = 100;
    drainStamina(low, true);
    drainStamina(high, true);
    expect(low.condition).toBeLessThan(high.condition);
  });

  it('keeps execution save odds scale-invariant and every home-tier drill measurable', () => {
    const m = createMatch(42, ROVERS, UNITED);
    const shooter = 9;
    const keeper = 11;
    m.players[shooter].condition = 100;
    m.players[keeper].condition = 100;

    m.players[shooter].def.attrs.sho = 50;
    m.players[keeper].def.attrs.ref = 50;
    const lowScale = keeperSaveProbability(
      m,
      keeper,
      executionStat(m, shooter, 'sho'),
    );
    m.players[shooter].def.attrs.sho = 500;
    m.players[keeper].def.attrs.ref = 500;
    const highScale = keeperSaveProbability(
      m,
      keeper,
      executionStat(m, shooter, 'sho'),
    );
    expect(Math.abs(lowScale - highScale)).toBeLessThanOrEqual(0.001);

    for (const [rating, gain] of [
      [94, 5],
      [180, 8],
      [268, 12],
      [356, 17],
      [442, 23],
    ] as const) {
      m.players[shooter].def.attrs.sho = rating;
      m.players[keeper].def.attrs.ref = rating;
      const beforeDrill = keeperSaveProbability(
        m,
        keeper,
        executionStat(m, shooter, 'sho'),
      );
      m.players[shooter].def.attrs.sho = rating + gain;
      const afterDrill = keeperSaveProbability(
        m,
        keeper,
        executionStat(m, shooter, 'sho'),
      );
      expect(beforeDrill - afterDrill).toBeGreaterThanOrEqual(0.01);
    }
  });

  it('carries every home-tier PAC drill into measurable geometry and resets residue at kickoff', () => {
    for (const [rating, gain] of [
      [94, 5],
      [180, 8],
      [268, 12],
      [356, 17],
      [442, 23],
    ] as const) {
      const low = createMatch(42, ROVERS, UNITED);
      const high = createMatch(42, ROVERS, UNITED);
      const runner = 5;
      low.players[runner].def.attrs.pac = rating;
      high.players[runner].def.attrs.pac = rating + gain;
      low.players[runner].pos = { x: 200, y: 9000 };
      high.players[runner].pos = { x: 200, y: 9000 };
      const start = { x: 200, y: 9000 };

      for (let index = 0; index < 20; index += 1) {
        movementTick(low);
        movementTick(high);
        low.tick += 1;
        high.tick += 1;
      }

      const lowTravel = Math.hypot(
        low.players[runner].pos.x - start.x,
        low.players[runner].pos.y - start.y,
      );
      const highTravel = Math.hypot(
        high.players[runner].pos.x - start.x,
        high.players[runner].pos.y - start.y,
      );
      expect(highTravel).toBeGreaterThan(lowTravel);
      expect(high.players[runner].movementResidue).toBeDefined();

      restartKickoff(high, 0);
      expect(
        high.players.every(
          (player) =>
            player.movementResidue?.x === 0 && player.movementResidue?.y === 0,
        ),
      ).toBe(true);
    }
  });

  it('makes every division home-tier STA drill reduce fixed-point drain', () => {
    const samples = [
      [94, 5],
      [180, 8],
      [268, 12],
      [356, 17],
      [442, 23],
    ] as const;
    for (const [rating, gain] of samples) {
      const match = createMatch(42, ROVERS, UNITED);
      const low = {
        ...match.players[5],
        def: {
          ...match.players[5].def,
          attrs: { ...match.players[5].def.attrs, sta: rating },
        },
        condition: 100,
      };
      const high = {
        ...low,
        def: {
          ...low.def,
          attrs: { ...low.def.attrs, sta: rating + gain },
        },
        condition: 100,
      };
      drainStamina(low, true);
      drainStamina(high, true);
      expect(high.condition).toBeGreaterThan(low.condition);
    }
  });

  it('applies Energy Use to real off-ball movement but never to carrier speed', () => {
    const movement = (
      energyUse: 'SAVE_ENERGY' | 'BALANCED' | 'ALL_OUT',
      condition: number,
      playerIndex: number,
    ) => {
      const m = createMatch(42, ROVERS, UNITED);
      m.tactics[0].energyUse = energyUse;
      m.players[playerIndex].condition = condition;
      const before = { ...m.players[playerIndex].pos };
      movementTick(m);
      return Math.hypot(
        m.players[playerIndex].pos.x - before.x,
        m.players[playerIndex].pos.y - before.y,
      );
    };

    const saved = movement('SAVE_ENERGY', 100, 5);
    const balanced = movement('BALANCED', 100, 5);
    const allOut = movement('ALL_OUT', 100, 5);
    expect(saved).toBeLessThan(balanced);
    expect(balanced).toBeLessThan(allOut);
    expect(movement('ALL_OUT', 0, 5)).toBeCloseTo(
      movement('BALANCED', 0, 5),
      5,
    );
    expect(movement('SAVE_ENERGY', 100, 9)).toBeCloseTo(
      movement('ALL_OUT', 100, 9),
      5,
    );
  });

  it('applies the selected Energy Use multiplier to slide-tackle condition cost', () => {
    const slideLoss = (energyUse: 'SAVE_ENERGY' | 'BALANCED' | 'ALL_OUT') => {
      const m = createMatch(42, ROVERS, UNITED);
      const carrierIdx = 9;
      const tacklerIdx = 13;
      m.tactics[1].energyUse = energyUse;
      m.ball = { kind: 'held', by: carrierIdx };
      m.players[carrierIdx].pos = { x: 3400, y: 3000 };
      m.players[tacklerIdx].pos = { x: 3400, y: 2100 };
      m.players[tacklerIdx].condition = 90;
      for (let index = 11; index < 22; index += 1) {
        if (index !== tacklerIdx) m.players[index].pos = { x: 200, y: 9000 };
      }
      const before = m.players[tacklerIdx].condition;
      tackleTick(m);
      expect(m.players[tacklerIdx].slideTackle).toBeDefined();
      return before - m.players[tacklerIdx].condition;
    };

    expect(slideLoss('SAVE_ENERGY')).toBeLessThan(slideLoss('BALANCED'));
    expect(slideLoss('BALANCED')).toBeLessThan(slideLoss('ALL_OUT'));
  });
});
