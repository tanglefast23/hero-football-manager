import {
  FACILITY_ADJACENCIES,
  FACILITY_CATALOG,
  FACILITY_GRID_HEIGHT,
  FACILITY_GRID_WIDTH,
  activeFacilityAdjacencies,
  advanceFacilityConstruction,
  buildFacility,
  closeFacility,
  createFacilityGrid,
  facilityCloseRefund,
  facilityEffects,
  facilityInvestment,
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

function finishConstruction(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined) next = advanceFacilityConstruction(next).grid;
  return next;
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
    ]);
    expect(Object.values(FACILITY_CATALOG).every(entry =>
      entry.buildWeeks >= 1
      && entry.upgradeCosts.length === 2
      && entry.upgradeWeeks.length === 2
      && entry.weeklyUpkeep.length === 3,
    )).toBe(true);
    expect(FACILITY_CATALOG['stadium-stand']).toMatchObject({
      buildCost: 10_000,
      weeklyUpkeep: [50, 80, 120],
    });
    expect(FACILITY_CATALOG['fan-shop'].weeklyUpkeep).toEqual([40, 65, 95]);
    expect(FACILITY_CATALOG['coaching-office'].weeklyUpkeep).toEqual([40, 65, 100]);
    expect(Object.fromEntries(
      Object.entries(FACILITY_CATALOG)
        .filter(([type]) => type !== 'coaching-office')
        .map(([type, entry]) => [type, entry.upgradeCosts]),
    )).toEqual({
      'training-pitch': [10_000, 18_000],
      gym: [9_000, 16_000],
      'tech-center': [11_500, 20_500],
      'shooting-range': [9_500, 17_000],
      'keeper-court': [9_500, 17_000],
      'medical-bay': [12_500, 22_500],
      dorm: [7_500, 13_500],
      'scout-office': [7_500, 13_500],
      'youth-field': [15_000, 27_000],
      'fan-shop': [6_500, 11_500],
      'stadium-stand': [19_000, 34_000],
    });
  });

  test('builds immutably, charges the catalog cost, and generates stable IDs', () => {
    const empty = createFacilityGrid();
    const first = build(empty, 'gym', { x: 2, y: 1 }, 20_000);
    const completedFirst = finishConstruction(first.grid);
    const second = build(completedFirst, 'dorm', { x: 3, y: 1 }, first.cashAfter);

    expect(empty.buildings).toEqual([]);
    expect(first).toMatchObject({ cost: 7_000, cashAfter: 13_000 });
    expect(second).toMatchObject({ cost: 6_000, cashAfter: 7_000 });
    expect(second.grid.buildings).toEqual([
      { id: 'facility-1', type: 'gym', level: 1, capitalInvested: 7_000, x: 2, y: 1 },
      { id: 'facility-2', type: 'dorm', level: 1, capitalInvested: 6_000, x: 3, y: 1 },
    ]);
    expect(second.grid.construction).toMatchObject({
      kind: 'BUILD',
      buildingId: 'facility-2',
      weeksRemaining: 1,
    });
    expect(first.grid.construction).toMatchObject({
      kind: 'BUILD',
      buildingId: 'facility-1',
      weeksRemaining: 2,
    });
    expect(() => build(first.grid, 'dorm', { x: 3, y: 1 }, first.cashAfter))
      .toThrow(/only one facility construction project/);

    const replay = build(
      finishConstruction(build(createFacilityGrid(), 'gym', { x: 2, y: 1 }, 20_000).grid),
      'dorm',
      { x: 3, y: 1 },
      13_000,
    );
    expect(JSON.stringify(replay)).toBe(JSON.stringify(second));
    expect(JSON.parse(JSON.stringify(second.grid))).toEqual(second.grid);
  });

  test('rejects locked, unaffordable, out-of-bounds, fractional, and overlapping builds', () => {
    const grid = finishConstruction(build(createFacilityGrid(), 'training-pitch', { x: 0, y: 0 }).grid);

    expect(() => buildFacility(grid, 'training-pitch', { x: 4, y: 0 }, 1_000_000))
      .toThrow(/Training Pitch is already built/);
    expect(() => buildFacility(grid, 'gym', { x: 3, y: 3 }, 6_999))
      .toThrow(/not affordable/);
    expect(() => buildFacility(grid, 'youth-field', { x: 7, y: 5 }, 1_000_000))
      .toThrow(/outside/);
    expect(() => buildFacility(grid, 'gym', { x: 2.5, y: 2 }, 1_000_000))
      .toThrow(/integer grid coordinates/);
    expect(() => buildFacility(grid, 'medical-bay', { x: 1, y: 1 }, 1_000_000))
      .toThrow(/overlaps/);
  });

  test('rejects a second copy while the first copy is still under construction', () => {
    const grid = build(createFacilityGrid(), 'gym', { x: 0, y: 0 }).grid;

    expect(() => buildFacility(grid, 'gym', { x: 2, y: 0 }, 1_000_000))
      .toThrow(/Gym is already built/);
  });

  test('allows three income buildings of each type and rejects a fourth', () => {
    let shops = createFacilityGrid();
    for (let index = 0; index < 3; index += 1) {
      shops = finishConstruction(build(shops, 'fan-shop', { x: index, y: 0 }).grid);
    }
    expect(shops.buildings.map(building => building.type)).toEqual([
      'fan-shop',
      'fan-shop',
      'fan-shop',
    ]);
    expect(() => build(shops, 'fan-shop', { x: 3, y: 0 }))
      .toThrow(/Fan Shop limit reached.*up to 3/);

    let stands = createFacilityGrid();
    for (let index = 0; index < 3; index += 1) {
      stands = finishConstruction(build(stands, 'stadium-stand', { x: index * 2, y: 0 }).grid);
    }
    expect(() => build(stands, 'stadium-stand', { x: 6, y: 0 }))
      .toThrow(/Stadium Stand limit reached.*up to 3/);
  });

  test('asks repeatable income buildings to wait while the works crew is busy', () => {
    const firstShop = build(createFacilityGrid(), 'fan-shop', { x: 0, y: 0 }).grid;

    expect(() => build(firstShop, 'fan-shop', { x: 1, y: 0 }))
      .toThrow(/only one facility construction project/);
  });
});

describe('facility upgrades and upkeep', () => {
  test('upgrades through level 3, charges each level, and totals weekly upkeep', () => {
    const built = build(createFacilityGrid(), 'gym', { x: 0, y: 0 }, 50_000);
    expect(built.grid.buildings[0].capitalInvested).toBe(7_000);
    const ready = finishConstruction(built.grid);
    const levelTwoProject = upgradeFacility(ready, 'facility-1', built.cashAfter);
    expect(levelTwoProject.grid.buildings[0].level).toBe(1);
    expect(levelTwoProject.grid.buildings[0].capitalInvested).toBe(16_000);
    expect(weeklyFacilityUpkeep(levelTwoProject.grid)).toBe(90);
    const levelTwoGrid = finishConstruction(levelTwoProject.grid);
    expect(levelTwoGrid.buildings[0].capitalInvested).toBe(16_000);
    const levelThreeProject = upgradeFacility(levelTwoGrid, 'facility-1', levelTwoProject.cashAfter);
    expect(levelThreeProject.grid.buildings[0].capitalInvested).toBe(32_000);
    const levelThreeGrid = finishConstruction(levelThreeProject.grid);

    expect(levelTwoProject).toMatchObject({ cost: 9_000, cashAfter: 34_000 });
    expect(levelThreeProject).toMatchObject({ cost: 16_000, cashAfter: 18_000 });
    expect(levelThreeGrid.buildings[0].level).toBe(3);
    expect(levelThreeGrid.buildings[0].capitalInvested).toBe(32_000);
    expect(weeklyFacilityUpkeep(levelThreeGrid)).toBe(210);
    expect(() => upgradeFacility(levelThreeGrid, 'facility-1', 100_000))
      .toThrow(/already at level 3/);
  });

  test('validates upgrade identity and affordability', () => {
    const grid = finishConstruction(build(createFacilityGrid(), 'medical-bay', { x: 0, y: 0 }).grid);

    expect(() => upgradeFacility(grid, 'missing', 100_000)).toThrow(/unknown facility/);
    expect(() => upgradeFacility(grid, 'facility-1', 12_499)).toThrow(/not affordable/);
  });

  test('rejects Coaching Office upgrades because higher levels have no benefit', () => {
    const grid = finishConstruction(
      build(createFacilityGrid(), 'coaching-office', { x: 0, y: 0 }).grid,
    );

    expect(() => upgradeFacility(grid, 'facility-1', 100_000))
      .toThrow(/Coaching Office upgrades are disabled/);
  });

  test('upgrades one income building without changing its other copies', () => {
    let grid = finishConstruction(build(createFacilityGrid(), 'fan-shop', { x: 0, y: 0 }).grid);
    grid = finishConstruction(build(grid, 'fan-shop', { x: 1, y: 0 }).grid);

    const upgrading = finishConstruction(upgradeFacility(grid, 'facility-2', 100_000).grid);

    expect(upgrading.buildings.map(building => [building.id, building.level])).toEqual([
      ['facility-1', 1],
      ['facility-2', 2],
    ]);
  });

  test('rejects persisted investment outside the non-negative safe-integer invariant', () => {
    const grid = finishConstruction(build(createFacilityGrid(), 'gym', { x: 0, y: 0 }).grid);
    const withInvestment = (capitalInvested: number): FacilityGridState => ({
      ...grid,
      buildings: grid.buildings.map(building => ({ ...building, capitalInvested })),
    });

    expect(() => weeklyFacilityUpkeep(withInvestment(-1)))
      .toThrow(/capital invested must be a non-negative safe integer/);
    expect(() => weeklyFacilityUpkeep(withInvestment(1.5)))
      .toThrow(/capital invested must be a non-negative safe integer/);
  });
});

describe('closing a facility', () => {
  test('refunds half of the build and every finished upgrade, and frees the square', () => {
    const built = build(createFacilityGrid(), 'gym', { x: 0, y: 0 }, 30_000);
    const ready = finishConstruction(built.grid);
    const upgraded = finishConstruction(upgradeFacility(ready, 'facility-1', 30_000).grid);

    // 7,000 built + 9,000 to reach Level 2.
    expect(facilityInvestment(upgraded.buildings[0])).toBe(16_000);
    const closed = closeFacility(upgraded, 'facility-1', 1_000);

    expect(closed).toMatchObject({ cost: -8_000, cashAfter: 9_000 });
    expect(closed.grid.buildings).toEqual([]);
    expect(weeklyFacilityUpkeep(closed.grid)).toBe(0);
  });

  test('gives nothing back for a founding facility the club never paid for', () => {
    const seeded: FacilityGridState = {
      ...createFacilityGrid(),
      nextBuildingId: 2,
      buildings: [{
        id: 'facility-1',
        type: 'dorm',
        level: 1,
        capitalInvested: 0,
        x: 0,
        y: 0,
        seeded: true,
      }],
    };

    expect(facilityCloseRefund(seeded.buildings[0])).toBe(0);
    expect(closeFacility(seeded, 'facility-1', 500)).toMatchObject({ cost: 0, cashAfter: 500 });
  });

  /**
   * The state closing exists for. A struggling club sits under water for weeks
   * by design — the difficulty cash floor is -15,000 on Cozy and -30,000 on
   * Chairman — and cutting upkeep is what a manager does about it. Refusing the
   * credit there made the button throw at exactly the moment it was needed.
   */
  test('pays out while the club is in the red, where spending is still refused', () => {
    const grid = finishConstruction(build(createFacilityGrid(), 'gym', { x: 0, y: 0 }, 30_000).grid);
    const closed = closeFacility(grid, 'facility-1', -10_000);

    expect(closed).toMatchObject({ cost: -3_500, cashAfter: -6_500 });
    expect(closed.grid.buildings).toEqual([]);
    expect(() => upgradeFacility(grid, 'facility-1', -10_000))
      .toThrow(/non-negative safe integer/);
    expect(() => buildFacility(grid, 'dorm', { x: 4, y: 4 }, -10_000))
      .toThrow(/non-negative safe integer/);
    expect(() => relocateFacility(grid, 'facility-1', { x: 4, y: 4 }, -10_000))
      .toThrow(/non-negative safe integer/);
    // A credit still refuses nonsense; only the floor was lifted.
    expect(() => closeFacility(grid, 'facility-1', 1.5)).toThrow(/safe integer/);
  });

  test('refuses to demolish whatever the crew is currently on', () => {
    const built = build(createFacilityGrid(), 'gym', { x: 0, y: 0 }, 30_000);

    expect(() => closeFacility(built.grid, 'facility-1', 1_000))
      .toThrow(/cannot close while construction is active/);
    expect(() => closeFacility(finishConstruction(built.grid), 'missing', 1_000))
      .toThrow(/unknown facility/);
  });

  test('rebuilding costs full price, so closing is never a discount', () => {
    const built = build(createFacilityGrid(), 'gym', { x: 0, y: 0 }, 30_000);
    const closed = closeFacility(finishConstruction(built.grid), 'facility-1', built.cashAfter);
    const rebuilt = build(closed.grid, 'gym', { x: 0, y: 0 }, closed.cashAfter);

    expect(rebuilt.cost).toBe(FACILITY_CATALOG.gym.buildCost);
    expect(rebuilt.grid.buildings[0].level).toBe(1);
    // 30,000 out, 3,500 back, 7,000 out again: two builds cost more than one.
    expect(rebuilt.cashAfter).toBeLessThan(built.cashAfter);
  });
});

describe('facility relocation and adjacency', () => {
  test('relocates for the explicit fee without changing level or identity', () => {
    const built = build(createFacilityGrid(), 'shooting-range', { x: 0, y: 0 }, 10_000);
    const ready = finishConstruction(built.grid);
    const upgraded = upgradeFacility(ready, 'facility-1', 20_000);
    const upgradedGrid = finishConstruction(upgraded.grid);
    const moved = relocateFacility(upgradedGrid, 'facility-1', { x: 7, y: 4 }, 1_000);

    expect(moved).toMatchObject({ cost: 375, cashAfter: 625 });
    expect(moved.grid.buildings[0]).toEqual({
      id: 'facility-1',
      type: 'shooting-range',
      level: 2,
      capitalInvested: 17_000,
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
    grid = finishConstruction(build(grid, 'gym', { x: 0, y: 0 }).grid);
    const gymDorm = build(grid, 'dorm', { x: 1, y: 0 });
    expect(gymDorm.newlyDiscoveredAdjacencies).toEqual([]);
    const gymDormComplete = advanceFacilityConstruction(gymDorm.grid);
    expect(gymDormComplete.newlyDiscoveredAdjacencies).toEqual(['gym-dorm']);
    grid = gymDormComplete.grid;

    grid = finishConstruction(build(grid, 'fan-shop', { x: 0, y: 2 }).grid);
    grid = finishConstruction(build(grid, 'stadium-stand', { x: 1, y: 2 }).grid);
    grid = finishConstruction(build(grid, 'medical-bay', { x: 4, y: 0 }).grid);
    grid = finishConstruction(build(grid, 'training-pitch', { x: 5, y: 0 }).grid);

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

  test('charges $230 a week for the four Level-1 opening facilities', () => {
    let grid = finishConstruction(build(createFacilityGrid(), 'training-pitch', { x: 0, y: 0 }).grid);
    grid = finishConstruction(build(grid, 'coaching-office', { x: 2, y: 0 }).grid);
    grid = finishConstruction(build(grid, 'fan-shop', { x: 3, y: 0 }).grid);
    grid = finishConstruction(build(grid, 'stadium-stand', { x: 4, y: 0 }).grid);

    expect(weeklyFacilityUpkeep(grid)).toBe(230);
  });

  test('does not count diagonal corners as adjacent or stack duplicate pairs', () => {
    let grid = finishConstruction(build(createFacilityGrid(), 'gym', { x: 0, y: 0 }).grid);
    grid = finishConstruction(build(grid, 'dorm', { x: 1, y: 1 }).grid);
    expect(activeFacilityAdjacencies(grid)).toEqual([]);

    grid = relocateFacility(grid, 'facility-2', { x: 1, y: 0 }, 1_000).grid;
    // Schema-3 careers could already contain duplicates. New purchases reject
    // them, but decoding an old career must keep its paid building and the
    // adjacency engine must still avoid stacking its benefit.
    grid = {
      ...grid,
      nextBuildingId: 4,
      buildings: [...grid.buildings, {
        id: 'facility-3',
        type: 'gym',
        level: 1,
        capitalInvested: 7_000,
        x: 2,
        y: 0,
      }],
    };
    expect(activeFacilityAdjacencies(grid)).toEqual(['gym-dorm']);
    expect(facilityEffects(grid).staminaTrainingBonusPercent).toBe(10);
  });

  test('rejects relocations that overlap another footprint or cannot be afforded', () => {
    let grid = finishConstruction(build(createFacilityGrid(), 'youth-field', { x: 0, y: 0 }).grid);
    grid = finishConstruction(build(grid, 'gym', { x: 3, y: 0 }).grid);

    expect(() => relocateFacility(grid, 'facility-2', { x: 1, y: 1 }, 1_000))
      .toThrow(/overlaps/);
    expect(() => relocateFacility(grid, 'facility-2', { x: 4, y: 0 }, 349))
      .toThrow(/not affordable/);
  });
});
