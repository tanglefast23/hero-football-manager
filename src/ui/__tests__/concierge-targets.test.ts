import type { CoachCandidateViewModel } from '../market-models';
import type { ClubFacilityBuildingViewModel } from '../models';
import {
  firstGuidedCoachCandidateId,
  firstGuidedFacilityUpgradeId,
} from '../concierge-targets';

describe('concierge actionable targets', () => {
  it('points assistant hiring at the first candidate whose assistant action is enabled', () => {
    const unavailable = { id: 'current-head', assistantAvailable: false } as CoachCandidateViewModel;
    const available = { id: 'actual-assistant', assistantAvailable: true } as CoachCandidateViewModel;
    expect(firstGuidedCoachCandidateId([unavailable, available], 'ASSISTANT')).toBe('actual-assistant');
  });

  it('skips max-level facilities when choosing the upgrade target', () => {
    const maxed = { id: 'level-three', upgradeCost: undefined } as ClubFacilityBuildingViewModel;
    const upgradeable = { id: 'level-two', upgradeCost: 12_000 } as ClubFacilityBuildingViewModel;
    expect(firstGuidedFacilityUpgradeId([maxed, upgradeable])).toBe('level-two');
  });
});
