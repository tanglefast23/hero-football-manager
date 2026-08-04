import type { AssistantMode } from '../game/types';
import type { BertMomentId } from './bert-poses';

export interface AssistantModeOption {
  readonly mode: AssistantMode;
  readonly label: string;
  readonly detail: string;
  readonly accessibilityLabel: string;
}

export interface AssistantModeChoiceCopy {
  readonly kicker: string;
  readonly line: string;
  readonly moment: BertMomentId;
  readonly options: readonly [AssistantModeOption, AssistantModeOption];
}

export const ASSISTANT_MODE_CHOICE: AssistantModeChoiceCopy = {
  kicker: 'Before you take the keys',
  line: 'You have done this before. Do you want me explaining it again, or just staying out of your way?',
  moment: 'sizing-you-up',
  options: [
    {
      mode: 'teacher',
      label: 'Teach me again',
      detail: 'Bert explains every first and holds the opening weeks until the desk is clear.',
      accessibilityLabel: 'Teach me again. Bert explains every first and holds the opening weeks until the desk is clear.',
    },
    {
      mode: 'advisor',
      label: 'Stay out of my way',
      detail: 'No lessons, no arrows, no held weeks. He still brings you every decision.',
      accessibilityLabel: 'Stay out of my way. No lessons, no arrows, no held weeks. He still brings you every decision.',
    },
  ],
};

/** First careers stay on the shipped route; only proven devices are asked. */
export function shouldAskAssistantMode(climbCompleted: boolean): boolean {
  return climbCompleted;
}
