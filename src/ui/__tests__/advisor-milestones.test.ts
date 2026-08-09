import { createCareer, FIRST_FAN_GAIN_FLAG } from '../../game';
import { createLaunchCareerSetup } from '../../application/launch';
import {
  advisorMilestonesToBank,
  type AdvisorMilestoneContext,
} from '../advisor-milestones';

const NO_CONTEXT: AdvisorMilestoneContext = {
  enteredManagement: false,
  viewingSquad: false,
  viewingHome: false,
  viewingFinances: false,
  viewingShutMarket: false,
  lowConditionMatchday: false,
  viewingExpiredContract: false,
};

describe('silently banking lessons an Advisor has already lived through', () => {
  it('does nothing to a Teacher career', () => {
    const teacher = createCareer(createLaunchCareerSetup(20260804));
    expect(
      advisorMilestonesToBank(teacher, {
        ...NO_CONTEXT,
        enteredManagement: true,
      }),
    ).toEqual([]);
  });

  it('banks the opening when the advised manager reaches the office', () => {
    const advisor = {
      ...createCareer(createLaunchCareerSetup(20260804)),
      assistantMode: 'advisor' as const,
    };

    expect(
      advisorMilestonesToBank(advisor, {
        ...NO_CONTEXT,
        enteredManagement: true,
      }),
    ).toContain('intro-complete');

    const firstFixtureWeek = Math.min(
      ...advisor.fixtures
        .filter(
          (fixture) =>
            fixture.homeClubId === advisor.userClubId ||
            fixture.awayClubId === advisor.userClubId,
        )
        .map((fixture) => fixture.week),
    );
    expect(
      advisorMilestonesToBank(
        { ...advisor, week: firstFixtureWeek },
        NO_CONTEXT,
      ),
    ).not.toContain('desk-intro-complete');
    expect(
      advisorMilestonesToBank(
        { ...advisor, week: firstFixtureWeek },
        {
          ...NO_CONTEXT,
          viewingHome: true,
        },
      ),
    ).toContain('desk-intro-complete');
  });

  it('banks each one-shot only after its real trigger or destination exists', () => {
    const initial = createCareer(createLaunchCareerSetup(20260804));
    const advisor = {
      ...initial,
      assistantMode: 'advisor' as const,
      season: 3,
      week: 8,
      totalInstantDrills: 3,
      eventFlags: [...initial.eventFlags, FIRST_FAN_GAIN_FLAG],
      facilities: {
        ...initial.facilities,
        grid: {
          ...initial.facilities.grid!,
          discoveredAdjacencies: ['gym-dorm' as const],
        },
      },
    };

    expect(
      advisorMilestonesToBank(advisor, {
        ...NO_CONTEXT,
        enteredManagement: true,
        viewingSquad: true,
        viewingFinances: true,
        viewingShutMarket: true,
        lowConditionMatchday: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        'condition-warning-seen',
        'quick-train-seen',
        'facility-combo-gym-dorm-seen',
        'transfer-window-seen',
        'match-condition-warning-seen',
        'first-fans-seen',
        'first-fans-ledger-seen',
      ]),
    );

    expect(advisorMilestonesToBank(advisor, NO_CONTEXT)).toEqual([]);
  });
});
