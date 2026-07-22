import { launchPass, movementTick, shotBonus } from '../engine';
import { createMatch } from '../match';
import {
  activatePower,
  addGauge,
  dribbleBonus,
  futureSightInterceptor,
  inUsefulContext,
  keeperSaveBonus,
  phaseRunPreventsShot,
  powerTick,
  speedMultiplier,
} from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PowerId, TeamDef } from '../types';

const POWER_IDS: readonly PowerId[] = [
  'SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN', 'PORTAL_PASS',
  'DECOY_DOUBLE', 'FUTURE_SIGHT', 'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
  'GUST',
];

function matchWith(power: PowerId): { match: MatchState; hero: number } {
  const slot = power === 'ELASTIC_KEEPER' ? 0 : 10;
  const home: TeamDef = {
    ...ROVERS,
    id: `m4-${power.toLowerCase()}`,
    players: ROVERS.players.map((player, index) => ({
      ...player,
      attrs: { ...player.attrs },
      power: index === slot ? power : undefined,
    })),
  };
  return { match: createMatch(20260721, home, UNITED), hero: slot };
}

describe('M4 twelve-power catalog', () => {
  it.each(POWER_IDS)('%s has a deterministic activation lifecycle', power => {
    const { match, hero } = matchWith(power);
    match.rng = () => 0.99;
    activatePower(match, hero, 1);

    expect(match.events).toContainEqual(expect.objectContaining({ kind: 'POWER_FIRED', player: hero, power, strength: 1 }));
    expect(match.players[hero].powerState).toMatchObject({ kind: 'active' });
    expect(match.players[hero].powerState.kind === 'active'
      ? match.players[hero].powerState.strength : 0).toBeGreaterThan(1);
  });

  it.each(POWER_IDS)('%s rewards a well-placed tap above contextual auto', power => {
    const auto = matchWith(power);
    const manual = matchWith(power);
    activatePower(auto.match, auto.hero, 0.85);
    activatePower(manual.match, manual.hero, 1);

    const autoState = auto.match.players[auto.hero].powerState;
    const manualState = manual.match.players[manual.hero].powerState;
    expect(autoState.kind).toBe('active');
    expect(manualState.kind).toBe('active');
    const autoStrength = autoState.kind === 'active' ? autoState.strength : 0;
    const manualStrength = manualState.kind === 'active' ? manualState.strength : 0;
    expect(manualStrength).toBeGreaterThan(autoStrength);
    if (power !== 'PORTAL_PASS') {
      const autoUntil = autoState.kind === 'active' ? autoState.untilTick : 0;
      const manualUntil = manualState.kind === 'active' ? manualState.untilTick : 0;
      expect(manualUntil).toBeGreaterThan(autoUntil);
    }
    expect(auto.match.events).toContainEqual(expect.objectContaining({ kind: 'POWER_FIRED', strength: 0.85 }));
    expect(manual.match.events).toContainEqual(expect.objectContaining({ kind: 'POWER_FIRED', strength: 1 }));
  });

  it('applies every movement, possession, misdirection, and prediction spike visibly', () => {
    const blink = matchWith('BLINK_RUN');
    blink.match.players[blink.hero].pos = { x: 3400, y: 6000 };
    blink.match.ball = { kind: 'held', by: blink.hero };
    activatePower(blink.match, blink.hero, 1);
    expect(blink.match.players[blink.hero].pos.y).toBeLessThan(4850);

    const portal = matchWith('PORTAL_PASS');
    portal.match.ball = { kind: 'held', by: portal.hero };
    activatePower(portal.match, portal.hero, 1);
    expect(portal.match.ball).toMatchObject({ kind: 'held' });
    expect(portal.match.ball.kind === 'held' ? portal.match.ball.by : portal.hero).not.toBe(portal.hero);

    const decoy = matchWith('DECOY_DOUBLE');
    decoy.match.players[decoy.hero].pos = { x: 3000, y: 5000 };
    decoy.match.players[11].pos = { x: 3100, y: 5000 };
    activatePower(decoy.match, decoy.hero, 1);
    const beforeDecoyMove = { ...decoy.match.players[11].pos };
    movementTick(decoy.match);
    expect(decoy.match.players[11].pos).not.toEqual(beforeDecoyMove);

    const future = matchWith('FUTURE_SIGHT');
    future.match.players[future.hero].pos = { x: 3000, y: 5000 };
    future.match.players[9].pos = { x: 2600, y: 3500 };
    future.match.players[11].pos = { x: 3100, y: 5000 };
    future.match.players[12].pos = { x: 3200, y: 5000 };
    future.match.ball = { kind: 'held', by: 11 };
    activatePower(future.match, future.hero, 1, 11);
    expect(future.match.ball).toEqual({ kind: 'held', by: 11 });
    launchPass(future.match, 11, 12, false);
    expect(future.match.ball).toMatchObject({
      kind: 'pass',
      from: 11,
      to: 12,
      willSucceed: false,
      interceptor: future.hero,
    });
    expect(future.match.players[future.hero].pos).toEqual(future.match.players[12].pos);
    expect(future.match.players[future.hero].powerState.kind).toBe('active');
    expect(future.match.players[future.hero].powerState).toMatchObject({
      kind: 'active', commitment: 'FUTURE_OUTLET',
    });

    const web = matchWith('WEB_TRAP');
    web.match.players[web.hero].pos = { x: 3000, y: 5000 };
    web.match.players[11].pos = { x: 3100, y: 5000 };
    web.match.ball = { kind: 'held', by: 11 };
    activatePower(web.match, web.hero, 1, 11);
    expect(web.match.players[11].outUntilTick).toBe(web.match.tick);
    web.match.players[web.hero].pos = { x: 4200, y: 5000 };
    powerTick(web.match);
    expect(web.match.players[11].outUntilTick).toBeGreaterThan(web.match.tick);
    expect(web.match.ball.kind).toBe('loose');
  });

  it('lets Portal Pass trigger from a teammate carrying under pressure', () => {
    const portal = matchWith('PORTAL_PASS');
    const carrier = 6;
    const marker = 11;
    portal.match.ball = { kind: 'held', by: carrier };
    portal.match.players[carrier].pos = { x: 3000, y: 4000 };
    portal.match.players[marker].pos = { x: 3050, y: 4000 };

    expect(inUsefulContext(portal.match, portal.hero)).toBe(true);
    activatePower(portal.match, portal.hero, 1);
    expect(portal.match.ball).toMatchObject({ kind: 'held' });
    expect(portal.match.ball.kind === 'held' ? portal.match.ball.by : carrier).not.toBe(carrier);
  });

  it('lets Decoy Double trigger while a teammate carries', () => {
    const decoy = matchWith('DECOY_DOUBLE');
    const carrier = 6;
    const marker = 11;
    decoy.match.ball = { kind: 'held', by: carrier };
    decoy.match.players[carrier].pos = { x: 3000, y: 4000 };
    decoy.match.players[decoy.hero].pos = { x: 300, y: 8000 };
    decoy.match.players[marker].pos = { x: 3050, y: 4000 };
    const markerX = decoy.match.players[marker].pos.x;

    expect(inUsefulContext(decoy.match, decoy.hero)).toBe(true);
    activatePower(decoy.match, decoy.hero, 1);
    movementTick(decoy.match);
    expect(decoy.match.players[marker].pos.x).not.toBe(markerX);
  });

  it('applies the continuous speed, shooting, phase, and goalkeeper bonuses', () => {
    const speed = matchWith('SUPER_SPEED');
    activatePower(speed.match, speed.hero, 1);
    expect(speedMultiplier(speed.match, speed.hero)).toBeGreaterThan(2.3);

    const thunder = matchWith('THUNDER_STRIKE');
    activatePower(thunder.match, thunder.hero, 1);
    expect(shotBonus(thunder.match, thunder.hero)).toBeGreaterThan(70);

    const phase = matchWith('PHASE_RUN');
    activatePower(phase.match, phase.hero, 1);
    expect(phaseRunPreventsShot(phase.match, phase.hero)).toBe(false);
    expect(dribbleBonus(phase.match, phase.hero)).toBeGreaterThan(75);

    const keeper = matchWith('ELASTIC_KEEPER');
    activatePower(keeper.match, keeper.hero, 1);
    expect(keeperSaveBonus(keeper.match, keeper.hero)).toBeGreaterThan(75);
  });

  it('scales effects by hero tier without changing replayed tap strength', () => {
    const tier1 = matchWith('BLINK_RUN');
    const tier3 = matchWith('BLINK_RUN');
    tier1.match.players[tier1.hero].pos = { x: 3400, y: 6000 };
    tier3.match.players[tier3.hero].pos = { x: 3400, y: 6000 };
    tier1.match.players[tier1.hero].def.powerTier = 1;
    tier3.match.players[tier3.hero].def.powerTier = 3;

    activatePower(tier1.match, tier1.hero, 1);
    activatePower(tier3.match, tier3.hero, 1);

    expect(tier3.match.players[tier3.hero].pos.y).toBeLessThan(tier1.match.players[tier1.hero].pos.y);
    const tier1State = tier1.match.players[tier1.hero].powerState;
    const tier3State = tier3.match.players[tier3.hero].powerState;
    expect(tier1State.kind).toBe('active');
    expect(tier3State.kind).toBe('active');
    const tier1Strength = tier1State.kind === 'active' ? tier1State.strength : 0;
    const tier3Strength = tier3State.kind === 'active' ? tier3State.strength : 0;
    expect(tier3Strength).toBeCloseTo(tier1Strength * 1.45, 12);
    expect(tier1.match.events.at(-1)).toMatchObject({ kind: 'POWER_FIRED', strength: 1 });
    expect(tier3.match.events.at(-1)).toMatchObject({ kind: 'POWER_FIRED', strength: 1 });
  });

  it('keeps Portal Pass active cooldown constant across tiers', () => {
    const tier1 = matchWith('PORTAL_PASS');
    const tier3 = matchWith('PORTAL_PASS');
    tier1.match.players[tier1.hero].def.powerTier = 1;
    tier3.match.players[tier3.hero].def.powerTier = 3;
    tier1.match.ball = { kind: 'held', by: 6 };
    tier3.match.ball = { kind: 'held', by: 6 };

    activatePower(tier1.match, tier1.hero, 1);
    activatePower(tier3.match, tier3.hero, 1);

    expect(tier1.match.players[tier1.hero].powerState).toMatchObject({ kind: 'active', untilTick: 40 });
    expect(tier3.match.players[tier3.hero].powerState).toMatchObject({ kind: 'active', untilTick: 40 });
    tier1.match.tick = 40;
    tier3.match.tick = 40;
    powerTick(tier1.match);
    powerTick(tier3.match);
    addGauge(tier1.match, tier1.hero, 5);
    addGauge(tier3.match, tier3.hero, 5);
    expect(tier1.match.players[tier1.hero].gauge).toBe(5);
    expect(tier3.match.players[tier3.hero].gauge).toBe(5);
  });

  it('does not let Future Sight intercept while its hero is recovering', () => {
    const future = matchWith('FUTURE_SIGHT');
    future.match.players[future.hero].pos = { x: 3000, y: 5000 };
    future.match.players[12].pos = { x: 3200, y: 5000 };
    activatePower(future.match, future.hero, 1);
    future.match.players[future.hero].tackleRecoveryUntil = future.match.tick + 5;

    expect(futureSightInterceptor(future.match, 1, 12)).toBe(-1);
    expect(future.match.players[future.hero].powerState.kind).toBe('active');
  });

  it.each([
    'PORTAL_PASS', 'DECOY_DOUBLE', 'FUTURE_SIGHT',
    'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER', 'GUST',
  ] as const)('%s expires rather than auto-firing without its useful target', power => {
    const { match, hero } = matchWith(power);
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 20 };
    match.ball = power === 'ELASTIC_KEEPER' || power === 'GUST'
      ? { kind: 'held', by: hero }
      : { kind: 'held', by: 11 };
    match.players[11].pos = { x: 200, y: 9000 };
    match.players[hero].pos = { x: 4300, y: 1000 };

    powerTick(match);

    expect(match.players[hero].powerState).toEqual({ kind: 'zone', remainingTicks: 19 });
    expect(match.events).not.toContainEqual(expect.objectContaining({ kind: 'POWER_FIRED', player: hero }));
  });

  it.each([
    'PORTAL_PASS', 'DECOY_DOUBLE', 'FUTURE_SIGHT',
    'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER', 'GUST',
  ] as const)('%s arms a manual tap without its useful context', power => {
    const { match, hero } = matchWith(power);
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 60 };
    match.ball = power === 'ELASTIC_KEEPER' || power === 'GUST'
      ? { kind: 'held', by: hero }
      : { kind: 'held', by: 11 };
    match.players[11].pos = { x: 200, y: 9000 };
    match.players[hero].pos = { x: 4300, y: 1000 };

    powerTick(match, [{ tick: match.tick, kind: 'POWER_TAP', player: hero }]);

    expect(match.players[hero].powerState).toEqual({ kind: 'armed', remainingTicks: 20 });
    expect(match.events).not.toContainEqual(expect.objectContaining({ kind: 'POWER_FIRED', player: hero }));
  });

  it.each(POWER_IDS)('%s enters wind-up through its authored useful context', power => {
    const { match, hero } = matchWith(power);
    const opponent = 11;
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 60 };
    const heroY = power === 'ELASTIC_KEEPER' ? 8500 : power === 'THUNDER_STRIKE' ? 2500 : 3500;
    match.players[hero].pos = { x: 2250, y: heroY };
    match.players[opponent].pos = { x: 2350, y: power === 'ELASTIC_KEEPER' ? 8000 : heroY };

    if (power === 'FUTURE_SIGHT' || power === 'SUPER_STRENGTH' || power === 'WEB_TRAP'
      || power === 'ELASTIC_KEEPER' || power === 'GUST') {
      match.ball = { kind: 'held', by: opponent };
    } else {
      match.ball = { kind: 'held', by: hero };
    }

    powerTick(match);

    expect(match.players[hero].powerState.kind).toBe('winding');
  });
});
