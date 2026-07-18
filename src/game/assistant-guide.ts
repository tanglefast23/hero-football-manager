import type { GameState } from './types';

export type AssistantGuideSequenceId =
  | 'management-intro'
  | 'squad-intro'
  | 'desk-intro';

export type AssistantGuideMilestone =
  | 'intro-complete'
  | 'squad-intro-complete'
  | 'first-training-complete'
  | 'desk-intro-complete'
  | 'first-week-advanced';

const FLAG_BY_MILESTONE: Readonly<Record<AssistantGuideMilestone, string>> = {
  'intro-complete': 'guide:bert:intro-complete',
  'squad-intro-complete': 'guide:bert:squad-intro-complete',
  'first-training-complete': 'guide:bert:first-training-complete',
  'desk-intro-complete': 'guide:bert:desk-intro-complete',
  'first-week-advanced': 'guide:bert:first-week-advanced',
};

const MILESTONE_BY_SEQUENCE: Readonly<Record<AssistantGuideSequenceId, AssistantGuideMilestone>> = {
  'management-intro': 'intro-complete',
  'squad-intro': 'squad-intro-complete',
  'desk-intro': 'desk-intro-complete',
};

export function hasAssistantGuideMilestone(
  state: Pick<GameState, 'eventFlags'>,
  milestone: AssistantGuideMilestone,
): boolean {
  return state.eventFlags.includes(FLAG_BY_MILESTONE[milestone]);
}

export function completeAssistantGuideMilestone(
  state: GameState,
  milestone: AssistantGuideMilestone,
): GameState {
  const flag = FLAG_BY_MILESTONE[milestone];
  if (state.eventFlags.includes(flag)) return state;
  return { ...state, eventFlags: [...state.eventFlags, flag] };
}

export function completeAssistantGuideSequence(
  state: GameState,
  sequenceId: AssistantGuideSequenceId,
): GameState {
  return completeAssistantGuideMilestone(state, MILESTONE_BY_SEQUENCE[sequenceId]);
}
