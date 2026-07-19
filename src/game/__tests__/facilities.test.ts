import {
  FACILITY_ADJACENCIES,
  FACILITY_CATALOG,
  FACILITY_GRID_HEIGHT,
  FACILITY_GRID_WIDTH,
  activeFacilityAdjacencies,
  buildFacility,
  createFacilityGrid,
  facilityEffects,
  relocateFacility,
  upgradeFacility,
  weeklyFacilityUpkeep,
  type FacilityGridState,
  type FacilityPosition,
  type FacilityType,
} from '../facilities';

function build(
  grid: FacilityGridState,
  type: FacilityType,
  position: FacilityPosition,
  cash = 1_000_000,
) {
  return buildFacility(grid, type, position, cash);
}

describe('facility catalog and grid', () => {
  test('defines the complete M2 catalog on a deterministic 8x6 grid', () => {
    const grid = createFacilityGrid();

    expect([grid.width, grid.height]).toEqual([FACILITY_GRID_WIDTH, FACILITY_GRID_HEIGHT]);
    expect(Object.keys(FACILITY_CATALOG)).toEqual([
      'training-pitch',
      'gym',
      'tech-center',
      'shooting-range',
      'keeper-court',
      'medical-bay',
      'dorm',
      'scout-office',
      'coaching-office',
      'youth-field',
      'fan-shop',
      'stadium-stand',
      'hero-lab',
    ]);
    expect(Object.values(FACILITY_CATALOG).every(entry =>
      entry.upgradeCosts.length === 2 && entry.weeklyUpkeep.length === 3,
    )).toBe(true);
    expect(FACILITY_CATALOG['hero-lab'].available).toBe(false);
  });

  test('builds immutably, charges the catalog cost, and generates stable IDs', () => {
    const empty = createFacilityGrid();
    const first = build(empty, 'gym', { x: 2, y: 1 }, 20_000);
    const second = build(first.grid, 'dorm', { x: 3, y: 1 }, first.cashAfter);

    expect(empty.buildings).toEqual([]);
    expect(first).toMatchObject({ cost: 7_000, cashAfter: 13_000 });
    expect(second).toMatchObject({ cost: 6_000, cashAfter: 7_000 });
    expect(second.grid.buildings).toEqual([
      { id: 'facility-1', type: 'gym', level: 1, x: 2, y: 1 },
      { id: 'facility-2', type: 'dorm', level: 1, x: 3, y: 1 },
    ]);

    const replay = build(
      build(createFacilityGrid(), 'gym', { x: 2, y: 1 }, 20_000).grid,
      'dorm',
      { x: 3, y: 1 },
      13_000,
    );
    expect(JSON.stringify(replay)).toBe(JSON.stringify(second));
    expect(JSON.parse(JSON.stringify(second.grid))).toEqual(second.grid);
  });

  test('rejects locked, unaffordable, out-of-bounds, fractional, and overlapping builds', () => {
    const grid = build(createFacilityGrid(), 'training-pitch', { x: 0, y: 0 }).grid;

    expect(() => buildFacility(grid, 'hero-lab', { x: 3, y: 3 }, 1_000_000))
      .toThrow(/not unlocked/);
    expect(() => buildFacility(grid, 'gym', { x: 3, y: 3 }, 6_999))
      .toThrow(/not affordable/);
    expect(() => buildFacility(grid, 'youth-field', { x: 7, y: 5 }, 1_000_000))
      .toThrow(/outside/);
    expect(() => buildFacility(grid, 'gym', { x: 2.5, y: 2 }, 1_000_000))
      .toThrow(/integer grid coordinates/);
    expect(() => buildFacility(grid, 'medical-bay', { x: 1, y: 1 }, 1_000_000))
      .toThrow(/overlaps/);
  });
});

describe('facility upgrades and upkeep', () => {
  test('upgrades through level 3, charges each level, and totals weekly upkeep', () => {
    const built = build(createFacilityGrid(), 'gym', { x: 0, y: 0 }, 30_000);
    const levelTwo = upgradeFacility(built.grid, 'facility-1', built.cashAfter);
    const levelThree = upgradeFacility(levelTwo.grid, 'facility-1', levelTwo.cashAfter);

    expect(levelTwo).toMatchObject({ cost: 7_000, cashAfter: 16_000 });
    expect(levelThree).toMatchObject({ cost: 10_500, cashAfter: 5_500 });
    expect(levelThree.grid.buildings[0].level).toBe(3);
    expect(weeklyFacilityUpkeep(levelThree.grid)).toBe(210);
    expect(() => upgradeFacility(levelThree.grid, 'facility-1', 100_000))
      .toThrow(/already at level 3/);
  });

  test('validates upgrade identity and affordability', () => {
    const grid = build(createFacilityGrid(), 'medical-bay', { x: 0, y: 0 }).grid;

    expect(() => upgradeFacility(grid, 'missing', 100_000)).toThrow(/unknown facility/);
    expect(() => upgradeFacility(grid, 'facility-1', 9_999)).toThrow(/not affordable/);
  });
});

describe('facility relocation and adjacency', () => {
  test('relocates for the explicit fee without changing level or identity', () => {
    const built = build(createFacilityGrid(), 'shooting-range', { x: 0, y: 0 }, 10_000);
    const upgraded = upgradeFacility(built.grid, 'facility-1', 20_000);
    const moved = relocateFacility(upgraded.grid, 'facility-1', { x: 7, y: 4 }, 1_000);

    expect(moved).toMatchObject({ cost: 375, cashAfter: 625 });
    expect(moved.grid.buildings[0]).toEqual({
      id: 'facility-1',
      type: 'shooting-range',
      level: 2,
      x: 7,
      y: 4,
    });
    expect(() => relocateFacility(moved.grid, 'facility-1', { x: 6, y: 5 }, 1_000))
      .toThrow(/outside/);
    expect(() => relocateFacility(moved.grid, 'facility-1', { x: 7, y: 4 }, 1_000))
      .toThrow(/already at that position/);
  });

  test('discovers all three orthogonal pairings, applies effects once, and remembers discoveries', () => {
    let grid = createFacilityGrid();
    grid = build(grid, 'gym', { x: 0, y: 0 }).grid;
    const gymDorm = build(grid, 'dorm', { x: 1, y: 0 });
    expect(gymDorm.newlyDiscoveredAdjacencies).toEqual(['gym-dorm']);
    grid = gymDorm.grid;

    grid = build(grid, 'fan-shop', { x: 0, y: 2 }).grid;
    grid = build(grid, 'stadium-stand', { x: 1, y: 2 }).grid;
    grid = build(grid, 'medical-bay', { x: 4, y: 0 }).grid;
    grid = build(grid, 'training-pitch', { x: 5, y: 0 }).grid;

    expect(activeFacilityAdjacencies(grid)).toEqual(FACILITY_ADJACENCIES.map(item => item.id));
    expect(grid.discoveredAdjacencies).toEqual(FACILITY_ADJACENCIES.map(item => item.id));
    expect(facilityEffects(grid)).toEqual({
      staminaTrainingBonusPercent: 10,
      merchIncomeBonusPercent: 10,
      injuryRiskReductionPercent: 20,
    });

    const moved = relocateFacility(grid, 'facility-2', { x: 7, y: 5 }, 1_000);
    expect(activeFacilityAdjacencies(moved.grid)).toEqual([
      'fan-shop-stadium',
      'medical-training-pitch',
    ]);
    expect(moved.grid.discoveredAdjacencies).toEqual(FACILITY_ADJACENCIES.map(item => item.id));
    expect(moved.newlyDiscoveredAdjacencies).toEqual([]);
  });

  test('does not count diagonal corners as adjacent or stack duplicate pairs', () => {
    let grid = build(createFacilityGrid(), 'gym', { x: 0, y: 0 }).grid;
    grid = build(grid, 'dorm', { x: 1, y: 1 }).grid;
    expect(activeFacilityAdjacencies(grid)).toEqual([]);

    grid = relocateFacility(grid, 'facility-2', { x: 1, y: 0 }, 1_000).grid;
    grid = build(grid, 'gym', { x: 2, y: 0 }).grid;
    expect(activeFacilityAdjacencies(grid)).toEqual(['gym-dorm']);
    expect(facilityEffects(grid).staminaTrainingBonusPercent).toBe(10);
  });

  test('rejects relocations that overlap another footprint or cannot be afforded', () => {
    let grid = build(createFacilityGrid(), 'youth-field', { x: 0, y: 0 }).grid;
    grid = build(grid, 'gym', { x: 3, y: 0 }).grid;

    expect(() => relocateFacility(grid, 'facility-2', { x: 1, y: 1 }, 1_000))
      .toThrow(/overlaps/);
    expect(() => relocateFacility(grid, 'facility-2', { x: 4, y: 0 }, 349))
      .toThrow(/not affordable/);
  });
});
