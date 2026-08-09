import { loadLaunchContent } from '../../content';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  trainingDrillUpgradeCost,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

describe('drill shop nudge', () => {
  const content = loadLaunchContent();

  /** A promoted club on a quiet week with the money for a tier-2 drill. */
  function promotedDeskClearCareer(
    seed: number,
    division: 4 | 2 = 4,
  ): GameState {
    const started = buildCareerFacility(
      createCareer(createLaunchCareerSetup(seed, undefined, content)),
      'training-pitch',
      { x: 0, y: 0 },
    ).state;
    let grid = started.facilities.grid!;
    while (grid.construction !== undefined) {
      grid = advanceFacilityConstruction(grid).grid;
    }
    return {
      ...started,
      week: 9,
      facilities: { trainingGroundBuilt: true, grid },
      market: undefined,
      m2: { ...started.m2!, highestDivisionReached: division },
      clubs: started.clubs.map((club) =>
        club.id === started.userClubId ? { ...club, cash: 50_000 } : club,
      ),
    };
  }

  it('points out the newly unlocked tier on a quiet week', () => {
    const alerts = homeViewModel(promotedDeskClearCareer(20261101)).alerts;

    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('training-upgrade:tier-2');
    expect(alerts[0].detail).toContain(
      `$${trainingDrillUpgradeCost(2).toLocaleString()}`,
    );
  });

  /** Tiers are bought in order, so D2 does not let a club skip straight to 4. */
  it('names the next tier to buy, not the highest the division allows', () => {
    const alerts = homeViewModel(promotedDeskClearCareer(20261102, 2)).alerts;

    expect(alerts[0].id).toBe('training-upgrade:tier-2');
  });

  it('stays quiet in the division below the first unlock', () => {
    const stillD5 = {
      ...promotedDeskClearCareer(20261103),
      m2: {
        ...promotedDeskClearCareer(20261103).m2!,
        highestDivisionReached: 5 as const,
      },
    };

    expect(homeViewModel(stillD5).alerts).toHaveLength(0);
  });

  it('waits until the club can afford the drill', () => {
    const broke = promotedDeskClearCareer(20261104);
    const poor = {
      ...broke,
      clubs: broke.clubs.map((club) =>
        club.id === broke.userClubId ? { ...club, cash: 10 } : club,
      ),
    };

    expect(homeViewModel(poor).alerts).toHaveLength(0);
  });

  it('goes away for good once the club buys any upgrade', () => {
    const bought = {
      ...promotedDeskClearCareer(20261105),
      ownedTrainingTiers: { sprints: 2 },
    };

    expect(homeViewModel(bought).alerts).toHaveLength(0);
  });

  it('never displaces a real inbox item', () => {
    const clear = promotedDeskClearCareer(20261106);
    const injuredId = clear.players.find(
      (player) => player.clubId === clear.userClubId,
    )!.id;
    const withInjury = {
      ...clear,
      players: clear.players.map((player) =>
        player.id === injuredId ? { ...player, injuryWeeks: 3 } : player,
      ),
    };

    const ids = homeViewModel(withInjury).alerts.map((alert) => alert.id);
    expect(ids).toContain(`injury-${injuredId}`);
    expect(ids.some((id) => id.startsWith('training-upgrade:'))).toBe(false);
  });
});
