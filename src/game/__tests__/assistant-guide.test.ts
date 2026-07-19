import { createCareer } from '../career';
import {
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
  hasAssistantGuideMilestone,
} from '../assistant-guide';
import { createLaunchCareerSetup } from '../../application/launch';

describe('assistant guide milestones', () => {
  test('adds namespaced guide flags without mutating the save', () => {
    const state = createCareer(createLaunchCareerSetup(841));
    const next = completeAssistantGuideSequence(state, 'management-intro');

    expect(next).not.toBe(state);
    expect(state.eventFlags).toEqual([]);
    expect(hasAssistantGuideMilestone(next, 'intro-complete')).toBe(true);
  });

  test('is idempotent and preserves unrelated event flags', () => {
    const state = {
      ...createCareer(createLaunchCareerSetup(842)),
      eventFlags: ['spider-adopted'],
    };
    const once = completeAssistantGuideMilestone(state, 'first-training-complete');
    const twice = completeAssistantGuideMilestone(once, 'first-training-complete');

    expect(once.eventFlags).toEqual([
      'spider-adopted',
      'guide:bert:first-training-complete',
    ]);
    expect(twice).toBe(once);
  });

  test('records dismissal of the final desk briefing', () => {
    const state = createCareer(createLaunchCareerSetup(843));
    const next = completeAssistantGuideSequence(state, 'desk-intro');

    expect(hasAssistantGuideMilestone(next, 'desk-intro-complete')).toBe(true);
  });
});
