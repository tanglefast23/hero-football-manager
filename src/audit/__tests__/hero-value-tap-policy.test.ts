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
  it.each(['ELASTIC_KEEPER', 'GIANT_GK'] as const)(
    '%s waits for the on-target shot instead of arming on a closing Zone',
    (power) => {
      const match = matchWith(power, 0);
      match.players[0].powerState = { kind: 'zone', remainingTicks: 1 };
      match.ball = { kind: 'held', by: 20 };
      expect(shouldQueueWellTappedPower(match, 0)).toBe(false);

      match.ball = {
        kind: 'shot',
        pos: { x: 3400, y: 9800 },
        vel: { x: 0, y: 300 },
        by: 20,
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

  it('keeps the closing-window fallback for an outfield power', () => {
    const match = matchWith('SUPER_SPEED', 9);
    match.players[9].powerState = { kind: 'zone', remainingTicks: 1 };
    match.ball = { kind: 'held', by: 11 };
    expect(shouldQueueWellTappedPower(match, 9)).toBe(true);
  });
});
