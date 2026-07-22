import type { CoachCandidateViewModel } from './market-models';
import type { ClubFacilityBuildingViewModel, FacilityTypeViewModel } from './models';

export type GuidedFirstFacilityPhase = 'build-menu' | 'grid';

/**
 * The club always starts with a seeded Training Pitch, so the first facility
 * a player *builds* can be anything — there is no reason to force a second
 * pitch. Any selected type advances the guide to the grid step.
 */
export function guidedFirstFacilityPhase(
  selectedBuildType: FacilityTypeViewModel | null,
): GuidedFirstFacilityPhase {
  return selectedBuildType === null ? 'build-menu' : 'grid';
}

export function guidedFirstFacilityAllowsBuildType(_type: FacilityTypeViewModel): boolean {
  return true;
}

export function guidedFirstFacilityAllowsPlacement(
  selectedBuildType: FacilityTypeViewModel | null,
  _x: number,
  _y: number,
): boolean {
  return selectedBuildType !== null;
}

export function firstGuidedCoachCandidateId(
  coaches: readonly CoachCandidateViewModel[],
  role: 'HEAD' | 'ASSISTANT',
): string | undefined {
  return coaches.find(coach => (
    role === 'HEAD' ? coach.headAvailable : coach.assistantAvailable
  ))?.id;
}

export function firstGuidedFacilityUpgradeId(
  buildings: readonly ClubFacilityBuildingViewModel[],
): string | undefined {
  return buildings.find(building => building.upgradeCost !== undefined)?.id;
}
