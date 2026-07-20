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

  test.each([
    ['outside the facility grid', { x: 7, y: 5 }],
    ['overlaps', { x: 0, y: 0 }],
  ])('rejects a persisted facility that %s', (_label, position) => {
    const initial = createCareer(createLaunchCareerSetup(789));
    const built = buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 }).state;
    const stored = JSON.parse(serializeGameState(built)) as {
      facilities: { grid: { buildings: Array<{ x: number; y: number }> } };
    };
    if (_label === 'outside the facility grid') {
      stored.facilities.grid.buildings[0] = {
        ...stored.facilities.grid.buildings[0],
        ...position,
      };
    } else {
      stored.facilities.grid.buildings.push({
        ...stored.facilities.grid.buildings[0],
        ...position,
      });
      Object.assign(stored.facilities.grid.buildings[1], { id: 'facility-2', type: 'gym' });
    }

    expect(() => parseStoredGameState(JSON.stringify(stored))).toThrow(_label);
  });
});

function completeProject(state: GameState): GameState {
  let grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  while (grid.construction !== undefined) grid = advanceFacilityConstruction(grid).grid;
  return { ...state, facilities: { ...state.facilities, grid } };
}
