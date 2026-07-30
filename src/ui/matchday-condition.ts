import type { LineupPlayerViewModel } from './models';

export const MATCHDAY_CONDITION_WARNING_THRESHOLD = 80;

export type MatchdayConditionStatusKind = 'below-peak' | 'fatigued' | 'exhausted';

export interface MatchdayConditionStatus {
  kind: MatchdayConditionStatusKind;
  label: 'Below peak' | 'Fatigued' | 'Exhausted';
}

export function matchdayConditionStatus(condition: number): MatchdayConditionStatus | null {
  if (condition < 30) return { kind: 'exhausted', label: 'Exhausted' };
  if (condition < 50) return { kind: 'fatigued', label: 'Fatigued' };
  if (condition <= 80) return { kind: 'below-peak', label: 'Below peak' };
  return null;
}

export function matchdayConditionWarningCopy(playerName: string): string {
  return `Boss, ${playerName} is below peak. The lower a player’s condition, the less effectively they’ll play on the field and the sooner they’ll tire. Training builds skill, but rest anyone you need at their best.`;
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
