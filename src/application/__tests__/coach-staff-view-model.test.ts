import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import { hireCareerCoach } from '../../game/market-career';
import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel } from '../view-models';

describe('Club coaching-staff view model', () => {
  const content = loadLaunchContent();

  it('puts the employed coach and exact role effects in the Club tab model', () => {
    const initial = createCareer(createLaunchCareerSetup(20260721, undefined, content));
    const candidate = {
      ...initial.market!.coachCandidates[0],
      level: 1,
      weeklyWage: 500,
      specialties: ['ATTACK', 'MOTIVATOR'] as const,
    };
    const market = hireCareerCoach(
      initial,
      { ...initial.market!, coachCandidates: [candidate] },
      candidate.id,
      'HEAD',
    );
    const viewModel = clubFinancesViewModel({ ...initial, market });

    expect(viewModel.coachingStaff).toEqual([expect.objectContaining({
      id: candidate.id,
      role: 'HEAD',
      roleLabel: 'Head coach',
      level: 1,
      weeklyWage: 500,
      severanceCost: 500,
      specialtyLabels: ['Attack', 'Motivator'],
      effectLabels: [
        'SHO training +10%',
        'Morale loss −5% · Hero Gauge +5%',
        '+12 TP weekly',
      ],
    })]);
  });

  it('shows true half-strength effects for an employed assistant', () => {
    const initial = createCareer(createLaunchCareerSetup(20260722, undefined, content));
    const assistant = {
      ...initial.market!.coachCandidates[0],
      level: 1,
      weeklyWage: 500,
      specialties: ['ATTACK', 'MOTIVATOR'] as const,
    };
    const state = {
      ...initial,
      market: { ...initial.market!, assistantCoach: assistant },
    };

    expect(clubFinancesViewModel(state).coachingStaff[0])
      .toMatchObject({
        role: 'ASSISTANT',
        effectLabels: [
          'SHO training +5%',
          'Morale loss −2.5% · Hero Gauge +2.5%',
          '+6 TP weekly',
        ],
      });
  });
});
