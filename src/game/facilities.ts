export const FACILITY_GRID_WIDTH = 8;
export const FACILITY_GRID_HEIGHT = 6;
export const MAX_FACILITY_LEVEL = 3;
export const TRAINING_PITCH_TP_PER_LEVEL = 10;

export type FacilityType =
  | 'training-pitch'
  | 'gym'
  | 'tech-center'
  | 'shooting-range'
  | 'keeper-court'
  | 'medical-bay'
  | 'dorm'
  | 'scout-office'
  | 'coaching-office'
  | 'youth-field'
  | 'fan-shop'
  | 'stadium-stand';

export type FacilityLevel = 1 | 2 | 3;

export interface FacilityFootprint {
  readonly width: number;
  readonly height: number;
}

export interface FacilityCatalogEntry {
  readonly type: FacilityType;
  readonly name: string;
  readonly footprint: FacilityFootprint;
  readonly buildCost: number;
  readonly buildWeeks: number;
  /** Cost to move from the array index + 1 to the next level. */
  readonly upgradeCosts: readonly [number, number];
  /** Weeks to reach levels 2 and 3. */
  readonly upgradeWeeks: readonly [number, number];
  /** Weekly upkeep for levels 1, 2, and 3. */
  readonly weeklyUpkeep: readonly [number, number, number];
  readonly relocationFee: number;
  readonly available: boolean;
}

export const FACILITY_CATALOG: Readonly<Record<FacilityType, FacilityCatalogEntry>> = {
  'training-pitch': facility('training-pitch', 'Training Pitch', 2, 2, 8_000, 2, [8_000, 12_000], [2, 3], [100, 160, 240], 400),
  gym: facility('gym', 'Gym', 1, 1, 7_000, 2, [7_000, 10_500], [2, 3], [90, 140, 210], 350),
  'tech-center': facility('tech-center', 'Tech Center', 1, 1, 9_000, 2, [9_000, 13_500], [2, 3], [110, 175, 260], 450),
  'shooting-range': facility('shooting-range', 'Shooting Range', 1, 2, 7_500, 2, [7_500, 11_250], [2, 3], [95, 150, 225], 375),
  'keeper-court': facility('keeper-court', 'Keeper Court', 1, 2, 7_500, 2, [7_500, 11_250], [2, 3], [95, 150, 225], 375),
  'medical-bay': facility('medical-bay', 'Medical Bay', 1, 1, 10_000, 2, [10_000, 15_000], [2, 3], [125, 200, 300], 500),
  dorm: facility('dorm', 'Dorm', 1, 1, 6_000, 1, [6_000, 9_000], [1, 2], [75, 120, 180], 300),
  'scout-office': facility('scout-office', 'Scout Office', 1, 1, 6_000, 1, [6_000, 9_000], [1, 2], [75, 120, 180], 300),
  'coaching-office': facility('coaching-office', 'Coaching Office', 1, 1, 6_500, 1, [6_500, 9_750], [1, 2], [80, 130, 195], 325),
  'youth-field': facility('youth-field', 'Youth Field', 2, 2, 12_000, 3, [12_000, 18_000], [2, 3], [150, 240, 360], 600),
  'fan-shop': facility('fan-shop', 'Fan Shop', 1, 1, 5_000, 1, [5_000, 7_500], [1, 2], [65, 105, 155], 250),
  'stadium-stand': facility('stadium-stand', 'Stadium Stand', 2, 2, 15_000, 3, [15_000, 22_500], [2, 3], [190, 300, 450], 750),
};

export type FacilityAdjacencyId =
  | 'gym-dorm'
  | 'fan-shop-stadium'
  | 'medical-training-pitch';

export interface FacilityEffects {
  readonly staminaTrainingBonusPercent: number;
  readonly merchIncomeBonusPercent: number;
  readonly injuryRiskReductionPercent: number;
}

export interface FacilityAdjacencyDefinition {
  readonly id: FacilityAdjacencyId;
  readonly first: FacilityType;
  readonly second: FacilityType;
  readonly description: string;
  readonly effects: FacilityEffects;
}

export const FACILITY_ADJACENCIES: readonly FacilityAdjacencyDefinition[] = [
  {
    id: 'gym-dorm',
    first: 'gym',
    second: 'dorm',
    description: 'Gym + Dorm: +10% stamina training gains',
    effects: effects(10, 0, 0),
  },
  {
    id: 'fan-shop-stadium',
    first: 'fan-shop',
    second: 'stadium-stand',
    description: 'Fan Shop + Stadium Stand: +10% merchandise income',
    effects: effects(0, 10, 0),
  },
  {
    id: 'medical-training-pitch',
    first: 'medical-bay',
    second: 'training-pitch',
    description: 'Medical Bay + Training Pitch: -20% injury risk',
    effects: effects(0, 0, 20),
  },
];

export interface FacilityPosition {
  readonly x: number;
  readonly y: number;
}

export interface PlacedFacility extends FacilityPosition {
  readonly id: string;
  readonly type: FacilityType;
  readonly level: FacilityLevel;
  /** True only for facilities the club was founded with, never player-built. */
  readonly seeded?: true;
}

export interface FacilityConstructionProject {
  readonly kind: 'BUILD' | 'UPGRADE';
  readonly buildingId: string;
  readonly type: FacilityType;
  readonly targetLevel: FacilityLevel;
  readonly weeksRemaining: number;
  readonly totalWeeks: number;
}

/** Plain save data: no Maps, Sets, class instances, or generated runtime state. */
export interface FacilityGridState {
  readonly width: typeof FACILITY_GRID_WIDTH;
  readonly height: typeof FACILITY_GRID_HEIGHT;
  readonly nextBuildingId: number;
  readonly buildings: readonly PlacedFacility[];
  readonly discoveredAdjacencies: readonly FacilityAdjacencyId[];
  readonly construction?: FacilityConstructionProject;
}

export interface FacilityConstructionAdvance {
  readonly grid: FacilityGridState;
  readonly completed?: FacilityConstructionProject;
  readonly newlyDiscoveredAdjacencies: readonly FacilityAdjacencyId[];
}

export interface FacilityTransaction {
  readonly grid: FacilityGridState;
  readonly cost: number;
  readonly cashAfter: number;
  readonly newlyDiscoveredAdjacencies: readonly FacilityAdjacencyId[];
}

export function createFacilityGrid(): FacilityGridState {
  return {
    width: FACILITY_GRID_WIDTH,
    height: FACILITY_GRID_HEIGHT,
    nextBuildingId: 1,
    buildings: [],
    discoveredAdjacencies: [],
  };
}

export function buildFacility(
  grid: FacilityGridState,
  type: FacilityType,
  position: FacilityPosition,
  availableCash: number,
): FacilityTransaction {
  validateFacilityGrid(grid);
  validateCash(availableCash);
  assertNoActiveConstruction(grid);
  const definition = definitionFor(type);
  if (!definition.available) throw new Error(`${definition.name} is not unlocked`);
  assertAffordable(availableCash, definition.buildCost);

  const id = `facility-${grid.nextBuildingId}`;
  if (grid.buildings.some(building => building.id === id)) {
    throw new Error(`facility ID ${id} is already in use`);
  }
  const building: PlacedFacility = {
    id,
    type,
    level: 1,
    x: position.x,
    y: position.y,
  };
  validatePlacement(grid, building);

  return transaction(
    {
      ...grid,
      nextBuildingId: checkedAdd(grid.nextBuildingId, 1, 'next facility ID'),
      buildings: [...grid.buildings, building],
      construction: constructionProject(
        'BUILD',
        building,
        1,
        definition.buildWeeks,
      ),
    },
    definition.buildCost,
    availableCash,
  );
}

export function upgradeFacility(
  grid: FacilityGridState,
  buildingId: string,
  availableCash: number,
): FacilityTransaction {
  validateFacilityGrid(grid);
  validateCash(availableCash);
  assertNoActiveConstruction(grid);
  const building = findBuilding(grid, buildingId);
  if (building.level === MAX_FACILITY_LEVEL) {
    throw new Error(`${buildingId} is already at level ${MAX_FACILITY_LEVEL}`);
  }
  const cost = FACILITY_CATALOG[building.type].upgradeCosts[building.level - 1];
  assertAffordable(availableCash, cost);

  const nextLevel = (building.level + 1) as FacilityLevel;
  const weeks = FACILITY_CATALOG[building.type].upgradeWeeks[building.level - 1];
  return transaction(
    {
      ...grid,
      construction: constructionProject('UPGRADE', building, nextLevel, weeks),
    },
    cost,
    availableCash,
  );
}

export function relocateFacility(
  grid: FacilityGridState,
  buildingId: string,
  position: FacilityPosition,
  availableCash: number,
): FacilityTransaction {
  validateFacilityGrid(grid);
  validateCash(availableCash);
  const building = findBuilding(grid, buildingId);
  if (grid.construction?.buildingId === buildingId) {
    throw new Error(`${buildingId} cannot move while construction is active`);
  }
  if (building.x === position.x && building.y === position.y) {
    throw new Error(`${buildingId} is already at that position`);
  }
  const cost = FACILITY_CATALOG[building.type].relocationFee;
  assertAffordable(availableCash, cost);
  const relocated = { ...building, x: position.x, y: position.y };
  validatePlacement(grid, relocated, buildingId);

  return transaction(
    {
      ...grid,
      buildings: grid.buildings.map(candidate => candidate.id === buildingId
        ? relocated
        : candidate),
    },
    cost,
    availableCash,
  );
}

export function weeklyFacilityUpkeep(grid: FacilityGridState): number {
  validateFacilityGrid(grid);
  let total = 0;
  for (const building of grid.buildings) {
    if (!isFacilityOperational(grid, building.id)) continue;
    const upkeep = FACILITY_CATALOG[building.type].weeklyUpkeep[building.level - 1];
    total = checkedAdd(total, upkeep, 'weekly facility upkeep');
  }
  return total;
}

export function isFacilityOperational(grid: FacilityGridState, buildingId: string): boolean {
  const building = findBuilding(grid, buildingId);
  return grid.construction?.kind !== 'BUILD' || grid.construction.buildingId !== building.id;
}

export function advanceFacilityConstruction(
  grid: FacilityGridState,
): FacilityConstructionAdvance {
  validateFacilityGrid(grid);
  const project = grid.construction;
  if (project === undefined) {
    return { grid, newlyDiscoveredAdjacencies: [] };
  }
  if (project.weeksRemaining > 1) {
    return {
      grid: {
        ...grid,
        construction: { ...project, weeksRemaining: project.weeksRemaining - 1 },
      },
      newlyDiscoveredAdjacencies: [],
    };
  }

  const completedGrid: FacilityGridState = {
    ...grid,
    buildings: project.kind === 'UPGRADE'
      ? grid.buildings.map(building => building.id === project.buildingId
        ? { ...building, level: project.targetLevel }
        : building)
      : grid.buildings,
    construction: undefined,
  };
  const active = activeAdjacenciesUnchecked(completedGrid);
  const discovered = new Set(completedGrid.discoveredAdjacencies);
  const newlyDiscoveredAdjacencies = active.filter(id => !discovered.has(id));
  const nextGrid = newlyDiscoveredAdjacencies.length === 0
    ? completedGrid
    : {
        ...completedGrid,
        discoveredAdjacencies: [
          ...completedGrid.discoveredAdjacencies,
          ...newlyDiscoveredAdjacencies,
        ],
      };
  return {
    grid: nextGrid,
    completed: project,
    newlyDiscoveredAdjacencies,
  };
}

export function activeFacilityAdjacencies(
  grid: FacilityGridState,
): FacilityAdjacencyId[] {
  validateFacilityGrid(grid);
  return activeAdjacenciesUnchecked(grid);
}

/** Each named pairing applies at most once, even if several copies touch. */
export function facilityEffects(grid: FacilityGridState): FacilityEffects {
  const active = new Set(activeFacilityAdjacencies(grid));
  let result = effects(0, 0, 0);
  for (const adjacency of FACILITY_ADJACENCIES) {
    if (!active.has(adjacency.id)) continue;
    result = effects(
      checkedAdd(
        result.staminaTrainingBonusPercent,
        adjacency.effects.staminaTrainingBonusPercent,
        'stamina training bonus',
      ),
      checkedAdd(
        result.merchIncomeBonusPercent,
        adjacency.effects.merchIncomeBonusPercent,
        'merchandise income bonus',
      ),
      checkedAdd(
        result.injuryRiskReductionPercent,
        adjacency.effects.injuryRiskReductionPercent,
        'injury risk reduction',
      ),
    );
  }
  return result;
}

function transaction(
  nextGrid: FacilityGridState,
  cost: number,
  availableCash: number,
): FacilityTransaction {
  const active = activeAdjacenciesUnchecked(nextGrid);
  const discovered = new Set(nextGrid.discoveredAdjacencies);
  const newlyDiscoveredAdjacencies = active.filter(id => !discovered.has(id));
  const grid = newlyDiscoveredAdjacencies.length === 0
    ? nextGrid
    : {
        ...nextGrid,
        discoveredAdjacencies: [
          ...nextGrid.discoveredAdjacencies,
          ...newlyDiscoveredAdjacencies,
        ],
      };

  return {
    grid,
    cost,
    cashAfter: availableCash - cost,
    newlyDiscoveredAdjacencies,
  };
}

function activeAdjacenciesUnchecked(grid: FacilityGridState): FacilityAdjacencyId[] {
  const operational = grid.buildings.filter(building => (
    grid.construction?.kind !== 'BUILD' || grid.construction.buildingId !== building.id
  ));
  return FACILITY_ADJACENCIES
    .filter(adjacency => operational.some(first =>
      first.type === adjacency.first
      && operational.some(second =>
        second.id !== first.id
        && second.type === adjacency.second
        && shareEdge(first, second),
      ),
    ))
    .map(adjacency => adjacency.id);
}

function shareEdge(first: PlacedFacility, second: PlacedFacility): boolean {
  const firstFootprint = FACILITY_CATALOG[first.type].footprint;
  const secondFootprint = FACILITY_CATALOG[second.type].footprint;
  const horizontalContact = first.x + firstFootprint.width === second.x
    || second.x + secondFootprint.width === first.x;
  const verticalContact = first.y + firstFootprint.height === second.y
    || second.y + secondFootprint.height === first.y;
  const verticalOverlap = first.y < second.y + secondFootprint.height
    && second.y < first.y + firstFootprint.height;
  const horizontalOverlap = first.x < second.x + secondFootprint.width
    && second.x < first.x + firstFootprint.width;
  return (horizontalContact && verticalOverlap) || (verticalContact && horizontalOverlap);
}

/** Validates every persisted grid invariant, including bounds and overlap. */
export function validateFacilityGrid(grid: FacilityGridState): void {
  if (grid.width !== FACILITY_GRID_WIDTH || grid.height !== FACILITY_GRID_HEIGHT) {
    throw new Error(`facility grid must be ${FACILITY_GRID_WIDTH}x${FACILITY_GRID_HEIGHT}`);
  }
  if (!Number.isSafeInteger(grid.nextBuildingId) || grid.nextBuildingId < 1) {
    throw new Error('next facility ID must be a positive safe integer');
  }
  const ids = new Set<string>();
  for (const building of grid.buildings) {
    if (typeof building.id !== 'string' || building.id.length === 0) {
      throw new Error('facility IDs must be non-empty strings');
    }
    if (ids.has(building.id)) throw new Error(`duplicate facility ID ${building.id}`);
    ids.add(building.id);
    definitionFor(building.type);
    if (!Number.isSafeInteger(building.level)
      || building.level < 1
      || building.level > MAX_FACILITY_LEVEL) {
      throw new Error(`facility ${building.id} level must be from 1 to ${MAX_FACILITY_LEVEL}`);
    }
    validatePlacement(grid, building, building.id);
  }

  const validAdjacencyIds = new Set(FACILITY_ADJACENCIES.map(adjacency => adjacency.id));
  const discoveries = new Set<FacilityAdjacencyId>();
  for (const id of grid.discoveredAdjacencies) {
    if (!validAdjacencyIds.has(id)) throw new Error(`unknown facility adjacency ${String(id)}`);
    if (discoveries.has(id)) throw new Error(`duplicate facility adjacency ${id}`);
    discoveries.add(id);
  }

  const project = grid.construction;
  if (project !== undefined) {
    const building = grid.buildings.find(candidate => candidate.id === project.buildingId);
    if (building === undefined) throw new Error('facility construction references an unknown building');
    if (project.type !== building.type) throw new Error('facility construction type does not match its building');
    if (project.kind === 'BUILD' && (building.level !== 1 || project.targetLevel !== 1)) {
      throw new Error('new facility construction must target level 1');
    }
    if (project.kind === 'UPGRADE' && project.targetLevel !== building.level + 1) {
      throw new Error('facility upgrade must target the next level');
    }
    if (!Number.isSafeInteger(project.weeksRemaining)
      || project.weeksRemaining < 1
      || !Number.isSafeInteger(project.totalWeeks)
      || project.totalWeeks < project.weeksRemaining) {
      throw new Error('facility construction weeks must be positive safe integers');
    }
  }
}

function validatePlacement(
  grid: FacilityGridState,
  building: PlacedFacility,
  ignoredBuildingId?: string,
): void {
  if (!Number.isSafeInteger(building.x) || !Number.isSafeInteger(building.y)) {
    throw new Error('facility position must use integer grid coordinates');
  }
  const footprint = definitionFor(building.type).footprint;
  if (building.x < 0
    || building.y < 0
    || building.x + footprint.width > FACILITY_GRID_WIDTH
    || building.y + footprint.height > FACILITY_GRID_HEIGHT) {
    throw new Error(`${building.id} is outside the facility grid`);
  }
  for (const other of grid.buildings) {
    if (other.id === ignoredBuildingId) continue;
    if (rectanglesOverlap(building, other)) {
      throw new Error(`${building.id} overlaps ${other.id}`);
    }
  }
}

function rectanglesOverlap(first: PlacedFacility, second: PlacedFacility): boolean {
  const firstFootprint = FACILITY_CATALOG[first.type].footprint;
  const secondFootprint = FACILITY_CATALOG[second.type].footprint;
  return first.x < second.x + secondFootprint.width
    && second.x < first.x + firstFootprint.width
    && first.y < second.y + secondFootprint.height
    && second.y < first.y + firstFootprint.height;
}

function findBuilding(grid: FacilityGridState, buildingId: string): PlacedFacility {
  if (typeof buildingId !== 'string' || buildingId.length === 0) {
    throw new Error('facility ID must be a non-empty string');
  }
  const building = grid.buildings.find(candidate => candidate.id === buildingId);
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  return building;
}

function definitionFor(type: FacilityType): FacilityCatalogEntry {
  const definition = FACILITY_CATALOG[type];
  if (definition === undefined) throw new Error(`unknown facility type ${String(type)}`);
  return definition;
}

function validateCash(cash: number): void {
  if (!Number.isSafeInteger(cash) || cash < 0) {
    throw new Error('available cash must be a non-negative safe integer');
  }
}

function assertAffordable(availableCash: number, cost: number): void {
  if (cost > availableCash) throw new Error('facility transaction is not affordable');
}

function assertNoActiveConstruction(grid: FacilityGridState): void {
  if (grid.construction !== undefined) {
    throw new Error('only one facility construction project may be active at a time');
  }
}

function constructionProject(
  kind: FacilityConstructionProject['kind'],
  building: PlacedFacility,
  targetLevel: FacilityLevel,
  weeks: number,
): FacilityConstructionProject {
  if (!Number.isSafeInteger(weeks) || weeks < 1) {
    throw new Error('facility construction duration must be a positive safe integer');
  }
  return {
    kind,
    buildingId: building.id,
    type: building.type,
    targetLevel,
    weeksRemaining: weeks,
    totalWeeks: weeks,
  };
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function facility(
  type: FacilityType,
  name: string,
  width: number,
  height: number,
  buildCost: number,
  buildWeeks: number,
  upgradeCosts: readonly [number, number],
  upgradeWeeks: readonly [number, number],
  weeklyUpkeep: readonly [number, number, number],
  relocationFee: number,
  available = true,
): FacilityCatalogEntry {
  return {
    type,
    name,
    footprint: { width, height },
    buildCost,
    buildWeeks,
    upgradeCosts,
    upgradeWeeks,
    weeklyUpkeep,
    relocationFee,
    available,
  };
}

function effects(
  staminaTrainingBonusPercent: number,
  merchIncomeBonusPercent: number,
  injuryRiskReductionPercent: number,
): FacilityEffects {
  return {
    staminaTrainingBonusPercent,
    merchIncomeBonusPercent,
    injuryRiskReductionPercent,
  };
}
