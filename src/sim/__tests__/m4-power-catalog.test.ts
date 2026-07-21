import { launchPass, shotBonus } from '../engine';
import { createMatch } from '../match';
import {
  activatePower,
  dribbleBonus,
  futureSightInterceptor,
  keeperSaveBonus,
  phaseRunPreventsShot,
  powerTick,
  speedMultiplier,
} from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PowerId, TeamDef } from '../types';

const POWER_IDS: readonly PowerId[] = [
  'SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN', 'PORTAL_PASS',
  'MAGNET_TOUCH', 'DECOY_DOUBLE', 'FUTURE_SIGHT', 'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
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
    expect(match.players[hero].powerState).toMatchObject({ kind: 'active', strength: 1 });
  });

  it('applies every movement, possession, misdirection, and prediction spike visibly', () => {
    const blink = matchWith('BLINK_RUN');
    blink.match.players[blink.hero].pos = { x: 3400, y: 6000 };
    blink.match.ball = { kind: 'held', by: blink.hero };
    activatePower(blink.match, blink.hero, 1);
    expect(blink.match.players[blink.hero].pos.y).toBe(4950);

    const portal = matchWith('PORTAL_PASS');
    portal.match.ball = { kind: 'held', by: portal.hero };
    activatePower(portal.match, portal.hero, 1);
    expect(portal.match.ball).toMatchObject({ kind: 'held' });
    expect(portal.match.ball.kind === 'held' ? portal.match.ball.by : portal.hero).not.toBe(portal.hero);

    const magnet = matchWith('MAGNET_TOUCH');
    magnet.match.players[magnet.hero].pos = { x: 3000, y: 5000 };
    magnet.match.ball = { kind: 'loose', pos: { x: 3100, y: 5000 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    activatePower(magnet.match, magnet.hero, 1);
    expect(magnet.match.ball).toEqual({ kind: 'held', by: magnet.hero });

    const decoy = matchWith('DECOY_DOUBLE');
    decoy.match.players[decoy.hero].pos = { x: 3000, y: 5000 };
    decoy.match.players[11].pos = { x: 3100, y: 5000 };
    activatePower(decoy.match, decoy.hero, 1);
    expect(decoy.match.players[11].pos.x).toBeGreaterThan(3100);

    const future = matchWith('FUTURE_SIGHT');
    future.match.players[future.hero].pos = { x: 3000, y: 5000 };
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

  it('applies the continuous speed, shooting, phase, and goalkeeper bonuses', () => {
    const speed = matchWith('SUPER_SPEED');
    activatePower(speed.match, speed.hero, 1);
    expect(speedMultiplier(speed.match, speed.hero)).toBe(2.2);

    const thunder = matchWith('THUNDER_STRIKE');
    activatePower(thunder.match, thunder.hero, 1);
    expect(shotBonus(thunder.match, thunder.hero)).toBe(65);

    const phase = matchWith('PHASE_RUN');
    activatePower(phase.match, phase.hero, 1);
    expect(phaseRunPreventsShot(phase.match, phase.hero)).toBe(true);
    expect(dribbleBonus(phase.match, phase.hero)).toBe(70);

    const keeper = matchWith('ELASTIC_KEEPER');
    activatePower(keeper.match, keeper.hero, 1);
    expect(keeperSaveBonus(keeper.match, keeper.hero)).toBe(70);
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
    'PORTAL_PASS', 'MAGNET_TOUCH', 'DECOY_DOUBLE', 'FUTURE_SIGHT',
    'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
  ] as const)('%s expires rather than auto-firing without its useful target', power => {
    const { match, hero } = matchWith(power);
    match.players[hero].firePolicy = 'FIRE_WHEN_READY';
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 20 };

    powerTick(match);

    expect(match.players[hero].powerState).toEqual({ kind: 'zone', remainingTicks: 19 });
    expect(match.events).not.toContainEqual(expect.objectContaining({ kind: 'POWER_FIRED', player: hero }));
  });

  it.each([
    'PORTAL_PASS', 'MAGNET_TOUCH', 'DECOY_DOUBLE', 'FUTURE_SIGHT',
    'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
  ] as const)('%s does not consume a manual tap without its useful context', power => {
    const { match, hero } = matchWith(power);
    match.players[hero].powerState = { kind: 'zone', remainingTicks: 60 };
    match.ball = { kind: 'held', by: power === 'ELASTIC_KEEPER' ? 1 : 9 };

    powerTick(match, [{ tick: match.tick, kind: 'POWER_TAP', player: hero }]);

    expect(match.players[hero].powerState).toEqual({ kind: 'zone', remainingTicks: 59 });
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

    if (power === 'MAGNET_TOUCH') {
      match.ball = { kind: 'loose', pos: { x: 2300, y: 3500 }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
    } else if (power === 'FUTURE_SIGHT' || power === 'SUPER_STRENGTH' || power === 'WEB_TRAP' || power === 'ELASTIC_KEEPER') {
      match.ball = { kind: 'held', by: opponent };
    } else {
      match.ball = { kind: 'held', by: hero };
    }

    powerTick(match);

    expect(match.players[hero].powerState.kind).toBe('winding');
  });
});
