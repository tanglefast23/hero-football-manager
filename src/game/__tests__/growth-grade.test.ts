import { POTENTIAL_GRADES } from '../archetype-caps';
import { playerGrowthGrade } from '../training';
import type { CareerPlayer } from '../types';

/**
 * What the register's Potential column measures.
 *
 * It used to be raw talent, which flattered a thirty-year-old with potential 5
 * who could never realise it — their age band alone divides every gain by more
 * than two. It now answers the question the column is actually read for: how
 * fast does this player still improve? Age band, position bonus and archetype
 * carry three quarters of it; the SUPER lottery carries the last quarter.
 *
 * Facility and coach are deliberately excluded. They are club-wide, so they
 * would move all sixteen grades together and never change the order — motion
 * with no information in it.
 */
function player(overrides: Partial<CareerPlayer> = {}): CareerPlayer {
  return {
    id: 'p1',
    clubId: 'c1',
    name: 'Test',
    role: 'FWD',
    attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
    licensed: false,
    weeklyWage: 100,
    contractSeasons: 2,
    injuryWeeks: 0,
    age: 26,
    potential: 3,
    ...overrides,
  } as CareerPlayer;
}

const rank = (grade: string) => POTENTIAL_GRADES.indexOf(grade as never);

describe('playerGrowthGrade', () => {
  it('falls as the same player crosses each age band', () => {
    const young = playerGrowthGrade(player({ age: 22 }));
    const prime = playerGrowthGrade(player({ age: 26 }));
    const veteran = playerGrowthGrade(player({ age: 31 }));

    // The age band is the dominant term: 1.3 / 1.0 / 0.6 is a 2.17x swing, and
    // it is the fact the old column hid completely.
    expect(rank(young)).toBeGreaterThan(rank(prime));
    expect(rank(prime)).toBeGreaterThan(rank(veteran));
  });

  it('ranks a young ordinary player above an old gifted one', () => {
    // The case that made the old column misleading. Raw potential 5 on a
    // thirty-one-year-old is a ceiling they will never reach.
    const youngAverage = playerGrowthGrade(player({ age: 22, potential: 2 }));
    const oldGifted = playerGrowthGrade(player({ age: 31, potential: 5 }));

    expect(rank(youngAverage)).toBeGreaterThan(rank(oldGifted));
  });

  it('still rewards the lottery, at a quarter of the weight', () => {
    const low = playerGrowthGrade(player({ potential: 1 }));
    const high = playerGrowthGrade(player({ potential: 5 }));

    expect(rank(high)).toBeGreaterThan(rank(low));
  });

  it('rewards an archetype that pays on the attributes the role actually uses', () => {
    const plain = playerGrowthGrade(player({ archetype: undefined }));
    const prodigy = playerGrowthGrade(player({ archetype: 'Prodigy' }));

    expect(rank(prodigy)).toBeGreaterThan(rank(plain));
  });

  it('stays inside the grade scale at both extremes', () => {
    const worst = playerGrowthGrade(player({ age: 34, potential: 1, archetype: undefined }));
    const best = playerGrowthGrade(player({ age: 20, potential: 5, archetype: 'Prodigy' }));

    expect(POTENTIAL_GRADES).toContain(worst);
    expect(POTENTIAL_GRADES).toContain(best);
    expect(rank(best)).toBeGreaterThan(rank(worst));
  });
});
