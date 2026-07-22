import {
  hasAssistantGuideSequenceCompleted,
  hasAssistantGuideMilestone,
  careerRosterCapacity,
  completeAssistantGuideSequence,
  deferAssistantGuideSequencesUntilUnlock,
  isStoryCupGuideUnlocked,
  isStoryFeaturePacingActive,
  isStoryScoutingUnlocked,
  isStoryYouthUnlocked,
  maxCareerFacilityLevel,
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
  activeTab: ManagementTab,
): AssistantGuideSequenceId | null {
  if (!isFirstCareerWeek(state)) return null;
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) {
    return 'management-intro';
  }
  if (
    activeTab === 'home'
    && hasAssistantGuideMilestone(state, 'first-training-complete')
    && (state.facilities.trainingGroundBuilt || isTrainingGroundUnderConstruction(state))
    && !hasAssistantGuideMilestone(state, 'desk-intro-complete')
    && !hasAssistantGuideMilestone(state, 'first-week-advanced')
  ) {
    return 'desk-intro';
  }
  return null;
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
  if (state.careerMode !== 'full' || state.market === undefined || state.m2 === undefined) {
    return [];
  }

  const due: AssistantInboxGuideSequenceId[] = [];
  const completed = (sequenceId: AssistantInboxGuideSequenceId) => (
    hasAssistantGuideSequenceCompleted(state, sequenceId)
  );
  const buildings = state.facilities.grid?.buildings ?? [];
  const hasCoachingOffice = buildings.some(building => building.type === 'coaching-office');
  const scoutingUnlocked = isStoryScoutingUnlocked(state)
    || state.market.activeScoutMission !== undefined
    || state.market.scoutReports.length > 0;
  const rosterFull = state.players.filter(player => player.clubId === state.userClubId).length
    >= careerRosterCapacity(state);
  const playerSalesUnlocked = !isStoryFeaturePacingActive(state)
    || (scoutingUnlocked && rosterFull);

  if (state.market.headCoach === undefined) {
    due.push(completed('head-coach-market') ? 'head-coach-hire' : 'head-coach-market');
  } else if (!hasCoachingOffice) {
    due.push('coaching-office');
  } else if (state.market.assistantCoach === undefined) {
    due.push('assistant-coach-hire');
  }

  const playerBuilt = buildings.filter(building => building.seeded !== true);
  if (playerBuilt.length === 0) {
    due.push('facility-placement');
  } else {
    if (completed('facility-placement')
      && state.facilities.grid?.construction === undefined
      && playerBuilt.some(
        building => building.level < maxCareerFacilityLevel(state),
      )) {
      due.push('facility-upgrade');
    }
    if ((state.facilities.grid?.discoveredAdjacencies.length ?? 0) > 0) {
      due.push('facility-adjacency');
    }
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

  if (
    isStoryYouthUnlocked(state)
    && state.youthIntake?.status === 'OPEN'
    && state.youthIntake.offers.length > 0
  ) {
    due.push('youth-intake');
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

  return due.filter(sequenceId => !completed(sequenceId));
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

  const hasCoachingOffice = state.facilities.grid?.buildings.some(
    building => building.type === 'coaching-office',
  ) ?? false;
  if ((state.facilities.grid?.buildings.filter(building => building.seeded !== true).length ?? 0) > 0) {
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

  if (!isStoryFeaturePacingActive(next)) return next;
  const premature: AssistantInboxGuideSequenceId[] = [];
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
      return { text: 'SAVE YOUR FIRST WEEKLY PLAN.', target: 'training-plan' };
    }
    return { text: 'OPEN SQUAD.', target: 'squad-tab' };
  }
  if (!state.facilities.trainingGroundBuilt && !isTrainingGroundUnderConstruction(state)) {
    if (activeTab === 'home') {
      return { text: 'CHECK YOUR INBOX.', target: 'training-ground-alert' };
    }
    if (activeTab === 'club') {
      return { text: 'BUILD THE TRAINING GROUND.', target: 'training-ground-facility' };
    }
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (activeTab !== 'home') {
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (!hasAssistantGuideMilestone(state, 'desk-intro-complete')) return null;
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
