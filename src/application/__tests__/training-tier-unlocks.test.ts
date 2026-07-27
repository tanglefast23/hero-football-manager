import { loadLaunchContent } from '../../content';
import {
  TRAINING_PATHS,
  createCareer,
  purchaseCareerTrainingUpgrade,
  resolveTrainingDrillForPath,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { squadTrainingViewModel } from '../view-models';

describe('training drill tier purchases', () => {
  const content = loadLaunchContent();

  test('shows the OWNED tier for a stat option, not the best the division allows', () => {
    const divisionFive = createCareer(createLaunchCareerSetup(
      20260722,
      undefined,
      content,
    ));
    const player = divisionFive.players.find(candidate => candidate.clubId === divisionFive.userClubId)!;
    const optionAt = (highestDivisionReached: 5 | 4 | 2, ownedTier?: number) => squadTrainingViewModel(
      {
        ...divisionFive,
        trainingPoints: 100,
        m2: { ...divisionFive.m2!, highestDivisionReached },
        ...(ownedTier === undefined ? {} : { ownedTrainingTiers: { sprints: ownedTier } }),
      },
      content,
      player.id,
    ).selectedPlayerStatOptions?.find(option => option.pathId === 'sprints');

    // Climbing the pyramid changes nothing on its own: the club still trains on
    // the tier it bought.
    expect(optionAt(5)).toMatchObject({ drillName: 'Sprints 1', gain: 5, tpCost: 10 });
    expect(optionAt(4)).toMatchObject({ drillName: 'Sprints 1', gain: 5, tpCost: 10 });
    expect(optionAt(2)).toMatchObject({ drillName: 'Sprints 1', gain: 5, tpCost: 10 });
    expect(optionAt(2, 4)).toMatchObject({ drillName: 'Sprints 4', gain: 17, tpCost: 28 });
  });

  test('marks a stat option unaffordable when the bank cannot cover one tap', () => {
    const initial = createCareer(createLaunchCareerSetup(20260723, undefined, content));
    const player = initial.players.find(candidate => candidate.clubId === initial.userClubId)!;
    const sprints = resolveTrainingDrillForPath(initial, 'sprints');

    const funded = squadTrainingViewModel(
      { ...initial, trainingPoints: sprints.tpCost },
      content,
      player.id,
    ).selectedPlayerStatOptions?.find(option => option.pathId === 'sprints');
    const broke = squadTrainingViewModel(
      { ...initial, trainingPoints: sprints.tpCost - 1 },
      content,
      player.id,
    ).selectedPlayerStatOptions?.find(option => option.pathId === 'sprints');

    expect(funded?.affordable).toBe(true);
    expect(broke?.affordable).toBe(false);
  });

  it('offers every path its own next tier, priced, with the reason it is unavailable', () => {
    const state = createCareer(createLaunchCareerSetup(413, undefined, content));
    const rich = {
      ...state,
      clubs: state.clubs.map(club => club.id === state.userClubId
        ? { ...club, cash: 100_000 }
        : club),
    };

    const atDivisionFive = squadTrainingViewModel(rich, content, undefined).drillUpgrades;
    expect(atDivisionFive).toHaveLength(TRAINING_PATHS.length);
    expect(atDivisionFive[0]).toMatchObject({
      pathId: 'sprints',
      label: 'Pace',
      drillName: 'Sprints 1',
      ownedTier: 1,
      nextTier: 2,
      nextGain: 8,
      cost: 3_000,
      blockedReason: 'Tier 2 drills unlock in D4 · County League.',
    });

    const promoted = { ...rich, m2: { ...rich.m2!, highestDivisionReached: 4 as const } };
    expect(squadTrainingViewModel(promoted, content, undefined).drillUpgrades[0].blockedReason)
      .toBeUndefined();

    const broke = {
      ...promoted,
      clubs: promoted.clubs.map(club => club.id === promoted.userClubId
        ? { ...club, cash: 2_999 }
        : club),
    };
    expect(squadTrainingViewModel(broke, content, undefined).drillUpgrades[0].blockedReason)
      .toBe('Not enough money.');
  });

  it('buys one path at a time, charging the club and leaving the others alone', () => {
    const state = createCareer(createLaunchCareerSetup(414, undefined, content));
    const promoted = {
      ...state,
      m2: { ...state.m2!, highestDivisionReached: 4 as const },
      clubs: state.clubs.map(club => club.id === state.userClubId
        ? { ...club, cash: 3_000 }
        : club),
    };

    const bought = purchaseCareerTrainingUpgrade(promoted, 'sprints').state;

    expect(bought.ownedTrainingTiers).toEqual({ sprints: 2 });
    expect(bought.clubs.find(club => club.id === bought.userClubId)?.cash).toBe(0);
    expect(bought.cashTransactions?.at(-1)).toMatchObject({
      kind: 'training-upgrade',
      label: 'Pace Tier 2 drill bought',
      amount: -3_000,
      referenceId: 'sprints-ii',
    });
    expect(resolveTrainingDrillForPath(bought, 'sprints').id).toBe('sprints-ii');
    // Every other path is untouched: seven separate decisions, seven bills.
    expect(resolveTrainingDrillForPath(bought, 'duels').id).toBe('duels');

    // Tier 3 is a division away, and the purse paid for exactly one path.
    expect(() => purchaseCareerTrainingUpgrade(bought, 'sprints'))
      .toThrow('Tier 3 drills unlock in D3 · Regional League.');
    expect(() => purchaseCareerTrainingUpgrade(bought, 'keeper-drills'))
      .toThrow('Not enough money.');
  });
});
