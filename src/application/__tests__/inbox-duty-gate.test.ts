import { DEFAULT_CREATION_RATINGS } from '../../game';
import { completeAssistantGuideSequence } from '../../game/assistant-guide';
import { advanceFacilityConstruction } from '../../game/facilities';
import { buildCareerFacility } from '../../game/management';
import { hireCareerCoach } from '../../game/market-career';
import type { GameState } from '../../game/types';
import {
  dueAssistantInboxGuideSequences,
  outstandingInboxDuties,
} from '../assistant-guide';
import { useM1Store } from '../store';

function coachingOfficeDutyCareer(state: GameState): GameState {
  const withHeadCoach = {
    ...state,
    market: hireCareerCoach(
      state,
      state.market!,
      state.market!.coachCandidates[0].id,
    ),
  };
  const started = buildCareerFacility(withHeadCoach, 'training-pitch', {
    x: 0,
    y: 0,
  }).state;
  let grid = started.facilities.grid!;
  while (grid.construction !== undefined) {
    grid = advanceFacilityConstruction(grid).grid;
  }
  return completeAssistantGuideSequence(
    {
      ...started,
      week: 3,
      facilities: {
        ...started.facilities,
        trainingGroundBuilt: true,
        grid,
      },
    },
    'youth-intake',
  );
}

function startTeacherCareer(): void {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(123, 'teacher');
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
}

function hireOpeningHeadCoach(): void {
  const coachId = useM1Store.getState().career?.market?.coachCandidates[0]?.id;
  if (coachId === undefined) throw new Error('opening coach is missing');
  useM1Store.getState().hireCoach(coachId, 'HEAD');
}

function buildOpeningPitch(): void {
  useM1Store.getState().buildClubFacility('training-pitch', { x: 0, y: 0 });
}

function finishOpeningWeekJobs(): void {
  hireOpeningHeadCoach();
  buildOpeningPitch();
}

function userClubCash(): number {
  const career = useM1Store.getState().career!;
  return career.clubs.find((club) => club.id === career.userClubId)!.cash;
}

describe('opening blue inbox jobs', () => {
  beforeEach(startTeacherCareer);

  it('holds each week until the real action completes', () => {
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toEqual([
      'facility-placement',
      'head-coach-market',
    ]);

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(1);
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'facility-placement',
      'head-coach-market',
    ]);

    // Reading both briefings does not perform either job.
    useM1Store.getState().completeAssistantGuide('facility-placement');
    useM1Store.getState().completeAssistantGuide('head-coach-market');
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toEqual([
      'facility-placement',
      'head-coach-market',
    ]);

    finishOpeningWeekJobs();
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toEqual([]);
    useM1Store.getState().dismissInboxDutyReminder();
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(2);

    useM1Store.getState().continueWeekReview();
    const weekTwo = useM1Store.getState().career!;
    expect(dueAssistantInboxGuideSequences(weekTwo)).toContain('youth-intake');
    expect(outstandingInboxDuties(weekTwo)).toEqual(['youth-intake']);

    // The briefing and the decline route both leave the signing job open.
    useM1Store.getState().completeAssistantGuide('youth-intake');
    useM1Store.getState().declineYouth();
    expect(useM1Store.getState().career?.youthIntake?.status).toBe('OPEN');
    expect(useM1Store.getState().inboxDutyReminder).toEqual(['youth-intake']);
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toEqual([
      'youth-intake',
    ]);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(2);
    expect(useM1Store.getState().inboxDutyReminder).toEqual(['youth-intake']);

    useM1Store.getState().dismissInboxDutyReminder();
    const youthId =
      useM1Store.getState().career?.youthIntake?.offers[0]?.player.id;
    if (youthId === undefined)
      throw new Error('opening youth offer is missing');
    useM1Store.getState().focusInboxDuty('youth-intake');
    useM1Store.getState().signYouth(youthId);
    expect(
      useM1Store.getState().career?.youthIntake?.signedPlayerIds,
    ).toContain(youthId);
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toEqual([]);

    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(3);
    useM1Store.getState().continueWeekReview();
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toEqual([
      'coaching-office',
    ]);

    useM1Store.getState().focusInboxDuty('coaching-office');
    useM1Store.getState().buildClubFacility('coaching-office', { x: 2, y: 0 });
    expect(outstandingInboxDuties(useM1Store.getState().career!)).toEqual([]);
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();
  });

  it('blocks normal navigation but offers a deliberate Back to Inbox escape', () => {
    buildOpeningPitch();
    useM1Store.getState().focusInboxDuty('head-coach-market');
    useM1Store.getState().setActiveTab('market');

    useM1Store.getState().setActiveTab('home');
    expect(useM1Store.getState()).toMatchObject({
      activeTab: 'market',
      inboxDutyFocus: {
        mode: 'focused',
        dutyId: 'head-coach-market',
      },
      inboxDutyReminder: ['head-coach-market'],
    });

    useM1Store.getState().backToInboxDuties();
    expect(useM1Store.getState()).toMatchObject({
      activeTab: 'home',
      inboxDutyFocus: { mode: 'choosing' },
      inboxDutyReminder: null,
    });

    useM1Store.getState().setActiveTab('squad');
    expect(useM1Store.getState().activeTab).toBe('home');
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'head-coach-market',
    ]);
  });

  it('rejects the wrong transaction and releases focus after completion', () => {
    useM1Store.getState().focusInboxDuty('facility-placement');
    useM1Store.getState().setActiveTab('club');
    const cashBeforeWrongBuild = userClubCash();
    useM1Store.getState().buildClubFacility('gym', { x: 0, y: 0 });
    expect(useM1Store.getState().career?.facilities.grid?.buildings).toEqual(
      [],
    );
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'facility-placement',
    ]);
    expect(userClubCash()).toBe(cashBeforeWrongBuild);

    useM1Store.getState().dismissInboxDutyReminder();
    buildOpeningPitch();
    expect(useM1Store.getState()).toMatchObject({
      activeTab: 'home',
      inboxDutyFocus: { mode: 'choosing' },
    });

    useM1Store.getState().focusInboxDuty('head-coach-market');
    const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
    const cashBeforeWrongHire = userClubCash();
    useM1Store.getState().hireCoach(coachId, 'ASSISTANT');
    expect(
      useM1Store.getState().career?.market?.assistantCoach,
    ).toBeUndefined();
    expect(useM1Store.getState().inboxDutyReminder).toEqual([
      'head-coach-market',
    ]);
    expect(userClubCash()).toBe(cashBeforeWrongHire);

    useM1Store.getState().dismissInboxDutyReminder();
    useM1Store.getState().hireCoach(coachId, 'HEAD');
    expect(useM1Store.getState().career?.market?.headCoach?.id).toBe(coachId);
    expect(useM1Store.getState().inboxDutyFocus).toBeNull();
  });

  it('refuses a wrong facility before it spends cash and brings Bert on', () => {
    const due = coachingOfficeDutyCareer(useM1Store.getState().career!);
    expect(outstandingInboxDuties(due)).toContain('coaching-office');
    useM1Store.setState({ career: due, inboxDutyReminder: null, notice: null });
    const cashBefore = due.clubs.find(
      (club) => club.id === due.userClubId,
    )!.cash;
    const buildingsBefore = due.facilities.grid!.buildings;

    useM1Store.getState().buildClubFacility('medical-bay', { x: 2, y: 0 });

    const refused = useM1Store.getState();
    expect(refused.career?.facilities.grid?.buildings).toEqual(buildingsBefore);
    expect(
      refused.career?.clubs.find((club) => club.id === due.userClubId)?.cash,
    ).toBe(cashBefore);
    expect(refused.inboxDutyReminder).toEqual(['coaching-office']);
    expect(refused.error).toBeNull();
  });

  it('still starts the required Coaching Office immediately', () => {
    const due = coachingOfficeDutyCareer(useM1Store.getState().career!);
    useM1Store.setState({ career: due, inboxDutyReminder: null, notice: null });

    useM1Store.getState().buildClubFacility('coaching-office', { x: 2, y: 0 });

    expect(
      useM1Store.getState().career?.facilities.grid?.construction,
    ).toMatchObject({ type: 'coaching-office' });
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();
  });
});
