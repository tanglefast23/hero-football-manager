import type { CoachCandidateViewModel } from '../market-models';
import type { ClubFacilityBuildingViewModel } from '../models';
import {
  GUIDED_FIRST_FACILITY_TYPE,
  firstGuidedCoachCandidateId,
  firstGuidedFacilityUpgradeId,
  guidedFirstFacilityAllowsBuildType,
  guidedFirstFacilityAllowsPlacement,
  guidedFirstFacilityPhase,
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

  it('locks the first facility guide to Training Grounds but allows any valid grid cell', () => {
    expect(GUIDED_FIRST_FACILITY_TYPE).toBe('training-pitch');
    expect(guidedFirstFacilityPhase(null)).toBe('build-menu');
    expect(guidedFirstFacilityPhase('gym')).toBe('build-menu');
    expect(guidedFirstFacilityPhase('training-pitch')).toBe('grid');
    expect(guidedFirstFacilityAllowsBuildType('training-pitch')).toBe(true);
    expect(guidedFirstFacilityAllowsBuildType('gym')).toBe(false);
    expect(guidedFirstFacilityAllowsPlacement('training-pitch', 0, 0)).toBe(true);
    expect(guidedFirstFacilityAllowsPlacement('training-pitch', 1, 0)).toBe(true);
    expect(guidedFirstFacilityAllowsPlacement('training-pitch', 6, 4)).toBe(true);
    expect(guidedFirstFacilityAllowsPlacement('gym', 0, 0)).toBe(false);
  });
});
