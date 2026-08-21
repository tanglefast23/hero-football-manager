import { sellingTransferQuote, type ValuationPlayer } from './market';
import { currentUserDivision } from './m2-career';
import { clearCareerContractPromise } from './contract-promises';
import {
  activeFacilityAdjacencies,
  createFacilityGrid,
  FACILITY_CATALOG,
  facilityBuildLimit,
  validateFacilityGrid,
  type FacilityGridState,
  type FacilityPosition,
  type FacilityType,
  type PlacedFacility,
} from './facilities';
import { isAvailableForSelection } from './lineup';
import { compareIds } from './ordering';
import { createEmergencyYouthReplacement } from './youth-intake';
import type {
  BoardCommercialFacilityPlacement,
  BoardSaleCandidate,
  BoardUltimatumResolution,
  BoardUltimatumState,
  CareerPlayer,
  GameState,
} from './types';

export const BOARD_ULTIMATUM_WEEKS = 4;
const BOARD_FORCED_SALE_DISCOUNT_PERCENT = 30 as const;
const BOARD_FORCED_SALE_MORALE_DELTA = -8 as const;

export type BoardForcedSaleResolution = Extract<
  BoardUltimatumResolution,
  { kind: 'FORCED_SALE' }
>;

export type BoardFacilityConversionResolution = Extract<
  BoardUltimatumResolution,
  { kind: 'FACILITY_CONVERSION' }
>;

const BOARD_PROTECTED_FACILITY_TYPES: ReadonlySet<FacilityType> = new Set([
  'training-pitch',
  'coaching-office',
]);
const BOARD_COMMERCIAL_FACILITY_TYPES: ReadonlySet<FacilityType> = new Set([
  'fan-shop',
  'stadium-stand',
]);

/**
 * Creates the exact player list shown to the manager. The board never sells
 * anyone outside this persisted list, and all ordering is deterministic.
 */
export function createBoardUltimatum(
  state: GameState,
): BoardUltimatumState | undefined {
  const candidates = eligibleBoardSaleCandidates(state);
  if (candidates.length < 3) return undefined;
  return {
    id: `board-ultimatum-s${state.season}-w${state.week}`,
    issuedSeason: state.season,
    issuedWeek: state.week,
    weeksRemaining: BOARD_ULTIMATUM_WEEKS,
    targetCash: 0,
    consequence: 'FORCED_SALE',
    candidates: candidates.slice(0, candidates.length >= 4 ? 4 : 3),
  };
}

/** The board's first missed round restructures facilities, never the squad. */
export function createBoardFacilityUltimatum(
  state: GameState,
): BoardUltimatumState {
  return {
    id: `board-facility-ultimatum-s${state.season}-w${state.week}`,
    issuedSeason: state.season,
    issuedWeek: state.week,
    weeksRemaining: BOARD_ULTIMATUM_WEEKS,
    targetCash: 0,
    consequence: 'FACILITY_CONVERSION',
    candidates: [],
  };
}

/** Missing means the original pre-conversion save format: a player-sale round. */
export function boardUltimatumConsequence(
  ultimatum: BoardUltimatumState,
): NonNullable<BoardUltimatumState['consequence']> {
  return ultimatum.consequence ?? 'FORCED_SALE';
}

/**
 * Repairs the saved visible list after a player leaves. Existing safe entries
 * retain their quoted fee; deterministic replacements fill any empty slots.
 */
export function reconcileBoardUltimatumCandidates(state: GameState): GameState {
  const safety = state.financialSafety;
  const ultimatum = safety?.boardUltimatum;
  if (safety === undefined || ultimatum === undefined) return state;
  if (boardUltimatumConsequence(ultimatum) === 'FACILITY_CONVERSION') {
    return state;
  }

  const eligible = eligibleBoardSaleCandidates(state);
  if (eligible.length < 3) {
    const { boardUltimatum: _boardUltimatum, ...withoutUltimatum } = safety;
    return { ...state, financialSafety: withoutUltimatum };
  }
  const eligibleIds = new Set(eligible.map((candidate) => candidate.playerId));
  const targetCount = eligible.length >= 4 ? 4 : 3;
  const candidates = ultimatum.candidates
    .filter((candidate) => eligibleIds.has(candidate.playerId))
    .slice(0, targetCount);
  const retainedIds = new Set(
    candidates.map((candidate) => candidate.playerId),
  );
  for (const candidate of eligible) {
    if (candidates.length >= targetCount) break;
    if (retainedIds.has(candidate.playerId)) continue;
    candidates.push(candidate);
    retainedIds.add(candidate.playerId);
  }
  const eligibleRank = new Map(
    eligible.map((candidate, index) => [candidate.playerId, index]),
  );
  candidates.sort(
    (left, right) =>
      (eligibleRank.get(left.playerId) ?? Number.MAX_SAFE_INTEGER) -
      (eligibleRank.get(right.playerId) ?? Number.MAX_SAFE_INTEGER),
  );
  const protectedPlayerId =
    ultimatum.protectedPlayerId !== undefined &&
    retainedIds.has(ultimatum.protectedPlayerId)
      ? ultimatum.protectedPlayerId
      : undefined;
  const unchanged =
    candidates.length === ultimatum.candidates.length &&
    candidates.every(
      (candidate, index) =>
        candidate.playerId === ultimatum.candidates[index].playerId &&
        candidate.marketValue === ultimatum.candidates[index].marketValue &&
        candidate.forcedSaleFee === ultimatum.candidates[index].forcedSaleFee &&
        candidate.discountPercent ===
          ultimatum.candidates[index].discountPercent,
    ) &&
    protectedPlayerId === ultimatum.protectedPlayerId;
  if (unchanged) return state;
  const { protectedPlayerId: _protectedPlayerId, ...unprotectedUltimatum } =
    ultimatum;
  return {
    ...state,
    financialSafety: {
      ...safety,
      boardUltimatum: {
        ...unprotectedUltimatum,
        candidates,
        ...(protectedPlayerId === undefined ? {} : { protectedPlayerId }),
      },
    },
  };
}

function eligibleBoardSaleCandidates(state: GameState): BoardSaleCandidate[] {
  const lineup = userLineup(state);
  const starters = new Set(lineup.playerIds);
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return state.players
    .filter(
      (player) =>
        player.clubId === state.userClubId &&
        player.id !== state.onboarding?.createdPlayerId &&
        player.contractSeasonsRemaining > 0 &&
        canLeaveWithoutBreakingLineup(state, player),
    )
    .map((player) => ({
      candidate: candidateForPlayer(state, player, division),
      weeklyWage: player.weeklyWage,
      starter: starters.has(player.id) ? 1 : 0,
    }))
    .sort((left, right) => {
      return (
        right.weeklyWage - left.weeklyWage ||
        left.starter - right.starter ||
        right.candidate.forcedSaleFee - left.candidate.forcedSaleFee ||
        compareIds(left.candidate.playerId, right.candidate.playerId)
      );
    })
    .map(({ candidate }) => candidate);
}

/** Selects or changes the one player protected from a board-enforced sale. */
export function protectBoardUltimatumPlayer(
  state: GameState,
  playerId: string,
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('board protection can only change during the manage phase');
  }
  const safety = state.financialSafety;
  const ultimatum = safety?.boardUltimatum;
  if (safety === undefined || ultimatum === undefined) {
    throw new Error('there is no active board ultimatum');
  }
  if (boardUltimatumConsequence(ultimatum) !== 'FORCED_SALE') {
    throw new Error('the active board ultimatum does not threaten a player');
  }
  if (
    !ultimatum.candidates.some((candidate) => candidate.playerId === playerId)
  ) {
    throw new Error(
      'only a player from the visible board candidates may be protected',
    );
  }
  return {
    ...state,
    financialSafety: {
      ...safety,
      boardUltimatum: { ...ultimatum, protectedPlayerId: playerId },
    },
  };
}

/**
 * Plans the board's one facility conversion without spending club cash or
 * touching the normal works crew. The persisted result contains every chosen
 * square, so applying it after settlement cannot make a second placement
 * decision from changed state.
 */
export function boardFacilityConversionAtDeadline(
  state: GameState,
  ultimatum: BoardUltimatumState,
): BoardFacilityConversionResolution {
  const grid = state.facilities.grid ?? createFacilityGrid();
  validateFacilityGrid(grid);
  const base = {
    id: ultimatum.id,
    kind: 'FACILITY_CONVERSION' as const,
    resolvedSeason: state.season,
    resolvedWeek: state.week,
    targetCash: ultimatum.targetCash,
  };
  const standCount = countFacilities(grid, 'stadium-stand');
  const shopCount = countFacilities(grid, 'fan-shop');
  if (
    standCount >= facilityBuildLimit('stadium-stand') &&
    shopCount >= facilityBuildLimit('fan-shop')
  ) {
    return {
      ...base,
      addedFacilities: [],
      failureReason: 'COMMERCIAL_LIMITS_REACHED',
    };
  }

  const replaceable = replaceableBoardFacilities(grid);
  const removed = replaceable[0];
  const cleared =
    removed === undefined ? grid : gridWithoutBuilding(grid, removed.id);
  if (standCount < facilityBuildLimit('stadium-stand')) {
    const position = firstFacilityPosition(cleared, 'stadium-stand');
    if (position !== undefined) {
      return {
        ...base,
        ...(removed === undefined
          ? {}
          : {
              removedFacilityId: removed.id,
              removedFacilityType: removed.type,
            }),
        addedFacilities: commercialPlacements(
          cleared,
          'stadium-stand',
          1,
          position,
        ),
      };
    }
  }

  if (shopCount < facilityBuildLimit('fan-shop')) {
    const additions = fillFanShopPlacements(
      cleared,
      facilityBuildLimit('fan-shop') - shopCount,
    );
    if (additions.length > 0) {
      return {
        ...base,
        ...(removed === undefined
          ? {}
          : {
              removedFacilityId: removed.id,
              removedFacilityType: removed.type,
            }),
        addedFacilities: additions,
      };
    }
  }

  return {
    ...base,
    addedFacilities: [],
    failureReason:
      replaceable.length === 0 ? 'NO_REPLACEABLE_BUILDING' : 'NO_SPACE',
  };
}

/** Applies only the exact removal and placements persisted in the resolution. */
export function applyBoardFacilityConversionConsequences(
  state: GameState,
  resolution: BoardFacilityConversionResolution,
): GameState {
  let grid = state.facilities.grid ?? createFacilityGrid();
  validateFacilityGrid(grid);
  if (resolution.removedFacilityId !== undefined) {
    const removed = grid.buildings.find(
      (building) => building.id === resolution.removedFacilityId,
    );
    if (
      removed === undefined ||
      removed.type !== resolution.removedFacilityType ||
      BOARD_PROTECTED_FACILITY_TYPES.has(removed.type) ||
      BOARD_COMMERCIAL_FACILITY_TYPES.has(removed.type) ||
      grid.construction?.buildingId === removed.id
    ) {
      throw new Error('the board facility removal no longer matches the save');
    }
    grid = gridWithoutBuilding(grid, removed.id);
  }

  for (const addition of resolution.addedFacilities) {
    const expectedId = `facility-${grid.nextBuildingId}`;
    if (addition.buildingId !== expectedId) {
      throw new Error('the board facility addition ID does not match the grid');
    }
    const building: PlacedFacility = {
      id: addition.buildingId,
      type: addition.type,
      level: 1,
      capitalInvested: 0,
      x: addition.x,
      y: addition.y,
    };
    grid = {
      ...grid,
      nextBuildingId: checkedAdd(
        grid.nextBuildingId,
        1,
        'next board facility ID',
      ),
      buildings: [...grid.buildings, building],
    };
    validateFacilityGrid(grid);
  }

  if (resolution.addedFacilities.length > 0) {
    grid = {
      ...grid,
      discoveredAdjacencies: [
        ...new Set([
          ...grid.discoveredAdjacencies,
          ...activeFacilityAdjacencies(grid),
        ]),
      ],
    };
  }
  validateFacilityGrid(grid);
  return {
    ...state,
    facilities: { ...state.facilities, grid },
  };
}

/** Clears a target immediately after an in-week cash-producing transaction. */
export function clearMetBoardUltimatum(state: GameState): GameState {
  const safety = state.financialSafety;
  const ultimatum = safety?.boardUltimatum;
  if (safety === undefined || ultimatum === undefined) return state;
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  if (club.cash < ultimatum.targetCash) return state;
  const { boardUltimatum: _boardUltimatum, ...withoutUltimatum } = safety;
  return {
    ...state,
    financialSafety: {
      ...withoutUltimatum,
      latestBoardResolution: targetMetResolution(state, ultimatum),
    },
  };
}

/** Resolves only from the visible list, skipping its one protected player. */
export function boardForcedSaleAtDeadline(
  state: GameState,
  ultimatum: BoardUltimatumState,
): BoardForcedSaleResolution | undefined {
  const userClub = state.clubs.find((club) => club.id === state.userClubId);
  if (userClub === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  for (const candidate of ultimatum.candidates) {
    if (candidate.playerId === ultimatum.protectedPlayerId) continue;
    const player = state.players.find(
      (item) =>
        item.id === candidate.playerId && item.clubId === state.userClubId,
    );
    if (player === undefined || !canLeaveWithoutBreakingLineup(state, player))
      continue;
    const buyer = state.clubs
      .filter(
        (club) =>
          club.id !== state.userClubId && club.cash >= candidate.forcedSaleFee,
      )
      .slice()
      .sort(
        (left, right) =>
          right.cash - left.cash || compareIds(left.id, right.id),
      )[0];
    if (buyer === undefined) continue;
    const fansLost = Math.min(
      userClub.fans,
      Math.max(25, Math.min(150, Math.floor(userClub.fans / 10))),
    );
    const replacement = createEmergencyYouthReplacement(
      state,
      player.role,
      ultimatum.id,
    );
    return {
      id: ultimatum.id,
      kind: 'FORCED_SALE',
      resolvedSeason: state.season,
      resolvedWeek: state.week,
      targetCash: ultimatum.targetCash,
      playerId: player.id,
      buyerClubId: buyer.id,
      replacementPlayerId: replacement.id,
      fee: candidate.forcedSaleFee,
      discountPercent: BOARD_FORCED_SALE_DISCOUNT_PERCENT,
      moraleDelta: BOARD_FORCED_SALE_MORALE_DELTA,
      fansLost,
    };
  }
  return undefined;
}

/**
 * Applies roster, payroll, buyer-cash, fan, and morale effects. The caller owns
 * the user cash credit because the forced fee is itemized in the weekly ledger.
 */
export function applyBoardForcedSaleConsequences(
  state: GameState,
  resolution: BoardForcedSaleResolution,
): GameState {
  const player = state.players.find(
    (candidate) =>
      candidate.id === resolution.playerId &&
      candidate.clubId === state.userClubId,
  );
  if (player === undefined)
    throw new Error(`unknown board-sale player ${resolution.playerId}`);
  const buyer = state.clubs.find(
    (candidate) => candidate.id === resolution.buyerClubId,
  );
  if (buyer === undefined || buyer.id === state.userClubId) {
    throw new Error(`unknown board-sale buyer ${resolution.buyerClubId}`);
  }
  if (buyer.cash < resolution.fee)
    throw new Error('the board-sale buyer cannot afford the fee');
  const replacement = createEmergencyYouthReplacement(
    state,
    player.role,
    resolution.id,
  );
  if (replacement.id !== resolution.replacementPlayerId) {
    throw new Error(
      'the board-sale replacement does not match the saved resolution',
    );
  }
  const lineups = replaceDepartingStarter(state, player);
  return {
    ...state,
    clubs: state.clubs.map((club) => {
      if (club.id === state.userClubId) {
        return {
          ...club,
          fans: Math.max(0, club.fans - resolution.fansLost),
          weeklyWages: checkedAdd(
            checkedSubtract(
              club.weeklyWages,
              player.weeklyWage,
              'board-sale payroll',
            ),
            replacement.weeklyWage,
            'board relief payroll',
          ),
        };
      }
      if (club.id === buyer.id) {
        return {
          ...club,
          cash: checkedSubtract(
            club.cash,
            resolution.fee,
            'board-sale buyer cash',
          ),
          weeklyWages: checkedAdd(
            club.weeklyWages,
            player.weeklyWage,
            'board-sale buyer payroll',
          ),
        };
      }
      return club;
    }),
    players: [
      ...state.players.map((candidate) => {
        if (candidate.id === player.id) {
          return {
            ...clearCareerContractPromise(candidate),
            clubId: buyer.id,
            licensed: false,
          };
        }
        if (candidate.clubId !== state.userClubId) return candidate;
        return {
          ...candidate,
          morale: Math.max(0, candidate.morale + resolution.moraleDelta),
        };
      }),
      replacement,
    ],
    lineups,
    market:
      state.market === undefined
        ? undefined
        : {
            ...state.market,
            transferListings: (state.market.transferListings ?? []).filter(
              (listing) => listing.playerId !== player.id,
            ),
          },
  };
}

export function targetMetResolution(
  state: Pick<GameState, 'season' | 'week'>,
  ultimatum: BoardUltimatumState,
): BoardUltimatumResolution {
  return {
    id: ultimatum.id,
    kind: 'TARGET_MET',
    resolvedSeason: state.season,
    resolvedWeek: state.week,
    targetCash: ultimatum.targetCash,
  };
}

function countFacilities(grid: FacilityGridState, type: FacilityType): number {
  return grid.buildings.filter((building) => building.type === type).length;
}

function replaceableBoardFacilities(grid: FacilityGridState): PlacedFacility[] {
  return grid.buildings
    .filter(
      (building) =>
        !BOARD_PROTECTED_FACILITY_TYPES.has(building.type) &&
        !BOARD_COMMERCIAL_FACILITY_TYPES.has(building.type) &&
        grid.construction?.buildingId !== building.id,
    )
    .slice()
    .sort((left, right) => {
      const leftDefinition = FACILITY_CATALOG[left.type];
      const rightDefinition = FACILITY_CATALOG[right.type];
      const leftArea =
        leftDefinition.footprint.width * leftDefinition.footprint.height;
      const rightArea =
        rightDefinition.footprint.width * rightDefinition.footprint.height;
      const leftUpkeep = leftDefinition.weeklyUpkeep[left.level - 1];
      const rightUpkeep = rightDefinition.weeklyUpkeep[right.level - 1];
      return (
        rightArea - leftArea ||
        rightUpkeep - leftUpkeep ||
        compareIds(left.id, right.id)
      );
    });
}

function gridWithoutBuilding(
  grid: FacilityGridState,
  buildingId: string,
): FacilityGridState {
  return {
    ...grid,
    buildings: grid.buildings.filter((building) => building.id !== buildingId),
  };
}

function firstFacilityPosition(
  grid: FacilityGridState,
  type: FacilityType,
): FacilityPosition | undefined {
  const footprint = FACILITY_CATALOG[type].footprint;
  for (let y = 0; y <= grid.height - footprint.height; y += 1) {
    for (let x = 0; x <= grid.width - footprint.width; x += 1) {
      const overlaps = grid.buildings.some((building) => {
        const other = FACILITY_CATALOG[building.type].footprint;
        return (
          x < building.x + other.width &&
          building.x < x + footprint.width &&
          y < building.y + other.height &&
          building.y < y + footprint.height
        );
      });
      if (!overlaps) return { x, y };
    }
  }
  return undefined;
}

function commercialPlacements(
  grid: FacilityGridState,
  type: BoardCommercialFacilityPlacement['type'],
  count: number,
  firstPosition?: FacilityPosition,
): BoardCommercialFacilityPlacement[] {
  let simulated = grid;
  const placements: BoardCommercialFacilityPlacement[] = [];
  for (let index = 0; index < count; index += 1) {
    const position =
      index === 0 && firstPosition !== undefined
        ? firstPosition
        : firstFacilityPosition(simulated, type);
    if (position === undefined) break;
    const placement: BoardCommercialFacilityPlacement = {
      buildingId: `facility-${simulated.nextBuildingId}`,
      type,
      x: position.x,
      y: position.y,
    };
    placements.push(placement);
    simulated = {
      ...simulated,
      nextBuildingId: checkedAdd(
        simulated.nextBuildingId,
        1,
        'planned board facility ID',
      ),
      buildings: [
        ...simulated.buildings,
        {
          id: placement.buildingId,
          type,
          level: 1,
          capitalInvested: 0,
          x: placement.x,
          y: placement.y,
        },
      ],
    };
  }
  return placements;
}

function fillFanShopPlacements(
  grid: FacilityGridState,
  count: number,
): BoardCommercialFacilityPlacement[] {
  return commercialPlacements(grid, 'fan-shop', count);
}

function candidateForPlayer(
  state: GameState,
  player: CareerPlayer,
  division: number,
): BoardSaleCandidate {
  const quote = sellingTransferQuote(valuationPlayer(player), {
    careerSeed: state.careerSeed,
    season: state.season,
    week: state.week,
    sellingClubDivision: division,
  });
  return {
    playerId: player.id,
    marketValue: quote.valuation,
    forcedSaleFee: Math.max(1, Math.floor(quote.fee * 0.7)),
    discountPercent: BOARD_FORCED_SALE_DISCOUNT_PERCENT,
  };
}

function valuationPlayer(player: CareerPlayer): ValuationPlayer {
  return {
    id: player.id,
    role: player.role,
    attrs: player.attrs,
    age: player.age ?? 24,
    potential: player.potential ?? 3,
    ...(player.power === undefined
      ? {}
      : { power: player.power, powerTier: player.powerTier ?? 1 }),
    contractSeasonsRemaining: player.contractSeasonsRemaining,
  };
}

function canLeaveWithoutBreakingLineup(
  state: GameState,
  player: CareerPlayer,
): boolean {
  const lineup = userLineup(state);
  if (!lineup.playerIds.includes(player.id)) return true;
  const starterIds = new Set(lineup.playerIds);
  return state.players.some(
    (candidate) =>
      candidate.clubId === state.userClubId &&
      candidate.id !== player.id &&
      !starterIds.has(candidate.id) &&
      isEligibleBoardLineupReplacement(candidate) &&
      (candidate.role === player.role ||
        (candidate.role !== 'GK' && player.role !== 'GK')),
  );
}

function replaceDepartingStarter(
  state: GameState,
  player: CareerPlayer,
): GameState['lineups'] {
  const lineup = userLineup(state);
  if (!lineup.playerIds.includes(player.id)) return state.lineups;
  const starters = new Set(lineup.playerIds);
  const replacement =
    state.players.find(
      (candidate) =>
        candidate.clubId === state.userClubId &&
        candidate.id !== player.id &&
        !starters.has(candidate.id) &&
        isEligibleBoardLineupReplacement(candidate) &&
        candidate.role === player.role,
    ) ??
    state.players.find(
      (candidate) =>
        candidate.clubId === state.userClubId &&
        candidate.id !== player.id &&
        !starters.has(candidate.id) &&
        isEligibleBoardLineupReplacement(candidate) &&
        candidate.role !== 'GK' &&
        player.role !== 'GK',
    );
  if (replacement === undefined) {
    throw new Error('the board-sale player has no eligible lineup replacement');
  }
  return state.lineups.map((candidate) =>
    candidate.clubId === state.userClubId
      ? {
          ...candidate,
          playerIds: candidate.playerIds.map((id) =>
            id === player.id ? replacement.id : id,
          ),
        }
      : candidate,
  );
}

function isEligibleBoardLineupReplacement(player: CareerPlayer): boolean {
  return (
    player.contractSeasonsRemaining > 0 &&
    isAvailableForSelection(player) &&
    !(player.power !== undefined && !player.licensed)
  );
}

function userLineup(state: GameState) {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined) throw new Error('the user club has no lineup');
  return lineup;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  const result = left - right;
  if (!Number.isSafeInteger(result) || result < 0)
    throw new Error(`${label} is invalid`);
  return result;
}
