import { createCareer } from '../../game/career';
import {
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
} from '../../game/assistant-guide';
import { createLaunchCareerSetup } from '../launch';
import {
  currentAssistantObjective,
  pendingAssistantGuideSequence,
} from '../assistant-guide';

describe('assistant guide application flow', () => {
  test('reveals one task and one follow-up sequence at a time', () => {
    let state = createCareer(createLaunchCareerSetup(932));
    expect(pendingAssistantGuideSequence(state, 'home')).toBe('management-intro');
    expect(currentAssistantObjective(state)).toBeNull();

    state = completeAssistantGuideSequence(state, 'management-intro');
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state)).toEqual({ text: 'OPEN SQUAD.', targetTab: 'squad' });
    expect(pendingAssistantGuideSequence(state, 'squad')).toBe('squad-intro');

    state = completeAssistantGuideSequence(state, 'squad-intro');
    expect(currentAssistantObjective(state)).toEqual({
      text: 'TRAIN ONE PLAYER ONCE.',
      targetTab: 'squad',
    });

    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    expect(currentAssistantObjective(state)).toEqual({ text: 'RETURN HOME.', targetTab: 'home' });
    expect(pendingAssistantGuideSequence(state, 'squad')).toBeNull();
    expect(pendingAssistantGuideSequence(state, 'home')).toBe('desk-intro');

    state = completeAssistantGuideSequence(state, 'desk-intro');
    expect(currentAssistantObjective(state)?.text).toBe('READ THE DESK. THEN ADVANCE WEEK.');
    state = completeAssistantGuideMilestone(state, 'first-week-advanced');
    expect(currentAssistantObjective(state)).toBeNull();
  });
});
