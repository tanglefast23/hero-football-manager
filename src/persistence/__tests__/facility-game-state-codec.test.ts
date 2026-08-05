import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { buildCareerFacility, closeCareerFacility } from '../../game/management';
import { advanceFacilityConstruction } from '../../game/facilities';
import type { GameState } from '../../game/types';
import {
  migrateStoredGameState,
  parseStoredGameState,
  serializeGameState,
} from '../game-state-codec';

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

  /**
   * Closing is reachable while the club is under water, so the credit it logs
   * can leave a negative balance behind it. Every other cash transaction is a
   * purchase, which needs money to make, so this field was non-negative until
   * now — a save written after an underwater closure would have failed to load.
   */
  test('round-trips a closure logged while the club was in the red', () => {
    const initial = createCareer(createLaunchCareerSetup(20260804));
    const built = completeProject(buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state);
    const broke = {
      ...built,
      clubs: built.clubs.map(club => (
        club.id === built.userClubId ? { ...club, cash: -10_000 } : club
      )),
    };
    const closed = closeCareerFacility(broke, 'facility-1').state;

    expect(closed.clubs.find(club => club.id === closed.userClubId)?.cash).toBe(-6_500);
    expect(closed.cashTransactions?.at(-1)).toMatchObject({
      kind: 'facility-closure',
      amount: 3_500,
      balanceAfter: -6_500,
    });
    expect(parseStoredGameState(serializeGameState(closed)).cashTransactions?.at(-1))
      .toEqual(closed.cashTransactions?.at(-1));
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

  test('drops retired Hero Essence and Hero Lab data from older development saves', () => {
    const current = createCareer(createLaunchCareerSetup(457));
    const legacy = JSON.parse(serializeGameState(current)) as {
      heroEssence?: number;
      facilities: {
        grid: {
          buildings: Array<Record<string, unknown>>;
          construction?: Record<string, unknown>;
        };
      };
    };
    legacy.heroEssence = 12;
    legacy.facilities.grid.buildings.push({
      id: 'facility-99',
      type: 'hero-lab',
      level: 1,
      x: 6,
      y: 4,
    });
    legacy.facilities.grid.construction = {
      kind: 'BUILD',
      buildingId: 'facility-99',
      type: 'hero-lab',
      targetLevel: 1,
      weeksRemaining: 4,
      totalWeeks: 4,
    };

    const restored = parseStoredGameState(JSON.stringify(legacy));

    expect('heroEssence' in restored).toBe(false);
    expect(restored.facilities.grid?.buildings).toEqual([]);
    expect(restored.facilities.grid?.construction).toBeUndefined();
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

  test.each([
    ['seeded Level 3', { level: 3, seeded: true }, undefined, 20_000],
    ['player-built Level 3', { level: 3 }, undefined, 28_000],
    [
      'paid Level 2 upgrade underway',
      { level: 1 },
      { kind: 'UPGRADE', targetLevel: 2, weeksRemaining: 2, totalWeeks: 2 },
      16_000,
    ],
    [
      'paid build underway',
      { level: 1 },
      { kind: 'BUILD', targetLevel: 1, weeksRemaining: 2, totalWeeks: 2 },
      8_000,
    ],
  ] as const)(
    'migrates the frozen schema-3 Training Pitch basis for %s',
    (_label, buildingPatch, constructionPatch, expectedBasis) => {
      const legacy = schema3CareerWithPitch(buildingPatch, constructionPatch);

      const migrated = migrateStoredGameState(legacy) as unknown as GameState;

      expect(migrated.facilities.grid?.buildings[0].capitalInvested).toBe(expectedBasis);
      expect(parseStoredGameState(JSON.stringify(migrated)).facilities.grid?.buildings[0])
        .toMatchObject({ type: 'training-pitch', capitalInvested: expectedBasis });
    },
  );

  test('requires a nonnegative safe capital basis in every schema-4 building', () => {
    const current = createCareer(createLaunchCareerSetup(20260806));
    const invalid = {
      ...current,
      facilities: {
        ...current.facilities,
        grid: {
          ...current.facilities.grid!,
          nextBuildingId: 2,
          buildings: [{
            id: 'facility-1',
            type: 'gym' as const,
            level: 1 as const,
            capitalInvested: -1,
            x: 0,
            y: 0,
          }],
        },
      },
    };

    expect(() => serializeGameState(invalid)).toThrow(/capitalInvested|capital invested/);
    expect(() => parseStoredGameState(JSON.stringify(invalid)))
      .toThrow(/capitalInvested|capital invested/);
  });
});

function completeProject(state: GameState): GameState {
  let grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  while (grid.construction !== undefined) grid = advanceFacilityConstruction(grid).grid;
  return { ...state, facilities: { ...state.facilities, grid } };
}

type MutableRecord = Record<string, unknown>;

function schema3CareerWithPitch(
  buildingPatch: Readonly<{ level: number; seeded?: true }>,
  constructionPatch: Readonly<{
    kind: 'BUILD' | 'UPGRADE';
    targetLevel: number;
    weeksRemaining: number;
    totalWeeks: number;
  }> | undefined,
): MutableRecord {
  const legacy = JSON.parse(JSON.stringify(
    createCareer(createLaunchCareerSetup(20260807)),
  )) as MutableRecord;
  legacy.schemaVersion = 3;
  delete legacy.clubBusiness;
  delete legacy.sponsorRules;
  const facilities = legacy.facilities as MutableRecord;
  const grid = facilities.grid as MutableRecord;
  grid.nextBuildingId = 2;
  grid.buildings = [{
    id: 'facility-1',
    type: 'training-pitch',
    ...buildingPatch,
    x: 0,
    y: 0,
  }];
  grid.discoveredAdjacencies = [];
  if (constructionPatch === undefined) {
    delete grid.construction;
  } else {
    grid.construction = {
      ...constructionPatch,
      buildingId: 'facility-1',
      type: 'training-pitch',
    };
  }
  return legacy;
}
