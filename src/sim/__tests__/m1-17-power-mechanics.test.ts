import {
  attackingDecision,
  attemptShot,
  launchPass,
  movementTick,
  possessionTick,
  shotFlightTick,
  tackleTick,
} from '../engine';
import { createMatch } from '../match';
import {
  activatePower,
  consumeDecoyAction,
  dribbleBonus,
  inUsefulContext,
  interruptWindup,
  keeperSaveBonus,
  phaseRunPreventsShot,
  powerFinishShotProfile,
  powerTick,
  speedMultiplier,
  zoneEntryContext,
} from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PowerId, PowerState } from '../types';

function matchWith(power: PowerId, slot = 10): { match: MatchState; hero: number } {
  const home = {
    ...ROVERS,
    players: ROVERS.players.map((player, idx) => ({
      ...player,
      attrs: { ...player.attrs },
      power: idx === slot ? power : undefined,
    })),
  };
  return { match: createMatch(117, home, UNITED), hero: slot };
}

function activateAt(
  power: PowerId,
  strength: number,
  tier: 1 | 3,
  slot: number,
): { match: MatchState; hero: number } {
  const sample = matchWith(power, slot);
  sample.match.players[slot].def.powerTier = tier;
  activatePower(sample.match, slot, strength);
  return sample;
}

describe('m1.18 authored one-moment powers', () => {
  it('opens an attacking Zone before Thunder reaches its strict shooting context', () => {
    const { match, hero } = matchWith('THUNDER_STRIKE');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 3400, y: 5000 };
    match.players[hero].gauge = 60;

    expect(zoneEntryContext(match, hero)).toBe(true);
    expect(inUsefulContext(match, hero)).toBe(false);
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('zone');
  });

  it('centres Thunder context on the actual goal and protects but does not skip its windup carry', () => {
    const { match, hero } = matchWith('THUNDER_STRIKE');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 4700, y: 3000 };
    expect(inUsefulContext(match, hero)).toBe(true);
    match.players[hero].powerState = { kind: 'winding', untilTick: 15, strength: 1 };
    expect(attackingDecision(match, hero).kind).toBe('carry');
    expect(dribbleBonus(match, hero)).toBeGreaterThan(0);
  });

  it('commits Thunder Strike to driving through windup and shooting once active', () => {
    const { match, hero } = matchWith('THUNDER_STRIKE');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 3400, y: 2000 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 600, y: 8000 };
    match.players[hero].powerState = { kind: 'winding', untilTick: 15, strength: 1 };
    expect(attackingDecision(match, hero).kind).toBe('carry');

    activatePower(match, hero, 1);
    expect(attackingDecision(match, hero).kind).toBe('shoot');
    possessionTick(match);
    expect(match.ball.kind).toBe('shot');
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('retains a Thunder commitment through a poor shot lane and cashes it once the lane is normal quality', () => {
    const { match, hero } = matchWith('THUNDER_STRIKE');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 3400, y: 3800 };
    activatePower(match, hero, 1);

    expect(attackingDecision(match, hero).kind).toBe('carry');
    possessionTick(match);
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'active', commitment: 'THUNDER_SHOT',
    });
    expect(match.events.some(event => event.kind === 'SHOT')).toBe(false);

    match.players[hero].pos = { x: 3400, y: 1900 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 600, y: 8000 };
    match.tick = 5;
    possessionTick(match);
    expect(match.events.filter(event => event.kind === 'SHOT')).toHaveLength(1);
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('does not spend a banked Thunder Strike on an ordinary shot', () => {
    const { match, hero } = matchWith('THUNDER_STRIKE');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 700 };
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };

    possessionTick(match);

    expect(match.ball.kind).toBe('shot');
    expect(match.players[hero].powerState).toEqual({ kind: 'zone', remainingTicks: 70 });
  });

  it('Portal Pass always exits ahead and selects the lane with room', () => {
    const { match, hero } = matchWith('PORTAL_PASS');
    const carrier = 6;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2250, y: 4000 };
    for (let idx = 0; idx < 11; idx += 1) {
      if (idx !== carrier && idx !== hero) match.players[idx].pos = { x: 600, y: 7000 };
    }
    match.players[hero].pos = { x: 3600, y: 3300 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 600, y: 7000 };
    const beforeProgress = 10500 - match.players[carrier].pos.y;

    activatePower(match, hero, 1);

    expect(match.ball.kind).toBe('held');
    const receiver = match.ball.kind === 'held' ? match.ball.by : carrier;
    expect(receiver).not.toBe(carrier);
    expect(10500 - match.players[receiver].pos.y).toBeGreaterThan(beforeProgress);
    expect(match.players[receiver].pos.x).toBeGreaterThan(600);
    expect(attackingDecision(match, receiver).kind).not.toBe('pass');
  });

  it('Decoy Double creates a genuine extra forward without relocating an opponent', () => {
    const { match, hero } = matchWith('DECOY_DOUBLE');
    const carrier = 6;
    const marker = 12;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2600, y: 4000 };
    match.players[hero].pos = { x: 3400, y: 4300 };
    match.players[marker].pos = { x: 2700, y: 3700 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== marker) match.players[idx].pos = { x: 6000, y: 8000 };
    }
    const before = { ...match.players[marker].pos };
    activatePower(match, hero, 1);
    expect(match.players[marker].pos).toEqual(before);
    expect(dribbleBonus(match, carrier)).toBe(0);
    expect(match.decoyClones[0]).toMatchObject({ ownerIdx: hero, sourceIdx: 9 });
    expect(match.decoyClones[0]?.def.role).toBe('FWD');
    expect(match.decoyClones[0]?.def.attrs).toEqual(match.players[9].def.attrs);
  });

  it('ends the Decoy extra player immediately when possession turns over', () => {
    const { match, hero } = matchWith('DECOY_DOUBLE');
    const carrier = 6;
    const marker = 12;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2600, y: 4000 };
    match.players[marker].pos = { x: 2700, y: 3700 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== marker) match.players[idx].pos = { x: 6000, y: 9000 };
    }
    activatePower(match, hero, 1);
    expect(match.players[hero].powerState.kind).toBe('active');
    const newCarrier = 13;
    match.ball = { kind: 'held', by: newCarrier };
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it.each(['PORTAL_PASS', 'DECOY_DOUBLE', 'GRAVITY_WELL'] as const)(
    '%s refunds a stale windup without emitting a fake fire',
    power => {
      const { match, hero } = matchWith(power, 6);
      match.players[hero].powerState = { kind: 'winding', untilTick: 15, strength: 0.85 };
      match.ball = { kind: 'held', by: 11 };

      activatePower(match, hero, 0.85);

      expect(match.players[hero].powerState).toEqual({ kind: 'idle' });
      expect(match.players[hero].gauge).toBe(50);
      expect(match.events).toContainEqual(expect.objectContaining({
        kind: 'POWER_INTERRUPTED', player: hero,
      }));
      expect(match.events).not.toContainEqual(expect.objectContaining({
        kind: 'POWER_FIRED', player: hero,
      }));
    },
  );

  it('lands Decoy Double at the extra-forward spot shown when its full windup began', () => {
    const { match, hero } = matchWith('DECOY_DOUBLE', 6);
    const carrier = 9;
    const marker = 12;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2600, y: 4000 };
    match.players[hero].pos = { x: 3400, y: 4300 };
    match.players[marker].pos = { x: 2700, y: 3700 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== marker) match.players[idx].pos = { x: 6000, y: 9000 };
    }
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };

    powerTick(match);
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'winding', carrierIdx: carrier, targetIdx: marker,
    });
    const winding = match.players[hero].powerState as PowerState;
    if (winding.kind !== 'winding' || match.players[hero].powerAnchor === undefined) {
      throw new Error('expected a placed Decoy windup');
    }
    if (winding.runnerAnchor === undefined) throw new Error('expected a placed Decoy runner');
    const cloneAnchor = { ...winding.runnerAnchor };
    const newCarrier = 8;
    match.ball = { kind: 'held', by: newCarrier };
    match.players[marker].pos = { x: 1500, y: 5200 };
    const movedMarker = { ...match.players[marker].pos };
    match.tick = winding.untilTick;

    powerTick(match);

    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'POWER_FIRED', player: hero, power: 'DECOY_DOUBLE',
    }));
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'active', carrierIdx: newCarrier, targetIdx: marker,
    });
    expect(match.players[marker].pos).toEqual(movedMarker);
    expect(match.decoyClones[0]?.pos).toEqual(cloneAnchor);
  });

  it('refunds a placed Decoy windup when possession turns over', () => {
    const { match, hero } = matchWith('DECOY_DOUBLE', 6);
    match.ball = { kind: 'held', by: 9 };
    match.players[9].pos = { x: 2600, y: 4000 };
    match.players[12].pos = { x: 2700, y: 3700 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== 12) match.players[idx].pos = { x: 6000, y: 9000 };
    }
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
    powerTick(match);
    const winding = match.players[hero].powerState as PowerState;
    if (winding.kind !== 'winding') throw new Error('expected Decoy windup');
    match.ball = { kind: 'held', by: 13 };
    match.tick = winding.untilTick;

    powerTick(match);

    expect(match.players[hero].powerState).toEqual({ kind: 'idle' });
    expect(match.players[hero].gauge).toBe(50);
    expect(match.players[hero].powerAnchor).toBeUndefined();
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'POWER_INTERRUPTED', player: hero,
    }));
    expect(match.events).not.toContainEqual(expect.objectContaining({
      kind: 'POWER_FIRED', player: hero,
    }));
  });

  it('clears a placed anchor when its windup is interrupted', () => {
    const { match, hero } = matchWith('DECOY_DOUBLE', 6);
    match.ball = { kind: 'held', by: 9 };
    match.players[9].pos = { x: 2600, y: 4000 };
    match.players[12].pos = { x: 2700, y: 3700 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== 12) match.players[idx].pos = { x: 6000, y: 9000 };
    }
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
    powerTick(match);
    expect(match.players[hero].powerAnchor).toBeDefined();

    interruptWindup(match, hero);

    expect(match.players[hero].powerState).toEqual({ kind: 'idle' });
    expect(match.players[hero].powerAnchor).toBeUndefined();
    expect(match.players[hero].gauge).toBe(50);
  });

  it('lands Gravity Well on the blocker and destination shown when its full windup began', () => {
    const { match, hero } = matchWith('GRAVITY_WELL', 6);
    const carrier = 9;
    const blocker = 12;
    const secondBlocker = 13;
    match.ball = { kind: 'held', by: carrier };
    match.players[hero].pos = { x: 2250, y: 5000 };
    match.players[carrier].pos = { x: 3400, y: 4800 };
    match.players[blocker].pos = { x: 3300, y: 4400 };
    match.players[secondBlocker].pos = { x: 3250, y: 4100 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== blocker && idx !== secondBlocker) match.players[idx].pos = { x: 6000, y: 9000 };
    }
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };

    powerTick(match);
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'winding', carrierIdx: carrier, targetIdx: blocker,
      secondaryTargetIdx: secondBlocker,
    });
    const winding = match.players[hero].powerState as PowerState;
    if (winding.kind !== 'winding' || match.players[hero].powerAnchor === undefined) {
      throw new Error('expected a placed Gravity windup');
    }
    const anchor = { ...match.players[hero].powerAnchor };
    const secondAnchor = winding.kind === 'winding' ? winding.secondaryAnchor : undefined;
    if (secondAnchor === undefined) throw new Error('expected a second placed Gravity target');
    const newCarrier = 8;
    match.ball = { kind: 'held', by: newCarrier };
    match.players[blocker].pos = { x: 5000, y: 4200 };
    match.players[secondBlocker].pos = { x: 5100, y: 3900 };
    match.tick = winding.untilTick;

    powerTick(match);

    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'POWER_FIRED', player: hero, power: 'GRAVITY_WELL',
    }));
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'active', carrierIdx: newCarrier, targetIdx: blocker,
      secondaryTargetIdx: secondBlocker,
    });
    expect(match.players[blocker].pos).toEqual(anchor);
    expect(match.players[secondBlocker].pos).toEqual(secondAnchor);
  });

  it('keeps Gravity on its valid second capture when the primary becomes unavailable', () => {
    const { match, hero } = matchWith('GRAVITY_WELL', 6);
    const carrier = 9;
    const primary = 12;
    const secondary = 13;
    const newcomer = 14;
    match.ball = { kind: 'held', by: carrier };
    match.players[hero].pos = { x: 2250, y: 5000 };
    match.players[carrier].pos = { x: 3400, y: 4800 };
    match.players[primary].pos = { x: 3300, y: 4400 };
    match.players[secondary].pos = { x: 3250, y: 4100 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== primary && idx !== secondary) match.players[idx].pos = { x: 6000, y: 9000 };
    }
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
    powerTick(match);
    const winding = match.players[hero].powerState as PowerState;
    if (winding.kind !== 'winding' || winding.secondaryAnchor === undefined) {
      throw new Error('expected two captured Gravity targets');
    }
    const secondaryAnchor = { ...winding.secondaryAnchor };
    match.players[primary].outUntilTick = winding.untilTick + 10;
    match.players[newcomer].pos = { x: 3350, y: 4300 };
    const newcomerBefore = { ...match.players[newcomer].pos };
    match.tick = winding.untilTick;

    powerTick(match);

    expect(match.players[secondary].pos).toEqual(secondaryAnchor);
    expect(match.players[newcomer].pos).toEqual(newcomerBefore);
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'active', targetIdx: undefined, secondaryTargetIdx: secondary,
    });
  });

  it('places Decoy\'s extra forward farther ahead with a tap and an upgrade', () => {
    function cloneProgress(strength: number, tier: 1 | 3): number {
      const { match, hero } = matchWith('DECOY_DOUBLE');
      const carrier = 6;
      const marker = 12;
      match.players[hero].def.powerTier = tier;
      match.ball = { kind: 'held', by: carrier };
      match.players[carrier].pos = { x: 2600, y: 4000 };
      match.players[marker].pos = { x: 2700, y: 3700 };
      for (let idx = 11; idx < 22; idx += 1) {
        if (idx !== marker) match.players[idx].pos = { x: 6000, y: 9000 };
      }
      activatePower(match, hero, strength);
      const clone = match.decoyClones[0];
      if (clone === null) throw new Error('expected Decoy clone');
      return 10500 - clone.pos.y;
    }

    const auto = cloneProgress(0.85, 1);
    const manual = cloneProgress(1, 1);
    const tier3 = cloneProgress(1, 3);
    expect(manual).toBeGreaterThan(auto);
    expect(tier3).toBeGreaterThan(manual);
  });

  it('Fire Torch only removes the goal-side marker on its hero attacking run', () => {
    const { match, hero } = matchWith('FIRE_TORCH');
    const behind = 11;
    const goalSide = 12;
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 4000 };
    match.players[behind].pos = { x: 2250, y: 4500 };
    match.players[goalSide].pos = { x: 2300, y: 3400 };
    activatePower(match, hero, 1);
    expect(match.players[goalSide].outReason).toBe('ignited');
    expect(match.players[behind].outReason).toBeUndefined();
  });

  it('keeps Fire Torch removal brief while rewarding manual timing and upgrades', () => {
    const removalTicks = (strength: number, tier: 1 | 3): number => {
      const { match, hero } = matchWith('FIRE_TORCH');
      const marker = 12;
      match.players[hero].def.powerTier = tier;
      match.ball = { kind: 'held', by: hero };
      match.players[hero].pos = { x: 2250, y: 4000 };
      match.players[marker].pos = { x: 2300, y: 3400 };
      for (let idx = 11; idx < 22; idx += 1) {
        if (idx !== marker) match.players[idx].pos = { x: 6000, y: 9000 };
      }
      activatePower(match, hero, strength);
      return match.players[marker].outUntilTick - match.tick;
    };

    const auto = removalTicks(0.85, 1);
    const manual = removalTicks(1, 1);
    const upgradedManual = removalTicks(1, 3);
    expect(auto).toBeGreaterThan(0);
    expect(manual).toBeGreaterThan(auto);
    expect(upgradedManual).toBeGreaterThan(manual);
    expect(upgradedManual).toBeLessThanOrEqual(30);
  });

  it('keeps targetless blind Fire Torch windups safe for movement', () => {
    const { match, hero } = matchWith('FIRE_TORCH');
    match.blindAutoHome = true;
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 200, y: 9000 };

    powerTick(match);

    expect(match.players[hero].powerState).toEqual({
      kind: 'winding', untilTick: 15, strength: 0.85,
    });
    expect(() => movementTick(match)).not.toThrow();
    match.tick = 15;
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('keeps a Fire Torch carrier on the authored run until one normal shot', () => {
    const { match, hero } = matchWith('FIRE_TORCH');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 3400, y: 3800 };
    match.players[12].pos = { x: 3400, y: 3400 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== 12) match.players[idx].pos = { x: 600, y: 8000 };
    }
    activatePower(match, hero, 1);
    expect(attackingDecision(match, hero).kind).toBe('carry');
    possessionTick(match);
    expect(match.players[hero].powerState).toMatchObject({ kind: 'active', commitment: 'FIRE_RUN' });

    match.players[hero].pos = { x: 3400, y: 2100 };
    match.tick = 5;
    possessionTick(match);
    expect(match.events.filter(event => event.kind === 'SHOT')).toHaveLength(1);
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it.each(['BLINK_RUN', 'FIRE_TORCH'] as const)('%s preserves the attacking carry during windup', power => {
    const { match, hero } = matchWith(power);
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 3400, y: 4000 };
    match.players[hero].powerState = { kind: 'winding', untilTick: 15, strength: 1 };
    expect(attackingDecision(match, hero).kind).toBe('carry');
    expect(dribbleBonus(match, hero)).toBeGreaterThan(0);
  });

  it('keeps Fire Torch acquisition visible and stable while tiers change marker count', () => {
    const firesAt = (strength: number, tier: 1 | 3, distance: number): boolean => {
      const { match, hero } = matchWith('FIRE_TORCH');
      match.players[hero].def.powerTier = tier;
      match.ball = { kind: 'held', by: hero };
      match.players[hero].pos = { x: 2000, y: 4000 };
      match.players[12].pos = { x: 2000 + distance, y: 4000 };
      for (let idx = 11; idx < 22; idx += 1) {
        if (idx !== 12) match.players[idx].pos = { x: 6000, y: 9000 };
      }
      activatePower(match, hero, strength);
      return match.players[12].outReason === 'ignited';
    };

    expect(firesAt(0.85, 1, 1800)).toBe(true);
    expect(firesAt(1, 1, 1800)).toBe(true);
    expect(firesAt(1, 3, 1800)).toBe(true);
    expect(firesAt(1, 3, 1950)).toBe(false);
  });

  it('Blink Run appears beyond the actual last defender and its next choice cannot be a pass', () => {
    const { match, hero } = matchWith('BLINK_RUN');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 5000 };
    for (let idx = 11; idx < 22; idx += 1) {
      match.players[idx].pos = { x: idx % 2 === 0 ? 1200 : 3300, y: idx === 11 ? 300 : 3600 + (idx - 12) * 100 };
    }
    const lastDefenderY = Math.min(...match.players.slice(12, 22).map(player => player.pos.y));
    activatePower(match, hero, 1);
    expect(match.players[hero].pos.y).toBeLessThan(lastDefenderY);
    expect(attackingDecision(match, hero).kind).not.toBe('pass');
    possessionTick(match);
    expect(match.players[hero].powerState).toMatchObject({ kind: 'active', commitment: 'BLINK_ACTION' });
    match.players[hero].pos = { x: 3400, y: 2000 };
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 600, y: 8000 };
    match.tick = 5;
    possessionTick(match);
    expect(match.events.filter(event => event.kind === 'SHOT')).toHaveLength(1);
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('never moves an already-advanced Blink runner backward', () => {
    const { match, hero } = matchWith('BLINK_RUN');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 3400, y: 1000 };
    for (let idx = 12; idx < 22; idx += 1) match.players[idx].pos = { x: 1000 + idx * 100, y: 2000 };
    activatePower(match, hero, 1);
    expect(match.players[hero].pos.y).toBeLessThan(1000);
  });

  it('Portal Pass excludes defenders and unavailable runners', () => {
    const { match, hero } = matchWith('PORTAL_PASS');
    const carrier = 6;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 800, y: 6500 };
    for (let idx = 0; idx < 11; idx += 1) {
      if (idx !== carrier) match.players[idx].pos = { x: 3400, y: 5000 };
      if (match.players[idx].def.role === 'MID' && idx !== carrier) match.players[idx].tackleRecoveryUntil = 20;
    }
    activatePower(match, hero, 1);
    expect(match.ball.kind).toBe('held');
    const receiver = match.ball.kind === 'held' ? match.ball.by : carrier;
    expect(['MID', 'FWD']).toContain(match.players[receiver].def.role);
    expect(match.players[receiver].tackleRecoveryUntil).toBeLessThanOrEqual(match.tick);
  });

  it('keeps Portal Heat banked when no obvious better forward exit exists', () => {
    const { match, hero } = matchWith('PORTAL_PASS', 6);
    const carrier = 9;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 3400, y: 6800 };
    match.players[11].pos = { x: 3450, y: 6800 };
    match.players[hero].gauge = 60;

    expect(inUsefulContext(match, hero)).toBe(false);
    expect(zoneEntryContext(match, hero)).toBe(false);
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('idle');
    expect(match.players[hero].gauge).toBeGreaterThanOrEqual(60);
    expect(match.ball).toEqual({ kind: 'held', by: carrier });
  });

  it('opens a Portal Zone only when a real forward exit exists', () => {
    const { match, hero } = matchWith('PORTAL_PASS', 6);
    const carrier = 9;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 3000, y: 4000 };
    match.players[hero].pos = { x: 3400, y: 3300 };
    for (let idx = 0; idx < 11; idx += 1) {
      if (idx !== carrier && idx !== hero) match.players[idx].pos = { x: 3400, y: 6500 };
    }
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 600, y: 7000 };
    match.players[hero].gauge = 60;

    expect(zoneEntryContext(match, hero)).toBe(true);
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('zone');
    expect(match.ball).toEqual({ kind: 'held', by: carrier });
  });

  it('places Portal exits progressively closer with manual timing and tiers', () => {
    function exitProgress(strength: number, tier: 1 | 3): number {
      const { match, hero } = matchWith('PORTAL_PASS');
      const carrier = 6;
      match.players[hero].def.powerTier = tier;
      match.ball = { kind: 'held', by: carrier };
      match.players[carrier].pos = { x: 3400, y: 3800 };
      for (let idx = 0; idx < 11; idx += 1) {
        if (idx !== carrier) match.players[idx].pos = { x: 3400, y: 6500 };
      }
      for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 6000, y: 9000 };
      activatePower(match, hero, strength);
      if (match.ball.kind !== 'held' || match.ball.by === carrier) throw new Error('expected Portal exit');
      return 10500 - match.players[match.ball.by].pos.y;
    }

    const auto = exitProgress(0.85, 1);
    const manual = exitProgress(1, 1);
    const tier3 = exitProgress(1, 3);
    expect(10500 - auto).toBeGreaterThanOrEqual(1800);
    expect(10500 - auto).toBeLessThanOrEqual(2100);
    expect(manual).toBeGreaterThan(auto);
    expect(tier3).toBeGreaterThan(manual);
  });

  it('Phase Run resolves its nearby goal-side challenger immediately, then allows ordinary play', () => {
    const { match, hero } = matchWith('PHASE_RUN');
    const defender = 11;
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 1500 };
    match.players[defender].pos = { x: 2250, y: 1400 };
    activatePower(match, hero, 1);
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'active', commitment: 'PHASE_ACTION',
    });
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(match.players[hero].pos.y).toBeLessThan(match.players[defender].pos.y);
    expect(phaseRunPreventsShot(match, hero)).toBe(false);
  });

  it('Phase Run locks its challenger and preserves the carrier through the windup', () => {
    const { match, hero } = matchWith('PHASE_RUN');
    const challenger = 11;
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 3000 };
    match.players[challenger].pos = { x: 2250, y: 2850 };
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };

    powerTick(match, [{ tick: match.tick, kind: 'POWER_TAP', player: hero }]);
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'winding', targetIdx: challenger,
    });
    expect(attackingDecision(match, hero).kind).toBe('carry');

    const winding = match.players[hero].powerState as MatchState['players'][number]['powerState'];
    if (winding.kind !== 'winding') throw new Error('expected Phase windup');
    match.tick = winding.untilTick;
    powerTick(match);
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'active', commitment: 'PHASE_ACTION',
    });
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(match.players[hero].pos.y).toBeLessThan(match.players[challenger].pos.y);
  });

  it('Phase Run carries farther through its one challenge with manual timing and tiers', () => {
    function clearedY(strength: number, tier: 1 | 3): number {
      const { match, hero } = matchWith('PHASE_RUN');
      match.players[hero].def.powerTier = tier;
      match.ball = { kind: 'held', by: hero };
      match.players[hero].pos = { x: 2250, y: 3000 };
      for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 200, y: 9000 };
      match.players[11].pos = { x: 2250, y: 2850 };
      activatePower(match, hero, strength);
      expect(match.players[hero].powerState).toMatchObject({
        kind: 'active', commitment: 'PHASE_ACTION',
      });
      expect(match.ball).toEqual({ kind: 'held', by: hero });
      return match.players[hero].pos.y;
    }

    const auto = clearedY(0.85, 1);
    const manual = clearedY(1, 1);
    const tier3 = clearedY(1, 3);
    expect(manual).toBeLessThan(auto);
    expect(tier3).toBeLessThan(manual);
  });

  it('Future Sight reads the next eligible pass and owns one controlled outlet', () => {
    const { match, hero } = matchWith('FUTURE_SIGHT', 2);
    const passer = 11;
    const receiver = 12;
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[receiver].pos = { x: 2300, y: 4800 };
    match.players[9].pos = { x: 2500, y: 3000 };
    match.ball = { kind: 'held', by: passer };

    activatePower(match, hero, 1);
    expect(match.ball).toEqual({ kind: 'held', by: passer });
    match.rng = () => 0;
    launchPass(match, passer, receiver, false);

    expect(match.ball).toMatchObject({ kind: 'pass', willSucceed: false, interceptor: hero });
    expect(match.players[hero].powerState).toMatchObject({
      kind: 'active', commitment: 'POWER_OUTLET', targetIdx: 9,
    });
    const flight = match.ball as unknown as Extract<MatchState['ball'], { kind: 'pass' }>;
    flight.pos = { ...match.players[hero].pos };
    possessionTick(match);
    expect(match.ball).toMatchObject({ kind: 'pass', willSucceed: true, interceptor: -1 });
    expect(match.ball).toMatchObject({ from: hero, to: 9 });
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('Future Sight timing and tiers keep the same real onside outlet instead of teleporting it', () => {
    function outletY(strength: number, tier: 1 | 3): number {
      const { match, hero } = matchWith('FUTURE_SIGHT', 2);
      match.players[hero].def.powerTier = tier;
      for (let idx = 0; idx < 11; idx += 1) match.players[idx].pos = { x: 6000, y: 7000 };
      match.players[hero].pos = { x: 2200, y: 5000 };
      match.players[9].pos = { x: 2500, y: 3000 };
      match.players[11].pos = { x: 2300, y: 4800 };
      match.players[12].pos = { x: 2300, y: 4800 };
      match.ball = { kind: 'held', by: 11 };
      activatePower(match, hero, strength);
      match.rng = () => 0;
      launchPass(match, 11, 12, false);
      const state = match.players[hero].powerState;
      if (state.kind !== 'active' || state.targetIdx === undefined) {
        throw new Error('expected Future Sight controlled outlet');
      }
      return match.players[state.targetIdx].pos.y;
    }

    const auto = outletY(0.85, 1);
    const manual = outletY(1, 1);
    const tier3 = outletY(1, 3);
    expect(auto).toBe(3000);
    expect(manual).toBe(auto);
    expect(tier3).toBe(manual);
  });

  it('Web roots and drops its victim while Ice slides carrier and ball together', () => {
    function spring(power: 'WEB_TRAP' | 'ICE_RINK') {
      const { match, hero } = matchWith(power, 2);
      const victim = 11;
      for (let idx = 0; idx < 11; idx += 1) match.players[idx].pos = { x: 6000, y: 9000 };
      match.players[hero].pos = { x: 1000, y: 5000 };
      match.players[victim].pos = { x: 2000, y: 5000 };
      match.ball = { kind: 'held', by: victim };
      activatePower(match, hero, 1, victim);
      expect(match.players[hero].powerState.kind).toBe('active');
      expect(match.ball).toEqual({ kind: 'held', by: victim });
      powerTick(match);
      expect(match.players[hero].powerState.kind).toBe('idle');
      return { match, victim };
    }

    const web = spring('WEB_TRAP');
    expect(web.match.ball).toMatchObject({ kind: 'loose', pos: web.match.players[web.victim].pos });
    expect(web.match.players[web.victim].webbedUntilTick).toBe(70);

    const ice = spring('ICE_RINK');
    expect(ice.match.ball).toEqual({ kind: 'held', by: ice.victim });
    expect(ice.match.players[ice.victim].forcedMovement).toMatchObject({ kind: 'ICE_SLIDE', untilTick: 23 });
  });

  it.each([
    ['WEB_TRAP', 1499, 1500],
    ['ICE_RINK', 1299, 1300],
  ] as const)('%s uses its authored inside/outside trigger boundary', (power, inside, outside) => {
    function triggerAt(distance: number): MatchState {
      const { match, hero } = matchWith(power, 2);
      const victim = 11;
      match.players[hero].pos = { x: 1000, y: 5000 };
      match.players[victim].pos = { x: 1000 + distance, y: 5000 };
      match.ball = { kind: 'held', by: victim };
      activatePower(match, hero, 1);
      powerTick(match);
      return match;
    }

    const insideMatch = triggerAt(inside);
    expect(insideMatch.ball.kind).toBe(power === 'WEB_TRAP' ? 'loose' : 'held');
    if (power === 'WEB_TRAP') expect(insideMatch.players[11].webbedUntilTick).toBe(70);
    else expect(insideMatch.players[11].forcedMovement?.kind).toBe('ICE_SLIDE');
    expect(insideMatch.players[2].powerState.kind).toBe('idle');

    const outsideMatch = triggerAt(outside);
    expect(outsideMatch.ball).toEqual({ kind: 'held', by: 11 });
    expect(outsideMatch.players[2].powerState.kind).toBe('active');
  });

  it('Gust spends on the next good pass and redirects it safely to the goalkeeper', () => {
    const { match, hero } = matchWith('GUST', 2);
    const passer = 11;
    const receiver = 12;
    match.players[hero].pos = { x: 1000, y: 5000 };
    match.players[receiver].pos = { x: 2200, y: 5000 };
    match.ball = { kind: 'held', by: passer };
    activatePower(match, hero, 1);
    match.rng = () => 0;

    launchPass(match, passer, receiver, false);

    expect(match.players[hero].powerState.kind).toBe('idle');
    expect(match.ball).toMatchObject({ kind: 'pass', to: 0, willSucceed: true, gustRedirect: true, interceptor: -1 });
    const flight = match.ball as unknown as Extract<MatchState['ball'], { kind: 'pass' }>;
    flight.pos = { ...match.players[0].pos };
    flight.z = 0;
    possessionTick(match);
    expect(match.ball).toMatchObject({ kind: 'held', by: 0, gustPunt: true });
  });

  it.each(['FUTURE_SIGHT', 'GUST'] as const)(
    '%s stays banked when the ordinary pass already fails',
    power => {
      const { match, hero } = matchWith(power, 2);
      const passer = 11;
      const receiver = 12;
      match.players[passer].def.attrs.pas = 1;
      match.players[receiver].pos = { x: 2300, y: 5000 };
      match.players[hero].pos = { x: 2200, y: 5000 };
      match.players[hero].def.attrs.def = 99;
      match.ball = { kind: 'held', by: passer };
      activatePower(match, hero, 1);
      match.rng = () => 0.99;

      launchPass(match, passer, receiver, false);

      expect(match.players[hero].powerState).toMatchObject({ kind: 'active' });
      expect(match.players[hero].powerState).not.toMatchObject({ commitment: 'POWER_OUTLET' });
    },
  );

  it('Shadow Mark stays burrowed for two seconds before its guaranteed hunt', () => {
    const { match, hero } = matchWith('SHADOW_MARK', 2);
    const carrier = 12;
    match.players[hero].pos = { x: 2000, y: 5000 };
    match.players[carrier].pos = { x: 2100, y: 5000 };
    match.ball = { kind: 'held', by: carrier };
    match.rng = () => 0.99;

    activatePower(match, hero, 1);
    expect(match.ball).toEqual({ kind: 'held', by: carrier });
    expect(match.players[hero].powerState.kind).toBe('active');
    tackleTick(match);
    expect(match.events).not.toContainEqual(expect.objectContaining({ kind: 'TACKLE', by: hero }));
    match.tick = 20;
    powerTick(match);
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'TACKLE', by: hero, on: carrier, style: 'power', won: true,
    }));
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('Shadow Mark stays hidden through a pass, then hunts its receiver after arming', () => {
    const { match, hero } = matchWith('SHADOW_MARK', 2);
    const passer = 11;
    const receiver = 12;
    for (let idx = 0; idx < 11; idx += 1) match.players[idx].pos = { x: 200, y: 9000 };
    match.players[hero].pos = { x: 2300, y: 5000 };
    match.players[receiver].pos = { x: 2300, y: 5000 };
    match.players[passer].def.attrs.pas = 99;
    match.ball = { kind: 'held', by: passer };
    match.rng = () => 0;
    activatePower(match, hero, 1);

    launchPass(match, passer, receiver, false);
    expect(match.ball).toMatchObject({ kind: 'pass', willSucceed: true, to: receiver });
    expect(match.players[hero].powerState.kind).toBe('active');
    const flight = match.ball as unknown as Extract<MatchState['ball'], { kind: 'pass' }>;
    flight.pos = { ...match.players[receiver].pos };
    flight.z = 0;
    possessionTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: receiver });
    match.tick = 20;
    powerTick(match);
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('Shadow Mark does not spend on an airborne shot before a carrier enters its hunt', () => {
    const { match, hero } = matchWith('SHADOW_MARK', 2);
    const shooter = 11;
    match.players[shooter].pos = { x: 2250, y: 5000 };
    match.players[hero].pos = { x: 2250, y: 5200 };
    match.ball = { kind: 'held', by: shooter };
    activatePower(match, hero, 1);

    attemptShot(match, shooter, 5000);

    expect(match.players[hero].powerState.kind).toBe('active');
  });

  it('anchors Shadow Mark to a fixed two-second burrow plus ten-second hunt', () => {
    const auto = activateAt('SHADOW_MARK', 0.85, 1, 2);
    const manual = activateAt('SHADOW_MARK', 1, 1, 2);
    const tier3 = activateAt('SHADOW_MARK', 1, 3, 2);
    expect(auto.match.players[auto.hero].powerState).toMatchObject({ untilTick: 120, armedAtTick: 20 });
    expect(manual.match.players[manual.hero].powerState).toMatchObject({ untilTick: 120, armedAtTick: 20 });
    expect(tier3.match.players[tier3.hero].powerState).toMatchObject({ untilTick: 120, armedAtTick: 20 });

    auto.match.ball = { kind: 'loose', pos: { x: 3400, y: 5250 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    auto.match.tick = 119;
    powerTick(auto.match);
    expect(auto.match.players[auto.hero].powerState.kind).toBe('active');
    auto.match.tick = 120;
    powerTick(auto.match);
    expect(auto.match.players[auto.hero].powerState.kind).toBe('idle');
  });

  it('keeper Zones open on danger but fire on the current on-target shot without a windup', () => {
    for (const power of ['ELASTIC_KEEPER', 'GIANT_GK'] as const) {
      const { match, hero } = matchWith(power, 0);
      match.players[20].pos = { x: 3400, y: 9000 };
      match.ball = { kind: 'held', by: 20 };
      expect(zoneEntryContext(match, hero)).toBe(true);
      expect(inUsefulContext(match, hero)).toBe(false);

      for (const policy of ['FIRE_WHEN_READY', 'SAVE_FOR_TAP'] as const) {
        match.players[hero].firePolicy = policy;
        match.players[hero].powerState = { kind: 'idle' };
        match.players[hero].gauge = 5;
        match.players[hero].zonesOpened = 0;
        powerTick(match);
        expect(match.players[hero].powerState).toEqual({ kind: 'zone', remainingTicks: 70 });
      }

      match.players[hero].firePolicy = 'FIRE_WHEN_READY';
      match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
      powerTick(match);
      expect(match.players[hero].powerState).toEqual({ kind: 'zone', remainingTicks: 70 });

      match.players[hero].firePolicy = 'SAVE_FOR_TAP';
      match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
      powerTick(match);
      expect(match.players[hero].powerState).toEqual({ kind: 'zone', remainingTicks: 70 });

      match.players[hero].firePolicy = 'FIRE_WHEN_READY';
      match.players[hero].powerState = { kind: 'zone', remainingTicks: 70 };
      match.players[hero].pos = { x: 3400, y: 10000 };
      match.ball = {
        kind: 'shot', pos: { x: 3400, y: 9800 }, vel: { x: 0, y: 300 }, by: 20,
        power: 1, targetX: 3400, z: 0, vz: 0, trajectory: 'driven', keeperChecked: false,
      };
      match.rng = () => 0;
      powerTick(match);
      expect(match.players[hero].powerState.kind).toBe('active');
      expect(match.events.at(-1)).toMatchObject({ kind: 'POWER_FIRED', player: hero, strength: 0.85 });
      shotFlightTick(match);
      expect(match.ball).toMatchObject({ kind: 'held', by: hero, caught: true });
      if (power === 'ELASTIC_KEEPER') {
        expect(match.players[hero].powerState.kind).toBe('idle');
      } else {
        expect(match.players[hero].powerState.kind).toBe('idle');
        expect(match.players[hero].gauge).toBeGreaterThan(0);
      }
    }
  });

  it('keeper cash-out bonuses use a nonlinear timing and tier curve', () => {
    for (const [power, expected] of [
      ['ELASTIC_KEEPER', { auto: 12, manual: 20, tier3: 32 }],
      ['GIANT_GK', { auto: 11, manual: 20, tier3: 30 }],
    ] as const) {
      const auto = activateAt(power, 0.85, 1, 0);
      const manual = activateAt(power, 1, 1, 0);
      const tier3 = activateAt(power, 1, 3, 0);
      const autoBonus = keeperSaveBonus(auto.match, auto.hero);
      const manualBonus = keeperSaveBonus(manual.match, manual.hero);
      const tier3Bonus = keeperSaveBonus(tier3.match, tier3.hero);
      expect(autoBonus).toBe(expected.auto);
      expect(manualBonus).toBe(expected.manual);
      expect(tier3Bonus).toBe(expected.tier3);
      expect(manualBonus - autoBonus).toBeGreaterThan(0);
      expect(tier3Bonus - manualBonus).toBeGreaterThanOrEqual(manualBonus - autoBonus);
    }
  });

  it('Super Strength manual timing and tiers scale pursuit while every valid carrier lock lands', () => {
    const auto = matchWith('SUPER_STRENGTH');
    const manual = matchWith('SUPER_STRENGTH');
    auto.match.players[auto.hero].def.powerTier = 1;
    manual.match.players[manual.hero].def.powerTier = 3;
    auto.match.players[auto.hero].powerState = { kind: 'winding', untilTick: 15, strength: 0.85, targetIdx: 11 };
    manual.match.players[manual.hero].powerState = { kind: 'winding', untilTick: 15, strength: 1, targetIdx: 11 };
    expect(speedMultiplier(manual.match, manual.hero)).toBeGreaterThan(speedMultiplier(auto.match, auto.hero));

    auto.match.players[auto.hero].pos = { x: 2000, y: 5000 };
    manual.match.players[manual.hero].pos = { x: 2000, y: 5000 };
    auto.match.players[11].pos = { x: 3350, y: 5000 };
    manual.match.players[11].pos = { x: 3350, y: 5000 };
    auto.match.ball = { kind: 'held', by: 11 };
    manual.match.ball = { kind: 'held', by: 11 };
    activatePower(auto.match, auto.hero, 0.85, 11);
    activatePower(manual.match, manual.hero, 1, 11);
    expect(auto.match.players[11].outReason).toBe('ko');
    expect(manual.match.players[11].outReason).toBe('ko');
  });

  it('cancels a stale Super Strength lock instead of flattening a non-carrier', () => {
    const { match, hero } = matchWith('SUPER_STRENGTH', 2);
    const target = 11;
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[target].pos = { x: 2300, y: 5000 };
    match.ball = { kind: 'held', by: 12 };
    activatePower(match, hero, 1, target);
    expect(match.players[target].outReason).toBeUndefined();
    expect(match.ball).toEqual({ kind: 'held', by: 12 });
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('turns a successful Super Strength carrier lock into the guaranteed tackle itself', () => {
    const { match, hero } = matchWith('SUPER_STRENGTH', 2);
    const target = 11;
    match.ball = { kind: 'held', by: target };
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[target].pos = { x: 2300, y: 5000 };
    for (let idx = 0; idx < 11; idx += 1) {
      if (idx !== hero) match.players[idx].pos = { x: 1000, y: 6500 };
    }
    activatePower(match, hero, 1, target);
    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(match.players[hero].powerState.kind).toBe('idle');
    expect(match.events).toContainEqual(expect.objectContaining({
      kind: 'TACKLE', by: hero, on: target, won: true, style: 'power',
    }));
  });

  it('turns Speed manual timing and tier into materially stronger tackle resistance', () => {
    const auto = matchWith('SUPER_SPEED');
    const manual = matchWith('SUPER_SPEED');
    auto.match.players[auto.hero].def.powerTier = 1;
    manual.match.players[manual.hero].def.powerTier = 3;
    activatePower(auto.match, auto.hero, 0.85);
    activatePower(manual.match, manual.hero, 1);
    expect(dribbleBonus(auto.match, auto.hero)).toBe(22);
    expect(dribbleBonus(manual.match, manual.hero)).toBe(32);
  });

  it('makes every authored attacking finish stronger from auto to tap to Tier 3', () => {
    function profile(power: 'SUPER_SPEED' | 'BLINK_RUN' | 'THUNDER_STRIKE' | 'FIRE_TORCH' | 'PHASE_RUN', strength: number, tier: 1 | 3) {
      const { match, hero } = matchWith(power);
      match.players[hero].def.powerTier = tier;
      match.players[hero].pos = { x: 2250, y: 2500 };
      match.ball = { kind: 'held', by: hero };
      for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 6000, y: 9000 };
      if (power === 'FIRE_TORCH') match.players[12].pos = { x: 2250, y: 2200 };
      if (power === 'PHASE_RUN') match.players[12].pos = { x: 2250, y: 2350 };
      activatePower(match, hero, strength);
      const result = powerFinishShotProfile(match, hero);
      if (result === null) throw new Error(`expected ${power} finish profile`);
      return result;
    }

    for (const power of ['SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN'] as const) {
      const auto = profile(power, 0.85, 1);
      const manual = profile(power, 1, 1);
      const tier3 = profile(power, 1, 3);
      expect(manual.aimScale).toBeLessThan(auto.aimScale);
      expect(tier3.aimScale).toBeLessThan(manual.aimScale);
      expect(manual.powerBonus).toBeGreaterThan(auto.powerBonus);
      expect(tier3.powerBonus).toBeGreaterThan(manual.powerBonus);
    }
  });

  it('Gravity Well only fires in friendly possession and pulls markers once toward the carrier', () => {
    const { match, hero } = matchWith('GRAVITY_WELL');
    const carrier = 6;
    match.players[hero].pos = { x: 2250, y: 5000 };
    match.players[carrier].pos = { x: 3300, y: 4800 };
    match.players[12].pos = { x: 3000, y: 3900 };
    for (let idx = 11; idx < 22; idx += 1) {
      if (idx !== 12) match.players[idx].pos = { x: 6000, y: 9000 };
    }
    match.ball = { kind: 'held', by: carrier };
    expect(inUsefulContext(match, hero)).toBe(true);
    const before = { ...match.players[12].pos };
    const beforeDistance = Math.hypot(before.x - match.players[carrier].pos.x, before.y - match.players[carrier].pos.y);
    activatePower(match, hero, 1);
    const after = { ...match.players[12].pos };
    expect(Math.hypot(after.x - match.players[carrier].pos.x, after.y - match.players[carrier].pos.y))
      .toBeLessThan(beforeDistance);
    expect(match.players[hero].powerState.kind).toBe('active');
    powerTick(match);
    expect(match.players[12].pos).toEqual(after);
    consumeDecoyAction(match, carrier);
    expect(match.players[hero].powerState.kind).toBe('idle');
  });

  it('banks Gravity Heat until the strict cross-lane blocker exists', () => {
    const { match, hero } = matchWith('GRAVITY_WELL', 6);
    const carrier = 9;
    match.ball = { kind: 'held', by: carrier };
    match.players[hero].pos = { x: 2250, y: 5000 };
    match.players[carrier].pos = { x: 3400, y: 4800 };
    match.players[hero].gauge = 60;
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 6000, y: 9000 };

    expect(zoneEntryContext(match, hero)).toBe(false);
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('idle');
    expect(match.players[hero].gauge).toBeGreaterThanOrEqual(60);

    match.players[12].pos = { x: 3300, y: 4400 };
    expect(zoneEntryContext(match, hero)).toBe(true);
    powerTick(match);
    expect(match.players[hero].powerState.kind).toBe('zone');
  });

  it('keeps every Gravity grade safely short of crossing through the carrier', () => {
    function pulse(strength: number, tier: 1 | 3): { before: number; after: number } {
      const { match, hero } = matchWith('GRAVITY_WELL', 6);
      const carrier = 9;
      const blocker = 12;
      match.players[hero].def.powerTier = tier;
      match.ball = { kind: 'held', by: carrier };
      match.players[hero].pos = { x: 2250, y: 5000 };
      match.players[carrier].pos = { x: 3400, y: 4800 };
      match.players[blocker].pos = { x: 3000, y: 3900 };
      for (let idx = 11; idx < 22; idx += 1) {
        if (idx !== blocker) match.players[idx].pos = { x: 6000, y: 9000 };
      }
      const before = { ...match.players[blocker].pos };
      activatePower(match, hero, strength);
      return {
        before: Math.hypot(before.x - match.players[carrier].pos.x, before.y - match.players[carrier].pos.y),
        after: Math.hypot(
          match.players[blocker].pos.x - match.players[carrier].pos.x,
          match.players[blocker].pos.y - match.players[carrier].pos.y,
        ),
      };
    }

    const auto = pulse(0.85, 1);
    const manual = pulse(1, 1);
    const tier3 = pulse(1, 3);
    for (const result of [auto, manual, tier3]) {
      expect(result.after).toBeLessThan(result.before);
      expect(result.after).toBeGreaterThanOrEqual(599);
    }
  });
});
