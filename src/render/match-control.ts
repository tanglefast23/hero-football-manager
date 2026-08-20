import type { FormationId } from '../sim/tactics';
import { controlledMatchOptions } from '../game/match-policy';

/** Keep the last confirmed holder visible while the ball is travelling loose. */
export function retainedCarrierIndex(
  currentCarrier: number,
  previousCarrier: number | null,
): number | null {
  return currentCarrier >= 0 ? currentCarrier : previousCarrier;
}

/**
 * A watched side fires on the manager's HERO POWER setting; the opposition
 * always fires automatically. Quick Result never reaches this function, and
 * never passes 'manual' — see controlledMatchOptions.
 */
export function matchPoliciesForControlledTeam(
  controlledTeam: 0 | 1,
  initialFormation: FormationId = '4-4-2',
  heroPowers: 'auto' | 'manual' = 'auto',
): ReturnType<typeof controlledMatchOptions> {
  return controlledMatchOptions(controlledTeam, initialFormation, heroPowers);
}
