import type { CoachCandidateViewModel } from './market-models';
import type { ClubFacilityBuildingViewModel, FacilityTypeViewModel } from './models';

export const GUIDED_FIRST_FACILITY_TYPE: FacilityTypeViewModel = 'training-pitch';

export type GuidedFirstFacilityPhase = 'build-menu' | 'grid';

export function guidedFirstFacilityPhase(
  selectedBuildType: FacilityTypeViewModel | null,
): GuidedFirstFacilityPhase {
  return selectedBuildType === GUIDED_FIRST_FACILITY_TYPE ? 'grid' : 'build-menu';
}

export function guidedFirstFacilityAllowsBuildType(type: FacilityTypeViewModel): boolean {
  return type === GUIDED_FIRST_FACILITY_TYPE;
}

export function guidedFirstFacilityAllowsPlacement(
  selectedBuildType: FacilityTypeViewModel | null,
  x: number,
  y: number,
): boolean {
  return selectedBuildType === GUIDED_FIRST_FACILITY_TYPE && x === 0 && y === 0;
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
