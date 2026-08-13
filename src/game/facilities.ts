import { scaledTrainingPoints } from './training-point-income';

export const FACILITY_GRID_WIDTH = 8;
export const FACILITY_GRID_HEIGHT = 6;
export const MAX_FACILITY_LEVEL = 3;
export const MAX_INCOME_FACILITY_COPIES = 3;
/**
 * Training Points a completed Training Pitch adds each week, per level.
 *
 * This is the club's main TP income and the thing that makes Division 5
 * escapable. Measured over three D5 seasons with the whole bank spent every
 * week (ramp probe, seed 4000000, all 90 fixtures a season):
 *
 * | manager                | season 1     | season 2      | season 3 |
 * |------------------------|--------------|---------------|----------|
 * | trains and builds      | 8th, sq 48.8 | 1st, PROMOTED | 1st (D4) |
 * | trains, never builds   | 8th, sq 39.7 | 10th          | 10th     |
 * | never trains           | 6th          | 10th          | 10th     |
 *
 * At 10 nobody escaped D5 in three seasons however hard they trained: a
 * Level 2 pitch plus BASE_WEEKLY_TRAINING_POINTS came to 44 TP a week, which
 * grows the squad about 7 points a season, and promotion needs roughly +11 over
 * the opening deficit. 28 puts a Level 2 pitch at 80 TP a week, which is the
 * measured rate that promotes in season 2 — the intended "one or two seasons of
 * building facilities and training".
 *
 * Raising this makes the Pitch more decisive, not less; lowering it toward the
 * baseline makes the building optional again, which is what broke D5.
 *
 * The 28 measured above is the full rate; `TRAINING_POINT_SCALE_PERCENT`
 * cuts it to 12 (2026-08-10, every TP source at 40%). A Level 2 pitch
 * now banks 34 TP a week rather than the 80 in the table, so the promotion
 * measured there arrives later — the table is kept because it is still the
 * reason the Pitch, not the baseline, is the building that earns promotion.
 */
export const TRAINING_PITCH_TP_PER_LEVEL = scaledTrainingPoints(28);

/**
 * Training Points earned every week with no Training Pitch built at all.
 *
 * A club can run drills on whatever field it has. Without this baseline the
 * weekly income was `trainingPitchLevel * TRAINING_PITCH_TP_PER_LEVEL`, and no
 * Training Pitch exists at career start, so a career earned **zero TP per week,
 * indefinitely** — it could only ever spend the 30 TP it launched with. Measured
 * over two D5 seasons with the whole bank spent every week (ramp probe):
 *
 * | base | drills/season | squad mean, season 1 → 2 |
 * |------|---------------|--------------------------|
 * | 0    | 3 per season  | 36.0 → 32.4 (decays)     |
 * | 24   | 72            | 39.7 → 42.0 (grows)      |
 * | 60   | 177           | 45.9 → 54.1              |
 *
 * 24 is the smallest value that turns squad decay into growth, and it is
 * deliberately not enough to win anything: a manager who trains every week but
 * never builds a Training Pitch finishes 8th, 10th, 10th across three D5
 * seasons. That is the intended floor — the club can always run drills, but
 * TRAINING_PITCH_TP_PER_LEVEL is what actually earns promotion. Do not raise
 * this toward the Pitch's own rate; a baseline large enough to promote on its
 * own would make the building optional, which is the trap that produced a
 * career earning zero TP forever in the first place.
 *
 * The 24 measured above is the full rate; `TRAINING_POINT_SCALE_PERCENT`
 * cuts it to 10 (2026-08-10, every TP source at 40%). That is still
 * above the zero-income trap and still nowhere near promoting on its own.
 */
export const BASE_WEEKLY_TRAINING_POINTS = scaledTrainingPoints(24);

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

/**
 * Fan Shops and Stadium Stands are commercial buildings: the club may open up
 * to three of each. Every training, recovery, scouting, staff, and youth
 * facility remains one per club so the grounds stay readable and those effects
 * never need hidden stacking rules.
 */
export function facilityBuildLimit(type: FacilityType): number {
  return type === 'fan-shop' || type === 'stadium-stand'
    ? MAX_INCOME_FACILITY_COPIES
    : 1;
}

export interface FacilityFootprint {
  readonly width: number;
  readonly height: number;
}

/**
 * Catalog keys for the building names, so the UI can draw them in the player's
 * language.
 *
 * Keys rather than an injected `t`, because `src/game` is a pure ring and its
 * architecture test forbids importing `src/i18n` — see
 * `docs/superpowers/specs/2026-08-06-multilingual-copy-design.md` §3, "at the
 * UI edge, never in the pure rings". `FacilityCatalogEntry.name` stays as the
 * English source and the fallback, the same dual-write `LedgerLine.label` and
 * `DIVISION_NAME_KEYS` use.
 *
 * A separate table rather than a twelfth argument to `facility()` below: the
 * catalog rows are already long enough to hide a typo in, and a key that can be
 * grepped as a set is what a coverage gate reads.
 */
export const FACILITY_NAME_KEYS: Readonly<Record<FacilityType, string>> = {
  'training-pitch': 'facility.name.trainingPitch',
  gym: 'facility.name.gym',
  'tech-center': 'facility.name.techCenter',
  'shooting-range': 'facility.name.shootingRange',
  'keeper-court': 'facility.name.keeperCourt',
  'medical-bay': 'facility.name.medicalBay',
  dorm: 'facility.name.dorm',
  'scout-office': 'facility.name.scoutOffice',
  'coaching-office': 'facility.name.coachingOffice',
  'youth-field': 'facility.name.youthField',
  'fan-shop': 'facility.name.fanShop',
  'stadium-stand': 'facility.name.stadiumStand',
};

interface FacilityCatalogEntry {
  readonly type: FacilityType;
  readonly name: string;
  /** Catalog key for `name`, so a translated screen can render either. */
  readonly nameKey: string;
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

export const FACILITY_CATALOG: Readonly<
  Record<FacilityType, FacilityCatalogEntry>
> = {
  'training-pitch': facility(
    'training-pitch',
    'Training Pitch',
    2,
    2,
    8_000,
    2,
    [10_000, 18_000],
    [2, 3],
    [100, 160, 240],
    400,
  ),
  gym: facility(
    'gym',
    'Gym',
    1,
    1,
    7_000,
    2,
    [9_000, 16_000],
    [2, 3],
    [90, 140, 210],
    350,
  ),
  'tech-center': facility(
    'tech-center',
    'Tech Center',
    1,
    1,
    9_000,
    2,
    [11_500, 20_500],
    [2, 3],
    [110, 175, 260],
    450,
  ),
  'shooting-range': facility(
    'shooting-range',
    'Shooting Range',
    1,
    2,
    7_500,
    2,
    [9_500, 17_000],
    [2, 3],
    [95, 150, 225],
    375,
  ),
  'keeper-court': facility(
    'keeper-court',
    'Keeper Court',
    1,
    2,
    7_500,
    2,
    [9_500, 17_000],
    [2, 3],
    [95, 150, 225],
    375,
  ),
  'medical-bay': facility(
    'medical-bay',
    'Medical Bay',
    1,
    1,
    10_000,
    2,
    [12_500, 22_500],
    [2, 3],
    [125, 200, 300],
    500,
  ),
  dorm: facility(
    'dorm',
    'Dorm',
    1,
    1,
    6_000,
    1,
    [7_500, 13_500],
    [1, 2],
    [75, 120, 180],
    300,
  ),
  'scout-office': facility(
    'scout-office',
    'Scout Office',
    1,
    1,
    6_000,
    1,
    [7_500, 13_500],
    [1, 2],
    [75, 120, 180],
    300,
  ),
  'coaching-office': facility(
    'coaching-office',
    'Coaching Office',
    1,
    1,
    6_500,
    1,
    [6_500, 9_750],
    [1, 2],
    [40, 65, 100],
    325,
  ),
  'youth-field': facility(
    'youth-field',
    'Youth Field',
    2,
    2,
    12_000,
    3,
    [15_000, 27_000],
    [2, 3],
    [150, 240, 360],
    600,
  ),
  'fan-shop': facility(
    'fan-shop',
    'Fan Shop',
    1,
    1,
    5_000,
    1,
    [6_500, 11_500],
    [1, 2],
    [40, 65, 95],
    250,
  ),
  // At the D5 floor (500 fans, $4 tickets), Level 1 adds $1,200 per home gate.
  // Across nine league gates that is $10,800, less $1,500 annual upkeep: a
  // $9,300 return and roughly 1.1-season payback before Cup ties.
  'stadium-stand': facility(
    'stadium-stand',
    'Stadium Stand',
    2,
    2,
    10_000,
    3,
    [19_000, 34_000],
    [2, 3],
    [50, 80, 120],
    750,
  ),
};

export type FacilityAdjacencyId =
  'gym-dorm' | 'fan-shop-stadium' | 'medical-training-pitch';

interface FacilityEffects {
  readonly staminaTrainingBonusPercent: number;
  readonly merchIncomeBonusPercent: number;
  readonly injuryRiskReductionPercent: number;
}

interface FacilityAdjacencyDefinition {
  readonly id: FacilityAdjacencyId;
  readonly first: FacilityType;
  readonly second: FacilityType;
  readonly description: string;
  /** Catalog key for `description`, dual-written like `nameKey` above. */
  readonly descriptionKey: string;
  readonly effects: FacilityEffects;
}

export const FACILITY_ADJACENCIES: readonly FacilityAdjacencyDefinition[] = [
  {
    id: 'gym-dorm',
    first: 'gym',
    second: 'dorm',
    description: 'Gym + Dorm: +10% stamina training gains',
    descriptionKey: 'facility.adjacency.gymDorm',
    effects: effects(10, 0, 0),
  },
  {
    id: 'fan-shop-stadium',
    first: 'fan-shop',
    second: 'stadium-stand',
    description: 'Fan Shop + Stadium Stand: +10% merchandise income',
    descriptionKey: 'facility.adjacency.fanShopStadium',
    effects: effects(0, 10, 0),
  },
  {
    id: 'medical-training-pitch',
    first: 'medical-bay',
    second: 'training-pitch',
    description: 'Medical Bay + Training Pitch: -20% injury risk',
    descriptionKey: 'facility.adjacency.medicalTrainingPitch',
    effects: effects(0, 0, 20),
  },
];

export interface FacilityPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * What a story has permanently changed about how well one building works.
 *
 * Deliberately four named fields rather than one "output" percent: the game's
 * seven facility benefits are not the same kind of number. A percent of the
 * dorm's "+4 recovery per level" rounds to nothing, and the medical bay's
 * benefit is whole weeks of recovery, which no percentage can move by a
 * sensible amount. Each field says which real formula it scales.
 *
 * Never `level` — that only ever goes up through building, and there is no
 * downgrade concept anywhere in the game to borrow.
 */
export interface FacilityBoosts {
  /** Percentage points on the Training Pitch's TP contribution. */
  readonly tpBonusPercent?: number;
  /** Percentage points on the *bonus part* of a training building's multiplier. */
  readonly trainingBonusPercent?: number;
  /** Flat points on the Dorm's weekly condition recovery. */
  readonly recoveryBonus?: number;
  /** Percentage points on this shop's or stand's own share of the income. */
  readonly incomeBonusPercent?: number;
}

/** How far a story may ever move one building, in either direction. */
export const FACILITY_BOOST_CAPS = {
  tpBonusPercent: 20,
  trainingBonusPercent: 20,
  recoveryBonus: 3,
  incomeBonusPercent: 20,
} as const;

export interface PlacedFacility extends FacilityPosition {
  readonly id: string;
  readonly type: FacilityType;
  readonly level: FacilityLevel;
  /** Cash actually paid for this building and every started upgrade. */
  readonly capitalInvested: number;
  /** True only for facilities the club was founded with, never player-built. */
  readonly seeded?: true;
  /** Absent on every building no story has touched, which is most of them. */
  readonly boosts?: FacilityBoosts;
}

/** A story's change to one building, clamped to its cap wherever it is read. */
export function cappedFacilityBoost(
  boosts: FacilityBoosts | undefined,
  facet: keyof typeof FACILITY_BOOST_CAPS,
): number {
  const raw = boosts?.[facet] ?? 0;
  if (!Number.isSafeInteger(raw))
    throw new Error(`facility ${facet} boost must be a safe integer`);
  const cap = FACILITY_BOOST_CAPS[facet];
  return Math.max(-cap, Math.min(cap, raw));
}

interface FacilityConstructionProject {
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

interface FacilityConstructionAdvance {
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
  validateSpendableCash(availableCash);
  const definition = definitionFor(type);
  if (!definition.available)
    throw new Error(`${definition.name} is not unlocked`);
  const copiesBuilt = grid.buildings.filter(
    (building) => building.type === type,
  ).length;
  const buildLimit = facilityBuildLimit(type);
  if (copiesBuilt >= buildLimit) {
    throw new Error(
      buildLimit === 1
        ? `${definition.name} is already built; upgrade or move the existing facility`
        : `${definition.name} limit reached; the club may build up to ${buildLimit}`,
    );
  }
  assertNoActiveConstruction(grid);
  assertAffordable(availableCash, definition.buildCost);

  const id = `facility-${grid.nextBuildingId}`;
  if (grid.buildings.some((building) => building.id === id)) {
    throw new Error(`facility ID ${id} is already in use`);
  }
  const building: PlacedFacility = {
    id,
    type,
    level: 1,
    capitalInvested: definition.buildCost,
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
  validateSpendableCash(availableCash);
  assertNoActiveConstruction(grid);
  const building = findBuilding(grid, buildingId);
  if (building.type === 'coaching-office') {
    throw new Error(
      'Coaching Office upgrades are disabled until they have a gameplay benefit',
    );
  }
  if (building.level === MAX_FACILITY_LEVEL) {
    throw new Error(`${buildingId} is already at level ${MAX_FACILITY_LEVEL}`);
  }
  const cost = FACILITY_CATALOG[building.type].upgradeCosts[building.level - 1];
  assertAffordable(availableCash, cost);

  const nextLevel = (building.level + 1) as FacilityLevel;
  const weeks =
    FACILITY_CATALOG[building.type].upgradeWeeks[building.level - 1];
  const paidBuilding: PlacedFacility = {
    ...building,
    capitalInvested: checkedAdd(
      building.capitalInvested,
      cost,
      'facility investment',
    ),
  };
  return transaction(
    {
      ...grid,
      buildings: grid.buildings.map((candidate) =>
        candidate.id === buildingId ? paidBuilding : candidate,
      ),
      construction: constructionProject(
        'UPGRADE',
        paidBuilding,
        nextLevel,
        weeks,
      ),
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
  validateSpendableCash(availableCash);
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
      buildings: grid.buildings.map((candidate) =>
        candidate.id === buildingId ? relocated : candidate,
      ),
    },
    cost,
    availableCash,
  );
}

/** Everything the club actually paid, including work still under construction. */
export function facilityInvestment(building: PlacedFacility): number {
  validateCapitalInvested(building);
  return building.capitalInvested;
}

/** Half of what went in, rounded down. Closing is meant to hurt a little. */
export function facilityCloseRefund(building: PlacedFacility): number {
  return Math.floor(facilityInvestment(building) / 2);
}

/**
 * Demolish a building and hand back half its investment.
 *
 * The square is freed and the level is gone for good: a rebuilt facility starts
 * at Level 1 and pays full price again, so this is never a cheaper route to
 * anything. It exists so a bad early build, or a wage bill that has outgrown
 * the upkeep, is recoverable rather than permanent.
 */
export function closeFacility(
  grid: FacilityGridState,
  buildingId: string,
  availableCash: number,
): FacilityTransaction {
  validateFacilityGrid(grid);
  validateCash(availableCash);
  const building = findBuilding(grid, buildingId);
  if (grid.construction?.buildingId === buildingId) {
    throw new Error(`${buildingId} cannot close while construction is active`);
  }
  // A negative cost is a credit; `transaction` already computes cash after.
  // Negated through a guard rather than plainly, because `-0` is a real value
  // that survives into a transaction and reads as a signed refund of nothing.
  const refund = facilityCloseRefund(building);
  return transaction(
    {
      ...grid,
      buildings: grid.buildings.filter(
        (candidate) => candidate.id !== buildingId,
      ),
    },
    refund === 0 ? 0 : -refund,
    availableCash,
  );
}

export function weeklyFacilityUpkeep(grid: FacilityGridState): number {
  validateFacilityGrid(grid);
  let total = 0;
  for (const building of grid.buildings) {
    if (!isFacilityOperational(grid, building.id)) continue;
    const upkeep =
      FACILITY_CATALOG[building.type].weeklyUpkeep[building.level - 1];
    total = checkedAdd(total, upkeep, 'weekly facility upkeep');
  }
  return total;
}

export function isFacilityOperational(
  grid: FacilityGridState,
  buildingId: string,
): boolean {
  const building = findBuilding(grid, buildingId);
  return (
    grid.construction?.kind !== 'BUILD' ||
    grid.construction.buildingId !== building.id
  );
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
        construction: {
          ...project,
          weeksRemaining: project.weeksRemaining - 1,
        },
      },
      newlyDiscoveredAdjacencies: [],
    };
  }

  const completedGrid: FacilityGridState = {
    ...grid,
    buildings:
      project.kind === 'UPGRADE'
        ? grid.buildings.map((building) =>
            building.id === project.buildingId
              ? { ...building, level: project.targetLevel }
              : building,
          )
        : grid.buildings,
    construction: undefined,
  };
  const active = activeAdjacenciesUnchecked(completedGrid);
  const discovered = new Set(completedGrid.discoveredAdjacencies);
  const newlyDiscoveredAdjacencies = active.filter((id) => !discovered.has(id));
  const nextGrid =
    newlyDiscoveredAdjacencies.length === 0
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
  const newlyDiscoveredAdjacencies = active.filter((id) => !discovered.has(id));
  const grid =
    newlyDiscoveredAdjacencies.length === 0
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

function activeAdjacenciesUnchecked(
  grid: FacilityGridState,
): FacilityAdjacencyId[] {
  const operational = grid.buildings.filter(
    (building) =>
      grid.construction?.kind !== 'BUILD' ||
      grid.construction.buildingId !== building.id,
  );
  return FACILITY_ADJACENCIES.filter((adjacency) =>
    operational.some(
      (first) =>
        first.type === adjacency.first &&
        operational.some(
          (second) =>
            second.id !== first.id &&
            second.type === adjacency.second &&
            shareEdge(first, second),
        ),
    ),
  ).map((adjacency) => adjacency.id);
}

function shareEdge(first: PlacedFacility, second: PlacedFacility): boolean {
  const firstFootprint = FACILITY_CATALOG[first.type].footprint;
  const secondFootprint = FACILITY_CATALOG[second.type].footprint;
  const horizontalContact =
    first.x + firstFootprint.width === second.x ||
    second.x + secondFootprint.width === first.x;
  const verticalContact =
    first.y + firstFootprint.height === second.y ||
    second.y + secondFootprint.height === first.y;
  const verticalOverlap =
    first.y < second.y + secondFootprint.height &&
    second.y < first.y + firstFootprint.height;
  const horizontalOverlap =
    first.x < second.x + secondFootprint.width &&
    second.x < first.x + firstFootprint.width;
  return (
    (horizontalContact && verticalOverlap) ||
    (verticalContact && horizontalOverlap)
  );
}

/** Validates every persisted grid invariant, including bounds and overlap. */
export function validateFacilityGrid(grid: FacilityGridState): void {
  if (
    grid.width !== FACILITY_GRID_WIDTH ||
    grid.height !== FACILITY_GRID_HEIGHT
  ) {
    throw new Error(
      `facility grid must be ${FACILITY_GRID_WIDTH}x${FACILITY_GRID_HEIGHT}`,
    );
  }
  if (!Number.isSafeInteger(grid.nextBuildingId) || grid.nextBuildingId < 1) {
    throw new Error('next facility ID must be a positive safe integer');
  }
  const ids = new Set<string>();
  for (const building of grid.buildings) {
    if (typeof building.id !== 'string' || building.id.length === 0) {
      throw new Error('facility IDs must be non-empty strings');
    }
    if (ids.has(building.id))
      throw new Error(`duplicate facility ID ${building.id}`);
    ids.add(building.id);
    definitionFor(building.type);
    if (
      !Number.isSafeInteger(building.level) ||
      building.level < 1 ||
      building.level > MAX_FACILITY_LEVEL
    ) {
      throw new Error(
        `facility ${building.id} level must be from 1 to ${MAX_FACILITY_LEVEL}`,
      );
    }
    validateCapitalInvested(building);
    validatePlacement(grid, building, building.id);
  }

  const validAdjacencyIds = new Set(
    FACILITY_ADJACENCIES.map((adjacency) => adjacency.id),
  );
  const discoveries = new Set<FacilityAdjacencyId>();
  for (const id of grid.discoveredAdjacencies) {
    if (!validAdjacencyIds.has(id))
      throw new Error(`unknown facility adjacency ${String(id)}`);
    if (discoveries.has(id))
      throw new Error(`duplicate facility adjacency ${id}`);
    discoveries.add(id);
  }

  const project = grid.construction;
  if (project !== undefined) {
    const building = grid.buildings.find(
      (candidate) => candidate.id === project.buildingId,
    );
    if (building === undefined)
      throw new Error('facility construction references an unknown building');
    if (project.type !== building.type)
      throw new Error('facility construction type does not match its building');
    if (
      project.kind === 'BUILD' &&
      (building.level !== 1 || project.targetLevel !== 1)
    ) {
      throw new Error('new facility construction must target level 1');
    }
    if (
      project.kind === 'UPGRADE' &&
      project.targetLevel !== building.level + 1
    ) {
      throw new Error('facility upgrade must target the next level');
    }
    if (
      !Number.isSafeInteger(project.weeksRemaining) ||
      project.weeksRemaining < 1 ||
      !Number.isSafeInteger(project.totalWeeks) ||
      project.totalWeeks < project.weeksRemaining
    ) {
      throw new Error(
        'facility construction weeks must be positive safe integers',
      );
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
  if (
    building.x < 0 ||
    building.y < 0 ||
    building.x + footprint.width > FACILITY_GRID_WIDTH ||
    building.y + footprint.height > FACILITY_GRID_HEIGHT
  ) {
    throw new Error(`${building.id} is outside the facility grid`);
  }
  for (const other of grid.buildings) {
    if (other.id === ignoredBuildingId) continue;
    if (rectanglesOverlap(building, other)) {
      throw new Error(`${building.id} overlaps ${other.id}`);
    }
  }
}

function rectanglesOverlap(
  first: PlacedFacility,
  second: PlacedFacility,
): boolean {
  const firstFootprint = FACILITY_CATALOG[first.type].footprint;
  const secondFootprint = FACILITY_CATALOG[second.type].footprint;
  return (
    first.x < second.x + secondFootprint.width &&
    second.x < first.x + firstFootprint.width &&
    first.y < second.y + secondFootprint.height &&
    second.y < first.y + firstFootprint.height
  );
}

function findBuilding(
  grid: FacilityGridState,
  buildingId: string,
): PlacedFacility {
  if (typeof buildingId !== 'string' || buildingId.length === 0) {
    throw new Error('facility ID must be a non-empty string');
  }
  const building = grid.buildings.find(
    (candidate) => candidate.id === buildingId,
  );
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  return building;
}

function definitionFor(type: FacilityType): FacilityCatalogEntry {
  const definition = FACILITY_CATALOG[type];
  if (definition === undefined)
    throw new Error(`unknown facility type ${String(type)}`);
  return definition;
}

function validateCash(cash: number): void {
  if (!Number.isSafeInteger(cash)) {
    throw new Error('available cash must be a safe integer');
  }
}

function validateCapitalInvested(building: PlacedFacility): void {
  if (
    !Number.isSafeInteger(building.capitalInvested) ||
    building.capitalInvested < 0
  ) {
    throw new Error(
      `facility ${building.id} capital invested must be a non-negative safe integer`,
    );
  }
}

/**
 * The non-negative floor, asserted only for transactions that take money.
 *
 * A club in trouble sits below zero for weeks by design: the fail-soft economy
 * runs on a difficulty cash floor of -15,000 (Cozy) or -30,000 (Chairman), and
 * several negative weeks have to pass before the board intervenes at all. A
 * credit has to stay reachable in exactly that state, because cutting upkeep
 * you can no longer pay is the whole point of closing a building. Only spends
 * need a balance to spend from.
 */
function validateSpendableCash(cash: number): void {
  validateCash(cash);
  if (cash < 0) {
    throw new Error('available cash must be a non-negative safe integer');
  }
}

function assertAffordable(availableCash: number, cost: number): void {
  if (cost > availableCash)
    throw new Error('facility transaction is not affordable');
}

function assertNoActiveConstruction(grid: FacilityGridState): void {
  if (grid.construction !== undefined) {
    throw new Error(
      'only one facility construction project may be active at a time',
    );
  }
}

function constructionProject(
  kind: FacilityConstructionProject['kind'],
  building: PlacedFacility,
  targetLevel: FacilityLevel,
  weeks: number,
): FacilityConstructionProject {
  if (!Number.isSafeInteger(weeks) || weeks < 1) {
    throw new Error(
      'facility construction duration must be a positive safe integer',
    );
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
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

/**
 * @i18n-fallback — `name` arrives as an argument and is kept beside the
 * `nameKey` this attaches from `FACILITY_NAME_KEYS`. The UI draws the key; these
 * words are the fallback and the source the translations were written from.
 */
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
    nameKey: FACILITY_NAME_KEYS[type],
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
