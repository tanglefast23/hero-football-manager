import type { FormationId } from '../sim/tactics';
import { controlledMatchOptions } from '../game/match-policy';

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
): ReturnType<typeof controlledMatchOptions> {
  return controlledMatchOptions(controlledTeam, initialFormation);
}
