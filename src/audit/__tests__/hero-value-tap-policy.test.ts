import { createMatch } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { PowerId, TeamDef } from '../../sim/types';
import { shouldQueueWellTappedPower } from '../hero-value-tap-policy';

function matchWith(power: PowerId, slot: number) {
  const home: TeamDef = {
    ...ROVERS,
    players: ROVERS.players.map((player, index) => ({
      ...player,
      attrs: { ...player.attrs },
      power: index === slot ? power : undefined,
    })),
  };
  return createMatch(181_800, home, UNITED, { homePolicy: 'SAVE_FOR_TAP' });
}

describe('hero-value well-tapped policy', () => {
  // Slot 0 is the goalkeeper — lineup.ts rejects any other order.
  it.each(['ELASTIC_KEEPER', 'GIANT_GK'] as const)(
    'taps a %s keeper on the shot, and never before it',
    (power) => {
      // The m2.7 exemption is retired (m2.8): a keeper takes their team's
      // policy like anyone else, so the probe must now model a manager who
      // actually presses. What it must NOT model is pressing early — a save
      // keeper's ten-second window is spent, not extended, so a press on a
      // build-up that turns back has thrown a Zone away.
      const match = matchWith(power, 0);
      expect(match.players[0].firePolicy).toBe('SAVE_FOR_TAP');

      match.players[0].powerState = { kind: 'zone', remainingTicks: 1 };
      match.ball = { kind: 'held', by: 20 };
      expect(shouldQueueWellTappedPower(match, 0)).toBe(false);

      match.ball = {
        kind: 'shot',
        pos: { x: 3400, y: 9800 },
        vel: { x: 0, y: 300 },
        by: 20,
        shooterId: match.players[20].def.id,
        shotStrengthD64: 0,
        power: 40,
        targetX: 3400,
        z: 0,
        vz: 0,
        trajectory: 'driven',
        keeperChecked: false,
      };
      expect(shouldQueueWellTappedPower(match, 0)).toBe(true);
    },
  );

  it('taps a GUST keeper on possession, not on a shot at goal', () => {
    // GUST is in ROLE_POOL.GK but is not a save power: it bends the opponent's
    // next pass, so its moment is enemy possession. Keying the keeper rules on
    // the ROLE rather than the POWER would give this keeper the shot-save
    // contract and leave their button dead through every build-up.
    const match = matchWith('GUST', 0);
    match.players[0].powerState = { kind: 'zone', remainingTicks: 1 };
    match.ball = { kind: 'held', by: 20 };
    expect(shouldQueueWellTappedPower(match, 0)).toBe(true);
  });

  it('keeps the closing-window fallback for an outfield power', () => {
    const match = matchWith('SUPER_SPEED', 9);
    match.players[9].powerState = { kind: 'zone', remainingTicks: 1 };
    match.ball = { kind: 'held', by: 11 };
    expect(shouldQueueWellTappedPower(match, 9)).toBe(true);
  });
});
