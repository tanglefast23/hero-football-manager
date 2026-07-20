import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { buildCareerFacility } from '../../game/management';
import { advanceFacilityConstruction } from '../../game/facilities';
import type { GameState } from '../../game/types';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('facility game-state persistence', () => {
  test('round-trips the grid, adjacency discoveries, and facility ledger lines', () => {
    const initial = createCareer(createLaunchCareerSetup(123));
    const gym = completeProject(buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state);
    const dorm = completeProject(buildCareerFacility(gym, 'dorm', { x: 1, y: 0 }).state);
    const state = {
      ...dorm,
      players: dorm.players.map((player, index) => index === 0
        ? { ...player, facilityStaBonusRemainder: 70 }
        : player),
      ledgers: [{
        season: 1,
        week: 1,
        lines: [{ kind: 'facilities' as const, label: 'Facility upkeep', amount: -165 }],
        balanceAfter: 30_000,
      }],
    };

    const restored = parseStoredGameState(serializeGameState(state));

    expect(restored.facilities.grid).toEqual(state.facilities.grid);
    expect(restored.facilities.grid?.discoveredAdjacencies).toEqual(['gym-dorm']);
    expect(restored.players[0].facilityStaBonusRemainder).toBe(70);
    expect(restored.ledgers[0].lines[0].kind).toBe('facilities');
  });

  test('loads an M1 save without a grid or stamina-bonus carry', () => {
    const current = createCareer(createLaunchCareerSetup(456));
    const legacy = JSON.parse(JSON.stringify(current)) as {
      facilities: Record<string, unknown>;
      players: Array<Record<string, unknown>>;
    };
    delete legacy.facilities.grid;
    for (const player of legacy.players) delete player.facilityStaBonusRemainder;

    const restored = parseStoredGameState(JSON.stringify(legacy));

    expect(restored.facilities.grid).toBeUndefined();
    expect(restored.players.every(player => player.facilityStaBonusRemainder === undefined))
      .toBe(true);
  });
});

function completeProject(state: GameState): GameState {
  let grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  while (grid.construction !== undefined) grid = advanceFacilityConstruction(grid).grid;
  return { ...state, facilities: { ...state.facilities, grid } };
}
