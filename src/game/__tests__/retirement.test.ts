import { describe, expect, it } from '@jest/globals';
import { resolveSeasonEndLifecycle, type PyramidPlayer } from '../pyramid';
import {
  contractTermOptions,
  isConsideringRetirement,
  maxRenewalTermSeasons,
  maxSigningTermSeasons,
  retirementCardCopy,
  seasonsBeforeRetirement,
} from '../retirement';
import type { PlayerPersonality } from '../types';

const SEED = 456;
const ATTRS = { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 };
const PERSONALITIES: PlayerPersonality[] = [
  'Fiery',
  'Loyal',
  'Greedy',
  'Joker',
  'Professional',
  'Timid',
];

function lifecyclePlayer(
  overrides: Partial<PyramidPlayer> = {},
): PyramidPlayer {
  return {
    id: 'player-1',
    clubId: 'club-1',
    name: 'Ari Flint',
    role: 'MID',
    attrs: { ...ATTRS },
    archetype: 'Playmaker',
    personality: 'Professional',
    age: 25,
    fame: 50,
    seasonsAtClub: 2,
    morale: 50,
    condition: 80,
    consecutiveLowMoraleWeeks: 0,
    ...overrides,
  };
}

/**
 * Seasons this player is still on the roster AFTER the next transition, counted
 * by running the real lifecycle rather than by trusting the formula under test.
 */
function seasonsActuallyPlayed(
  player: PyramidPlayer,
  careerSeed: number,
): number {
  let squad: PyramidPlayer[] = [player];
  let season = 1;
  let played = 0;
  while (squad.length > 0 && played < 30) {
    squad = resolveSeasonEndLifecycle(squad, season, careerSeed).activePlayers;
    season += 1;
    if (squad.length > 0) played += 1;
  }
  return played;
}

/**
 * Runs a real contract alongside the real lifecycle and reports the seasons
 * still owed when the player walks away. Anything above zero is a contract the
 * club is paying for after its holder has gone.
 *
 * `decrementThisSeason` models the difference between the two surfaces: a deal
 * signed in a transfer window still meets week 30 of the season in progress, a
 * renewal signed at season end does not.
 */
function seasonsOwedAtRetirement(
  player: PyramidPlayer,
  termSeasons: number,
  careerSeed: number,
  decrementThisSeason: boolean,
): number {
  let squad: PyramidPlayer[] = [player];
  let contract = termSeasons;
  let season = 1;
  if (decrementThisSeason) contract = Math.max(0, contract - 1);
  while (squad.length > 0 && season < 40) {
    squad = resolveSeasonEndLifecycle(squad, season, careerSeed).activePlayers;
    season += 1;
    if (squad.length === 0) break;
    contract = Math.max(0, contract - 1);
  }
  return contract;
}

describe('seasonsBeforeRetirement', () => {
  it('matches the seasons the lifecycle actually grants, for every personality and veteran age', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 30; age <= 38; age += 1) {
        const player = lifecyclePlayer({
          id: `p-${personality}-${age}`,
          personality,
          age,
        });
        expect(seasonsBeforeRetirement(player, SEED)).toBe(
          seasonsActuallyPlayed(player, SEED),
        );
      }
    }
  });

  it('returns zero once retirement has been announced', () => {
    const player = lifecyclePlayer({
      age: 36,
      retirementAnnouncementSeason: 4,
    });
    expect(seasonsBeforeRetirement(player, SEED)).toBe(0);
  });

  it('grants one final season to a player already past their retirement age', () => {
    const player = lifecyclePlayer({
      id: 'overdue',
      personality: 'Timid',
      age: 44,
    });
    expect(seasonsBeforeRetirement(player, SEED)).toBe(1);
  });
});

describe('contract term caps', () => {
  it('never leaves a renewal owing seasons after the player has gone', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 28; age <= 38; age += 1) {
        const player = lifecyclePlayer({
          id: `r-${personality}-${age}`,
          personality,
          age,
        });
        const cap = maxRenewalTermSeasons(player, SEED);
        expect(seasonsOwedAtRetirement(player, cap, SEED, false)).toBe(0);
      }
    }
  });

  it('leaves one season owing if a renewal runs a single season too long', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 33; age <= 38; age += 1) {
        const player = lifecyclePlayer({
          id: `ro-${personality}-${age}`,
          personality,
          age,
        });
        const cap = maxRenewalTermSeasons(player, SEED);
        if (cap >= 3) continue;
        expect(seasonsOwedAtRetirement(player, cap + 1, SEED, false)).toBe(1);
      }
    }
  });

  it('never leaves an in-season signing owing seasons after the player has gone', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 28; age <= 38; age += 1) {
        const player = lifecyclePlayer({
          id: `s-${personality}-${age}`,
          personality,
          age,
        });
        const cap = maxSigningTermSeasons(player, SEED);
        expect(seasonsOwedAtRetirement(player, cap, SEED, true)).toBe(0);
      }
    }
  });

  it('leaves one season owing if a signing runs a single season too long', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 33; age <= 38; age += 1) {
        const player = lifecyclePlayer({
          id: `so-${personality}-${age}`,
          personality,
          age,
        });
        const cap = maxSigningTermSeasons(player, SEED);
        if (cap >= 3) continue;
        expect(seasonsOwedAtRetirement(player, cap + 1, SEED, true)).toBe(1);
      }
    }
  });

  it('lets an in-season signing run exactly one season longer than a renewal', () => {
    for (const personality of PERSONALITIES) {
      for (let age = 30; age <= 38; age += 1) {
        const player = lifecyclePlayer({
          id: `c-${personality}-${age}`,
          personality,
          age,
        });
        expect(maxSigningTermSeasons(player, SEED)).toBe(
          Math.min(3, maxRenewalTermSeasons(player, SEED) + 1),
        );
      }
    }
  });

  it('never caps a player too young for it to bite', () => {
    for (const personality of PERSONALITIES) {
      const player = lifecyclePlayer({
        id: `y-${personality}`,
        personality,
        age: 30,
      });
      expect(maxRenewalTermSeasons(player, SEED)).toBe(3);
      expect(maxSigningTermSeasons(player, SEED)).toBe(3);
    }
  });

  it('refuses to renew an announced player at any length, but lets one be signed for the run-in', () => {
    const player = lifecyclePlayer({
      age: 37,
      retirementAnnouncementSeason: 4,
    });
    expect(maxRenewalTermSeasons(player, SEED)).toBe(0);
    expect(contractTermOptions(maxRenewalTermSeasons(player, SEED))).toEqual(
      [],
    );
    expect(maxSigningTermSeasons(player, SEED)).toBe(1);
  });

  it('always allows at least one season for an overdue but unannounced player', () => {
    const player = lifecyclePlayer({ id: 'ancient', age: 44 });
    expect(maxRenewalTermSeasons(player, SEED)).toBe(1);
    expect(maxSigningTermSeasons(player, SEED)).toBe(2);
  });
});

describe('contractTermOptions', () => {
  it('offers every term up to the cap and nothing beyond it', () => {
    expect(contractTermOptions(3)).toEqual([1, 2, 3]);
    expect(contractTermOptions(2)).toEqual([1, 2]);
    expect(contractTermOptions(1)).toEqual([1]);
    expect(contractTermOptions(0)).toEqual([]);
  });
});

describe('retirementCardCopy', () => {
  it('says nothing while retirement is more than one season away', () => {
    const player = lifecyclePlayer({
      id: 'far',
      personality: 'Professional',
      age: 28,
    });
    expect(seasonsBeforeRetirement(player, SEED)).toBeGreaterThan(1);
    expect(retirementCardCopy(player, SEED)).toBeUndefined();
    expect(isConsideringRetirement(player, SEED)).toBe(false);
  });

  it('warns exactly one season before the announcement', () => {
    for (const personality of PERSONALITIES) {
      const base = lifecyclePlayer({
        id: `w-${personality}`,
        personality,
        age: 28,
      });
      // Age forward to the last season before the announcement rather than
      // guessing: the retirement age varies by personality and by id hash.
      const oneOut = {
        ...base,
        age: 28 + seasonsBeforeRetirement(base, SEED) - 1,
      };
      expect(retirementCardCopy(oneOut, SEED)?.text).toBe(
        'Considering retirement in 1 year',
      );
      expect(isConsideringRetirement(oneOut, SEED)).toBe(true);
    }
  });

  it('marks the final season once announced', () => {
    const player = lifecyclePlayer({
      age: 36,
      retirementAnnouncementSeason: 4,
    });
    expect(retirementCardCopy(player, SEED)?.text).toBe(
      'Final season, retires in summer',
    );
    expect(isConsideringRetirement(player, SEED)).toBe(false);
  });
});
