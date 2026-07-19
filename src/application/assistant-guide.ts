import {
  hasAssistantGuideMilestone,
  type AssistantGuideSequenceId,
  type GameState,
} from '../game';
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
    && hasAssistantGuideMilestone(state, 'squad-intro-complete')
    && hasAssistantGuideMilestone(state, 'first-training-complete')
    && state.facilities.trainingGroundBuilt
    && !hasAssistantGuideMilestone(state, 'desk-intro-complete')
    && !hasAssistantGuideMilestone(state, 'first-week-advanced')
  ) {
    return 'desk-intro';
  }
  return null;
}

export function currentAssistantObjective(
  state: GameState,
  activeTab: ManagementTab,
): AssistantObjective | null {
  if (!hasAssistantGuideMilestone(state, 'intro-complete')) return null;
  if (!hasAssistantGuideMilestone(state, 'squad-intro-complete')) {
    return { text: 'OPEN SQUAD.', target: 'squad-tab' };
  }
  if (!hasAssistantGuideMilestone(state, 'first-training-complete')) {
    return { text: 'TRAIN ONE PLAYER ONCE.', target: 'training-plan' };
  }
  if (!state.facilities.trainingGroundBuilt) {
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
  if (!hasAssistantGuideMilestone(state, 'first-week-advanced')) {
    return { text: 'INBOX CLEAR. ADVANCE WEEK.', target: 'advance-week' };
  }
  return null;
}
