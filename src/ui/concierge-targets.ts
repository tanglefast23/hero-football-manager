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

/**
 * The two buildings that bring money in rather than only spend it: the Fan
 * Shop's weekly merchandise and the Stadium Stand's share of the home gate.
 * Everything else in the catalog trains, heals or scouts, and pays upkeep to do
 * it — which is the whole point of showing these two to a club in the red.
 */
export function isIncomeFacilityType(type: FacilityTypeViewModel): boolean {
  return type === 'fan-shop' || type === 'stadium-stand';
}

export function firstGuidedFacilityUpgradeId(
  buildings: readonly ClubFacilityBuildingViewModel[],
): string | undefined {
  return buildings.find(building => building.upgradeCost !== undefined)?.id;
}
