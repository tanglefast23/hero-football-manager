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
  it.each(['ELASTIC_KEEPER', 'GIANT_GK', 'GUST'] as const)(
    'never taps a goalkeeper carrying %s, even on a live on-target shot',
    (power) => {
      // Since m2.7 a GK slot is always FIRE_WHEN_READY (firePolicyForRole), so
      // queueInput refuses a tap on one and the probe must not offer it. The
      // rule is keyed on the ROLE, not the power: a keeper may carry GUST,
      // whose context is common enough that the old policy would have tapped
      // it — and a slot whose policy disagrees with its team is exactly what
      // validateEnvelope rejects.
      const match = matchWith(power, 0);
      expect(match.players[0].firePolicy).toBe('FIRE_WHEN_READY');

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
      // The moment the old policy tapped on. Automatic play still spends the
      // Zone here; the manager simply has no say in it.
      expect(shouldQueueWellTappedPower(match, 0)).toBe(false);
    },
  );

  it('keeps the closing-window fallback for an outfield power', () => {
    const match = matchWith('SUPER_SPEED', 9);
    match.players[9].powerState = { kind: 'zone', remainingTicks: 1 };
    match.ball = { kind: 'held', by: 11 };
    expect(shouldQueueWellTappedPower(match, 9)).toBe(true);
  });
});
