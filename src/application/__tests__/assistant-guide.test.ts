import { createCareer } from '../../game/career';
import { buildTrainingGround } from '../../game/squad';
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
    expect(pendingAssistantGuideSequence(state, 'club')).toBeNull();
    expect(pendingAssistantGuideSequence(state, 'home')).toBe('desk-intro');
    expect(currentAssistantObjective(state, 'home')).toBeNull();

    state = completeAssistantGuideSequence(state, 'desk-intro');
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'INBOX CLEAR. ADVANCE WEEK.',
      target: 'advance-week',
    });
    state = completeAssistantGuideMilestone(state, 'first-week-advanced');
    expect(currentAssistantObjective(state, 'home')).toBeNull();
  });

  test('never resurrects onboarding hints after the first career week', () => {
    const fresh = createCareer(createLaunchCareerSetup(933));
    const staleWeekTwoSave = { ...fresh, week: 2 };
    const staleLaterSeasonSave = { ...fresh, season: 2 };

    expect(pendingAssistantGuideSequence(staleWeekTwoSave, 'home')).toBeNull();
    expect(currentAssistantObjective(staleWeekTwoSave, 'home')).toBeNull();
    expect(pendingAssistantGuideSequence(staleLaterSeasonSave, 'home')).toBeNull();
    expect(currentAssistantObjective(staleLaterSeasonSave, 'home')).toBeNull();
  });

  test('treats a started Training Ground as progress and points to Advance Week', () => {
    let state = createCareer(createLaunchCareerSetup(934));
    state = completeAssistantGuideSequence(state, 'management-intro');
    state = completeAssistantGuideSequence(state, 'squad-intro');
    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    state = buildTrainingGround(state);

    expect(state.facilities.trainingGroundBuilt).toBe(false);
    expect(pendingAssistantGuideSequence(state, 'home')).toBe('desk-intro');
    state = completeAssistantGuideSequence(state, 'desk-intro');
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'INBOX CLEAR. ADVANCE WEEK.',
      target: 'advance-week',
    });
  });
});
