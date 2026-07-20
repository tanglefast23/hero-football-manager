import {
  FACILITY_CATALOG,
  buildFacility,
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
