import {
  hasAssistantGuideMilestone,
  type AssistantGuideSequenceId,
  type GameState,
} from '../game';
import type { ManagementTab } from '../ui/models';

export interface AssistantObjective {
  text: string;
  targetTab?: Extract<ManagementTab, 'home' | 'squad'>;
}

export function pendingAssistantGuideSequence(
  state: GameState,
  activeTab: ManagementTab,
): AssistantGuideSequenceId | null {
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

export function currentAssistantObjective(state: GameState): AssistantObjective | null {
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) return null;
  if (!hasAssistantGuideMilestone(state, 'squad-intro-complete')) {
    return { text: 'OPEN SQUAD.', targetTab: 'squad' };
  }
  if (!hasAssistantGuideMilestone(state, 'first-training-complete')) {
    return { text: 'TRAIN ONE PLAYER ONCE.', targetTab: 'squad' };
  }
  if (!hasAssistantGuideMilestone(state, 'desk-intro-complete')) {
    return { text: 'RETURN HOME.', targetTab: 'home' };
  }
  if (!hasAssistantGuideMilestone(state, 'first-week-advanced')) {
    return { text: 'READ THE DESK. THEN ADVANCE WEEK.', targetTab: 'home' };
  }
  return null;
}
