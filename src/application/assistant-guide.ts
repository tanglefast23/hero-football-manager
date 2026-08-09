import {
  assistantTeaches,
  hasAssistantGuideSequenceCompleted,
  hasAssistantGuideMilestone,
  highestDivisionReached,
  careerRosterCapacity,
  completeAssistantGuideSequence,
  deferAssistantGuideSequencesUntilUnlock,
  FACILITY_CATALOG,
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
  } else if (listings.some((listing) => listing.bids.length > 0)) {
    due.push('transfer-bid');
  } else if (playerSalesUnlocked && isTransferWindowOpen(state.week)) {
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

  // The week the Requests tab appears. Gated on the same baked catalog the tab
  // itself reads, so a career that never received one — a measurement harness —
  // is never told about a feature it does not have.
  const requestTuning = state.playerRequestRules?.tuning;
  if (
    requestTuning !== undefined &&
    (state.season > requestTuning.startSeason ||
      (state.season === requestTuning.startSeason &&
        state.week >= requestTuning.startWeek))
  ) {
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
      completed('board-ultimatum') ? 'board-protection' : 'board-ultimatum',
    );
  }

  const pending = due.filter((sequenceId) => !completed(sequenceId));

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
 * The desk jobs that hold the week open: the opening's two assigned tasks.
 *
 * Three rules decide what may be on this list, and between them they exclude
 * most of the inbox.
 *
 * It must have a completion out in the world. Bert's explainers — the coach
 * market, the cup format, the league boards — have nothing to finish, so
 * gating on one would hold the week shut with no way to open it.
 *
 * It must not wall the first press of the career. `facility-placement` is a
 * real duty by the first test and is still deliberately absent: the training
 * pitch is already due in week 1 and stays due until it is built, so blocking
 * on it would refuse the opening Advance Week of every new career. Week 1 asks
 * for the pitch through the objective line instead, which is the gentler
 * instrument and the one the opening was written around.
 *
 * It must be completable *this week* — see `affordable` below. A duty the club
 * cannot pay for would otherwise trap a career that has no way to earn until
 * the week moves, and nothing in this game is allowed to end that way.
 */
const BLOCKING_INBOX_DUTIES: readonly AssistantInboxGuideSequenceId[] = [
  'coaching-office',
  'youth-intake',
];

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
 * The youth intake is always answerable — declining closes it and costs
 * nothing — so only the build has availability to check. Cash, the one works
 * crew, and the opening Training Pitch rule all have to permit the office, so
 * the week gate lifts whenever the button it points at would refuse.
 */
function isInboxDutyAffordable(
  state: GameState,
  duty: AssistantInboxGuideSequenceId,
): boolean {
  if (duty !== 'coaching-office') return true;
  // A wrong opening project in an older save must be allowed to finish, and a
  // newly started pitch must be allowed to finish too. Asking for the office
  // while either rule owns the one works crew would deadlock Advance Week.
  if (openingTrainingPitchRequired(state)) return false;
  if (state.facilities.grid?.construction !== undefined) return false;
  const cash =
    state.clubs.find((club) => club.id === state.userClubId)?.cash ?? 0;
  return cash >= FACILITY_CATALOG['coaching-office'].buildCost;
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
 * Reads the same `dueAssistantInboxGuideSequences` the desk itself renders, so
 * a duty disappears from here at the exact moment it leaves the inbox — the
 * coaching office clears when construction *starts*, because that is when its
 * building joins the grid, and the youth intake clears on a signing or a
 * decline alike.
 */
export function outstandingInboxDuties(
  state: GameState,
): AssistantInboxGuideSequenceId[] {
  if (!assistantTeaches(state)) return [];
  if (state.season !== 1 || state.week > LAST_GATED_INBOX_WEEK) return [];
  const due = new Set(dueAssistantInboxGuideSequences(state));
  return BLOCKING_INBOX_DUTIES.filter(
    (duty) => due.has(duty) && isInboxDutyAffordable(state, duty),
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
  if (hasOperationalTrainingPitch) {
    next = completeAssistantGuideSequence(next, 'facility-placement');
  }
  if (hasCoachingOffice)
    next = completeAssistantGuideSequence(next, 'coaching-office');
  if (state.market?.assistantCoach !== undefined) {
    next = completeAssistantGuideSequence(next, 'assistant-coach-hire');
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
      'transfer-bid',
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
  if (activeTab !== 'home') {
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (state.market !== undefined && state.market.headCoach === undefined)
    return null;
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
