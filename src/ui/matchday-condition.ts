import type { LineupPlayerViewModel } from './models';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export const MATCHDAY_CONDITION_WARNING_THRESHOLD = 80;

export type MatchdayConditionStatusKind = 'below-peak' | 'fatigued' | 'exhausted';

export interface MatchdayConditionStatus {
  /**
   * The discriminator. Every caller that BRANCHES — stamp colour, card class —
   * reads this; `label` is only ever drawn, so it can be translated without
   * moving any logic.
   */
  kind: MatchdayConditionStatusKind;
  label: string;
}

const CONDITION_LABEL_KEYS: Readonly<Record<MatchdayConditionStatusKind, string>> = {
  'below-peak': 'fixtureMatchDay.condition.belowPeak',
  fatigued: 'fixtureMatchDay.condition.fatigued',
  exhausted: 'fixtureMatchDay.condition.exhausted',
};

export function matchdayConditionStatus(
  condition: number,
  t: CopyFn = englishCopy(),
): MatchdayConditionStatus | null {
  const kind: MatchdayConditionStatusKind | null = condition < 30
    ? 'exhausted'
    : condition < 50
      ? 'fatigued'
      : condition <= 80 ? 'below-peak' : null;
  return kind === null ? null : { kind, label: t(CONDITION_LABEL_KEYS[kind]) };
}

export function matchdayConditionWarningCopy(
  playerName: string,
  t: CopyFn = englishCopy(),
): string {
  return t('fixtureMatchDay.conditionWarning', { player: playerName });
}

/** The lowest-condition starter owns Bert's one-time pre-match warning. */
export function matchdayConditionWarningPlayer(
  lineup: readonly LineupPlayerViewModel[],
): LineupPlayerViewModel | null {
  return lineup
    .filter(player => player.condition <= MATCHDAY_CONDITION_WARNING_THRESHOLD)
    .reduce<LineupPlayerViewModel | null>(
      (lowest, player) => lowest === null || player.condition < lowest.condition ? player : lowest,
      null,
    );
}
