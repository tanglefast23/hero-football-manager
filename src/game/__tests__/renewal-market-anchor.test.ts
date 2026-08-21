import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { currentUserDivision } from '../m2-career';
import { generatedPlayerWeeklyWage } from '../market';
import { careerRenewalWeeklyAsk } from '../market-career';
import type { DivisionLevel } from '../pyramid';
import type { CareerPlayer, GameState } from '../types';

/**
 * `renewalContractAsk` is a pure product of multipliers on the player's OWN
 * last wage — growth, fame, loyalty, personality — with a ceiling and no floor.
 * For anyone under about 100 fame that product is below 1, so every renewal is
 * a pay cut, and the next ask is a multiple of the cut. Measured on the
 * negotiation the panel itself teaches: 1,200 a week reaches 42 in eight
 * one-season renewals, which deletes the wage bill — the economy's main sink.
 *
 * The anchor is the division-anchored market wage for the same attributes:
 * what the club would pay to sign this player instead of keeping him. It moves
 * the BASE the multipliers price off, not the finished ask, so loyalty and
 * personality still change the number the way the player card promises.
 */
describe('renewal ask market anchor', () => {
  const state = createCareer(createLaunchCareerSetup(20_260_805));
  const division = currentUserDivision(state.m2!);
  const squad = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );

  /** The best a manager can do at the table: about 0.69x the stated ask. */
  const NEGOTIATED_DISCOUNT = 0.69;

  function withWage(player: CareerPlayer, weeklyWage: number): GameState {
    return {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === player.id ? { ...candidate, weeklyWage } : candidate,
      ),
    };
  }

  function inDivision(state: GameState, level: DivisionLevel): GameState {
    const userClub = state
      .m2!.pyramid.divisions.flatMap((division) => division.clubs)
      .find((club) => club.id === state.userClubId)!;
    return {
      ...state,
      m2: {
        ...state.m2!,
        highestDivisionReached: Math.min(
          state.m2!.highestDivisionReached ?? 5,
          level,
        ) as DivisionLevel,
        pyramid: {
          ...state.m2!.pyramid,
          divisions: state.m2!.pyramid.divisions.map((division) => ({
            ...division,
            clubs: [
              ...division.clubs.filter((club) => club.id !== state.userClubId),
              ...(division.level === level ? [userClub] : []),
            ],
          })),
        },
      },
    };
  }

  /**
   * The multipliers still apply — loyalty and personality are supposed to move
   * this price — so the ask is not the market wage itself. What it may never do
   * is price off a base BELOW the market wage, which is what compounded.
   */
  test('prices off the market wage once the last wage falls under it', () => {
    expect(squad.length).toBeGreaterThan(10);

    for (const player of squad) {
      // A wage the old compounding would have driven him down to.
      const market = generatedPlayerWeeklyWage(player.attrs, division);
      const starved = { ...player, weeklyWage: 1 };

      expect(careerRenewalWeeklyAsk(withWage(starved, 1), starved)).toBe(
        careerRenewalWeeklyAsk(withWage(player, market), {
          ...player,
          weeklyWage: market,
        }),
      );
    }
  });

  test('converges instead of compounding downward over repeated renewals', () => {
    const player = squad.find((candidate) => (candidate.fame ?? 0) < 100)!;
    const market = generatedPlayerWeeklyWage(player.attrs, division);

    let wage = player.weeklyWage;
    const trail = [wage];
    for (let renewal = 0; renewal < 10; renewal += 1) {
      const renewed = { ...player, weeklyWage: wage };
      const ask = careerRenewalWeeklyAsk(withWage(player, wage), renewed);
      wage = Math.max(1, Math.round(ask * NEGOTIATED_DISCOUNT));
      trail.push(wage);
    }

    // Measured on this exact fixture: without the anchor the trail reads
    // 129 -> 75 -> 44 -> 26 -> 15 -> 9 -> 5 -> 3 -> 2 -> 1 -> 1. With it,
    // 129 -> 75 -> 75 -> ... — a fixed point, reached after one renewal.
    expect(trail[trail.length - 1]).toBe(trail[trail.length - 2]);
    expect(wage).toBeGreaterThan(market / 2);
    expect(wage).toBeGreaterThan(trail[0] / 2);
  });

  test('leaves an ask already above the market wage alone', () => {
    const player = squad[0];
    const rich = withWage(player, 100_000);
    const asked = careerRenewalWeeklyAsk(rich, {
      ...player,
      weeklyWage: 100_000,
    });

    expect(asked).toBeGreaterThan(
      generatedPlayerWeeklyWage(player.attrs, division),
    );
    // The x5 ceiling still governs the top end; the floor never raised it.
    expect(asked).toBeLessThanOrEqual(500_000);
  });

  test('keeps every division premium inside the market ceiling', () => {
    const player = { ...squad[0], weeklyWage: 100_000 };
    const rich = withWage(player, player.weeklyWage);

    for (const level of [5, 4, 3, 2, 1] as const) {
      const divisionState = inDivision(rich, level);
      expect(careerRenewalWeeklyAsk(divisionState, player)).toBeLessThanOrEqual(
        generatedPlayerWeeklyWage(player.attrs, level) * 3,
      );
    }
  });

  test('keeps a D1 hero division premium inside the five-times renewal cap', () => {
    const player = {
      ...squad[0],
      weeklyWage: generatedPlayerWeeklyWage(squad[0].attrs, 1),
      power: 'FIRE_TORCH' as never,
      onHeroWage: false,
    };
    const d1 = inDivision(withWage(squad[0], player.weeklyWage), 1);

    expect(careerRenewalWeeklyAsk(d1, player)).toBeLessThanOrEqual(
      player.weeklyWage * 5,
    );
  });
});
