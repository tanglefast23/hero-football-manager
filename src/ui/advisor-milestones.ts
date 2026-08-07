import {
  assistantTeaches,
  hasAssistantGuideMilestone,
  hasEverGainedFans,
  type AssistantGuideMilestone,
  type GameState,
} from '../game';
import { facilityAdjacencyPresentation } from './facility-adjacency';

export interface AdvisorMilestoneContext {
  /** The office is visible, so an opening or facility discovery has happened. */
  readonly enteredManagement: boolean;
  /** The manager has opened the squad room after the lesson became relevant. */
  readonly viewingSquad: boolean;
  /** The desk is visible after the club has won its first supporters. */
  readonly viewingHome: boolean;
  /** The manager has reached the ledger the crowd lesson would point at. */
  readonly viewingFinances: boolean;
  /** The recruitment office is open, holding reports, with the window shut. */
  readonly viewingShutMarket: boolean;
  /** Match day currently contains a below-peak starter. */
  readonly lowConditionMatchday: boolean;
  /** The season review is showing a contract the manager has to settle. */
  readonly viewingExpiredContract: boolean;
}

/**
 * Lessons an Advisor career has already lived through, without showing them.
 *
 * Presentation callbacks normally bank these flags. Advisor removes those
 * callbacks along with the presentation, so App uses this pure list to keep a
 * later switch to Teacher from resurrecting stale lessons. A lesson is banked
 * only when its real screen or event has occurred, not merely because the
 * career is old enough that it could have occurred.
 */
export function advisorMilestonesToBank(
  state: GameState,
  context: AdvisorMilestoneContext,
): AssistantGuideMilestone[] {
  if (assistantTeaches(state)) return [];

  const milestones: AssistantGuideMilestone[] = [];
  const add = (milestone: AssistantGuideMilestone) => {
    if (!hasAssistantGuideMilestone(state, milestone) && !milestones.includes(milestone)) {
      milestones.push(milestone);
    }
  };

  if (context.enteredManagement && state.season === 1 && state.week === 1) {
    add('intro-complete');
  }
  if (
    context.viewingHome
    && state.season === 1
    && state.week === firstUserFixtureWeek(state)
  ) {
    add('desk-intro-complete');
  }
  if (context.viewingSquad && (state.totalInstantDrills ?? 0) >= 3) {
    add('condition-warning-seen');
  }
  if (
    context.viewingSquad
    && (state.season > 1 || (state.season === 1 && state.week >= 6))
  ) {
    add('quick-train-seen');
  }
  if (context.enteredManagement) {
    for (const adjacency of state.facilities.grid?.discoveredAdjacencies ?? []) {
      const presentation = facilityAdjacencyPresentation(adjacency);
      if (presentation !== undefined) add(presentation.milestone);
    }
  }
  if (context.viewingShutMarket) add('transfer-window-seen');
  if (context.viewingExpiredContract) add('expired-contract-seen');
  if (context.lowConditionMatchday) add('match-condition-warning-seen');
  if (context.viewingHome && hasEverGainedFans(state)) add('first-fans-seen');
  if (context.viewingFinances && hasEverGainedFans(state)) {
    add('first-fans-seen');
    add('first-fans-ledger-seen');
  }

  return milestones;
}

function firstUserFixtureWeek(state: GameState): number | undefined {
  let earliest: number | undefined;
  for (const fixture of state.fixtures) {
    if (fixture.season !== state.season) continue;
    if (fixture.homeClubId !== state.userClubId && fixture.awayClubId !== state.userClubId) continue;
    if (earliest === undefined || fixture.week < earliest) earliest = fixture.week;
  }
  return earliest;
}
