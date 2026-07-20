import type { CoachCandidateViewModel } from './market-models';
import type { ClubFacilityBuildingViewModel } from './models';

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
