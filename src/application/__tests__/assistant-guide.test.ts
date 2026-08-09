import {
  advanceWeek,
  createCareer,
  CUP_SETTLEMENT_WEEKS,
} from '../../game/career';
import { advanceFacilityConstruction } from '../../game/facilities';
import { buildTrainingGround } from '../../game/squad';
import { buildCareerFacility } from '../../game/management';
import { hireCareerCoach } from '../../game/market-career';
import {
  declineYouthIntakeOffers,
  reconcileStoryYouthIntake,
  signYouthIntakeOffer,
} from '../../game/youth-intake';
import {
  completeAssistantGuideMilestone,
  completeAssistantGuideSequence,
  hasAssistantGuideSequenceCompleted,
  M2_ASSISTANT_GUIDE_SEQUENCE_IDS,
} from '../../game/assistant-guide';
import type { GameState } from '../../game/types';
import { createLaunchCareerSetup } from '../launch';
import { FACILITY_CATALOG } from '../../game/facilities';
import {
  currentAssistantObjective,
  dueAssistantInboxGuideSequences,
  LAST_GATED_INBOX_WEEK,
  openingTrainingPitchRequired,
  outstandingInboxDuties,
  pendingAssistantGuideSequence,
  reconcileSatisfiedAssistantGuideSequences,
} from '../assistant-guide';
import { homeViewModel, reconcileHomeAssistantInbox } from '../view-models';

/**
 * Reads every other first off the desk, which is the state the upgrade lesson
 * waits for. Repeated because some guides only appear once their predecessor is
 * read — the coach market before the hire, and so on.
 */
function clearOtherGuideFirsts(state: GameState): GameState {
  let next = state;
  for (let pass = 0; pass < M2_ASSISTANT_GUIDE_SEQUENCE_IDS.length; pass += 1) {
    const remaining = dueAssistantInboxGuideSequences(next).filter(
      (sequenceId) => sequenceId !== 'facility-upgrade',
    );
    if (remaining.length === 0) return next;
    for (const sequenceId of remaining) {
      next = completeAssistantGuideSequence(next, sequenceId);
    }
  }
  return next;
}

function completeOpeningPitch(state: GameState): GameState {
  const started = buildCareerFacility(state, 'training-pitch', {
    x: 0,
    y: 0,
  }).state;
  let grid = started.facilities.grid!;
  while (grid.construction !== undefined)
    grid = advanceFacilityConstruction(grid).grid;
  return {
    ...started,
    facilities: { ...started.facilities, trainingGroundBuilt: true, grid },
  };
}

function withOneRosterSpace(state: GameState): GameState {
  const removed = state.players.find(
    (player) => player.clubId === state.userClubId,
  );
  if (removed === undefined) throw new Error('user roster is empty');
  return {
    ...state,
    players: state.players.filter((player) => player.id !== removed.id),
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId
        ? { ...club, weeklyWages: club.weeklyWages - removed.weeklyWage }
        : club,
    ),
  };
}

function managedSponsorCareer(options: {
  readonly season: number;
  readonly week: number;
  readonly withActionableOffer: boolean;
  readonly phase?: GameState['phase'];
}): GameState {
  const state = createCareer(
    createLaunchCareerSetup(9_800 + options.season * 30 + options.week),
  );
  const contract = {
    contractId: `continuity-s${options.season}-slot0`,
    sponsorContentId: 'continuity',
    sponsorName: 'Current Sponsor',
    offerLine: 'Your existing sponsor terms continue.',
    season: options.season,
    slot: 0,
    nominalMonthlyFee: 4_000,
    provisional: options.withActionableOffer,
  };
  const offer = {
    offerId: `offer-s${options.season}-slot0-steady-test`,
    sponsorContentId: 'test-sponsor',
    sponsorName: 'Test Sponsor',
    offerLine: 'A steady deal for a rising club.',
    season: options.season,
    slot: 0,
    profile: 'STEADY' as const,
    nominalMonthlyFee: 4_200,
    objective: {
      kind: 'LEAGUE_WINS' as const,
      label: 'Win 5 league matches',
      target: 5,
      nominalBonus: 1_000,
    },
  };
  return {
    ...state,
    season: options.season,
    week: options.week,
    phase: options.phase ?? 'manage',
    m2: { ...state.m2!, highestDivisionReached: 4 },
    clubBusiness: {
      ...state.clubBusiness,
      sponsorship: {
        activeContracts: [contract],
        offers: options.withActionableOffer ? [offer] : [],
        portfolioSeason: options.season,
        offerSeason: options.season,
      },
    },
  };
}

describe('assistant guide application flow', () => {
  test('queues Sponsor Desk on the first D4 management morning, once offers are actionable', () => {
    const promotionMorning = managedSponsorCareer({
      season: 2,
      week: 1,
      withActionableOffer: true,
    });

    expect(dueAssistantInboxGuideSequences(promotionMorning)).toContain(
      'sponsor-desk',
    );
    expect(dueAssistantInboxGuideSequences(promotionMorning)).not.toContain(
      'sponsor-desk-continuity',
    );
    expect(
      dueAssistantInboxGuideSequences({
        ...promotionMorning,
        phase: 'season-end',
      }),
    ).not.toContain('sponsor-desk');
    expect(
      homeViewModel(reconcileHomeAssistantInbox(promotionMorning)).alerts,
    ).toContainEqual(
      expect.objectContaining({
        guideSequenceId: 'sponsor-desk',
        destination: 'club-finances',
      }),
    );

    const completed = completeAssistantGuideSequence(
      promotionMorning,
      'sponsor-desk',
    );
    expect(dueAssistantInboxGuideSequences(completed)).not.toContain(
      'sponsor-desk',
    );
  });

  test('queues Buzz on the first Season 3 management morning even while managed sponsors stay locked', () => {
    const fresh = createCareer(createLaunchCareerSetup(9_803));
    const seasonThreeD5: GameState = {
      ...fresh,
      season: 3,
      week: 1,
      phase: 'manage',
    };

    expect(dueAssistantInboxGuideSequences(seasonThreeD5)).toContain(
      'sponsor-buzz',
    );
    expect(dueAssistantInboxGuideSequences(seasonThreeD5)).not.toContain(
      'sponsor-desk',
    );
    expect(
      dueAssistantInboxGuideSequences({ ...seasonThreeD5, phase: 'matchday' }),
    ).not.toContain('sponsor-buzz');
  });

  test('replaces an impossible Week 5 Sponsor Desk objective with continuity copy', () => {
    const migrated = managedSponsorCareer({
      season: 3,
      week: 5,
      withActionableOffer: false,
    });
    const staleStandardGuide: GameState = {
      ...migrated,
      eventFlags: [
        ...migrated.eventFlags,
        'guide:bert:inbox:queued:sponsor-desk',
        'guide:bert:inbox:delivered:s3:w4:guide:sponsor-desk',
      ],
    };

    const repaired =
      reconcileSatisfiedAssistantGuideSequences(staleStandardGuide);

    expect(
      repaired.eventFlags.some((flag) => flag.endsWith('guide:sponsor-desk')),
    ).toBe(false);
    expect(dueAssistantInboxGuideSequences(repaired)).toContain(
      'sponsor-desk-continuity',
    );
    expect(dueAssistantInboxGuideSequences(repaired)).not.toContain(
      'sponsor-desk',
    );
    expect(
      homeViewModel(reconcileHomeAssistantInbox(repaired)).alerts,
    ).toContainEqual(
      expect.objectContaining({
        guideSequenceId: 'sponsor-desk-continuity',
        destination: 'club-finances',
      }),
    );
  });

  test('forgets a premature Sponsor Desk delivery before D4 instead of releasing Buzz early', () => {
    const fresh = createCareer(createLaunchCareerSetup(9_804));
    const exposed: GameState = {
      ...fresh,
      season: 3,
      eventFlags: [
        ...fresh.eventFlags,
        'guide:bert:inbox:queued:sponsor-desk',
        'guide:bert:inbox:delivered:s3:w1:guide:sponsor-desk',
        'guide:bert:sponsor-desk:first-delivered:s3:w1:guide:sponsor-desk',
      ],
    };
    const repaired = reconcileSatisfiedAssistantGuideSequences(exposed);
    expect(
      repaired.eventFlags.some((flag) => flag.includes('sponsor-desk')),
    ).toBe(false);

    const promoted = managedSponsorCareer({
      season: 3,
      week: 1,
      withActionableOffer: true,
    });
    const alerts = homeViewModel(
      reconcileHomeAssistantInbox({
        ...promoted,
        eventFlags: repaired.eventFlags,
      }),
    ).alerts;
    expect(alerts).toContainEqual(
      expect.objectContaining({ guideSequenceId: 'sponsor-desk' }),
    );
    expect(alerts).not.toContainEqual(
      expect.objectContaining({ guideSequenceId: 'sponsor-buzz' }),
    );
  });

  test('flags the fixture on the morning of match week, once', () => {
    let state = createCareer(createLaunchCareerSetup(932));
    state = completeAssistantGuideSequence(state, 'management-intro');
    const firstFixtureWeek = Math.min(
      ...state.fixtures
        .filter(
          (fixture) =>
            fixture.season === state.season &&
            (fixture.homeClubId === state.userClubId ||
              fixture.awayClubId === state.userClubId),
        )
        .map((fixture) => fixture.week),
    );
    // The briefing has to land on a week of its own, after the intro's.
    expect(firstFixtureWeek).toBeGreaterThan(1);

    // Quiet on the weeks between the intro and the match.
    expect(
      pendingAssistantGuideSequence(
        { ...state, week: firstFixtureWeek - 1 },
        'home',
      ),
    ).toBeNull();

    const matchWeek = { ...state, week: firstFixtureWeek };
    expect(pendingAssistantGuideSequence(matchWeek, 'home')).toBe('desk-intro');
    // Reading it retires it: this was dead content precisely because nothing
    // ever asked for it, and a briefing that reappears every match week is the
    // opposite failure.
    expect(
      pendingAssistantGuideSequence(
        completeAssistantGuideSequence(matchWeek, 'desk-intro'),
        'home',
      ),
    ).toBeNull();
  });

  test('reveals one task and one follow-up sequence at a time', () => {
    let state = createCareer(createLaunchCareerSetup(932));
    expect(pendingAssistantGuideSequence(state, 'home')).toBe(
      'management-intro',
    );
    expect(currentAssistantObjective(state, 'home')).toBeNull();

    state = completeAssistantGuideSequence(state, 'management-intro');
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'OPEN SQUAD.',
      target: 'squad-tab',
    });
    expect(pendingAssistantGuideSequence(state, 'squad')).toBeNull();
    expect(currentAssistantObjective(state, 'squad')).toEqual({
      text: 'TAP + ON A PLAYER AND TRAIN A STAT.',
      target: 'training-plan',
    });

    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    expect(currentAssistantObjective(state, 'squad')).toEqual({
      text: 'RETURN HOME.',
      target: 'home-tab',
    });
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
    expect(currentAssistantObjective(state, 'club')).toEqual({
      text: 'RETURN HOME.',
      target: 'home-tab',
    });
    expect(pendingAssistantGuideSequence(state, 'club')).toBeNull();
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();

    // Hiring the head coach is the other first-week inbox job; the desk only
    // clears once both are done.
    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };
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
    expect(
      pendingAssistantGuideSequence(staleLaterSeasonSave, 'home'),
    ).toBeNull();
    expect(currentAssistantObjective(staleLaterSeasonSave, 'home')).toBeNull();
  });

  test('treats a started Training Ground as progress and points to Advance Week', () => {
    let state = createCareer(createLaunchCareerSetup(934));
    state = completeAssistantGuideSequence(state, 'management-intro');
    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    state = buildTrainingGround(state);
    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };

    expect(state.facilities.trainingGroundBuilt).toBe(false);
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'INBOX CLEAR. ADVANCE WEEK.',
      target: 'advance-week',
    });
  });

  test('lets a save with the wrong opening project finish it before asking for the pitch again', () => {
    let state = createCareer(createLaunchCareerSetup(935));
    state = completeAssistantGuideSequence(state, 'management-intro');
    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    state = buildCareerFacility(state, 'gym', { x: 0, y: 0 }).state;
    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };

    expect(openingTrainingPitchRequired(state)).toBe(true);
    expect(currentAssistantObjective(state, 'club')).toEqual({
      text: 'RETURN HOME.',
      target: 'home-tab',
    });
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'LET THE CURRENT BUILD FINISH. ADVANCE WEEK.',
      target: 'advance-week',
    });

    let finishedGrid = state.facilities.grid!;
    while (finishedGrid.construction !== undefined) {
      finishedGrid = advanceFacilityConstruction(finishedGrid).grid;
    }
    const recoveredWeekThree = {
      ...state,
      week: 3,
      facilities: { ...state.facilities, grid: finishedGrid },
    };
    expect(dueAssistantInboxGuideSequences(recoveredWeekThree)).toEqual(
      expect.arrayContaining(['facility-placement', 'coaching-office']),
    );
    expect(outstandingInboxDuties(recoveredWeekThree)).not.toContain(
      'coaching-office',
    );
  });

  test('waits for both first-week inbox jobs before pointing to Advance Week', () => {
    let state = createCareer(createLaunchCareerSetup(936));
    state = completeAssistantGuideSequence(state, 'management-intro');
    state = completeAssistantGuideMilestone(state, 'first-training-complete');
    state = buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;

    expect(state.market?.headCoach).toBeUndefined();
    expect(pendingAssistantGuideSequence(state, 'home')).toBeNull();
    expect(currentAssistantObjective(state, 'home')).toBeNull();

    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };
    expect(currentAssistantObjective(state, 'home')).toEqual({
      text: 'INBOX CLEAR. ADVANCE WEEK.',
      target: 'advance-week',
    });
  });

  test('retires queued coach help once the hiring objective is already complete', () => {
    let state = createCareer(createLaunchCareerSetup(937));
    state = completeAssistantGuideSequence(state, 'head-coach-market');
    state = {
      ...state,
      eventFlags: [
        ...state.eventFlags,
        'guide:bert:inbox:queued:head-coach-hire',
      ],
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };

    const reconciled = reconcileSatisfiedAssistantGuideSequences(state);

    expect(dueAssistantInboxGuideSequences(reconciled)).not.toContain(
      'head-coach-hire',
    );
    expect(reconciled.eventFlags).toContain(
      'guide:bert:sequence-complete:head-coach-hire',
    );
  });

  test('saves the first facility upgrade for a quiet week after the story season', () => {
    let state = createCareer(createLaunchCareerSetup(935));
    state = buildCareerFacility(state, 'training-pitch', { x: 2, y: 0 }).state;
    state = advanceWeek(state);
    state = advanceWeek(state); // the pitch now takes two weeks to open
    state = reconcileSatisfiedAssistantGuideSequences(state);

    // The pitch opens in Week 3 of the story season, days after the player paid
    // for it. "Upgrade a facility" there reads as "build that again".
    expect(state.facilities.trainingGroundBuilt).toBe(true);
    expect(dueAssistantInboxGuideSequences(state)).not.toContain(
      'facility-upgrade',
    );

    // Season 2 opens with firsts of its own, and the upgrade queues behind all
    // of them rather than taking one of the three weekly slots.
    const seasonTwo = { ...state, season: 2 };
    expect(dueAssistantInboxGuideSequences(seasonTwo)).not.toContain(
      'facility-upgrade',
    );
    const quietWeek = clearOtherGuideFirsts(seasonTwo);
    expect(dueAssistantInboxGuideSequences(quietWeek)).toEqual([
      'facility-upgrade',
    ]);

    // Nothing left to teach once every building sits at the current ceiling.
    const atCeiling = {
      ...quietWeek,
      facilities: {
        ...quietWeek.facilities,
        grid: {
          ...quietWeek.facilities.grid!,
          buildings: quietWeek.facilities.grid!.buildings.map((building) => ({
            ...building,
            level: 2 as const,
          })),
        },
      },
    };
    expect(dueAssistantInboxGuideSequences(atCeiling)).not.toContain(
      'facility-upgrade',
    );
  });

  test('strips an upgrade lesson a story-season save was already handed', () => {
    let state = createCareer(createLaunchCareerSetup(938));
    state = buildCareerFacility(state, 'training-pitch', { x: 2, y: 0 }).state;
    state = advanceWeek(state);
    state = advanceWeek(state);
    const weekThreeSave = {
      ...state,
      eventFlags: [
        ...state.eventFlags,
        'guide:bert:inbox:queued:facility-upgrade',
        'guide:bert:inbox:delivered:s1:w3:guide:facility-upgrade',
      ],
    };

    const repaired = reconcileSatisfiedAssistantGuideSequences(weekThreeSave);

    expect(
      repaired.eventFlags.some((flag) => flag.includes('facility-upgrade')),
    ).toBe(false);
  });

  test('keeps the upgrade card off a desk that already has real work on it', () => {
    let state = createCareer(createLaunchCareerSetup(939));
    state = buildCareerFacility(state, 'training-pitch', { x: 2, y: 0 }).state;
    state = advanceWeek(state);
    state = advanceWeek(state);
    state = clearOtherGuideFirsts({ ...state, season: 2 });

    const upgradeCard = expect.objectContaining({
      guideSequenceId: 'facility-upgrade',
    });
    expect(
      homeViewModel(reconcileHomeAssistantInbox(state)).alerts,
    ).toContainEqual(upgradeCard);

    const injured = {
      ...state,
      players: state.players.map((player, index) =>
        player.clubId === state.userClubId && index === 0
          ? { ...player, injuryWeeks: 2 }
          : player,
      ),
    };
    expect(
      homeViewModel(reconcileHomeAssistantInbox(injured)).alerts,
    ).not.toContainEqual(upgradeCard);
  });

  it('offers Youth Intake in Week 2 and delays the Coaching Office prompt until Week 3', () => {
    let state = createCareer(createLaunchCareerSetup(415));
    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };

    const weekTwo = reconcileStoryYouthIntake({
      ...withOneRosterSpace(state),
      week: 2,
    });
    expect(weekTwo.youthIntake).toMatchObject({ status: 'OPEN' });
    expect(dueAssistantInboxGuideSequences(weekTwo)).toContain('youth-intake');
    expect(dueAssistantInboxGuideSequences(weekTwo)).not.toContain(
      'coaching-office',
    );

    const repairedWeekTwo = reconcileSatisfiedAssistantGuideSequences({
      ...weekTwo,
      eventFlags: [
        ...weekTwo.eventFlags,
        'guide:bert:inbox:queued:coaching-office',
        'guide:bert:inbox:delivered:s1:w2:guide:coaching-office',
      ],
    });
    expect(
      repairedWeekTwo.eventFlags.some((flag) =>
        flag.includes('coaching-office'),
      ),
    ).toBe(false);

    const afterYouth = completeAssistantGuideSequence(
      repairedWeekTwo,
      'youth-intake',
    );
    expect(dueAssistantInboxGuideSequences(afterYouth)).toContain(
      'youth-intake',
    );
    const signedYouth = signYouthIntakeOffer(
      afterYouth,
      afterYouth.youthIntake!,
      afterYouth.youthIntake!.offers[0].player.id,
    );
    const weekThree = {
      ...signedYouth.state,
      youthIntake: signedYouth.intake,
      week: 3,
    };
    expect(dueAssistantInboxGuideSequences(weekThree)).toContain(
      'coaching-office',
    );
    expect(dueAssistantInboxGuideSequences(weekThree)).not.toContain(
      'youth-intake',
    );
  });

  it('holds the week open for the opening inbox duties and lets it go afterwards', () => {
    let state = createCareer(createLaunchCareerSetup(415));
    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };

    // Reading Bert's card is not the task. The Training Pitch remains owed
    // until its construction starts.
    expect(dueAssistantInboxGuideSequences(state)).toContain(
      'facility-placement',
    );
    expect(outstandingInboxDuties(state)).toEqual(['facility-placement']);

    state = completeOpeningPitch(state);
    const weekTwo = reconcileStoryYouthIntake({
      ...withOneRosterSpace(state),
      week: 2,
    });
    expect(outstandingInboxDuties(weekTwo)).toEqual(['youth-intake']);

    // Dismissing Bert's briefing is not a signing and does not clear the job.
    const afterYouth = completeAssistantGuideSequence(weekTwo, 'youth-intake');
    expect(outstandingInboxDuties(afterYouth)).toEqual(['youth-intake']);

    const youthSigning = signYouthIntakeOffer(
      afterYouth,
      afterYouth.youthIntake!,
      afterYouth.youthIntake!.offers[0].player.id,
    );
    const signedYouth = {
      ...youthSigning.state,
      youthIntake: youthSigning.intake,
    };
    expect(outstandingInboxDuties(signedYouth)).toEqual([]);

    const weekThree = { ...signedYouth, week: 3 };
    expect(outstandingInboxDuties(weekThree)).toEqual(['coaching-office']);

    // Starting construction clears it — the building joins the grid at once,
    // which is what the desk reads. Finishing it is not required.
    const building = buildCareerFacility(weekThree, 'coaching-office', {
      x: 1,
      y: 4,
    }).state;
    expect(outstandingInboxDuties(building)).toEqual([]);

    // Week 4 onwards the desk is the manager's own business.
    expect(
      outstandingInboxDuties({ ...weekThree, week: LAST_GATED_INBOX_WEEK + 1 }),
    ).toEqual([]);
    // The Cup card is a later Must Do, so it remains blocking whenever its
    // guide is due; unlike the three opening jobs, a season change does not
    // silently retire it.
    expect(outstandingInboxDuties({ ...weekThree, season: 2 })).toEqual([
      'national-cup',
    ]);
    expect(
      outstandingInboxDuties({
        ...completeAssistantGuideSequence(weekThree, 'national-cup'),
        season: 2,
      }),
    ).toEqual([]);
  });

  it('does not resurrect an unusable Youth card in an older declined save', () => {
    let state = createCareer(createLaunchCareerSetup(416));
    state = {
      ...completeOpeningPitch(state),
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
      week: 2,
    };
    state = reconcileStoryYouthIntake(withOneRosterSpace(state));
    state = completeAssistantGuideSequence(state, 'youth-intake');
    const declined = declineYouthIntakeOffers(state, state.youthIntake!);
    const oldSave = reconcileSatisfiedAssistantGuideSequences({
      ...declined.state,
      youthIntake: declined.intake,
    });

    expect(dueAssistantInboxGuideSequences(oldSave)).not.toContain(
      'youth-intake',
    );
    expect(outstandingInboxDuties(oldSave)).toEqual([]);
  });

  it('never holds the week open for a duty the club cannot pay for', () => {
    let state = createCareer(createLaunchCareerSetup(415));
    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };
    state = { ...completeOpeningPitch(state), week: 3 };
    expect(outstandingInboxDuties(state)).toContain('coaching-office');

    // A club that cannot afford the office has no way to earn until the week
    // moves, so the gate must let go rather than end the career on a locked
    // button. Fail-soft, like the rest of the economy. The duty stays on the
    // desk — it is still the job — it just stops holding the clock.
    const broke = {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId
          ? { ...club, cash: FACILITY_CATALOG['coaching-office'].buildCost - 1 }
          : club,
      ),
    };
    expect(dueAssistantInboxGuideSequences(broke)).toContain('coaching-office');
    expect(outstandingInboxDuties(broke)).not.toContain('coaching-office');
  });

  it('keeps the Training Pitch objective unfinished until construction completes', () => {
    let state = createCareer(createLaunchCareerSetup(413));
    expect(state.facilities.grid?.buildings).toHaveLength(0);
    expect(dueAssistantInboxGuideSequences(state)).toContain(
      'facility-placement',
    );

    state = completeAssistantGuideSequence(state, 'facility-placement');
    expect(
      hasAssistantGuideSequenceCompleted(state, 'facility-placement'),
    ).toBe(false);

    state = buildCareerFacility(state, 'training-pitch', { x: 4, y: 2 }).state;
    expect(dueAssistantInboxGuideSequences(state)).not.toContain(
      'facility-placement',
    );
    expect(
      hasAssistantGuideSequenceCompleted(state, 'facility-placement'),
    ).toBe(false);

    state = advanceWeek(state);
    state = reconcileSatisfiedAssistantGuideSequences(state);
    expect(state.facilities.trainingGroundBuilt).toBe(false);
    expect(
      hasAssistantGuideSequenceCompleted(state, 'facility-placement'),
    ).toBe(false);

    state = advanceWeek(state);
    state = reconcileSatisfiedAssistantGuideSequences(state);
    expect(state.facilities.trainingGroundBuilt).toBe(true);
    expect(
      hasAssistantGuideSequenceCompleted(state, 'facility-placement'),
    ).toBe(true);
  });

  it('waits until the Coaching Office opens before offering assistant-coach hiring', () => {
    let state = createCareer(createLaunchCareerSetup(414));
    state = {
      ...state,
      market: hireCareerCoach(
        state,
        state.market!,
        state.market!.coachCandidates[0].id,
      ),
    };
    state = buildCareerFacility(state, 'coaching-office', { x: 2, y: 0 }).state;

    expect(state.facilities.grid?.construction?.type).toBe('coaching-office');
    expect(dueAssistantInboxGuideSequences(state)).not.toContain(
      'assistant-coach-hire',
    );

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
    expect(
      repaired.eventFlags.some((flag) => flag.includes('assistant-coach-hire')),
    ).toBe(false);
    const repairedLaterSeason = reconcileSatisfiedAssistantGuideSequences({
      ...premature,
      season: 2,
    });
    expect(
      repairedLaterSeason.eventFlags.some((flag) =>
        flag.includes('assistant-coach-hire'),
      ),
    ).toBe(false);

    state = advanceWeek(repaired);
    state = reconcileSatisfiedAssistantGuideSequences(state);

    expect(state.facilities.grid?.construction).toBeUndefined();
    expect(dueAssistantInboxGuideSequences(state)).toContain(
      'assistant-coach-hire',
    );

    const scheduled = reconcileHomeAssistantInbox(state);
    expect(homeViewModel(scheduled).alerts).toContainEqual(
      expect.objectContaining({
        guideSequenceId: 'assistant-coach-hire',
        destination: 'coach-market',
      }),
    );
  });

  test('opens the division leaders briefing when the boards themselves open', () => {
    const drawn = createCareer(createLaunchCareerSetup(551));
    const noCup: GameState = {
      ...drawn,
      m2: { ...drawn.m2!, nationalCups: [] },
    };
    const firstCupWeek = CUP_SETTLEMENT_WEEKS[0];

    // A career with no cup drawn has no leaders tab and must never be sent to
    // one, however late the season gets.
    expect(
      dueAssistantInboxGuideSequences({ ...noCup, week: firstCupWeek + 3 }),
    ).not.toContain('division-leaders');
    expect(
      dueAssistantInboxGuideSequences({ ...drawn, week: firstCupWeek + 2 }),
    ).not.toContain('division-leaders');

    const unlocked = { ...drawn, week: firstCupWeek + 3 };
    expect(dueAssistantInboxGuideSequences(unlocked)).toContain(
      'division-leaders',
    );
    // Reading it retires it, on the same completion flag as every other first.
    expect(
      dueAssistantInboxGuideSequences(
        completeAssistantGuideSequence(unlocked, 'division-leaders'),
      ),
    ).not.toContain('division-leaders');
  });

  test('sends the delivered division leaders card to the leaders board', () => {
    const firstCupWeek = CUP_SETTLEMENT_WEEKS[0];
    let state: GameState = {
      ...createCareer(createLaunchCareerSetup(551)),
      week: firstCupWeek + 3,
    };
    // Only three cards reach a desk in a week, so the older firsts are read
    // off it first — otherwise this asserts the tranche, not the routing.
    for (
      let pass = 0;
      pass < M2_ASSISTANT_GUIDE_SEQUENCE_IDS.length;
      pass += 1
    ) {
      const others = dueAssistantInboxGuideSequences(state).filter(
        (sequenceId) => sequenceId !== 'division-leaders',
      );
      if (others.length === 0) break;
      for (const sequenceId of others) {
        state = completeAssistantGuideSequence(state, sequenceId);
      }
    }

    const scheduled = reconcileHomeAssistantInbox(state);
    expect(homeViewModel(scheduled).alerts).toContainEqual(
      expect.objectContaining({
        guideSequenceId: 'division-leaders',
        destination: 'league-leaders',
      }),
    );
  });
});
