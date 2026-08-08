import { createCareer } from '../career';
import {
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
  dismissAssistantInboxProductForCurrentWeek,
  dismissAssistantInboxProductPermanently,
  hasAssistantGuideMilestone,
  hasAssistantGuideSequenceCompleted,
  isAssistantInboxProductDismissedForCurrentWeek,
  isAssistantInboxProductPermanentlyDismissed,
  pendingAssistantInboxGuideSequences,
  queueAssistantGuideSequence,
  queueAssistantGuideSequences,
  scheduleAssistantInboxWeek,
  shouldShowSquadSortHint,
  wasSponsorDeskIntroDeliveredBeforeCurrentWeek,
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

  test('records the matchday condition lesson only once per career', () => {
    const state = createCareer(createLaunchCareerSetup(8_430));
    const once = completeAssistantGuideMilestone(state, 'match-condition-warning-seen');
    const twice = completeAssistantGuideMilestone(once, 'match-condition-warning-seen');

    expect(hasAssistantGuideMilestone(once, 'match-condition-warning-seen')).toBe(true);
    expect(twice).toBe(once);
  });

  test('offers the roster sort hint from Week 12 until any tap dismisses it forever', () => {
    const career = createCareer(createLaunchCareerSetup(8_431));
    const weekEleven = { ...career, season: 1, week: 11 };
    const weekTwelve = { ...career, season: 1, week: 12 };

    expect(shouldShowSquadSortHint(weekEleven)).toBe(false);
    expect(shouldShowSquadSortHint(weekTwelve)).toBe(true);
    expect(shouldShowSquadSortHint({ ...career, season: 2, week: 1 })).toBe(true);

    const dismissed = completeAssistantGuideMilestone(weekTwelve, 'squad-sort-seen');
    expect(shouldShowSquadSortHint(dismissed)).toBe(false);
    expect(completeAssistantGuideMilestone(dismissed, 'squad-sort-seen')).toBe(dismissed);
  });

  test('persists M2 firsts in insertion order and completes them idempotently', () => {
    const state = createCareer(createLaunchCareerSetup(844));
    const queued = queueAssistantGuideSequences(state, [
      'scout-mission',
      'head-coach-market',
      'scout-mission',
    ]);
    const queuedAgain = queueAssistantGuideSequence(queued, 'head-coach-market');

    expect(queuedAgain).toBe(queued);
    expect(pendingAssistantInboxGuideSequences(queued)).toEqual([
      'scout-mission',
      'head-coach-market',
    ]);

    const completed = completeAssistantGuideSequence(queued, 'scout-mission');
    const completedAgain = completeAssistantGuideSequence(completed, 'scout-mission');
    expect(hasAssistantGuideSequenceCompleted(completed, 'scout-mission')).toBe(true);
    expect(pendingAssistantInboxGuideSequences(completed)).toEqual(['head-coach-market']);
    expect(completedAgain).toBe(completed);
  });

  test('treats the migrated continuity briefing as the one-time Sponsor Desk introduction', () => {
    const state = createCareer(createLaunchCareerSetup(8_441));
    const completed = completeAssistantGuideSequence(state, 'sponsor-desk-continuity');

    expect(hasAssistantGuideSequenceCompleted(completed, 'sponsor-desk-continuity')).toBe(true);
    expect(hasAssistantGuideSequenceCompleted(completed, 'sponsor-desk')).toBe(true);
    expect(completeAssistantGuideSequence(completed, 'sponsor-desk')).toBe(completed);
  });

  test('delivers at most three firsts and holds the fourth for a later week', () => {
    const fresh = createCareer(createLaunchCareerSetup(845));
    const state = {
      ...fresh,
      facilities: { ...fresh.facilities, trainingGroundBuilt: true },
    };
    const firstWeek = scheduleAssistantInboxWeek(state, {
      dueGuideSequenceIds: [
        'head-coach-market',
        'facility-placement',
        'scout-mission',
        'transfer-list',
      ],
    });

    expect(firstWeek.guideSequenceIds).toEqual([
      'head-coach-market',
      'facility-placement',
      'scout-mission',
    ]);
    expect(firstWeek.deferredGuideSequenceIds).toEqual(['transfer-list']);

    const afterThreeReads = firstWeek.guideSequenceIds.reduce(
      (career, sequenceId) => completeAssistantGuideSequence(career, sequenceId),
      firstWeek.state,
    );
    const stillSameWeek = scheduleAssistantInboxWeek(afterThreeReads);
    expect(stillSameWeek.guideSequenceIds).toEqual([]);
    expect(stillSameWeek.deferredGuideSequenceIds).toEqual(['transfer-list']);

    const nextWeek = scheduleAssistantInboxWeek({ ...stillSameWeek.state, week: 2 });
    expect(nextWeek.guideSequenceIds).toEqual(['transfer-list']);
    expect(nextWeek.deferredGuideSequenceIds).toEqual([]);
    expect(nextWeek.state.eventFlags.some(flag => flag.includes(':w1:'))).toBe(false);
  });

  test('gives urgent product alerts priority and remains byte-idempotent', () => {
    const state = createCareer(createLaunchCareerSetup(846));
    const options = {
      dueGuideSequenceIds: [
        'head-coach-market',
        'facility-placement',
        'scout-mission',
      ] as const,
      productAlerts: [
        { id: 'injury-captain', priority: 'urgent' as const },
        { id: 'board-warning', priority: 'urgent' as const },
        { id: 'loan-reminder', priority: 'normal' as const },
      ],
    };
    const planned = scheduleAssistantInboxWeek(state, options);
    const plannedAgain = scheduleAssistantInboxWeek(planned.state, options);

    expect(planned.productAlertIds).toEqual(['injury-captain', 'board-warning']);
    expect(planned.guideSequenceIds).toEqual(['head-coach-market']);
    expect(planned.deferredProductAlertIds).toEqual(['loan-reminder']);
    expect(planned.deferredGuideSequenceIds).toEqual([
      'facility-placement',
      'scout-mission',
    ]);
    expect(plannedAgain).toEqual({ ...planned, state: planned.state });
    expect(plannedAgain.state).toBe(planned.state);
  });

  test('dismisses a read product only for its current occurrence and persists it', () => {
    const state = createCareer(createLaunchCareerSetup(8_461));
    const dismissed = dismissAssistantInboxProductForCurrentWeek(state, 'financial-warning');
    const reloaded = JSON.parse(JSON.stringify(dismissed)) as typeof dismissed;

    expect(isAssistantInboxProductDismissedForCurrentWeek(reloaded, 'financial-warning')).toBe(true);
    expect(isAssistantInboxProductDismissedForCurrentWeek(
      { ...reloaded, week: reloaded.week + 1 },
      'financial-warning',
    )).toBe(false);
  });

  test('permanently dismisses a one-time product lesson after its hand-off', () => {
    const state = createCareer(createLaunchCareerSetup(8_462));
    const dismissed = dismissAssistantInboxProductPermanently(state, 'emergency-loan');
    const nextWeek = { ...dismissed, week: dismissed.week + 1 };

    expect(isAssistantInboxProductPermanentlyDismissed(dismissed, 'emergency-loan')).toBe(true);
    expect(isAssistantInboxProductPermanentlyDismissed(nextWeek, 'emergency-loan')).toBe(true);
  });

  test.each([0, 1, 2, 3])(
    'holds simultaneous Buzz behind Sponsor Desk with %i occupied inbox slots, including reload',
    occupiedSlots => {
      const fresh = createCareer(createLaunchCareerSetup(8_450 + occupiedSlots));
      const unlockMorning = {
        ...fresh,
        season: 3,
        week: 1,
        phase: 'manage' as const,
        m2: { ...fresh.m2!, highestDivisionReached: 4 as const },
      };
      const firstWeek = scheduleAssistantInboxWeek(unlockMorning, {
        dueGuideSequenceIds: ['sponsor-desk', 'sponsor-buzz'],
        productAlerts: Array.from({ length: occupiedSlots }, (_, index) => ({
          id: `urgent-${index}`,
          priority: 'urgent' as const,
        })),
      });

      expect(pendingAssistantInboxGuideSequences(firstWeek.state)).toEqual([
        'sponsor-desk',
        'sponsor-buzz',
      ]);
      expect(firstWeek.guideSequenceIds).not.toContain('sponsor-buzz');

      const sponsorWeek = firstWeek.guideSequenceIds.includes('sponsor-desk')
        ? firstWeek
        : scheduleAssistantInboxWeek({
            ...(JSON.parse(JSON.stringify(firstWeek.state)) as typeof firstWeek.state),
            week: 2,
          });
      expect(sponsorWeek.guideSequenceIds).toContain('sponsor-desk');
      expect(sponsorWeek.guideSequenceIds).not.toContain('sponsor-buzz');
      expect(wasSponsorDeskIntroDeliveredBeforeCurrentWeek(sponsorWeek.state)).toBe(false);

      const afterReload = JSON.parse(JSON.stringify(sponsorWeek.state)) as typeof sponsorWeek.state;
      const nextMorning = { ...afterReload, week: sponsorWeek.week + 1 };
      expect(wasSponsorDeskIntroDeliveredBeforeCurrentWeek(nextMorning)).toBe(true);
      const buzzWeek = scheduleAssistantInboxWeek(nextMorning);
      expect(buzzWeek.guideSequenceIds).toContain('sponsor-buzz');
    },
  );

  test('does not release simultaneous Buzz merely because Sponsor Desk was read in the same week', () => {
    const fresh = createCareer(createLaunchCareerSetup(8_459));
    const unlockMorning = {
      ...fresh,
      season: 3,
      week: 1,
      phase: 'manage' as const,
      m2: { ...fresh.m2!, highestDivisionReached: 4 as const },
    };
    const first = scheduleAssistantInboxWeek(unlockMorning, {
      dueGuideSequenceIds: ['sponsor-desk', 'sponsor-buzz'],
    });
    const readNow = completeAssistantGuideSequence(first.state, 'sponsor-desk');
    const sameWeek = scheduleAssistantInboxWeek(readNow);

    expect(sameWeek.guideSequenceIds).not.toContain('sponsor-buzz');
    expect(scheduleAssistantInboxWeek({ ...sameWeek.state, week: 2 }).guideSequenceIds)
      .toContain('sponsor-buzz');
  });

  test('lets a newly urgent alert displace, but not erase, a scheduled guide', () => {
    const state = createCareer(createLaunchCareerSetup(847));
    const guides = scheduleAssistantInboxWeek(state, {
      dueGuideSequenceIds: ['facility-placement', 'facility-upgrade', 'facility-adjacency'],
    });
    const interrupted = scheduleAssistantInboxWeek(guides.state, {
      productAlerts: [{ id: 'board-ultimatum', priority: 'urgent' }],
    });

    expect(interrupted.productAlertIds).toEqual(['board-ultimatum']);
    expect(interrupted.guideSequenceIds).toEqual(['facility-placement', 'facility-upgrade']);
    expect(interrupted.deferredGuideSequenceIds).toEqual(['facility-adjacency']);
    expect(pendingAssistantInboxGuideSequences(interrupted.state)).toEqual([
      'facility-placement',
      'facility-upgrade',
      'facility-adjacency',
    ]);
  });

  test('persists a one-shot product notice through the weekly cap and save/load', () => {
    const state = createCareer(createLaunchCareerSetup(848));
    const crowded = scheduleAssistantInboxWeek(state, {
      productAlerts: [
        { id: 'injury-one', priority: 'urgent' },
        { id: 'injury-two', priority: 'urgent' },
        { id: 'transfer-request', priority: 'urgent' },
        { id: 'board-resolution:board-s1-w1', priority: 'normal', oneShot: true },
      ],
    });

    expect(crowded.productAlertIds).toEqual(['injury-one', 'injury-two', 'transfer-request']);
    expect(crowded.deferredProductAlertIds).toEqual(['board-resolution:board-s1-w1']);

    const reloaded = JSON.parse(JSON.stringify(crowded.state)) as typeof crowded.state;
    const nextWeek = scheduleAssistantInboxWeek({ ...reloaded, week: 2 });
    expect(nextWeek.productAlertIds).toEqual(['board-resolution:board-s1-w1']);
    expect(nextWeek.deferredProductAlertIds).toEqual([]);
    expect(nextWeek.state.eventFlags.some(flag => (
      flag.includes('acknowledged-product:board-resolution%3Aboard-s1-w1')
    ))).toBe(true);
  });

  test('bounds persisted one-shot queue and acknowledgement flags', () => {
    let state = createCareer(createLaunchCareerSetup(849));
    for (let week = 1; week <= 12; week += 1) {
      const planned = scheduleAssistantInboxWeek({ ...state, week }, {
        productAlerts: Array.from({ length: 5 }, (_, index) => ({
          id: `notice-${week}-${index}`,
          priority: 'normal' as const,
          oneShot: true,
        })),
      });
      state = planned.state;
    }
    expect(state.eventFlags.filter(flag => flag.includes('pending-product:')).length).toBeLessThanOrEqual(24);
    expect(state.eventFlags.filter(flag => flag.includes('acknowledged-product:')).length).toBeLessThanOrEqual(24);
  });
});
