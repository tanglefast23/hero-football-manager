import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('squad training tier options', () => {
  const content = loadLaunchContent();

  it('a bank of 11 with Tier 4 owned keeps Tier 1-2 affordable with exact runs', () => {
    const fresh = createCareer(
      createLaunchCareerSetup(20260720, undefined, content),
    );
    const career = {
      ...fresh,
      phase: 'manage' as const,
      trainingPoints: 11,
      ownedTrainingTiers: { finishing: 4 },
    };
    const playerId = career.players.find(
      (player) => player.clubId === career.userClubId && player.role !== 'GK',
    )!.id;
    const viewModel = squadTrainingViewModel(career, content, playerId);
    const finishing = viewModel.selectedPlayerStatOptions!.find(
      (option) => option.pathId === 'finishing',
    )!;
    // The row still opens on the owned drill, but the chooser below it stays live.
    expect(finishing.ownedTier).toBe(4);
    expect(finishing.affordable).toBe(false);
    expect(finishing.tiers.map((tier) => tier.tier)).toEqual([1, 2, 3, 4]);
    expect(finishing.tiers.map((tier) => tier.tpCost)).toEqual([7, 11, 17, 26]);
    expect(finishing.tiers.map((tier) => tier.affordable)).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(finishing.tiers.map((tier) => tier.affordableRuns)).toEqual([
      1, 1, 0, 0,
    ]);
    // Tier 2 is the acceptance case: 11 TP for the +5 authored gain.
    const tier2 = finishing.tiers[1]!;
    expect(tier2.drillName).toBe('Finishing 2');
    expect(tier2.baseValueAfter - finishing.currentValue).toBe(5);
  });
});
