import type { LineupPlayerViewModel } from './models';

export const MATCHDAY_CONDITION_WARNING_THRESHOLD = 70;

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
  return `Boss, ${playerName}’s legs are heavy after all that training. He’ll start below his best and tire sooner today. Repeated drills build skill, but don’t overtrain players you need at their peak.`;
}

/** The lowest-condition starter owns Bert's one-time pre-match warning. */
export function matchdayConditionWarningPlayer(
  lineup: readonly LineupPlayerViewModel[],
): LineupPlayerViewModel | null {
  return lineup
    .filter(player => player.condition < MATCHDAY_CONDITION_WARNING_THRESHOLD)
    .reduce<LineupPlayerViewModel | null>(
      (lowest, player) => lowest === null || player.condition < lowest.condition ? player : lowest,
      null,
    );
}
