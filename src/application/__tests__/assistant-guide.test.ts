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
    expect(currentAssistantObjective(state, 'home')).toBeNull();

    state = completeAssistantGuideSequence(state, 'management-intro');
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toEqual({ text: 'OPEN SQUAD.', target: 'squad-tab' });
    expect(pendingAssistantGuideSequence(state, 'squad')).toBe('squad-intro');

    state = completeAssistantGuideSequence(state, 'squad-intro');
    expect(currentAssistantObjective(state, 'squad')).toEqual({
      text: 'TRAIN ONE PLAYER ONCE.',
      target: 'training-plan',
    });

    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    expect(currentAssistantObjective(state, 'squad')).toEqual({ text: 'RETURN HOME.', target: 'home-tab' });
    expect(pendingAssistantGuideSequence(state, 'squad')).toBeNull();
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();

    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'CHECK YOUR INBOX.',
      target: 'training-ground-alert',
    });
    expect(currentAssistantObjective(state, 'club')).toEqual({
      text: 'BUILD THE TRAINING GROUND.',
      target: 'training-ground-facility',
    });

    state = {
      ...state,
      facilities: { ...state.facilities, trainingGroundBuilt: true },
    };
    expect(currentAssistantObjective(state, 'club')).toEqual({ text: 'RETURN HOME.', target: 'home-tab' });
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'INBOX CLEAR. ADVANCE WEEK.',
      target: 'advance-week',
    });
    state = completeAssistantGuideMilestone(state, 'first-week-advanced');
    expect(currentAssistantObjective(state, 'home')).toBeNull();
  });
});
