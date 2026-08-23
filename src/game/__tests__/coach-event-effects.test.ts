import {
  applyCoachEventEffect,
  selectCareerEventCoach,
} from '../career-events';
import { careerCoachTrainingModifiers } from '../coach-weekly';
import type { CoachCandidate, CoachSpecialty } from '../market';
import type { GameState } from '../types';

/**
 * A story can change a coach permanently, and the two ways that could go wrong
 * are a boost that walks past its cap and a retraining that leaves a coach
 * holding the same specialty twice — which `validateCoach` throws on.
 */

function coach(
  id: string,
  specialties: [CoachSpecialty, CoachSpecialty],
): CoachCandidate {
  return {
    id,
    name: id,
    specialties,
    level: 2,
    weeklyWage: 100,
    personality: 'PROFESSIONAL',
    requiredDivision: 5,
    requiredFame: 0,
    loyaltyDiscountPercent: 0,
  };
}

function careerWithStaff(
  head?: CoachCandidate,
  assistant?: CoachCandidate,
): GameState {
  return {
    userClubId: 'user',
    pendingEvent: { eventId: 'a-story' },
    market: {
      coachCandidates: [],
      ...(head === undefined ? {} : { headCoach: head }),
      ...(assistant === undefined ? {} : { assistantCoach: assistant }),
    },
  } as unknown as GameState;
}

describe('pointing a story at a coach', () => {
  it('selects a slot the club actually staffs', () => {
    const state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    expect(
      selectCareerEventCoach(state, 'HEAD').pendingEvent?.selectedCoachRole,
    ).toBe('HEAD');
  });

  it('refuses a slot the club has left empty', () => {
    const state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    expect(() => selectCareerEventCoach(state, 'ASSISTANT')).toThrow(
      'employs no assistant coach',
    );
  });

  it('refuses to re-point a chapter that inherited its coach', () => {
    const state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    const locked: GameState = {
      ...state,
      pendingEvent: {
        ...state.pendingEvent!,
        selectedCoachRole: 'HEAD',
        coachLocked: true,
      },
    };
    expect(() => selectCareerEventCoach(locked, 'HEAD')).toThrow(
      'chosen earlier in the story',
    );
  });
});

describe('applying a coach effect', () => {
  it('accumulates a boost across separate stories', () => {
    let state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    state = applyCoachEventEffect(state, 'HEAD', {
      facet: 'training',
      amount: 5,
    });
    state = applyCoachEventEffect(state, 'HEAD', {
      facet: 'training',
      amount: 3,
    });
    expect(state.market?.headCoach?.boosts?.trainingPercent).toBe(8);
  });

  it('stops at the lifetime cap however many stories land', () => {
    let state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    for (let round = 0; round < 6; round += 1) {
      state = applyCoachEventEffect(state, 'HEAD', {
        facet: 'training',
        amount: 5,
      });
    }
    // Six +5 boosts is +30 unclamped; the cap is one head-coach level.
    expect(state.market?.headCoach?.boosts?.trainingPercent).toBe(10);
  });

  it('caps the losing direction too', () => {
    let state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    for (let round = 0; round < 6; round += 1) {
      state = applyCoachEventEffect(state, 'HEAD', {
        facet: 'training',
        amount: -5,
      });
    }
    expect(state.market?.headCoach?.boosts?.trainingPercent).toBe(-10);
  });

  it('changes only the coach the story pointed at', () => {
    let state = careerWithStaff(
      coach('head', ['ATTACK', 'FITNESS']),
      coach('assistant', ['DEFENSE', 'TECHNIQUE']),
    );
    state = applyCoachEventEffect(state, 'ASSISTANT', {
      facet: 'tp',
      amount: 2,
    });
    expect(state.market?.assistantCoach?.boosts?.weeklyTp).toBe(2);
    expect(state.market?.headCoach?.boosts).toBeUndefined();
  });

  it('retrains the second specialty and leaves the first alone', () => {
    let state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    state = applyCoachEventEffect(state, 'HEAD', {
      specialtyTo: 'GOALKEEPING',
    });
    expect(state.market?.headCoach?.specialties).toEqual([
      'ATTACK',
      'GOALKEEPING',
    ]);
  });

  it('refuses a retraining that would duplicate a specialty', () => {
    const state = careerWithStaff(coach('head', ['ATTACK', 'GOALKEEPING']));
    expect(() =>
      applyCoachEventEffect(state, 'HEAD', { specialtyTo: 'GOALKEEPING' }),
    ).toThrow('already holds');
  });

  it('moves where the bonus lands, without changing how much it is', () => {
    let state = careerWithStaff(coach('head', ['ATTACK', 'FITNESS']));
    const before = careerCoachTrainingModifiers(state.market!);
    expect(before.gainScalePercentByAttribute.sho).toBe(112);
    expect(before.gainScalePercentByAttribute.ref).toBe(100);

    state = applyCoachEventEffect(state, 'HEAD', {
      specialtyTo: 'GOALKEEPING',
    });
    const after = careerCoachTrainingModifiers(state.market!);
    // FITNESS is gone, GOALKEEPING arrives, ATTACK is untouched — a lateral move.
    expect(after.gainScalePercentByAttribute.sho).toBe(112);
    expect(after.gainScalePercentByAttribute.ref).toBe(112);
    expect(after.gainScalePercentByAttribute.sta).toBe(100);
  });
});
