import { advanceWeek, createCareer } from '../../game/career';
import { buildTrainingGround } from '../../game/squad';
import { buildCareerFacility } from '../../game/management';
import { hireCareerCoach } from '../../game/market-career';
import { reconcileStoryYouthIntake } from '../../game/youth-intake';
import {
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
  hasAssistantGuideSequenceCompleted,
} from '../../game/assistant-guide';
import { createLaunchCareerSetup } from '../launch';
import {
  currentAssistantObjective,
  dueAssistantInboxGuideSequences,
  pendingAssistantGuideSequence,
  reconcileSatisfiedAssistantGuideSequences,
} from '../assistant-guide';
import { homeViewModel, reconcileHomeAssistantInbox } from '../view-models';

describe('assistant guide application flow', () => {
  test('reveals one task and one follow-up sequence at a time', () => {
    let state = createCareer(createLaunchCareerSetup(932));
    expect(pendingAssistantGuideSequence(state, 'home')).toBe('management-intro');
    expect(currentAssistantObjective(state, 'home')).toBeNull();

    state = completeAssistantGuideSequence(state, 'management-intro');
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toEqual({ text: 'OPEN SQUAD.', target: 'squad-tab' });
    expect(pendingAssistantGuideSequence(state, 'squad')).toBeNull();
    expect(currentAssistantObjective(state, 'squad')).toEqual({
      text: 'PICK A PLAYER AND A STAT TO TRAIN.',
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
      text: 'BUILD YOUR TRAINING PITCH.',
      target: 'training-ground-facility',
    });

    state = {
      ...state,
      facilities: { ...state.facilities, trainingGroundBuilt: true },
    };
    expect(currentAssistantObjective(state, 'club')).toEqual({ text: 'RETURN HOME.', target: 'home-tab' });
    expect(pendingAssistantGuideSequence(state, 'club')).toBeNull();
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
    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    state = buildTrainingGround(state);

    expect(state.facilities.trainingGroundBuilt).toBe(false);
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'INBOX CLEAR. ADVANCE WEEK.',
      target: 'advance-week',
    });
  });

  test('waits for both first-week inbox jobs before pointing to Advance Week', () => {
    let state = createCareer(createLaunchCareerSetup(936, undefined, undefined, 'full'));
    state = completeAssistantGuideSequence(state, 'management-intro');
    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    state = buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;

    expect(state.market?.headCoach).toBeUndefined();
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toBeNull();

    state = {
      ...state,
      market: hireCareerCoach(state, state.market!, state.market!.coachCandidates[0].id),
    };
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'INBOX CLEAR. ADVANCE WEEK.',
      target: 'advance-week',
    });
  });

  test('retires queued coach help once the hiring objective is already complete', () => {
    let state = createCareer(createLaunchCareerSetup(937, undefined, undefined, 'full'));
    state = completeAssistantGuideSequence(state, 'head-coach-market');
    state = {
      ...state,
      eventFlags: [
        ...state.eventFlags,
        'guide:bert:inbox:queued:head-coach-hire',
      ],
      market: hireCareerCoach(state, state.market!, state.market!.coachCandidates[0].id),
    };

    const reconciled = reconcileSatisfiedAssistantGuideSequences(state);

    expect(dueAssistantInboxGuideSequences(reconciled)).not.toContain('head-coach-hire');
    expect(reconciled.eventFlags).toContain('guide:bert:sequence-complete:head-coach-hire');
  });

  test('waits for D4 before teaching the first facility upgrade', () => {
    let state = createCareer(createLaunchCareerSetup(935, undefined, undefined, 'full'));
    state = buildCareerFacility(state, 'training-pitch', { x: 2, y: 0 }).state;
    state = advanceWeek(state);
    state = advanceWeek(state); // the pitch now takes two weeks to open
    state = reconcileSatisfiedAssistantGuideSequences(state);

    expect(dueAssistantInboxGuideSequences(state)).not.toContain('facility-upgrade');
    const reachedD4 = {
      ...state,
      m2: { ...state.m2!, highestDivisionReached: 4 as const },
    };
    expect(dueAssistantInboxGuideSequences(reachedD4)).toContain('facility-upgrade');
  });

  it('offers Youth Intake in Week 2 and delays the Coaching Office prompt until Week 3', () => {
    let state = createCareer(createLaunchCareerSetup(415, undefined, undefined, 'full'));
    state = {
      ...state,
      market: hireCareerCoach(state, state.market!, state.market!.coachCandidates[0].id),
    };

    const weekTwo = reconcileStoryYouthIntake({ ...state, week: 2 });
    expect(weekTwo.youthIntake).toMatchObject({ status: 'OPEN' });
    expect(dueAssistantInboxGuideSequences(weekTwo)).toContain('youth-intake');
    expect(dueAssistantInboxGuideSequences(weekTwo)).not.toContain('coaching-office');

    const repairedWeekTwo = reconcileSatisfiedAssistantGuideSequences({
      ...weekTwo,
      eventFlags: [
        ...weekTwo.eventFlags,
        'guide:bert:inbox:queued:coaching-office',
        'guide:bert:inbox:delivered:s1:w2:guide:coaching-office',
      ],
    });
    expect(repairedWeekTwo.eventFlags.some(flag => flag.includes('coaching-office'))).toBe(false);

    const afterYouth = completeAssistantGuideSequence(repairedWeekTwo, 'youth-intake');
    const weekThree = { ...afterYouth, week: 3 };
    expect(dueAssistantInboxGuideSequences(weekThree)).toContain('coaching-office');
    expect(dueAssistantInboxGuideSequences(weekThree)).not.toContain('youth-intake');
  });

  it('keeps the Training Pitch objective unfinished until construction completes', () => {
    let state = createCareer(createLaunchCareerSetup(413, undefined, undefined, 'full'));
    expect(state.facilities.grid?.buildings).toHaveLength(0);
    expect(dueAssistantInboxGuideSequences(state)).toContain('facility-placement');

    state = completeAssistantGuideSequence(state, 'facility-placement');
    expect(hasAssistantGuideSequenceCompleted(state, 'facility-placement')).toBe(false);

    state = buildCareerFacility(state, 'training-pitch', { x: 4, y: 2 }).state;
    expect(dueAssistantInboxGuideSequences(state)).not.toContain('facility-placement');
    expect(hasAssistantGuideSequenceCompleted(state, 'facility-placement')).toBe(false);

    state = advanceWeek(state);
    state = reconcileSatisfiedAssistantGuideSequences(state);
    expect(state.facilities.trainingGroundBuilt).toBe(false);
    expect(hasAssistantGuideSequenceCompleted(state, 'facility-placement')).toBe(false);

    state = advanceWeek(state);
    state = reconcileSatisfiedAssistantGuideSequences(state);
    expect(state.facilities.trainingGroundBuilt).toBe(true);
    expect(hasAssistantGuideSequenceCompleted(state, 'facility-placement')).toBe(true);
  });

  it('waits until the Coaching Office opens before offering assistant-coach hiring', () => {
    let state = createCareer(createLaunchCareerSetup(414, undefined, undefined, 'full'));
    state = {
      ...state,
      market: hireCareerCoach(state, state.market!, state.market!.coachCandidates[0].id),
    };
    state = buildCareerFacility(state, 'coaching-office', { x: 2, y: 0 }).state;

    expect(state.facilities.grid?.construction?.type).toBe('coaching-office');
    expect(dueAssistantInboxGuideSequences(state)).not.toContain('assistant-coach-hire');

    const premature = {
      ...state,
      eventFlags: [
        ...state.eventFlags,
        'guide:bert:inbox:queued:assistant-coach-hire',
        'guide:bert:inbox:delivered:s1:w1:guide:assistant-coach-hire',
        'guide:bert:sequence-complete:assistant-coach-hire',
      ],
    };
    const repaired = reconcileSatisfiedAssistantGuideSequences(premature);
    expect(repaired.eventFlags.some(flag => flag.includes('assistant-coach-hire'))).toBe(false);
    const repairedLaterSeason = reconcileSatisfiedAssistantGuideSequences({
      ...premature,
      season: 2,
    });
    expect(repairedLaterSeason.eventFlags.some(flag => flag.includes('assistant-coach-hire')))
      .toBe(false);

    state = advanceWeek(repaired);
    state = reconcileSatisfiedAssistantGuideSequences(state);

    expect(state.facilities.grid?.construction).toBeUndefined();
    expect(dueAssistantInboxGuideSequences(state)).toContain('assistant-coach-hire');

    const scheduled = reconcileHomeAssistantInbox(state);
    expect(homeViewModel(scheduled).alerts).toContainEqual(expect.objectContaining({
      guideSequenceId: 'assistant-coach-hire',
      destination: 'coach-market',
    }));
  });
});
