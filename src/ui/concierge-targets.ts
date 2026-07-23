import type { CoachCandidateViewModel } from './market-models';
import type { ClubFacilityBuildingViewModel, FacilityTypeViewModel } from './models';

export type GuidedFirstFacilityPhase = 'build-menu' | 'grid';

export function guidedFirstFacilityPhase(
  selectedBuildType: FacilityTypeViewModel | null,
): GuidedFirstFacilityPhase {
  return selectedBuildType === 'training-pitch' ? 'grid' : 'build-menu';
}

export function guidedFirstFacilityAllowsBuildType(type: FacilityTypeViewModel): boolean {
  return type === 'training-pitch';
}

export function guidedFirstFacilityAllowsPlacement(
  selectedBuildType: FacilityTypeViewModel | null,
  _x: number,
  _y: number,
): boolean {
  return selectedBuildType === 'training-pitch';
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
