import type { AssistantMode } from '../game/types';
import { copyFor, type CopyFn } from '../i18n';
import type { BertMomentId } from './bert-poses';

/**
 * English copy, for every caller that has not threaded a locale through yet.
 * The same lazy shape `application/view-models.ts` uses.
 */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

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

/**
 * The pose is structure, not copy, so it stays here; everything Bert says is
 * joined on from the catalog. The VoiceOver label is the button's own two
 * sentences read together, built rather than authored twice — a translator who
 * revised one and not the other would leave the screen and the reader saying
 * different things.
 */
const MOMENT: BertMomentId = 'sizing-you-up';

function option(
  mode: AssistantMode,
  slug: string,
  t: CopyFn,
): AssistantModeOption {
  const label = t(`assistantModeChoice.${slug}.label`);
  const detail = t(`assistantModeChoice.${slug}.detail`);
  return { mode, label, detail, accessibilityLabel: `${label}. ${detail}` };
}

export function assistantModeChoice(
  t: CopyFn = englishCopy(),
): AssistantModeChoiceCopy {
  return {
    kicker: t('assistantModeChoice.kicker'),
    line: t('assistantModeChoice.line'),
    moment: MOMENT,
    options: [option('teacher', 'teacher', t), option('advisor', 'advisor', t)],
  };
}

/** First careers stay on the shipped route; only proven devices are asked. */
export function shouldAskAssistantMode(climbCompleted: boolean): boolean {
  return climbCompleted;
}
