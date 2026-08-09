import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../career';
import { applyCareerEventOutcome, offerCareerEvent } from '../career-events';
import type { GameState } from '../types';

/**
 * A story setback could heal a player.
 *
 * `injuryWeeks` was assigned outright, so an event that knocked someone out for
 * one week *replaced* a four-week absence he was already carrying and put him
 * back in the squad three weeks early. A setback now only ever lengthens; the
 * one story that shortens an absence says so with its own effect and its own
 * sign.
 */

function careerWithInjury(weeks: number): {
  state: GameState;
  playerId: string;
} {
  const base = createCareer(createLaunchCareerSetup());
  const player = base.players.find(
    (candidate) => candidate.clubId === base.userClubId,
  )!;
  const state: GameState = {
    ...base,
    players: base.players.map((candidate) =>
      candidate.id === player.id
        ? { ...candidate, injuryWeeks: weeks }
        : candidate,
    ),
  };
  return { state: offerCareerEvent(state, 'test-event'), playerId: player.id };
}

function injuryAfter(
  startingWeeks: number,
  effect: { injuryWeeks?: number; injuryWeeksDelta?: number },
): number {
  const { state, playerId } = careerWithInjury(startingWeeks);
  const resolved = applyCareerEventOutcome(state, 'a-choice', 'It happens.', {
    playerEffect: { playerId, ...effect },
  });
  return resolved.players.find((candidate) => candidate.id === playerId)!
    .injuryWeeks;
}

describe('event injury effects', () => {
  it('never shortens an absence a player is already serving', () => {
    expect(injuryAfter(4, { injuryWeeks: 1 })).toBe(4);
  });

  it('lengthens it when the setback is the worse of the two', () => {
    expect(injuryAfter(1, { injuryWeeks: 3 })).toBe(3);
  });

  it('leaves a fit player fit when the outcome carries no injury', () => {
    expect(injuryAfter(0, {})).toBe(0);
  });

  it('heals only through the effect that means healing', () => {
    expect(injuryAfter(4, { injuryWeeksDelta: -2 })).toBe(2);
    expect(injuryAfter(4, { injuryWeeksDelta: -1 })).toBe(3);
  });

  it('cannot heal a player past fit', () => {
    expect(injuryAfter(1, { injuryWeeksDelta: -3 })).toBe(0);
  });

  it('applies a setback and a heal in the order the story tells them', () => {
    // The sequel's losing branch: a fresh setback, then the specialist's help.
    expect(injuryAfter(1, { injuryWeeks: 3, injuryWeeksDelta: -1 })).toBe(2);
  });

  it('refuses a setback spelled negative or a heal spelled positive', () => {
    expect(() => injuryAfter(0, { injuryWeeks: -2 })).toThrow(
      'cannot be negative',
    );
    expect(() => injuryAfter(0, { injuryWeeksDelta: 2 })).toThrow(
      'must be negative or zero',
    );
  });
});
