import {
  attackingDecision,
  attemptShot,
  launchPass,
  movementTick,
  possessionTick,
  tackleTick,
} from '../engine';
import { createMatch } from '../match';
import {
  activatePower,
  decoyPassOption,
  gravityRunnerTarget,
  gustPuntDestination,
  inUsefulContext,
  powerTick,
  cancelPowerReferencesForSubstitution,
} from '../powers';
import { performSubstitution } from '../substitutions';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PlayerDef, PowerId, PowerState, TeamDef } from '../types';
import { playerAt } from '../entities';

function matchWith(power: PowerId, slot: number, bench: PlayerDef[] = []): MatchState {
  const home: TeamDef = {
    ...ROVERS,
    players: ROVERS.players.map((player, idx) => ({
      ...player,
      attrs: { ...player.attrs },
      power: idx === slot ? power : undefined,
    })),
    bench,
  };
  const away: TeamDef = {
    ...UNITED,
    players: UNITED.players.map(player => ({ ...player, attrs: { ...player.attrs }, power: undefined })),
  };
  return createMatch(1818, home, away);
}

function forceArrival(match: MatchState): void {
  if (match.ball.kind !== 'pass') throw new Error('expected pass flight');
  const targetIdx = match.ball.willSucceed ? match.ball.to : match.ball.interceptor;
  const target = match.ball.arrivalPos ?? playerAt(match, targetIdx)?.pos;
  if (target === undefined) throw new Error('expected pass target');
  match.ball.pos = { ...target };
  match.ball.z = 0;
  match.ball.vz = 0;
  possessionTick(match);
}

describe('m1.18 approved power contracts', () => {
  it('Strength suppresses the carrier decision without freezing movement, then lands', () => {
    const match = matchWith('SUPER_STRENGTH', 2);
    const hero = 2;
    const victim = 11;
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[victim].pos = { x: 3300, y: 5000 };
    match.ball = { kind: 'held', by: victim };
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };

    powerTick(match);
    expect(match.players[hero].powerState).toMatchObject({ kind: 'winding', untilTick: 5, targetIdx: victim });
    expect(match.players[victim].actionLockedUntilTick).toBe(5);
    const before = { ...match.players[victim].pos };
    movementTick(match);
    expect(match.players[victim].pos).not.toEqual(before);
    possessionTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: victim });

    match.tick = 5;
    powerTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(match.players[victim].outReason).toBe('ko');
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('Web drops the ball and roots only its victim for about two seconds', () => {
    const match = matchWith('WEB_TRAP', 2);
    const hero = 2;
    const victim = 11;
    match.players[hero].pos = { x: 2000, y: 5000 };
    match.players[victim].pos = { x: 2200, y: 5000 };
    match.ball = { kind: 'held', by: victim };
    activatePower(match, hero, 1, victim);
    powerTick(match);

    expect(match.ball).toMatchObject({ kind: 'loose', pos: { x: 2200, y: 5000 } });
    expect(match.players[victim].webbedUntilTick).toBe(70);
    const before = { ...match.players[victim].pos };
    movementTick(match);
    possessionTick(match);
    expect(match.players[victim].pos).toEqual(before);
    expect(match.ball.kind !== 'held' || match.ball.by).not.toBe(victim);
    match.tick = 70;
    powerTick(match);
    expect(match.players[victim].webbedUntilTick).toBeUndefined();
  });

  it('Web roots longer with a well-timed tap and an upgraded power', () => {
    function rootUntil(strength: number, tier: 1 | 3): number {
      const match = matchWith('WEB_TRAP', 2);
      match.players[2].def.powerTier = tier;
      match.players[2].pos = { x: 2000, y: 5000 };
      match.players[11].pos = { x: 2200, y: 5000 };
      match.ball = { kind: 'held', by: 11 };
      activatePower(match, 2, strength, 11);
      powerTick(match);
      return match.players[11].webbedUntilTick ?? -1;
    }

    const auto = rootUntil(0.85, 1);
    const manual = rootUntil(1, 1);
    const tier3 = rootUntil(1, 3);
    expect(auto).toBe(60);
    expect(manual).toBe(70);
    expect(tier3).toBe(80);
  });

  it('Ice keeps carrier and ball together while sliding toward the carrier own goal', () => {
    const match = matchWith('ICE_RINK', 2);
    const hero = 2;
    const victim = 11;
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[victim].pos = { x: 2300, y: 5000 };
    match.ball = { kind: 'held', by: victim };
    activatePower(match, hero, 1, victim);
    powerTick(match);
    const beforeY = match.players[victim].pos.y;
    movementTick(match);
    possessionTick(match);
    expect(match.players[victim].pos.y).toBeLessThan(beforeY);
    expect(match.ball).toEqual({ kind: 'held', by: victim });
    expect(match.events.some(event => event.kind === 'PASS' || event.kind === 'SHOT')).toBe(false);
  });

  it('Ice slides farther with a well-timed tap and an upgraded power without crossing the goal line', () => {
    function slideDistance(strength: number, tier: 1 | 3): number {
      const match = matchWith('ICE_RINK', 2);
      const hero = 2;
      const victim = 11;
      match.players[hero].def.powerTier = tier;
      match.players[hero].pos = { x: 2200, y: 6000 };
      match.players[victim].pos = { x: 2300, y: 6000 };
      match.ball = { kind: 'held', by: victim };
      activatePower(match, hero, strength, victim);
      powerTick(match);
      const beforeY = match.players[victim].pos.y;
      const untilTick = match.players[victim].forcedMovement?.untilTick;
      if (untilTick === undefined) throw new Error('expected Ice slide');

      for (let tick = match.tick; tick < untilTick; tick += 1) {
        match.tick = tick;
        movementTick(match);
        possessionTick(match);
      }
      expect(match.ball).toEqual({ kind: 'held', by: victim });
      expect(match.events.some(event => event.kind === 'PASS' || event.kind === 'SHOT')).toBe(false);
      expect(match.players[victim].pos.y).toBeGreaterThanOrEqual(300);
      match.tick = untilTick;
      powerTick(match);
      expect(match.players[victim].forcedMovement).toBeUndefined();
      return beforeY - match.players[victim].pos.y;
    }

    const auto = slideDistance(0.85, 1);
    const manual = slideDistance(1, 1);
    const tier3 = slideDistance(1, 3);
    expect(auto).toBeGreaterThanOrEqual(2200);
    expect(manual).toBeGreaterThan(auto);
    expect(tier3).toBeGreaterThan(manual);
  });

  it('Shadow arms after two seconds, waits through friendly possession, and steals a field carrier', () => {
    const hunt = matchWith('SHADOW_MARK', 2);
    hunt.players[2].pos = { x: 2200, y: 5000 };
    hunt.players[12].pos = { x: 2500, y: 5000 };
    hunt.ball = { kind: 'held', by: 12 };
    activatePower(hunt, 2, 1);
    powerTick(hunt);
    expect(hunt.ball).toEqual({ kind: 'held', by: 12 });
    hunt.tick = 20;
    powerTick(hunt);
    expect(hunt.ball).toEqual({ kind: 'held', by: 2 });
    expect(hunt.players[2].powerState.kind).toBe('idle');

    const cancel = matchWith('SHADOW_MARK', 2);
    const origin = { x: 2200, y: 5000 };
    cancel.players[2].pos = origin;
    cancel.ball = { kind: 'held', by: 12 };
    activatePower(cancel, 2, 1);
    cancel.players[2].pos = { x: 100, y: 100 };
    cancel.ball = { kind: 'held', by: 6 };
    powerTick(cancel);
    expect(cancel.players[2].powerState.kind).toBe('active');
    expect(cancel.players[2].pos).toEqual({ x: 100, y: 100 });
    cancel.tick = 20;
    cancel.players[12].pos = { x: 2250, y: 5000 };
    cancel.ball = { kind: 'held', by: 12 };
    powerTick(cancel);
    expect(cancel.ball).toEqual({ kind: 'held', by: 2 });
    expect(cancel.players[2].powerState.kind).toBe('idle');
  });

  it('Shadow ignores a goalkeeper carrier and returns home when its hunt expires', () => {
    const match = matchWith('SHADOW_MARK', 2);
    const origin = { x: 2200, y: 5000 };
    match.players[2].pos = origin;
    match.players[11].pos = { x: 2250, y: 5000 };
    match.ball = { kind: 'held', by: 11 };
    activatePower(match, 2, 1);
    match.players[2].pos = { x: 100, y: 100 };
    match.tick = 20;
    powerTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: 11 });
    expect(match.players[2].powerState.kind).toBe('active');
    match.tick = 120;
    powerTick(match);
    expect(match.players[2].powerState.kind).toBe('idle');
    expect(match.players[2].pos).toEqual(origin);
  });

  it('Rally queues one refill for a ready hero and never grants a fifth Zone', () => {
    const match = matchWith('RALLY_CRY', 5);
    const rally = 5;
    const recipient = 10;
    match.players[recipient].def.power = 'SUPER_SPEED';
    match.players[recipient].powerState = { kind: 'active', untilTick: 10, strength: 1, commitment: 'SPEED_ACTION' };
    match.players[recipient].zonesOpened = 3;
    match.players[rally].pos = { x: 2200, y: 5000 };
    match.players[recipient].pos = { x: 2400, y: 5000 };

    activatePower(match, rally, 1);
    expect(match.players[recipient].encoreState).toBe('BANKED');
    expect(match.players[recipient].encoreQueuedRefill).toBe(true);
    match.tick = 10;
    powerTick(match);
    expect(match.players[recipient].encoreQueuedRefill).toBeUndefined();
    expect(match.players[recipient].gauge).toBeGreaterThanOrEqual(60);

    match.ball = { kind: 'held', by: recipient };
    match.players[recipient].pos = { x: 2200, y: 3000 };
    powerTick(match);
    expect(match.players[recipient].zonesOpened).toBe(4);
    expect(match.players[recipient].encoreState).toBe('CONSUMED');
    match.players[recipient].powerState = { kind: 'idle' };
    match.players[recipient].gauge = 200;
    powerTick(match);
    expect(match.players[recipient].zonesOpened).toBe(4);
    expect(match.players[recipient].powerState.kind).toBe('idle');
  });

  it('Decoy creates a separate forward receiver that receives without replacing the original', () => {
    const match = matchWith('DECOY_DOUBLE', 5);
    const caster = 5;
    const carrier = 6;
    const marker = 12;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2600, y: 4000 };
    match.players[caster].pos = { x: 3400, y: 4300 };
    match.players[9].pos = { x: 2200, y: 3100 };
    match.players[10].pos = { x: 3500, y: 3600 };
    match.players[marker].pos = { x: 2700, y: 3700 };
    for (let idx = 11; idx < 22; idx += 1) if (idx !== marker) match.players[idx].pos = { x: 6500, y: 9000 };
    const casterBefore = { ...match.players[caster].pos };
    activatePower(match, caster, 1);
    const clone = decoyPassOption(match, carrier);
    expect(clone).not.toBeNull();
    expect(clone?.receiver).toBe(22);
    expect(clone?.receiver).not.toBe(caster);
    match.rng = () => 0;
    launchPass(match, carrier, clone!.receiver, false);
    expect(match.ball).toMatchObject({ kind: 'pass', to: 22, decoyReceiverPlayerId: match.decoyClones[0]!.def.id });
    forceArrival(match);
    expect(match.ball).toEqual({ kind: 'held', by: 22 });
    expect(match.decoyClones[0]?.pos).toEqual(clone!.pos);
    expect(match.players[9].pos).not.toEqual(clone!.pos);
    expect(match.players[caster].pos).toEqual(casterBefore);
    expect(match.players[caster].powerState.kind).toBe('active');
  });

  it('Decoy fails soft with no forward and cancels if its captured forward is substituted', () => {
    const noForward = matchWith('DECOY_DOUBLE', 5);
    noForward.players[9].def.role = 'MID';
    noForward.players[10].def.role = 'MID';
    noForward.ball = { kind: 'held', by: 6 };
    noForward.players[6].pos = { x: 2600, y: 4000 };
    noForward.players[12].pos = { x: 2700, y: 3700 };
    activatePower(noForward, 5, 1);
    expect(noForward.players[5].powerState.kind).toBe('idle');
    expect(noForward.events.some(event => event.kind === 'POWER_FIRED')).toBe(false);

    const replacement: PlayerDef = {
      ...ROVERS.players[9], id: 'bench-fwd', name: 'Bench Fwd', attrs: { ...ROVERS.players[9].attrs },
    };
    const sub = matchWith('DECOY_DOUBLE', 5, [replacement]);
    sub.ball = { kind: 'held', by: 6 };
    sub.players[6].pos = { x: 2600, y: 4000 };
    sub.players[9].pos = { x: 2200, y: 3100 };
    sub.players[10].pos = { x: 3500, y: 3600 };
    sub.players[12].pos = { x: 2700, y: 3700 };
    activatePower(sub, 5, 1);
    expect(sub.decoyClones[0]?.sourceIdx).toBe(9);
    expect(performSubstitution(
      sub, 0, 9, replacement.id, cancelPowerReferencesForSubstitution,
    )).toBe(true);
    expect(sub.players[5].powerState.kind).toBe('idle');
    expect(sub.decoyClones[0]).toBeNull();
  });

  it('Future steals then immediately guarantees the furthest-forward onside outlet', () => {
    const match = matchWith('FUTURE_SIGHT', 2);
    match.players[2].pos = { x: 2200, y: 5000 };
    match.players[9].pos = { x: 2200, y: 3000 };
    match.players[10].pos = { x: 2200, y: 2000 }; // offside
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 2400, y: 2500 };
    match.players[11].pos = { x: 2500, y: 5000 };
    match.players[12].pos = { x: 2300, y: 4800 };
    match.ball = { kind: 'held', by: 11 };
    activatePower(match, 2, 1);
    match.rng = () => 0;
    launchPass(match, 11, 12, false);
    expect(match.players[2].powerState).toMatchObject({ commitment: 'POWER_OUTLET', targetIdx: 9 });
    forceArrival(match);
    expect(match.ball).toMatchObject({ kind: 'pass', from: 2, to: 9, willSucceed: true, interceptor: -1 });
    expect(match.players[2].powerState.kind).toBe('idle');
  });

  it('Future interception is not inherited by a substitute while the pass is in flight', () => {
    const replacement: PlayerDef = {
      ...ROVERS.players[2], id: 'bench-reader', name: 'Bench Reader', attrs: { ...ROVERS.players[2].attrs },
    };
    const match = matchWith('FUTURE_SIGHT', 2, [replacement]);
    match.players[2].pos = { x: 2200, y: 5000 };
    match.players[9].pos = { x: 2200, y: 3000 };
    match.players[11].pos = { x: 2500, y: 5000 };
    match.players[12].pos = { x: 2300, y: 4800 };
    match.ball = { kind: 'held', by: 11 };
    activatePower(match, 2, 1);
    match.rng = () => 0;
    launchPass(match, 11, 12, false);
    expect(match.ball).toMatchObject({ kind: 'pass', interceptor: 2, powerInterceptorPlayerId: 'r2' });

    expect(performSubstitution(
      match, 0, 2, replacement.id, cancelPowerReferencesForSubstitution,
    )).toBe(true);
    forceArrival(match);
    expect(match.ball.kind).toBe('loose');
    expect(match.players[2].def.id).toBe(replacement.id);
  });

  it('Portal protects the receiver until their first pass or shot', () => {
    const match = matchWith('PORTAL_PASS', 5);
    match.ball = { kind: 'held', by: 6 };
    match.players[6].pos = { x: 1000, y: 4000 };
    match.players[9].pos = { x: 3400, y: 3300 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 600, y: 7000 };
    activatePower(match, 5, 1);
    if (match.ball.kind !== 'held') throw new Error('expected portal receiver');
    const receiver = match.ball.by;
    expect(match.players[receiver].portalProtectedUntilTick).toBe(20);
    match.players[12].pos = { x: match.players[receiver].pos.x + 50, y: match.players[receiver].pos.y };
    match.tick = 19;
    powerTick(match);
    tackleTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: receiver });
    launchPass(match, receiver, receiver === 9 ? 10 : 9, false, true);
    expect(match.players[receiver].portalProtectedUntilTick).toBeUndefined();

    match.players[receiver].portalProtectedUntilTick = match.tick + 20;
    match.ball = { kind: 'held', by: receiver };
    attemptShot(match, receiver, 1900);
    expect(match.players[receiver].portalProtectedUntilTick).toBeUndefined();
  });

  it('Gravity pulls defenders toward the carrier and commits a runner into the abandoned lane', () => {
    const match = matchWith('GRAVITY_WELL', 5);
    const hero = 5;
    const carrier = 6;
    const blocker = 12;
    match.ball = { kind: 'held', by: carrier };
    match.players[hero].pos = { x: 2250, y: 4400 };
    match.players[carrier].pos = { x: 1200, y: 4200 };
    match.players[9].pos = { x: 2000, y: 3000 };
    match.players[blocker].pos = { x: 1500, y: 3400 };
    for (let idx = 11; idx < 22; idx += 1) if (idx !== blocker) match.players[idx].pos = { x: 6500, y: 9000 };
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
    powerTick(match);
    expect(match.players[hero].powerState).toMatchObject({ kind: 'winding', runnerIdx: 9 });
    const winding = match.players[hero].powerState as PowerState;
    if (winding.kind !== 'winding' || winding.runnerAnchor === undefined) throw new Error('expected runner capture');
    const runnerAnchor = { ...winding.runnerAnchor };
    const blockerDistance = Math.hypot(
      match.players[blocker].pos.x - match.players[carrier].pos.x,
      match.players[blocker].pos.y - match.players[carrier].pos.y,
    );
    match.tick = 15;
    powerTick(match);
    expect(Math.hypot(
      match.players[blocker].pos.x - match.players[carrier].pos.x,
      match.players[blocker].pos.y - match.players[carrier].pos.y,
    )).toBeLessThan(blockerDistance);
    expect(gravityRunnerTarget(match, 9)).toEqual(runnerAnchor);
    const before = { ...match.players[9].pos };
    movementTick(match);
    expect(Math.hypot(match.players[9].pos.x - runnerAnchor.x, match.players[9].pos.y - runnerAnchor.y))
      .toBeLessThan(Math.hypot(before.x - runnerAnchor.x, before.y - runnerAnchor.y));
    expect(attackingDecision(match, carrier)).toMatchObject({ kind: 'pass', to: 9 });
    possessionTick(match);
    expect(match.ball).toMatchObject({ kind: 'pass', from: carrier, to: 9 });
    expect(match.players[hero].powerState.kind).toBe('active');
    expect(gravityRunnerTarget(match, 9)).toEqual(runnerAnchor);

    const inFlight = { ...match.players[9].pos };
    match.tick = 16;
    powerTick(match);
    movementTick(match);
    expect(Math.hypot(match.players[9].pos.x - runnerAnchor.x, match.players[9].pos.y - runnerAnchor.y))
      .toBeLessThan(Math.hypot(inFlight.x - runnerAnchor.x, inFlight.y - runnerAnchor.y));
    const flight = match.ball as unknown as Extract<MatchState['ball'], { kind: 'pass' }>;
    if (flight.kind !== 'pass') throw new Error('expected Gravity pass flight');
    flight.willSucceed = true;
    flight.interceptor = -1;
    forceArrival(match);
    expect(match.ball).toEqual({ kind: 'held', by: 9 });
    match.tick = 17;
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('clears Gravity safely when its committed attack turns over', () => {
    const match = matchWith('GRAVITY_WELL', 5);
    match.players[5].powerState = {
      kind: 'active',
      untilTick: 60,
      strength: 1,
      carrierIdx: 6,
      runnerIdx: 9,
      runnerPlayerId: match.players[9].def.id,
      runnerAnchor: { x: 2200, y: 3000 },
    };
    match.ball = { kind: 'held', by: 11 };
    powerTick(match);
    expect(match.players[5].powerState.kind).toBe('idle');
  });

  it.each([[1, 1], [2, 2], [3, 3]] as const)(
    'Fire tier %i ignites exactly %i nearby goal-side defenders',
    (tier, expected) => {
      const match = matchWith('FIRE_TORCH', 9);
      match.players[9].def.powerTier = tier;
      match.players[9].pos = { x: 2250, y: 3000 };
      match.ball = { kind: 'held', by: 9 };
      for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 6500, y: 9000 };
      match.players[12].pos = { x: 2200, y: 2700 };
      match.players[13].pos = { x: 2500, y: 2600 };
      match.players[14].pos = { x: 1900, y: 2500 };
      match.players[15].pos = { x: 6500, y: 9000 };
      activatePower(match, 9, 1);
      expect(match.events.filter(event => event.kind === 'IGNITED')).toHaveLength(expected);
      expect(match.events.filter(event => event.kind === 'IGNITED')
        .every(event => event.kind === 'IGNITED' && match.players[event.player].def.role === 'DEF')).toBe(true);
    },
  );

  it('Gust guarantees the redirect and open-forward punt while grade improves its landing', () => {
    const match = matchWith('GUST', 2);
    match.players[2].pos = { x: 2200, y: 5000 };
    match.players[11].pos = { x: 2300, y: 5000 };
    match.players[12].pos = { x: 2500, y: 4800 };
    match.ball = { kind: 'held', by: 11 };
    activatePower(match, 2, 1);
    match.rng = () => 0;
    launchPass(match, 11, 12, false);
    expect(match.ball).toMatchObject({
      kind: 'pass', to: 0, willSucceed: true, gustRedirect: true, gustGrade: 1.15,
    });
    forceArrival(match);
    expect(match.ball).toMatchObject({ kind: 'held', by: 0, gustPunt: true, gustGrade: 1.15 });
    match.players[9].pos = { x: 2200, y: 1800 };
    match.players[10].pos = { x: 3400, y: 2500 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 6500, y: 9000 };
    match.players[12].pos = { ...match.players[9].pos };
    const autoLanding = gustPuntDestination(match, 0, 0.85);
    const manualLanding = gustPuntDestination(match, 0, 1.15);
    const tier3Landing = gustPuntDestination(match, 0, 1.15 * 1.45);
    expect(autoLanding?.receiver).toBe(10);
    expect(manualLanding?.receiver).toBe(10);
    expect(tier3Landing?.receiver).toBe(10);
    expect(manualLanding!.pos.y).toBeLessThan(autoLanding!.pos.y);
    expect(tier3Landing!.pos.y).toBeLessThan(manualLanding!.pos.y);
    match.tick += 3;
    match.rng = () => 0.99;
    possessionTick(match);
    expect(match.ball).toMatchObject({
      kind: 'pass', from: 0, to: 10, gustPunt: true, gustGrade: 1.15,
      willSucceed: true, arrivalPos: manualLanding!.pos,
    });
    expect(match.events).toContainEqual(expect.objectContaining({ kind: 'GUST_REDIRECT', player: 2 }));
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'GUST_PUNT', player: 2, from: 0, to: 10,
    }));
    forceArrival(match);
    expect(match.ball).toEqual({ kind: 'held', by: 10 });
    expect(match.players[10].pos).toEqual(manualLanding!.pos);
  });

  it('targetless defensive placements remain banked instead of harming their own team', () => {
    for (const power of ['WEB_TRAP', 'ICE_RINK', 'SHADOW_MARK'] as const) {
      const match = matchWith(power, 2);
      match.ball = { kind: 'held', by: 6 };
      expect(inUsefulContext(match, 2)).toBe(false);
      match.players[2].powerState = { kind: 'zone', remainingTicks: 70 };
      powerTick(match);
      expect(match.players[2].powerState.kind).toBe('zone');
      expect(match.ball).toEqual({ kind: 'held', by: 6 });
    }
  });
});
