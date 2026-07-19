import {
  hasAssistantGuideMilestone,
  type AssistantGuideSequenceId,
  type GameState,
} from '../game';
import type { ManagementTab } from '../ui/models';

export interface AssistantObjective {
  text: string;
  target: 'home-tab' | 'squad-tab' | 'training-plan' | 'advance-week';
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
    activeTab === 'squad'
    && !hasAssistantGuideMilestone(state, 'squad-intro-complete')
  ) {
    return 'squad-intro';
  }
  if (
    activeTab === 'home'
    && hasAssistantGuideMilestone(state, 'first-training-complete')
    && !hasAssistantGuideMilestone(state, 'desk-intro-complete')
  ) {
    return 'desk-intro';
  }
  return null;
}

export function currentAssistantObjective(
  state: GameState,
  _activeTab: ManagementTab = 'home',
): AssistantObjective | null {
  if (!isFirstCareerWeek(state)) return null;
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) return null;
  if (!hasAssistantGuideMilestone(state, 'squad-intro-complete')) {
    return { text: 'OPEN SQUAD.', target: 'squad-tab' };
  }
  if (!hasAssistantGuideMilestone(state, 'first-training-complete')) {
    return { text: 'TRAIN ONE PLAYER ONCE.', target: 'training-plan' };
  }
  if (!hasAssistantGuideMilestone(state, 'desk-intro-complete')) {
    return { text: 'RETURN HOME.', target: 'home-tab' };
  }
  if (!hasAssistantGuideMilestone(state, 'first-week-advanced')) {
    return { text: 'READ THE DESK. THEN ADVANCE WEEK.', target: 'advance-week' };
  }
  return null;
}

function isFirstCareerWeek(state: Pick<GameState, 'season' | 'week'>): boolean {
  return state.season === 1 && state.week === 1;
}
