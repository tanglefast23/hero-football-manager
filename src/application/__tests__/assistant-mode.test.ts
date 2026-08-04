import { DEFAULT_CREATION_RATINGS } from '../../game';
import {
  clearAdvisorAssistantInboxSuppressions,
  completeAssistantGuideMilestone,
  scheduleAssistantInboxWeek,
} from '../../game/assistant-guide';
import type { GameState } from '../../game/types';
import {
  currentAssistantObjective,
  dueAssistantInboxGuideSequences,
  outstandingInboxDuties,
  pendingAssistantGuideSequence,
} from '../assistant-guide';
import {
  homeViewModel,
  isHomeDeskClear,
  reconcileHomeAssistantInbox,
} from '../view-models';
import { useM1Store } from '../store';

function openedCareer(): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(123);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  return useM1Store.getState().career!;
}

describe('assistant mode presentation', () => {
  it('keeps Teacher exactly on the existing opening journey', () => {
    const career = openedCareer();
    expect(pendingAssistantGuideSequence(career, 'home')).toBe('management-intro');
    expect(dueAssistantInboxGuideSequences(career).length).toBeGreaterThan(0);

    const introduced = completeAssistantGuideMilestone(career, 'intro-complete');
    expect(currentAssistantObjective(introduced, 'home')).not.toBeNull();
  });

  it('removes teaching and hard duties without erasing the logical due list', () => {
    const teacher = openedCareer();
    const advisor = { ...teacher, assistantMode: 'advisor' as const };

    expect(pendingAssistantGuideSequence(advisor, 'home')).toBeNull();
    expect(currentAssistantObjective(
      completeAssistantGuideMilestone(advisor, 'intro-complete'),
      'home',
    )).toBeNull();
    expect(dueAssistantInboxGuideSequences(advisor))
      .toEqual(dueAssistantInboxGuideSequences(teacher));

    const weekTwo = { ...advisor, week: 2 };
    expect(outstandingInboxDuties(weekTwo)).toEqual([]);
  });

  it('keeps the logical desk occupancy but removes every rendered Bert row and route', () => {
    const teacher = openedCareer();
    const advisor = { ...teacher, assistantMode: 'advisor' as const };

    expect(isHomeDeskClear(advisor)).toBe(isHomeDeskClear(teacher));

    const reconciled = reconcileHomeAssistantInbox(advisor);
    const home = homeViewModel(reconciled);
    expect(home.alerts.some(alert => alert.id === 'training-ground')).toBe(true);
    expect(home.alerts.some(alert => alert.id.startsWith('assistant-guide:'))).toBe(false);
    expect(home.alerts.some(alert => alert.guideSequenceId !== undefined)).toBe(false);
  });
});

describe('Advisor inbox pacing', () => {
  it('occupies one logical tranche, does not repeat it, and preserves the Teacher backlog', () => {
    const advisor = { ...openedCareer(), assistantMode: 'advisor' as const };
    const first = scheduleAssistantInboxWeek(advisor, {
      dueGuideSequenceIds: ['head-coach-market'],
    });

    expect(first.guideSequenceIds).toEqual(['head-coach-market']);

    const sameWeek = scheduleAssistantInboxWeek(first.state, {
      dueGuideSequenceIds: ['head-coach-market'],
    });
    expect(sameWeek.guideSequenceIds).toEqual(['head-coach-market']);

    const nextWeek = scheduleAssistantInboxWeek(
      { ...sameWeek.state, week: sameWeek.state.week + 1 },
      { dueGuideSequenceIds: ['head-coach-market'] },
    );
    expect(nextWeek.guideSequenceIds).toEqual([]);

    const resumed = scheduleAssistantInboxWeek(
      clearAdvisorAssistantInboxSuppressions({
        ...nextWeek.state,
        assistantMode: 'teacher',
        week: nextWeek.state.week + 1,
      }),
      { dueGuideSequenceIds: ['head-coach-market'] },
    );
    expect(resumed.guideSequenceIds).toEqual(['head-coach-market']);
  });
});
