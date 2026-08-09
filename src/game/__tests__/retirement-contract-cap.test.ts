import { describe, expect, it } from '@jest/globals';
import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import {
  assertContractTermFitsCareer,
  maxRenewalTermSeasons,
  maxSigningTermSeasons,
} from '../retirement';
import { renewCareerPlayer } from '../squad';
import type { CareerPlayer, GameState } from '../types';

const SEED = 456;

function veteran(overrides: Partial<CareerPlayer> = {}): CareerPlayer {
  return {
    id: 'vet-1',
    clubId: 'user-club',
    name: 'Sten Halvorsen',
    role: 'DEF',
    attrs: { pac: 50, sho: 40, pas: 55, def: 70, tec: 50, sta: 55, ref: 20 },
    licensed: false,
    weeklyWage: 400,
    onHeroWage: false,
    contractSeasonsRemaining: 0,
    morale: 60,
    injuryWeeks: 0,
    age: 37,
    personality: 'Timid',
    ...overrides,
  } as CareerPlayer;
}

describe('assertContractTermFitsCareer', () => {
  it('accepts a term at the renewal cap', () => {
    const player = veteran();
    const cap = maxRenewalTermSeasons(player, SEED);
    expect(cap).toBeGreaterThan(0);
    expect(() =>
      assertContractTermFitsCareer(player, cap, SEED, 'renewal'),
    ).not.toThrow();
  });

  it('rejects a renewal one season longer than the player has left', () => {
    const player = veteran();
    const tooLong = maxRenewalTermSeasons(player, SEED) + 1;
    expect(() =>
      assertContractTermFitsCareer(player, tooLong, SEED, 'renewal'),
    ).toThrow(/only has \d+ season/);
  });

  it('accepts a term at the signing cap', () => {
    const player = veteran();
    const cap = maxSigningTermSeasons(player, SEED);
    expect(() =>
      assertContractTermFitsCareer(player, cap, SEED, 'signing'),
    ).not.toThrow();
  });

  it('rejects a signing one season longer than the player has left', () => {
    const player = veteran();
    const tooLong = maxSigningTermSeasons(player, SEED) + 1;
    expect(() =>
      assertContractTermFitsCareer(player, tooLong, SEED, 'signing'),
    ).toThrow(/only has \d+ season/);
  });

  it('refuses any renewal length once retirement has been announced', () => {
    const announced = veteran({ retirementAnnouncementSeason: 2 });
    expect(() =>
      assertContractTermFitsCareer(announced, 1, SEED, 'renewal'),
    ).toThrow(/announced their retirement/);
  });

  it('still allows an announced player to be signed for the run-in', () => {
    const announced = veteran({ retirementAnnouncementSeason: 2 });
    expect(() =>
      assertContractTermFitsCareer(announced, 1, SEED, 'signing'),
    ).not.toThrow();
    expect(() =>
      assertContractTermFitsCareer(announced, 2, SEED, 'signing'),
    ).toThrow(/only has 1 season/);
  });

  it('leaves a player young enough to sign any term alone', () => {
    const player = veteran({ id: 'young', age: 24 });
    expect(() =>
      assertContractTermFitsCareer(player, 3, SEED, 'renewal'),
    ).not.toThrow();
    expect(() =>
      assertContractTermFitsCareer(player, 3, SEED, 'signing'),
    ).not.toThrow();
  });
});

/**
 * The store renews through `renewCareerPlayer`, not through the negotiated
 * market flow, so guarding only the market completion functions would leave the
 * shipped renewal button free to sign a contract that outlives its holder.
 */
describe('renewCareerPlayer', () => {
  function seasonEndWithExpiredVeteran(age: number): {
    state: GameState;
    playerId: string;
  } {
    const initial = createCareer({ ...createLaunchCareerSetup(8802) });
    const lineupIds = new Set(
      initial.lineups.find((lineup) => lineup.clubId === initial.userClubId)!
        .playerIds,
    );
    const target = initial.players.find(
      (player) =>
        player.clubId === initial.userClubId && !lineupIds.has(player.id),
    )!;
    return {
      playerId: target.id,
      state: {
        ...initial,
        phase: 'season-end' as const,
        players: initial.players.map((player) =>
          player.id === target.id
            ? {
                ...player,
                contractSeasonsRemaining: 0,
                age,
                personality: 'Timid' as const,
              }
            : player,
        ),
      },
    };
  }

  it('refuses a term that outlives the veteran being renewed', () => {
    const { state, playerId } = seasonEndWithExpiredVeteran(37);
    const player = state.players.find(
      (candidate) => candidate.id === playerId,
    )!;
    const cap = maxRenewalTermSeasons(player, state.careerSeed);
    expect(cap).toBeLessThan(3);
    expect(() => renewCareerPlayer(state, playerId, 4, cap + 1)).toThrow(
      /only has \d+ season/,
    );
  });

  it('accepts a term at the cap', () => {
    const { state, playerId } = seasonEndWithExpiredVeteran(37);
    const player = state.players.find(
      (candidate) => candidate.id === playerId,
    )!;
    const cap = maxRenewalTermSeasons(player, state.careerSeed);
    const renewed = renewCareerPlayer(state, playerId, 4, cap);
    expect(
      renewed.players.find((candidate) => candidate.id === playerId)
        ?.contractSeasonsRemaining,
    ).toBe(cap);
  });

  it('leaves an ordinary-aged player free to sign the full three seasons', () => {
    const { state, playerId } = seasonEndWithExpiredVeteran(24);
    const renewed = renewCareerPlayer(state, playerId, 4, 3);
    expect(
      renewed.players.find((candidate) => candidate.id === playerId)
        ?.contractSeasonsRemaining,
    ).toBe(3);
  });
});
