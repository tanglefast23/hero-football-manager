import type { MatchOpts } from '../sim/types';
import type { FormationId } from '../sim/tactics';

/** Keep the last confirmed holder visible while the ball is travelling loose. */
export function retainedCarrierIndex(
  currentCarrier: number,
  previousCarrier: number | null,
): number | null {
  return currentCarrier >= 0 ? currentCarrier : previousCarrier;
}

/** Every watched side uses the authored contextual power timing. */
export function matchPoliciesForControlledTeam(
  controlledTeam: 0 | 1,
  initialFormation: FormationId = '4-4-2',
): MatchOpts {
  return {
    homePolicy: 'FIRE_WHEN_READY',
    awayPolicy: 'FIRE_WHEN_READY',
    controlledTeam,
    ...(controlledTeam === 0
      ? { homeFormation: initialFormation }
      : { awayFormation: initialFormation }),
  };
}
