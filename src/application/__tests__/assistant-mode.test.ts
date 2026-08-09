import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  completeMatchday,
  DEFAULT_CREATION_RATINGS,
  willRetireAtSeasonTransition,
} from '../../game';
import { isFacilityOperational } from '../../game/facilities';
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
  storyEventViewModel,
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
    expect(pendingAssistantGuideSequence(career, 'home')).toBe(
      'management-intro',
    );
    expect(dueAssistantInboxGuideSequences(career).length).toBeGreaterThan(0);

    const introduced = completeAssistantGuideMilestone(
      career,
      'intro-complete',
    );
    expect(currentAssistantObjective(introduced, 'home')).not.toBeNull();
  });

  it('removes teaching and hard duties without erasing the logical due list', () => {
    const teacher = openedCareer();
    const advisor = { ...teacher, assistantMode: 'advisor' as const };

    expect(pendingAssistantGuideSequence(advisor, 'home')).toBeNull();
    expect(
      currentAssistantObjective(
        completeAssistantGuideMilestone(advisor, 'intro-complete'),
        'home',
      ),
    ).toBeNull();
    expect(dueAssistantInboxGuideSequences(advisor)).toEqual(
      dueAssistantInboxGuideSequences(teacher),
    );

    const weekTwo = { ...advisor, week: 2 };
    expect(outstandingInboxDuties(weekTwo)).toEqual([]);
  });

  it('keeps the logical desk occupancy but removes every rendered Bert row and route', () => {
    const teacher = openedCareer();
    const advisor = { ...teacher, assistantMode: 'advisor' as const };

    expect(isHomeDeskClear(advisor)).toBe(isHomeDeskClear(teacher));

    const reconciled = reconcileHomeAssistantInbox(advisor);
    const home = homeViewModel(reconciled);
    expect(home.alerts.some((alert) => alert.id === 'training-ground')).toBe(
      true,
    );
    expect(
      home.alerts.some((alert) => alert.id.startsWith('assistant-guide:')),
    ).toBe(false);
    expect(
      home.alerts.some((alert) => alert.guideSequenceId !== undefined),
    ).toBe(false);
    expect(home.alerts.some((alert) => alert.mustDoDutyId !== undefined)).toBe(
      false,
    );
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

function careerAfterOneWeek(mode: 'teacher' | 'advisor'): GameState {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(4242, mode);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  useM1Store.getState().buildClubFacility('training-pitch', { x: 0, y: 0 });
  const coachId = useM1Store.getState().career!.market!.coachCandidates[0].id;
  useM1Store.getState().hireCoach(coachId, 'HEAD');
  useM1Store.getState().advanceCareer();
  expect(useM1Store.getState().inboxDutyReminder).toBeNull();
  useM1Store.getState().continueWeekReview();
  return useM1Store.getState().career!;
}

describe('advice costs the manager nothing', () => {
  it('leaves the club in the same position after the same week', () => {
    const taught = careerAfterOneWeek('teacher');
    const advised = careerAfterOneWeek('advisor');

    expect(advised.week).toBe(2);
    expect(taught.week).toBe(2);
    expect(advised.clubs.map((club) => club.cash)).toEqual(
      taught.clubs.map((club) => club.cash),
    );
    expect(advised.trainingPoints).toBe(taught.trainingPoints);
    expect(advised.players.map((player) => player.id)).toEqual(
      taught.players.map((player) => player.id),
    );
    expect(
      advised.fixtures.filter((fixture) => fixture.status === 'played').length,
    ).toBe(
      taught.fixtures.filter((fixture) => fixture.status === 'played').length,
    );
  });

  it('diverges only on whether the next week is held', () => {
    careerAfterOneWeek('teacher');
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(2);
    expect(useM1Store.getState().inboxDutyReminder).toContain('youth-intake');

    careerAfterOneWeek('advisor');
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().career?.week).toBe(3);
    expect(useM1Store.getState().inboxDutyReminder).toBeNull();
  });

  it('is invisible to the game ring', () => {
    const gameDir = join(__dirname, '../../game');
    const mentions = readdirSync(gameDir)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) =>
        readFileSync(join(gameDir, name), 'utf8').includes('assistantMode'),
      );

    expect(mentions.sort()).toEqual(['assistant-guide.ts', 'types.ts']);
  });

  it('reaches four season boundaries without changing any mode-neutral career state', () => {
    const taught = runManagedCareer('teacher', 4);
    const advised = runManagedCareer('advisor', 4);

    expect(advised.finalState).toMatchObject({
      assistantMode: 'advisor',
      season: 4,
      phase: 'season-end',
    });
    expect(advised.managementWeeks).toHaveLength(120);
    expect(advised.managementWeekKeys).toEqual(taught.managementWeekKeys);
    expect(advised.managementWeeks).toEqual(taught.managementWeeks);
    expect(modeNeutralCareer(advised.finalState)).toEqual(
      modeNeutralCareer(taught.finalState),
    );
  });
});

interface ManagedCareerTrace {
  readonly finalState: GameState;
  readonly managementWeekKeys: string[];
  readonly managementWeeks: string[];
}

/**
 * Drives the same ordinary decisions through the app store in both modes.
 *
 * Teacher completes each tranche that reaches the desk. Advisor leaves those
 * exact guide queues suppressed. Everything else — facilities, coach, youth,
 * stories, matches, contracts, board protection and legacy choices — is the
 * same action in the same week. The bounded step count turns any new dead end
 * into a named failure instead of an endless test.
 */
function runManagedCareer(
  mode: 'teacher' | 'advisor',
  completedSeasons: number,
): ManagedCareerTrace {
  useM1Store.setState(useM1Store.getInitialState(), true);
  useM1Store.getState().startNewCareer(20_260_804, mode);
  useM1Store.getState().completePlayerCreation({
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });

  if (mode === 'teacher')
    useM1Store.getState().completeAssistantGuide('management-intro');
  settleAssistantDesk(mode);

  // The shipped opening jobs, performed in both modes so this test isolates
  // the setting rather than comparing two managers who made different clubs.
  useM1Store.getState().buildFacility();
  useM1Store.getState().trainPlayer('bramble-rovers-created-player', 'sprints');
  const coachId = useM1Store.getState().career?.market?.coachCandidates[0]?.id;
  if (coachId === undefined)
    throw new Error('managed mode parity career has no head coach candidate');
  useM1Store.getState().hireCoach(coachId);
  useM1Store.getState().setActiveTab('home');
  settleAssistantDesk(mode);

  const managementWeekKeys: string[] = [];
  const managementWeeks: string[] = [];
  const recordedWeeks = new Set<string>();

  for (let step = 0; step < completedSeasons * 220; step += 1) {
    const current = useM1Store.getState();
    const career = current.career;
    if (career === null)
      throw new Error('managed mode parity career disappeared');
    if (
      career.season === completedSeasons &&
      career.phase === 'season-end' &&
      current.screen === 'season-end'
    ) {
      return { finalState: career, managementWeekKeys, managementWeeks };
    }

    if (current.screen === 'awakening') {
      current.continueAfterAwakening();
    } else if (current.screen === 'event') {
      progressManagedEvent();
    } else if (current.screen === 'matchday') {
      completeManagedMatchday();
    } else if (current.screen === 'faceoff') {
      current.completeFaceOff();
    } else if (current.screen === 'postmatch') {
      current.continueAfterMatch();
    } else if (current.screen === 'week-review') {
      current.continueWeekReview();
    } else if (current.screen === 'championship-celebration') {
      current.completeChampionshipCelebration();
    } else if (current.screen === 'endgame-celebration') {
      current.completeEndgameCelebration();
    } else if (current.screen === 'awards-ceremony') {
      current.completeAwardsCeremony();
    } else if (current.screen === 'legacy') {
      current.chooseLegacy('farewell');
    } else if (current.screen === 'season-end') {
      const expired = career.players.find(
        (player) =>
          player.clubId === career.userClubId &&
          player.contractSeasonsRemaining === 0 &&
          !willRetireAtSeasonTransition(player, career.season),
      );
      if (expired === undefined) current.advanceCareer();
      else current.renewPlayer(expired.id, 1);
    } else if (current.screen === 'management') {
      if (current.postMatchOverlay === 'summary') {
        current.dismissPostMatchSummary();
        continue;
      }

      resolveSharedManagementDecisions();
      settleAssistantDesk(mode);
      const afterDesk = useM1Store.getState();
      const afterCareer = afterDesk.career;
      if (afterCareer === null)
        throw new Error('managed mode parity desk lost its career');
      if (afterDesk.screen !== 'management') continue;
      if (afterCareer.pendingEvent !== undefined) {
        afterDesk.openDeskStory();
        continue;
      }

      const weekKey = `${afterCareer.season}:${afterCareer.week}`;
      if (!recordedWeeks.has(weekKey)) {
        recordedWeeks.add(weekKey);
        managementWeekKeys.push(weekKey);
        managementWeeks.push(JSON.stringify(modeNeutralCareer(afterCareer)));
      }
      afterDesk.advanceCareer();
      if (useM1Store.getState().inboxDutyReminder !== null) {
        throw new Error(
          `${mode} was held by ${useM1Store.getState().inboxDutyReminder?.join(', ')} in ${weekKey}`,
        );
      }
    } else {
      throw new Error(`managed mode parity stopped on ${current.screen}`);
    }

    if (useM1Store.getState().error !== null) {
      throw new Error(
        `${mode} failed on ${useM1Store.getState().screen}: ${useM1Store.getState().error}`,
      );
    }
  }

  const stalled = useM1Store.getState();
  throw new Error(
    `${mode} exceeded its step budget on ${stalled.screen} at S${stalled.career?.season}W${stalled.career?.week}`,
  );
}

function resolveSharedManagementDecisions(): void {
  let current = useM1Store.getState();
  let career = current.career;
  if (career === null) throw new Error('managed decision pass has no career');

  const ultimatum = career.financialSafety?.boardUltimatum;
  if (ultimatum !== undefined && ultimatum.protectedPlayerId === undefined) {
    current.protectBoardCandidate(ultimatum.candidates[0].playerId);
    current = useM1Store.getState();
    career = current.career!;
  }

  if (
    career.season === 1 &&
    career.week >= 2 &&
    career.youthIntake?.status === 'OPEN' &&
    dueAssistantInboxGuideSequences(career).includes('youth-intake')
  ) {
    const youthId = career.youthIntake.offers[0]?.player.id;
    if (youthId === undefined)
      throw new Error('managed mode parity youth offer disappeared');
    current.signYouth(youthId);
    current = useM1Store.getState();
    career = current.career!;
  }

  const hasCoachingOffice =
    career.facilities.grid?.buildings.some(
      (building) => building.type === 'coaching-office',
    ) ?? false;
  if (
    !hasCoachingOffice &&
    career.facilities.grid?.construction === undefined &&
    dueAssistantInboxGuideSequences(career).includes('coaching-office')
  ) {
    current.buildClubFacility('coaching-office', { x: 2, y: 0 });
    current = useM1Store.getState();
    career = current.career!;
  }

  const grid = career.facilities.grid;
  const coachingOffice = grid?.buildings.find(
    (building) => building.type === 'coaching-office',
  );
  const market = career.market;
  if (
    coachingOffice !== undefined &&
    grid !== undefined &&
    isFacilityOperational(grid, coachingOffice.id) &&
    market !== undefined &&
    market.assistantCoach === undefined
  ) {
    const candidate = market.coachCandidates.find(
      (coach) => coach.id !== market.headCoach?.id,
    );
    if (candidate === undefined)
      throw new Error('managed mode parity assistant candidate disappeared');
    current.hireCoach(candidate.id, 'ASSISTANT');
    current = useM1Store.getState();
  }

  current.setActiveTab('home');
}

function settleAssistantDesk(mode: 'teacher' | 'advisor'): void {
  let current = useM1Store.getState();
  const career = current.career;
  if (career === null || current.screen !== 'management') return;

  if (mode === 'teacher') {
    const opening = pendingAssistantGuideSequence(career, current.activeTab);
    if (opening !== null) current.completeAssistantGuide(opening);
  }
  useM1Store.getState().reconcileAssistantInbox();

  current = useM1Store.getState();
  if (
    mode !== 'teacher' ||
    current.career === null ||
    current.screen !== 'management'
  )
    return;
  const delivered = new Set(
    homeViewModel(current.career).alerts.flatMap((alert) =>
      alert.guideSequenceId === undefined ? [] : [alert.guideSequenceId],
    ),
  );
  for (const sequenceId of delivered)
    useM1Store.getState().completeAssistantGuide(sequenceId);
}

function progressManagedEvent(): void {
  const current = useM1Store.getState();
  const career = current.career;
  const pending = career?.pendingEvent;
  if (career === null || pending === undefined)
    throw new Error('managed event lost its offer');
  if (pending.resolvedChoiceId !== undefined) {
    current.continueAfterEvent();
    return;
  }
  const viewModel = storyEventViewModel(career, loadLaunchContent());
  if (
    viewModel.playerSelectionRequired &&
    viewModel.selectedPlayer === undefined
  ) {
    current.selectEventPlayer(viewModel.playerChoices[0]!.id);
    return;
  }
  const choice =
    viewModel.choices.find(
      (candidate) => !candidate.disabled && candidate.tone === 'safe',
    ) ?? viewModel.choices.find((candidate) => !candidate.disabled);
  if (choice === undefined)
    throw new Error(`managed event ${pending.eventId} has no choice`);
  current.chooseEvent(choice.id);
}

/**
 * Completes the real career matchday transition with cheap deterministic
 * scores. Match simulation and replay already have their own golden suite;
 * this soak is about the management/store clock and must stay fast enough to
 * run in the ordinary test command.
 */
function completeManagedMatchday(): void {
  const career = useM1Store.getState().career;
  if (career === null) throw new Error('managed matchday lost its career');
  const matchday = activeCareerMatchday(career);
  if (matchday === undefined)
    throw new Error('managed matchday has no fixtures');
  const next = completeMatchday(
    career,
    matchday.fixtures.map((fixture) => ({
      fixtureId: fixture.id,
      homeGoals: fixture.matchSeed % 3,
      awayGoals: Math.floor(fixture.matchSeed / 3) % 3,
    })),
  );
  useM1Store.setState({
    career: next,
    screen:
      next.phase === 'matchday'
        ? 'matchday'
        : next.phase === 'season-end' || next.phase === 'complete'
          ? 'season-end'
          : 'management',
    activeTab: 'home',
    postMatch: null,
    postMatchOverlay: null,
    weekReview: null,
    error: null,
  });
}

function modeNeutralCareer(state: GameState): Omit<GameState, 'assistantMode'> {
  const { assistantMode: _mode, eventFlags, ...career } = state;
  return {
    ...career,
    // Guide delivery/completion/suppression is the presentation difference
    // under test. Product cadence, desk tips, events and every club fact remain
    // elsewhere in this projection and therefore still have to match.
    eventFlags: eventFlags.filter((flag) => !flag.startsWith('guide:bert:')),
  };
}
