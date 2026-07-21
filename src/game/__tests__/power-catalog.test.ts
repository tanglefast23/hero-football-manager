import {
  generatedClubHeroCount,
  generatedClubPower,
  LAUNCH_POWER_IDS,
  powerIsCompatibleWithRole,
} from '../power-catalog';

describe('generated club power variety', () => {
  it('deterministically exposes the complete launch catalog across generated clubs', () => {
    const first = Array.from({ length: 64 }, (_, index) => generatedClubPower(`club-${index}`, index % 4, 'FWD'));
    const second = Array.from({ length: 64 }, (_, index) => generatedClubPower(`club-${index}`, index % 4, 'FWD'));

    expect(second).toEqual(first);
    expect(new Set(first)).toEqual(new Set(LAUNCH_POWER_IDS.filter(power => power !== 'ELASTIC_KEEPER')));
    expect(generatedClubPower('keeper-club', 0, 'GK')).toBe('ELASTIC_KEEPER');
    expect(LAUNCH_POWER_IDS.every(power => (
      powerIsCompatibleWithRole(power, 'GK') !== powerIsCompatibleWithRole(power, 'FWD')
    ))).toBe(true);
  });

  it('ramps generated-opponent hero density from rare in D5 to 2-3 on every D1 club', () => {
    const clubs = Array.from({ length: 1_000 }, (_, index) => `density-club-${index}`);
    const d5 = clubs.map(club => generatedClubHeroCount(club, 5));
    const d4 = clubs.map(club => generatedClubHeroCount(club, 4));
    const d1 = clubs.map(club => generatedClubHeroCount(club, 1));

    expect(d5.every(count => count === 0 || count === 1)).toBe(true);
    expect(d5.filter(count => count === 1).length / d5.length).toBeGreaterThanOrEqual(0.08);
    expect(d5.filter(count => count === 1).length / d5.length).toBeLessThanOrEqual(0.12);
    expect(d4.every(count => count === 0 || count === 1)).toBe(true);
    expect(d4.filter(count => count === 1).length).toBeGreaterThan(d5.filter(count => count === 1).length);
    expect(d1.every(count => count === 2 || count === 3)).toBe(true);
  });
});
