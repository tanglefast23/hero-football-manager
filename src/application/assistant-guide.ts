import {
  assistantTeaches,
  boardUltimatumConsequence,
  hasAssistantGuideSequenceCompleted,
  hasAssistantGuideMilestone,
  highestDivisionReached,
  careerRosterCapacity,
  buildCareerFacility,
  hireCareerCoach,
  signYouthIntakeOffer,
  completeAssistantGuideSequence,
  deferAssistantGuideSequencesUntilUnlock,
  isDivisionLeadersUnlocked,
  isFacilityOperational,
  isStoryCupGuideUnlocked,
  isStoryFeaturePacingActive,
  isStoryScoutingUnlocked,
  isStoryYouthUnlocked,
  maxCareerFacilityLevel,
  STORY_COACHING_OFFICE_GUIDE_WEEK,
  type AssistantInboxGuideSequenceId,
  type AssistantGuideSequenceId,
  type GameState,
} from '../game';
import { isTransferWindowOpen } from '../game/market';
import { SPONSOR_OFFER_LAST_WEEK } from '../game/sponsors';
import type { ManagementTab } from '../ui/models';

export interface AssistantObjective {
  text: string;
  target:
    | 'home-tab'
    | 'squad-tab'
    | 'training-plan'
    | 'training-ground-alert'
    | 'training-ground-facility'
    | 'advance-week';
}

export function pendingAssistantGuideSequence(
  state: GameState,
  _activeTab: ManagementTab,
): AssistantGuideSequenceId | null {
  if (!assistantTeaches(state)) return null;
  if (isFirstCareerWeek(state)) {
    return hasAssistantGuideMilestone(state, 'intro-complete')
      ? null
      : 'management-intro';
  }
  if (
    isFirstFixtureWeek(state) &&
    !hasAssistantGuideMilestone(state, 'desk-intro-complete')
  ) {
    return 'desk-intro';
  }
  return null;
}

/**
 * True on the morning the first fixture's week opens — the last week training
 * can still change that result, and so the only week Bert's "train up before
 * you head in" is actionable. Derived from the fixture rather than a literal
 * week 3, so a schedule change moves the briefing with the match.
 */
function isFirstFixtureWeek(state: GameState): boolean {
  let earliestWeek: number | undefined;
  for (const fixture of state.fixtures) {
    if (fixture.season !== state.season) continue;
    if (
      fixture.homeClubId !== state.userClubId &&
      fixture.awayClubId !== state.userClubId
    )
      continue;
    if (earliestWeek === undefined || fixture.week < earliestWeek)
      earliestWeek = fixture.week;
  }
  return earliestWeek !== undefined && earliestWeek === state.week;
}

/**
 * Finds newly relevant M2 "firsts" without marking them read. The queue layer
 * persists these IDs and the weekly scheduler decides which three reach the
 * desk now. Progressions are deliberately sequential: Bert explains the coach
 * market before asking for a hire, and the board deadline before protection.
 */
export function dueAssistantInboxGuideSequences(
  state: GameState,
): AssistantInboxGuideSequenceId[] {
  if (state.market === undefined || state.m2 === undefined) {
    return [];
  }

  const due: AssistantInboxGuideSequenceId[] = [];
  const completed = (sequenceId: AssistantInboxGuideSequenceId) =>
    hasAssistantGuideSequenceCompleted(state, sequenceId);
  const grid = state.facilities.grid;
  const buildings = grid?.buildings ?? [];
  const hasCoachingOffice = buildings.some(
    (building) => building.type === 'coaching-office',
  );
  const hasOperationalCoachingOffice =
    grid !== undefined &&
    buildings.some(
      (building) =>
        building.type === 'coaching-office' &&
        isFacilityOperational(grid, building.id),
    );
  const scoutingUnlocked =
    isStoryScoutingUnlocked(state) ||
    state.market.activeScoutMission !== undefined ||
    state.market.scoutReports.length > 0;
  const rosterFull =
    state.players.filter((player) => player.clubId === state.userClubId)
      .length >= careerRosterCapacity(state);
  const playerSalesUnlocked =
    !isStoryFeaturePacingActive(state) || (scoutingUnlocked && rosterFull);

  if (state.phase === 'manage') {
    if (highestDivisionReached(state) <= 4 && !completed('sponsor-desk')) {
      due.push(sponsorDeskGuideForState(state));
    }
    if (state.season >= 3) due.push('sponsor-buzz');
  }

  if (state.market.headCoach === undefined) {
    due.push(
      completed('head-coach-market') ? 'head-coach-hire' : 'head-coach-market',
    );
  } else if (
    !hasCoachingOffice &&
    (!isStoryFeaturePacingActive(state) ||
      state.week >= STORY_COACHING_OFFICE_GUIDE_WEEK)
  ) {
    due.push('coaching-office');
  } else if (
    hasOperationalCoachingOffice &&
    state.market.assistantCoach === undefined
  ) {
    due.push('assistant-coach-hire');
  }

  if (
    isStoryYouthUnlocked(state) &&
    state.youthIntake?.status === 'OPEN' &&
    state.youthIntake.offers.length > 0
  ) {
    due.push('youth-intake');
  }

  const operationalTrainingPitch =
    grid === undefined
      ? state.facilities.trainingGroundBuilt
      : buildings.some(
          (building) =>
            building.type === 'training-pitch' &&
            isFacilityOperational(grid, building.id),
        );
  const trainingPitchUnderConstruction =
    grid?.construction?.kind === 'BUILD' &&
    grid.construction.type === 'training-pitch';
  const upgradeReachable =
    operationalTrainingPitch &&
    completed('facility-placement') &&
    grid?.construction === undefined &&
    buildings.some(
      (building) => building.level < maxCareerFacilityLevel(state),
    );
  if (!operationalTrainingPitch && !trainingPitchUnderConstruction) {
    due.push('facility-placement');
  }

  if (scoutingUnlocked) {
    if (state.market.scoutReports.length > 0) {
      due.push('scout-report');
    } else if (state.market.activeScoutMission === undefined) {
      due.push('scout-mission');
    }
  }

  const listings = state.market.transferListings ?? [];
  if (state.market.transferTalks !== undefined) {
    due.push('transfer-negotiation');
  } else if (
    !listings.some((listing) => listing.bids.length > 0) &&
    playerSalesUnlocked &&
    isTransferWindowOpen(state.week)
  ) {
    due.push(
      isStoryFeaturePacingActive(state) ? 'roster-cap' : 'transfer-list',
    );
  }

  if (state.m2.nationalCups.length > 0 && isStoryCupGuideUnlocked(state)) {
    due.push('national-cup');
  }

  // The same derivation the League screen's sub-tab list reads, so the boards
  // are always there by the time Bert points at them.
  if (
    isDivisionLeadersUnlocked(state.m2.nationalCups, state.season, state.week)
  ) {
    due.push('division-leaders');
  }

  // Teach Requests only when the first real request is already waiting. The
  // calendar unlock alone can leave Bert explaining an empty page for weeks.
  if (state.playerRequests?.pending !== undefined) {
    due.push('player-requests');
  }

  if (
    state.players.some(
      (player) => player.clubId === state.userClubId && player.injuryWeeks > 0,
    )
  ) {
    due.push('first-injury');
  }
  if (
    state.financialSafety?.loan !== undefined &&
    state.financialSafety.loan.remainingBalance > 0
  ) {
    due.push('first-emergency-loan');
  }
  if (
    state.players.some(
      (player) =>
        player.clubId === state.userClubId && player.transferRequested === true,
    )
  ) {
    due.push('first-transfer-request');
  }

  const retirementVisible = (state.retirementAnnouncements ?? []).some(
    (announcement) => announcement.announcedInSeason === state.season - 1,
  );
  if (retirementVisible) due.push('retirement');
  if ((state.pendingLegacyPlayerIds?.length ?? 0) > 0) due.push('club-legacy');

  if (state.financialSafety?.boardUltimatum !== undefined) {
    due.push(
      boardUltimatumConsequence(state.financialSafety.boardUltimatum) ===
        'FACILITY_CONVERSION'
        ? 'board-ultimatum'
        : 'board-protection',
    );
  }

  const pending = due.filter((sequenceId) => {
    if (!completed(sequenceId)) return true;
    const duty = openingInboxDutyForGuideSequence(sequenceId);
    return (
      assistantTeaches(state) &&
      state.season === 1 &&
      state.week <= LAST_GATED_INBOX_WEEK &&
      duty !== undefined &&
      isOpeningInboxDutyIncomplete(state, duty) &&
      isInboxDutyCompletable(state, duty)
    );
  });

  /*
   * The upgrade lesson is the only guide nothing is waiting on: the pitch
   * already works, and levelling it is a choice the club can make any week.
   * Taught the week the first pitch opened it read as "you just built that —
   * build it again", so it holds until the story season is over (which is also
   * the only cheap proof the grounds have been standing a while) and until the
   * desk has no other first on it. Product alerts are checked where they are
   * built, one ring out.
   */
  if (
    upgradeReachable &&
    pending.length === 0 &&
    !isStoryFeaturePacingActive(state) &&
    !completed('facility-upgrade')
  ) {
    pending.push('facility-upgrade');
  }
  return pending;
}

/**
 * The four blue desk jobs that hold the opening weeks open.
 *
 * Three rules decide what may be on this list, and between them they exclude
 * most of the inbox.
 *
 * It must have a completion out in the world. Bert's explainers — the coach
 * market, the cup format, the league boards — have nothing to finish, so
 * gating on one would hold the week shut with no way to open it.
 *
 * Completion must be a durable game fact. Reading Bert is never completion,
 * and declining the opening youth choice is not the requested signing.
 *
 * It must also be completable *this week*. A duty the club cannot pay for,
 * place, or fit in the roster would otherwise trap a career with no way to
 * earn or make space until the clock moves.
 */
export type OpeningInboxDutyId =
  | 'facility-placement'
  | 'head-coach-market'
  | 'youth-intake'
  | 'coaching-office'
  | 'assistant-coach-hire'
  | 'national-cup';

const BLOCKING_INBOX_DUTIES: readonly OpeningInboxDutyId[] = [
  'facility-placement',
  'head-coach-market',
  'youth-intake',
  'coaching-office',
  'assistant-coach-hire',
  'national-cup',
];

const LATER_MUST_DO_DUTIES = new Set<OpeningInboxDutyId>([
  'assistant-coach-hire',
  'national-cup',
]);

/** One durable job ID even when the coach lesson moves to its second briefing. */
export function openingInboxDutyForGuideSequence(
  sequenceId: AssistantInboxGuideSequenceId,
): OpeningInboxDutyId | undefined {
  if (sequenceId === 'head-coach-hire') return 'head-coach-market';
  return BLOCKING_INBOX_DUTIES.find((duty) => duty === sequenceId);
}

export function isOpeningInboxDutyIncomplete(
  state: GameState,
  duty: OpeningInboxDutyId | undefined,
): boolean {
  if (duty === undefined) return false;
  if (duty === 'facility-placement') {
    return !(
      state.facilities.trainingGroundBuilt ||
      (state.facilities.grid?.buildings.some(
        (building) => building.type === 'training-pitch',
      ) ??
        false)
    );
  }
  if (duty === 'head-coach-market') {
    return state.market?.headCoach === undefined;
  }
  if (duty === 'youth-intake') {
    return (state.youthIntake?.signedPlayerIds.length ?? 0) === 0;
  }
  if (duty === 'assistant-coach-hire') {
    return state.market?.assistantCoach === undefined;
  }
  if (duty === 'national-cup') {
    return !hasAssistantGuideSequenceCompleted(state, 'national-cup');
  }
  return !(
    state.facilities.grid?.buildings.some(
      (building) => building.type === 'coaching-office',
    ) ?? false
  );
}

export const OPENING_TRAINING_PITCH_BLOCKED_REASON_KEY =
  'clubFinances.a11y.buildTheTrainingPitchFirst';
export const OPENING_TRAINING_PITCH_REMINDER_KEY =
  'clubFinances.openingTrainingPitchReminder';

/**
 * The opening build is part of the Teacher path, not a momentary arrow state.
 * Keeping the rule in career data means dismissing the cue, changing tabs, or
 * reopening a save cannot expose another first project. Once a pitch has been
 * started the works crew is the ordinary gate; once the lesson has completed,
 * closing that pitch later does not restart onboarding.
 */
export function openingTrainingPitchRequired(state: GameState): boolean {
  if (!assistantTeaches(state)) return false;
  if (hasAssistantGuideSequenceCompleted(state, 'facility-placement'))
    return false;
  if (state.facilities.trainingGroundBuilt) return false;
  return !(
    state.facilities.grid?.buildings.some(
      (building) => building.type === 'training-pitch',
    ) ?? false
  );
}

/**
 * Whether the club could actually clear this duty right now.
 *
 * The pure transactions are the authority. They include cash, eligibility,
 * roster space, the works crew, the building footprint, and the pitch-first
 * rule. Trying them against the immutable state keeps this check aligned with
 * the button without duplicating all those rules here.
 */
function isInboxDutyCompletable(
  state: GameState,
  duty: OpeningInboxDutyId,
): boolean {
  if (
    duty === 'coaching-office' &&
    state.week < STORY_COACHING_OFFICE_GUIDE_WEEK
  ) {
    return false;
  }
  if (duty === 'head-coach-market') {
    if (state.market === undefined) return false;
    return state.market.coachCandidates.some((candidate) => {
      try {
        hireCareerCoach(state, state.market!, candidate.id, 'HEAD');
        return true;
      } catch {
        return false;
      }
    });
  }
  if (duty === 'youth-intake') {
    const intake = state.youthIntake;
    if (intake?.status !== 'OPEN') return false;
    return intake.offers.some((offer) => {
      try {
        signYouthIntakeOffer(state, intake, offer.player.id);
        return true;
      } catch {
        return false;
      }
    });
  }
  if (duty === 'assistant-coach-hire') {
    if (state.market === undefined) return false;
    return state.market.coachCandidates.some((candidate) => {
      try {
        hireCareerCoach(state, state.market!, candidate.id, 'ASSISTANT');
        return true;
      } catch {
        return false;
      }
    });
  }
  if (duty === 'national-cup') return true;

  // A wrong opening project in an older save must be allowed to finish. A job
  // which cannot use the one works crew must not deadlock Advance Week.
  if (state.facilities.grid?.construction !== undefined) return false;
  const type =
    duty === 'facility-placement' ? 'training-pitch' : 'coaching-office';
  if (type === 'coaching-office' && openingTrainingPitchRequired(state)) {
    return false;
  }
  for (let y = 0; y < 6; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      try {
        buildCareerFacility(state, type, { x, y });
        return true;
      } catch {
        // Try the next square. The pure transaction does not change `state`.
      }
    }
  }
  return false;
}

/**
 * The last week an unfinished duty stops the clock.
 *
 * Long enough to cover the opening's own assignments — the youth intake opens
 * in week 2 and the coaching office in week 3 — and no longer. By week 4 the
 * manager has been shown what a desk job looks like and what happens when one
 * is left; after that, ignoring the desk is a decision they are allowed to make
 * and live with, which is the whole shape of this game's economy.
 */
export const LAST_GATED_INBOX_WEEK = 3;

/**
 * The duties still owed this week, or none once the opening is over.
 *
 * A duty disappears only when its real result exists: the two buildings clear
 * when construction starts, the coach clears on hire, and Youth clears only
 * after a successful signing. A briefing flag cannot alter this list.
 */
export function outstandingInboxDuties(state: GameState): OpeningInboxDutyId[] {
  if (!assistantTeaches(state)) return [];
  const dueDuties = new Set(
    dueAssistantInboxGuideSequences(state)
      .map(openingInboxDutyForGuideSequence)
      .filter((duty): duty is OpeningInboxDutyId => duty !== undefined),
  );
  return BLOCKING_INBOX_DUTIES.filter(
    (duty) =>
      (LATER_MUST_DO_DUTIES.has(duty)
        ? dueDuties.has(duty)
        : state.season === 1 && state.week <= LAST_GATED_INBOX_WEEK) &&
      isOpeningInboxDutyIncomplete(state, duty) &&
      isInboxDutyCompletable(state, duty),
  );
}

/**
 * Removes coach tutorials whose objective was already completed directly.
 * This also heals saves where the follow-up was queued between opening the
 * market and signing the coach, so Bert never asks for a hire that exists.
 */
export function reconcileSatisfiedAssistantGuideSequences(
  state: GameState,
): GameState {
  let next = state;
  // The listing lesson already explains bids, cash, and wage removal. Retire
  // the old follow-up and heal saves that still have it queued or delivered.
  next = deferAssistantGuideSequencesUntilUnlock(next, ['transfer-bid']);
  next = completeAssistantGuideSequence(next, 'transfer-bid');
  if (state.market?.headCoach !== undefined) {
    next = completeAssistantGuideSequence(next, 'head-coach-market');
    next = completeAssistantGuideSequence(next, 'head-coach-hire');
  }

  const grid = state.facilities.grid;
  const hasCoachingOffice =
    grid?.buildings.some((building) => building.type === 'coaching-office') ??
    false;
  const hasOperationalCoachingOffice =
    grid?.buildings.some(
      (building) =>
        building.type === 'coaching-office' &&
        isFacilityOperational(grid, building.id),
    ) ?? false;
  const hasOperationalTrainingPitch =
    grid === undefined
      ? state.facilities.trainingGroundBuilt
      : grid.buildings.some(
          (building) =>
            building.type === 'training-pitch' &&
            isFacilityOperational(grid, building.id),
        );
  const hasStartedTrainingPitch =
    state.facilities.trainingGroundBuilt ||
    (grid?.buildings.some((building) => building.type === 'training-pitch') ??
      false);
  if (hasStartedTrainingPitch) {
    next = completeAssistantGuideSequence(next, 'facility-placement');
  }
  if (hasCoachingOffice)
    next = completeAssistantGuideSequence(next, 'coaching-office');
  if (state.market?.assistantCoach !== undefined) {
    next = completeAssistantGuideSequence(next, 'assistant-coach-hire');
  }
  if (
    (state.youthIntake?.signedPlayerIds.length ?? 0) > 0 ||
    state.youthIntake?.declined === true
  ) {
    next = completeAssistantGuideSequence(next, 'youth-intake');
  }
  if (
    state.market?.activeScoutMission !== undefined ||
    (state.market?.scoutReports.length ?? 0) > 0
  ) {
    next = completeAssistantGuideSequence(next, 'scout-mission');
  }

  const premature: AssistantInboxGuideSequenceId[] = [];
  if (!hasOperationalCoachingOffice) premature.push('assistant-coach-hire');
  if (highestDivisionReached(next) > 4) {
    premature.push('sponsor-desk', 'sponsor-desk-continuity');
  } else if (!hasAssistantGuideSequenceCompleted(next, 'sponsor-desk')) {
    const activeVariant = sponsorDeskGuideForState(next);
    premature.push(
      activeVariant === 'sponsor-desk'
        ? 'sponsor-desk-continuity'
        : 'sponsor-desk',
    );
  }
  if (next.season < 3) premature.push('sponsor-buzz');
  if (
    next.playerRequests?.pending === undefined &&
    !hasAssistantGuideSequenceCompleted(next, 'player-requests')
  ) {
    // Repairs saves which queued the old calendar-based lesson before a player
    // had asked for anything. It will queue again with the first real request.
    premature.push('player-requests');
  }
  if (!isStoryFeaturePacingActive(next)) {
    return deferAssistantGuideSequencesUntilUnlock(next, premature);
  }
  if (!hasCoachingOffice && next.week < STORY_COACHING_OFFICE_GUIDE_WEEK) {
    premature.push('coaching-office');
  }
  // Heals the saves that were handed the upgrade lesson days after paying for
  // their first build. It returns on its own once the story season is over.
  premature.push('facility-upgrade');
  if (!isStoryYouthUnlocked(next)) premature.push('youth-intake');
  if (!isStoryCupGuideUnlocked(next)) premature.push('national-cup');
  if (
    !isStoryScoutingUnlocked(next) &&
    next.market?.activeScoutMission === undefined &&
    (next.market?.scoutReports.length ?? 0) === 0
  ) {
    premature.push(
      'scout-mission',
      'scout-report',
      'roster-cap',
      'transfer-list',
      'transfer-negotiation',
    );
  }
  return deferAssistantGuideSequencesUntilUnlock(next, premature);
}

function sponsorDeskGuideForState(
  state: GameState,
): 'sponsor-desk' | 'sponsor-desk-continuity' {
  const hasActionableOffer =
    state.week <= SPONSOR_OFFER_LAST_WEEK &&
    state.clubBusiness.sponsorship.offers.some(
      (offer) => offer.season === state.season,
    );
  return hasActionableOffer ? 'sponsor-desk' : 'sponsor-desk-continuity';
}

export function currentAssistantObjective(
  state: GameState,
  activeTab: ManagementTab,
): AssistantObjective | null {
  if (!assistantTeaches(state)) return null;
  if (!isFirstCareerWeek(state)) return null;
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) return null;
  if (!hasAssistantGuideMilestone(state, 'first-training-complete')) {
    if (activeTab === 'squad') {
      return {
        text: 'TAP + ON A PLAYER AND TRAIN A STAT.',
        target: 'training-plan',
      };
    }
    return { text: 'OPEN SQUAD.', target: 'squad-tab' };
  }
  const currentProject = state.facilities.grid?.construction;
  if (
    openingTrainingPitchRequired(state) &&
    currentProject !== undefined &&
    currentProject.type !== 'training-pitch'
  ) {
    if (activeTab === 'home') {
      return {
        text: 'LET THE CURRENT BUILD FINISH. ADVANCE WEEK.',
        target: 'advance-week',
      };
    }
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (
    !state.facilities.trainingGroundBuilt &&
    !isTrainingGroundUnderConstruction(state)
  ) {
    if (activeTab === 'home') {
      return { text: 'CHECK YOUR INBOX.', target: 'training-ground-alert' };
    }
    if (activeTab === 'club') {
      return {
        text: 'BUILD YOUR TRAINING PITCH.',
        target: 'training-ground-facility',
      };
    }
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (state.market !== undefined && state.market.headCoach === undefined) {
    if (activeTab !== 'home') {
      return { text: 'RETURN HOME.', target: 'home-tab' };
    }
    return null;
  }
  if (!hasAssistantGuideMilestone(state, 'first-week-advanced')) {
    return { text: 'INBOX CLEAR. ADVANCE WEEK.', target: 'advance-week' };
  }
  return null;
}

function isTrainingGroundUnderConstruction(state: GameState): boolean {
  return (
    state.facilities.grid?.construction?.kind === 'BUILD' &&
    state.facilities.grid.construction.type === 'training-pitch'
  );
}

function isFirstCareerWeek(state: Pick<GameState, 'season' | 'week'>): boolean {
  return state.season === 1 && state.week === 1;
}
