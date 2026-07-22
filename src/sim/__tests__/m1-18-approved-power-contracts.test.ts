import {
  attackingDecision,
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
  inUsefulContext,
  powerTick,
  cancelPowerReferencesForSubstitution,
} from '../powers';
import { performSubstitution } from '../substitutions';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PlayerDef, PowerId, PowerState, TeamDef } from '../types';

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
  const target = match.ball.arrivalPos ?? match.players[
    match.ball.willSucceed ? match.ball.to : match.ball.interceptor
  ].pos;
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
    expect(match.players[victim].webbedUntilTick).toBe(20);
    const before = { ...match.players[victim].pos };
    movementTick(match);
    possessionTick(match);
    expect(match.players[victim].pos).toEqual(before);
    expect(match.ball.kind !== 'held' || match.ball.by).not.toBe(victim);
    match.tick = 20;
    powerTick(match);
    expect(match.players[victim].webbedUntilTick).toBeUndefined();
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

  it('Shadow arms after two seconds, steals inside its hunt, and returns on friendly possession', () => {
    const hunt = matchWith('SHADOW_MARK', 2);
    hunt.players[2].pos = { x: 2200, y: 5000 };
    hunt.players[11].pos = { x: 2500, y: 5000 };
    hunt.ball = { kind: 'held', by: 11 };
    activatePower(hunt, 2, 1);
    powerTick(hunt);
    expect(hunt.ball).toEqual({ kind: 'held', by: 11 });
    hunt.tick = 20;
    powerTick(hunt);
    expect(hunt.ball).toEqual({ kind: 'held', by: 2 });
    expect(hunt.players[2].powerState.kind).toBe('idle');

    const cancel = matchWith('SHADOW_MARK', 2);
    const origin = { x: 2200, y: 5000 };
    cancel.players[2].pos = origin;
    cancel.ball = { kind: 'held', by: 11 };
    activatePower(cancel, 2, 1);
    cancel.players[2].pos = { x: 100, y: 100 };
    cancel.ball = { kind: 'held', by: 6 };
    powerTick(cancel);
    expect(cancel.players[2].powerState.kind).toBe('idle');
    expect(cancel.players[2].pos).toEqual(origin);
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

  it('Decoy creates a separate forward receiver and materializes that forward on arrival', () => {
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
    expect(clone?.receiver).toBe(9);
    expect(clone?.receiver).not.toBe(caster);
    match.rng = () => 0;
    launchPass(match, carrier, clone!.receiver, false);
    expect(match.ball).toMatchObject({ kind: 'pass', arrivalPos: clone!.pos, decoyReceiverPlayerId: 'r9' });
    forceArrival(match);
    expect(match.ball).toEqual({ kind: 'held', by: 9 });
    expect(match.players[9].pos).toEqual(clone!.pos);
    expect(match.players[caster].pos).toEqual(casterBefore);
    expect(match.players[caster].powerState.kind).toBe('idle');
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
    expect(sub.players[5].decoyClone?.receiverIdx).toBe(9);
    expect(performSubstitution(
      sub, 0, 9, replacement.id, cancelPowerReferencesForSubstitution,
    )).toBe(true);
    expect(sub.players[5].powerState.kind).toBe('idle');
    expect(sub.players[5].decoyClone).toBeUndefined();
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
    expect(match.players[receiver].portalProtectedUntilTick).toBe(10);
    match.players[12].pos = { x: match.players[receiver].pos.x + 50, y: match.players[receiver].pos.y };
    tackleTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: receiver });
    launchPass(match, receiver, receiver === 9 ? 10 : 9, false, true);
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

  it('Gust guarantees the redirect to its GK but leaves the huge punt contestable', () => {
    const match = matchWith('GUST', 2);
    match.players[2].pos = { x: 2200, y: 5000 };
    match.players[11].pos = { x: 2300, y: 5000 };
    match.players[12].pos = { x: 2500, y: 4800 };
    match.ball = { kind: 'held', by: 11 };
    activatePower(match, 2, 1);
    match.rng = () => 0;
    launchPass(match, 11, 12, false);
    expect(match.ball).toMatchObject({ kind: 'pass', to: 0, willSucceed: true, gustRedirect: true });
    forceArrival(match);
    expect(match.ball).toMatchObject({ kind: 'held', by: 0, gustPunt: true });
    match.tick += 3;
    match.rng = () => 0.99;
    possessionTick(match);
    expect(match.ball).toMatchObject({ kind: 'pass', from: 0, gustPunt: true, willSucceed: false });
    expect(match.events).toContainEqual(expect.objectContaining({ kind: 'GUST_REDIRECT', player: 2 }));
    expect(match.events).toContainEqual(expect.objectContaining({ kind: 'GUST_PUNT', player: 2, from: 0 }));
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
