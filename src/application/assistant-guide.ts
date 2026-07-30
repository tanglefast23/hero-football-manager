import {
  hasAssistantGuideSequenceCompleted,
  hasAssistantGuideMilestone,
  careerRosterCapacity,
  completeAssistantGuideSequence,
  deferAssistantGuideSequencesUntilUnlock,
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
  if (isFirstCareerWeek(state)) {
    return hasAssistantGuideMilestone(state, 'intro-complete') ? null : 'management-intro';
  }
  if (isFirstFixtureWeek(state) && !hasAssistantGuideMilestone(state, 'desk-intro-complete')) {
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
    if (fixture.homeClubId !== state.userClubId && fixture.awayClubId !== state.userClubId) continue;
    if (earliestWeek === undefined || fixture.week < earliestWeek) earliestWeek = fixture.week;
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
  const completed = (sequenceId: AssistantInboxGuideSequenceId) => (
    hasAssistantGuideSequenceCompleted(state, sequenceId)
  );
  const grid = state.facilities.grid;
  const buildings = grid?.buildings ?? [];
  const hasCoachingOffice = buildings.some(building => building.type === 'coaching-office');
  const hasOperationalCoachingOffice = grid !== undefined && buildings.some(building => (
    building.type === 'coaching-office'
    && isFacilityOperational(grid, building.id)
  ));
  const scoutingUnlocked = isStoryScoutingUnlocked(state)
    || state.market.activeScoutMission !== undefined
    || state.market.scoutReports.length > 0;
  const rosterFull = state.players.filter(player => player.clubId === state.userClubId).length
    >= careerRosterCapacity(state);
  const playerSalesUnlocked = !isStoryFeaturePacingActive(state)
    || (scoutingUnlocked && rosterFull);

  if (state.market.headCoach === undefined) {
    due.push(completed('head-coach-market') ? 'head-coach-hire' : 'head-coach-market');
  } else if (
    !hasCoachingOffice
    && (!isStoryFeaturePacingActive(state) || state.week >= STORY_COACHING_OFFICE_GUIDE_WEEK)
  ) {
    due.push('coaching-office');
  } else if (hasOperationalCoachingOffice && state.market.assistantCoach === undefined) {
    due.push('assistant-coach-hire');
  }

  if (
    isStoryYouthUnlocked(state)
    && state.youthIntake?.status === 'OPEN'
    && state.youthIntake.offers.length > 0
  ) {
    due.push('youth-intake');
  }

  const operationalTrainingPitch = grid === undefined
    ? state.facilities.trainingGroundBuilt
    : buildings.some(building => (
        building.type === 'training-pitch'
        && isFacilityOperational(grid, building.id)
      ));
  const trainingPitchUnderConstruction = grid?.construction?.kind === 'BUILD'
    && grid.construction.type === 'training-pitch';
  const upgradeReachable = operationalTrainingPitch
    && completed('facility-placement')
    && grid?.construction === undefined
    && buildings.some(building => building.level < maxCareerFacilityLevel(state));
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
  } else if (listings.some(listing => listing.bids.length > 0)) {
    due.push('transfer-bid');
  } else if (playerSalesUnlocked && isTransferWindowOpen(state.week)) {
    due.push(isStoryFeaturePacingActive(state) ? 'roster-cap' : 'transfer-list');
  }

  if (state.m2.nationalCups.length > 0 && isStoryCupGuideUnlocked(state)) {
    due.push('national-cup');
  }

  if (state.players.some(player => player.clubId === state.userClubId && player.injuryWeeks > 0)) {
    due.push('first-injury');
  }
  if (state.financialSafety?.loan !== undefined && state.financialSafety.loan.remainingBalance > 0) {
    due.push('first-emergency-loan');
  }
  if (state.players.some(player => player.clubId === state.userClubId && player.transferRequested === true)) {
    due.push('first-transfer-request');
  }

  const retirementVisible = (state.retirementAnnouncements ?? [])
    .some(announcement => announcement.announcedInSeason === state.season - 1);
  if (retirementVisible) due.push('retirement');
  if ((state.pendingLegacyPlayerIds?.length ?? 0) > 0) due.push('club-legacy');

  if (state.financialSafety?.boardUltimatum !== undefined) {
    due.push(completed('board-ultimatum') ? 'board-protection' : 'board-ultimatum');
  }

  const pending = due.filter(sequenceId => !completed(sequenceId));

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
    upgradeReachable
    && pending.length === 0
    && !isStoryFeaturePacingActive(state)
    && !completed('facility-upgrade')
  ) {
    pending.push('facility-upgrade');
  }
  return pending;
}

/**
 * Removes coach tutorials whose objective was already completed directly.
 * This also heals saves where the follow-up was queued between opening the
 * market and signing the coach, so Bert never asks for a hire that exists.
 */
export function reconcileSatisfiedAssistantGuideSequences(state: GameState): GameState {
  let next = state;
  if (state.market?.headCoach !== undefined) {
    next = completeAssistantGuideSequence(next, 'head-coach-market');
    next = completeAssistantGuideSequence(next, 'head-coach-hire');
  }

  const grid = state.facilities.grid;
  const hasCoachingOffice = grid?.buildings.some(
    building => building.type === 'coaching-office',
  ) ?? false;
  const hasOperationalCoachingOffice = grid?.buildings.some(building => (
    building.type === 'coaching-office'
    && isFacilityOperational(grid, building.id)
  )) ?? false;
  const hasOperationalTrainingPitch = grid === undefined
    ? state.facilities.trainingGroundBuilt
    : grid.buildings.some(building => (
        building.type === 'training-pitch'
        && isFacilityOperational(grid, building.id)
      ));
  if (hasOperationalTrainingPitch) {
    next = completeAssistantGuideSequence(next, 'facility-placement');
  }
  if (hasCoachingOffice) next = completeAssistantGuideSequence(next, 'coaching-office');
  if (state.market?.assistantCoach !== undefined) {
    next = completeAssistantGuideSequence(next, 'assistant-coach-hire');
  }
  if (
    state.market?.activeScoutMission !== undefined
    || (state.market?.scoutReports.length ?? 0) > 0
  ) {
    next = completeAssistantGuideSequence(next, 'scout-mission');
  }

  const premature: AssistantInboxGuideSequenceId[] = [];
  if (!hasOperationalCoachingOffice) premature.push('assistant-coach-hire');
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
    !isStoryScoutingUnlocked(next)
    && next.market?.activeScoutMission === undefined
    && (next.market?.scoutReports.length ?? 0) === 0
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

export function currentAssistantObjective(
  state: GameState,
  activeTab: ManagementTab,
): AssistantObjective | null {
  if (!isFirstCareerWeek(state)) return null;
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) return null;
  if (!hasAssistantGuideMilestone(state, 'first-training-complete')) {
    if (activeTab === 'squad') {
      return { text: 'TAP + ON A PLAYER AND TRAIN A STAT.', target: 'training-plan' };
    }
    return { text: 'OPEN SQUAD.', target: 'squad-tab' };
  }
  if (!state.facilities.trainingGroundBuilt && !isTrainingGroundUnderConstruction(state)) {
    if (activeTab === 'home') {
      return { text: 'CHECK YOUR INBOX.', target: 'training-ground-alert' };
    }
    if (activeTab === 'club') {
      return { text: 'BUILD YOUR TRAINING PITCH.', target: 'training-ground-facility' };
    }
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (activeTab !== 'home') {
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (state.market !== undefined && state.market.headCoach === undefined) return null;
  if (!hasAssistantGuideMilestone(state, 'first-week-advanced')) {
    return { text: 'INBOX CLEAR. ADVANCE WEEK.', target: 'advance-week' };
  }
  return null;
}

function isTrainingGroundUnderConstruction(state: GameState): boolean {
  return state.facilities.grid?.construction?.kind === 'BUILD'
    && state.facilities.grid.construction.type === 'training-pitch';
}

function isFirstCareerWeek(state: Pick<GameState, 'season' | 'week'>): boolean {
  return state.season === 1 && state.week === 1;
}
