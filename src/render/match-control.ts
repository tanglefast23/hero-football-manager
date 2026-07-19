import type { MatchOpts } from '../sim/types';
import type { FormationId } from '../sim/tactics';

/** Keep the last confirmed holder visible while the ball is travelling loose. */
export function retainedCarrierIndex(
  currentCarrier: number,
  previousCarrier: number | null,
): number | null {
  return currentCarrier >= 0 ? currentCarrier : previousCarrier;
}

/** Keep the watched side manual without changing scheduled home/away order. */
export function matchPoliciesForControlledTeam(
  controlledTeam: 0 | 1,
  initialFormation: FormationId = '4-4-2',
): MatchOpts {
  return {
    homePolicy: controlledTeam === 0
      ? 'SAVE_FOR_TAP'
      : 'FIRE_WHEN_READY',
    awayPolicy: controlledTeam === 1
      ? 'SAVE_FOR_TAP'
      : 'FIRE_WHEN_READY',
    controlledTeam,
    ...(controlledTeam === 0
      ? { homeFormation: initialFormation }
      : { awayFormation: initialFormation }),
  };
}
