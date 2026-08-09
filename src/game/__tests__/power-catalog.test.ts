import {
  generatedClubHeroCount,
  generatedClubPower,
  LAUNCH_POWER_IDS,
  powerIsCompatibleWithRole,
} from '../power-catalog';
import type { PowerId, Role } from '../../sim/types';

const EXPECTED_ROLE_POOLS: Readonly<Record<Role, readonly PowerId[]>> = {
  GK: ['ELASTIC_KEEPER', 'GIANT_GK', 'GUST'],
  DEF: [
    'SUPER_SPEED',
    'FUTURE_SIGHT',
    'SUPER_STRENGTH',
    'WEB_TRAP',
    'RALLY_CRY',
    'ICE_RINK',
    'SHADOW_MARK',
    'GUST',
  ],
  MID: [
    'SUPER_SPEED',
    'BLINK_RUN',
    'FIRE_TORCH',
    'PHASE_RUN',
    'PORTAL_PASS',
    'DECOY_DOUBLE',
    'FUTURE_SIGHT',
    'WEB_TRAP',
    'RALLY_CRY',
    'ICE_RINK',
    'SHADOW_MARK',
    'GRAVITY_WELL',
    'GUST',
  ],
  FWD: [
    'SUPER_SPEED',
    'BLINK_RUN',
    'THUNDER_STRIKE',
    'FIRE_TORCH',
    'PHASE_RUN',
    'PORTAL_PASS',
    'RALLY_CRY',
    'GRAVITY_WELL',
  ],
};

describe('generated club power variety', () => {
  it('uses the exact role pools and deterministically exposes every member of each pool', () => {
    for (const role of ['GK', 'DEF', 'MID', 'FWD'] as const) {
      const compatible = LAUNCH_POWER_IDS.filter((power) =>
        powerIsCompatibleWithRole(power, role),
      );
      expect(compatible).toEqual(EXPECTED_ROLE_POOLS[role]);

      const first = Array.from({ length: 256 }, (_, index) =>
        generatedClubPower(`club-${index}`, index % 4, role),
      );
      const second = Array.from({ length: 256 }, (_, index) =>
        generatedClubPower(`club-${index}`, index % 4, role),
      );
      expect(second).toEqual(first);
      expect(new Set(first)).toEqual(new Set(EXPECTED_ROLE_POOLS[role]));
    }
    expect(new Set(Object.values(EXPECTED_ROLE_POOLS).flat())).toEqual(
      new Set(LAUNCH_POWER_IDS),
    );
    expect(powerIsCompatibleWithRole('FIRE_TORCH', 'GK')).toBe(false);
    expect(powerIsCompatibleWithRole('FIRE_TORCH', 'DEF')).toBe(false);
    expect(powerIsCompatibleWithRole('GUST', 'GK')).toBe(true);
  });

  it('keeps D5 hero-free and ramps to 2-3 heroes on every D1 club', () => {
    const clubs = Array.from(
      { length: 1_000 },
      (_, index) => `density-club-${index}`,
    );
    const d5 = clubs.map((club) => generatedClubHeroCount(club, 5));
    const d4 = clubs.map((club) => generatedClubHeroCount(club, 4));
    const d1 = clubs.map((club) => generatedClubHeroCount(club, 1));

    expect(d5.every((count) => count === 0)).toBe(true);
    expect(d4.every((count) => count === 0 || count === 1)).toBe(true);
    expect(d4.some((count) => count === 1)).toBe(true);
    expect(d1.every((count) => count === 2 || count === 3)).toBe(true);
  });
});
