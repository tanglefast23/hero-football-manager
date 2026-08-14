import { readFileSync } from 'fs';
import { join } from 'path';
import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import { createLaunchCareerSetup } from '../../application/launch';
import { dueAssistantInboxGuideSequences } from '../../application/assistant-guide';
import type { CoachCandidateViewModel } from '../market-models';
import type { ClubFacilityBuildingViewModel } from '../models';
import {
  firstGuidedCoachCandidateId,
  firstGuidedFacilityUpgradeId,
  guidedFirstFacilityAllowsBuildType,
  guidedFirstFacilityAllowsPlacement,
  guidedFirstFacilityPhase,
} from '../concierge-targets';

describe('concierge actionable targets', () => {
  it('points assistant hiring at the first candidate whose assistant action is enabled', () => {
    const unavailable = {
      id: 'current-head',
      assistantAvailable: false,
    } as CoachCandidateViewModel;
    const available = {
      id: 'actual-assistant',
      assistantAvailable: true,
    } as CoachCandidateViewModel;
    expect(
      firstGuidedCoachCandidateId([unavailable, available], 'ASSISTANT'),
    ).toBe('actual-assistant');
  });

  it('skips max-level and division-locked facilities when choosing the upgrade target', () => {
    const maxed = {
      id: 'level-three',
      upgradeCost: undefined,
    } as ClubFacilityBuildingViewModel;
    const upgradeable = {
      id: 'level-two',
      upgradeCost: 12_000,
    } as ClubFacilityBuildingViewModel;
    const locked = {
      id: 'division-locked',
      upgradeCost: 18_000,
      upgradeBlockedReason: 'Level 3 facilities unlock in D2.',
    } as ClubFacilityBuildingViewModel;
    expect(firstGuidedFacilityUpgradeId([maxed, locked, upgradeable])).toBe(
      'level-two',
    );
  });

  it('requires a Training Pitch for the first-facility guide and accepts any valid pitch position', () => {
    expect(guidedFirstFacilityPhase(null)).toBe('build-menu');
    expect(guidedFirstFacilityPhase('gym')).toBe('build-menu');
    expect(guidedFirstFacilityPhase('training-pitch')).toBe('grid');
    expect(guidedFirstFacilityAllowsBuildType('training-pitch')).toBe(true);
    expect(guidedFirstFacilityAllowsBuildType('gym')).toBe(false);
    expect(guidedFirstFacilityAllowsPlacement('gym', 2, 2)).toBe(false);
    expect(guidedFirstFacilityAllowsPlacement('training-pitch', 0, 0)).toBe(
      true,
    );
    expect(guidedFirstFacilityAllowsPlacement('training-pitch', 6, 4)).toBe(
      true,
    );
    expect(guidedFirstFacilityAllowsPlacement(null, 2, 2)).toBe(false);
  });

  it('guides a fresh full career to build its first Training Pitch, without a renderer', () => {
    const content = loadLaunchContent();
    const state = createCareer(
      createLaunchCareerSetup(413, undefined, content),
    );
    expect(state.facilities.grid?.buildings).toHaveLength(0);
    expect(dueAssistantInboxGuideSequences(state)).toContainSource(
      'facility-placement',
    );

    const source = readFileSync(
      join(process.cwd(), 'src/ui/screens/ClubFinancesScreen.tsx'),
      'utf8',
    );
    expect(source).toContainSource(
      "const guidedFirstFacility = guideFocus === 'facility-grid';",
    );
    expect(source).toContainSource(
      'guidedFirstFacilityAllowsBuildType(entry.type)',
    );
    expect(source).toContainSource('entry.blockedByOpeningTrainingPitch');
    expect(source).toContainSource(
      "setBuildMenuReminder(t('clubFinances.buildTrainingPitchFirstReminder'));",
    );
    // Pinned to the guard itself rather than the bare comparison: the club now
    // starts seeded, so re-gating the guide on an empty board is the mistake.
    // Other sections legitimately ask whether anything is built at all.
    expect(source).not.toContainSource(
      "guideFocus === 'facility-grid' && facilities.buildings.length === 0",
    );
  });
});
