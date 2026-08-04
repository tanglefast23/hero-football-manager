import {
  FACILITY_CATALOG,
  buildFacility,
  closeFacility,
  createFacilityGrid,
  isFacilityOperational,
  relocateFacility,
  upgradeFacility,
  type FacilityPosition,
  type FacilityTransaction,
  type FacilityType,
} from './facilities';
import { recordCashTransaction } from './cash-transactions';
import { facilityUpgradeBlockedReason } from './promotion-progression';
import {
  nextTrainingUpgradeOffer,
  trainingPathLabel,
  type TrainingUpgradeOffer,
} from './training-paths';
import type { GameState } from './types';

export interface CareerFacilityTransaction extends FacilityTransaction {
  readonly state: GameState;
}

export function buildCareerFacility(
  state: GameState,
  type: FacilityType,
  position: FacilityPosition,
): CareerFacilityTransaction {
  assertManagementPhase(state);
  const cash = userCash(state);
  const transaction = buildFacility(
    state.facilities.grid ?? createFacilityGrid(),
    type,
    position,
    cash,
  );
  const applied = applyFacilityTransaction(state, transaction);
  const building = transaction.grid.buildings.find(candidate => (
    !state.facilities.grid?.buildings.some(existing => existing.id === candidate.id)
  ));
  if (building === undefined) throw new Error('facility build did not add a building');
  return {
    ...applied,
    state: recordCashTransaction(applied.state, {
      kind: 'facility-build',
      label: `${FACILITY_CATALOG[type].name} construction started`,
      amount: -transaction.cost,
      referenceId: building.id,
    }),
  };
}

export function upgradeCareerFacility(
  state: GameState,
  buildingId: string,
): CareerFacilityTransaction {
  assertManagementPhase(state);
  const current = state.facilities.grid?.buildings.find(candidate => candidate.id === buildingId);
  if (current === undefined) throw new Error(`unknown facility ${buildingId}`);
  if (current.level < 3) {
    const targetLevel = (current.level + 1) as 2 | 3;
    const blockedReason = facilityUpgradeBlockedReason(state, targetLevel);
    if (blockedReason !== undefined) throw new Error(blockedReason);
  }
  const transaction = upgradeFacility(
    state.facilities.grid ?? createFacilityGrid(),
    buildingId,
    userCash(state),
  );
  const applied = applyFacilityTransaction(state, transaction);
  const building = transaction.grid.buildings.find(candidate => candidate.id === buildingId);
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  const targetLevel = transaction.grid.construction?.targetLevel;
  if (targetLevel === undefined) throw new Error('facility upgrade did not start construction');
  return {
    ...applied,
    state: recordCashTransaction(applied.state, {
      kind: 'facility-upgrade',
      label: `${FACILITY_CATALOG[building.type].name} Level ${targetLevel} upgrade started`,
      amount: -transaction.cost,
      referenceId: building.id,
    }),
  };
}

export function relocateCareerFacility(
  state: GameState,
  buildingId: string,
  position: FacilityPosition,
): CareerFacilityTransaction {
  assertManagementPhase(state);
  const transaction = relocateFacility(
    state.facilities.grid ?? createFacilityGrid(),
    buildingId,
    position,
    userCash(state),
  );
  const applied = applyFacilityTransaction(state, transaction);
  const building = transaction.grid.buildings.find(candidate => candidate.id === buildingId);
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  return {
    ...applied,
    state: recordCashTransaction(applied.state, {
      kind: 'facility-relocation',
      label: `Relocated ${FACILITY_CATALOG[building.type].name}`,
      amount: -transaction.cost,
      referenceId: building.id,
    }),
  };
}

/**
 * Demolishes a building and credits half its investment.
 *
 * The refund is the transaction's negative cost, so it reaches the club through
 * the same cash path as a build and lands in the One offs list beside it.
 */
export function closeCareerFacility(
  state: GameState,
  buildingId: string,
): CareerFacilityTransaction {
  assertManagementPhase(state);
  const building = state.facilities.grid?.buildings.find(candidate => candidate.id === buildingId);
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  const transaction = closeFacility(
    state.facilities.grid ?? createFacilityGrid(),
    buildingId,
    userCash(state),
  );
  const applied = applyFacilityTransaction(state, transaction);
  const refund = -transaction.cost;
  // A founding facility cost the club nothing, so closing one credits nothing
  // and there is no money movement worth a line in the list.
  if (refund === 0) return applied;
  return {
    ...applied,
    state: recordCashTransaction(applied.state, {
      kind: 'facility-closure',
      label: `Closed ${FACILITY_CATALOG[building.type].name}`,
      amount: refund,
      referenceId: building.id,
    }),
  };
}

export interface CareerTrainingUpgradeTransaction {
  readonly state: GameState;
  readonly offer: TrainingUpgradeOffer;
}

/**
 * Buys the next drill tier for one training path. No phase assertion: nothing
 * about the purchase is settled weekly the way construction is, and the squad
 * room stays open outside the manage phase.
 */
export function purchaseCareerTrainingUpgrade(
  state: GameState,
  pathId: string,
): CareerTrainingUpgradeTransaction {
  const offer = nextTrainingUpgradeOffer(state, pathId);
  if (offer === undefined) {
    throw new Error(`${trainingPathLabel(pathId)} already owns its best drill`);
  }
  if (offer.blockedReason !== undefined) throw new Error(offer.blockedReason);
  const paid: GameState = {
    ...state,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, cash: club.cash - offer.cost }
      : club),
    ownedTrainingTiers: { ...state.ownedTrainingTiers, [pathId]: offer.tier },
  };
  return {
    offer,
    state: recordCashTransaction(paid, {
      kind: 'training-upgrade',
      label: `${trainingPathLabel(pathId)} Tier ${offer.tier} drill bought`,
      amount: -offer.cost,
      referenceId: offer.drillId,
    }),
  };
}

function applyFacilityTransaction(
  state: GameState,
  transaction: FacilityTransaction,
): CareerFacilityTransaction {
  const stateAfter: GameState = {
    ...state,
    clubs: state.clubs.map(club => club.id === state.userClubId
      ? { ...club, cash: transaction.cashAfter }
      : club),
    facilities: {
      ...state.facilities,
      trainingGroundBuilt: transaction.grid.buildings.some(building => (
        building.type === 'training-pitch'
        && isFacilityOperational(transaction.grid, building.id)
      )),
      grid: transaction.grid,
    },
  };
  return { ...transaction, state: stateAfter };
}

function userCash(state: GameState): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  return club.cash;
}

function assertManagementPhase(state: GameState): void {
  if (state.phase !== 'manage') {
    throw new Error('facility transactions can only happen during the manage phase');
  }
}
