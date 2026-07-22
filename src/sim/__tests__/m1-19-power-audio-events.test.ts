import { launchPass, possessionTick } from '../engine';
import { createMatch } from '../match';
import { activatePower, powerTick } from '../powers';
import { ROVERS, UNITED } from '../teams';
import type { MatchState, PowerId } from '../types';

function matchWith(power: PowerId, slot = 10): { match: MatchState; hero: number } {
  const home = {
    ...ROVERS,
    players: ROVERS.players.map((player, idx) => ({
      ...player,
      attrs: { ...player.attrs },
      power: idx === slot ? power : undefined,
    })),
  };
  return { match: createMatch(119, home, UNITED), hero: slot };
}

function impacts(match: MatchState, power: PowerId) {
  return match.events.filter(event => event.kind === 'POWER_IMPACT' && event.power === power);
}

describe('m1.19 authored power audio events', () => {
  it('emits Blink exactly when the teleport moves the runner', () => {
    const { match, hero } = matchWith('BLINK_RUN');
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 5000 };
    for (let idx = 11; idx < 22; idx += 1) {
      match.players[idx].pos = { x: 1200 + (idx % 2) * 1800, y: 3400 + (idx - 11) * 80 };
    }
    const before = { ...match.players[hero].pos };

    activatePower(match, hero, 1);

    expect(match.players[hero].pos).not.toEqual(before);
    expect(impacts(match, 'BLINK_RUN')).toEqual([
      expect.objectContaining({ player: hero, target: hero }),
    ]);
  });

  it('emits Portal exactly when the protected receiver arrives', () => {
    const { match, hero } = matchWith('PORTAL_PASS');
    const carrier = 6;
    match.ball = { kind: 'held', by: carrier };
    match.players[carrier].pos = { x: 2250, y: 4200 };
    for (let idx = 0; idx < 11; idx += 1) {
      if (idx !== carrier && idx !== hero) match.players[idx].pos = { x: 3400, y: 6500 };
    }
    for (let idx = 11; idx < 22; idx += 1) match.players[idx].pos = { x: 500, y: 8500 };

    activatePower(match, hero, 1);

    if (match.ball.kind !== 'held') throw new Error('expected Portal receiver');
    const receiver = match.ball.by;
    expect(receiver).not.toBe(carrier);
    expect(match.players[receiver].portalProtectedUntilTick).toBeGreaterThan(match.tick);
    expect(impacts(match, 'PORTAL_PASS')).toEqual([
      expect.objectContaining({ player: hero, target: receiver }),
    ]);
  });

  it('emits Phase exactly when the runner clears a challenger', () => {
    const { match, hero } = matchWith('PHASE_RUN');
    const challenger = 11;
    match.ball = { kind: 'held', by: hero };
    match.players[hero].pos = { x: 2250, y: 3000 };
    match.players[challenger].pos = { x: 2250, y: 2850 };

    activatePower(match, hero, 1, challenger);

    expect(match.players[hero].pos.y).toBeLessThan(match.players[challenger].pos.y);
    expect(impacts(match, 'PHASE_RUN')).toEqual([
      expect.objectContaining({ player: hero, target: challenger }),
    ]);
  });

  it.each(['WEB_TRAP', 'ICE_RINK'] as const)(
    'emits %s only when the placed trap springs',
    power => {
      const { match, hero } = matchWith(power, 2);
      const victim = 11;
      match.players[hero].pos = { x: 1000, y: 5000 };
      match.players[victim].pos = { x: 1900, y: 5000 };
      match.ball = { kind: 'held', by: victim };

      activatePower(match, hero, 1, victim);
      expect(impacts(match, power)).toEqual([]);
      powerTick(match);

      expect(impacts(match, power)).toEqual([
        expect.objectContaining({ player: hero, target: victim }),
      ]);
    },
  );

  it('emits Shadow only after the burrow finishes and the steal lands', () => {
    const { match, hero } = matchWith('SHADOW_MARK', 2);
    // Shadow ignores goalkeepers; use a normal outfield carrier so this test
    // exercises the approved burrow-and-emerge steal rather than a non-target.
    const victim = 12;
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[victim].pos = { x: 2250, y: 5000 };
    match.ball = { kind: 'held', by: victim };

    activatePower(match, hero, 1);
    expect(impacts(match, 'SHADOW_MARK')).toEqual([]);
    match.tick = 20;
    powerTick(match);

    expect(match.ball).toEqual({ kind: 'held', by: hero });
    expect(impacts(match, 'SHADOW_MARK')).toEqual([
      expect.objectContaining({ player: hero, target: victim }),
    ]);
  });

  it('emits Future Sight on pass arrival, not when the prediction is armed', () => {
    const { match, hero } = matchWith('FUTURE_SIGHT', 2);
    const passer = 11;
    const receiver = 12;
    match.players[hero].pos = { x: 2200, y: 5000 };
    match.players[receiver].pos = { x: 2300, y: 4800 };
    match.players[9].pos = { x: 2500, y: 3000 };
    match.ball = { kind: 'held', by: passer };
    match.rng = () => 0;

    activatePower(match, hero, 1);
    launchPass(match, passer, receiver, false);
    expect(impacts(match, 'FUTURE_SIGHT')).toEqual([]);
    const flight = match.ball as unknown as Extract<MatchState['ball'], { kind: 'pass' }>;
    if (flight.kind !== 'pass') throw new Error('expected predicted pass');
    flight.pos = { ...match.players[hero].pos };
    possessionTick(match);

    expect(impacts(match, 'FUTURE_SIGHT')).toEqual([
      expect.objectContaining({ player: hero, target: receiver }),
    ]);
  });
});
