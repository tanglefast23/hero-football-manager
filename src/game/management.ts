import {
  FACILITY_CATALOG,
  FACILITY_NAME_KEYS,
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
  trainingPathLabelKey,
  type TrainingUpgradeOffer,
} from './training-paths';
import { dismissCareerCoach } from './market-career';
import type { GameState } from './types';

interface CareerFacilityTransaction extends FacilityTransaction {
  readonly state: GameState;
}

/**
 * The placeholders a facility cash line needs, in both halves.
 *
 * `facility` is the English name, which is what the persisted `label` reads and
 * what the line falls back to. `facilityKey` is a param whose VALUE is itself a
 * catalog key: this ring cannot translate the building's name, so it names it
 * and the screen resolves the two together. Facility names are translated
 * everywhere else in the game, and leaving one English inside an otherwise
 * translated sentence is the exact defect that put keys beside `DIVISION_NAMES`.
 */
function facilityLabelParams(
  type: FacilityType,
): Readonly<Record<string, string>> {
  return {
    facility: FACILITY_CATALOG[type].name,
    facilityKey: FACILITY_NAME_KEYS[type],
  };
}

/** Everything the confirmation needs to explain one staffed-office closure. */
interface StaffedCoachingOfficeClosureConfirmation {
  readonly buildingId: string;
  readonly assistantId: string;
  readonly assistantName: string;
  readonly cashBefore: number;
  readonly severanceCost: number;
  readonly facilityRefund: number;
  /** Positive means the close raises cash; negative means it consumes cash. */
  readonly netCashEffect: number;
  readonly cashAfter: number;
  readonly shortage: number;
  readonly canConfirm: boolean;
}

interface StaffedCoachingOfficeClosureTransaction {
  readonly state: GameState;
  readonly confirmation: StaffedCoachingOfficeClosureConfirmation;
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
  const building = transaction.grid.buildings.find(
    (candidate) =>
      !state.facilities.grid?.buildings.some(
        (existing) => existing.id === candidate.id,
      ),
  );
  if (building === undefined)
    throw new Error('facility build did not add a building');
  return {
    ...applied,
    state: recordCashTransaction(applied.state, {
      kind: 'facility-build',
      label: `${FACILITY_CATALOG[type].name} construction started`,
      labelKey: 'cashTransaction.facilityBuild',
      labelParams: facilityLabelParams(type),
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
  const current = state.facilities.grid?.buildings.find(
    (candidate) => candidate.id === buildingId,
  );
  if (current === undefined) throw new Error(`unknown facility ${buildingId}`);
  if (current.level < 3) {
    const targetLevel = (current.level + 1) as 2 | 3;
    const blockedReason = facilityUpgradeBlockedReason(state, targetLevel);
    // The English half: an engine error names an invariant break for a
    // developer, and the screen has already refused the tap in the player's
    // language before it can be reached.
    if (blockedReason !== undefined) throw new Error(blockedReason.text);
  }
  const transaction = upgradeFacility(
    state.facilities.grid ?? createFacilityGrid(),
    buildingId,
    userCash(state),
  );
  const applied = applyFacilityTransaction(state, transaction);
  const building = transaction.grid.buildings.find(
    (candidate) => candidate.id === buildingId,
  );
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  const targetLevel = transaction.grid.construction?.targetLevel;
  if (targetLevel === undefined)
    throw new Error('facility upgrade did not start construction');
  return {
    ...applied,
    state: recordCashTransaction(applied.state, {
      kind: 'facility-upgrade',
      label: `${FACILITY_CATALOG[building.type].name} Level ${targetLevel} upgrade started`,
      labelKey: 'cashTransaction.facilityUpgrade',
      labelParams: {
        ...facilityLabelParams(building.type),
        level: targetLevel,
      },
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
  const building = transaction.grid.buildings.find(
    (candidate) => candidate.id === buildingId,
  );
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  return {
    ...applied,
    state: recordCashTransaction(applied.state, {
      kind: 'facility-relocation',
      label: `Relocated ${FACILITY_CATALOG[building.type].name}`,
      labelKey: 'cashTransaction.facilityRelocated',
      labelParams: facilityLabelParams(building.type),
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
  const building = state.facilities.grid?.buildings.find(
    (candidate) => candidate.id === buildingId,
  );
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  if (
    building.type === 'coaching-office' &&
    state.market?.assistantCoach !== undefined
  ) {
    throw new Error(
      'a staffed Coaching Office must dismiss its assistant and close together',
    );
  }
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
      labelKey: 'cashTransaction.facilityClosed',
      labelParams: facilityLabelParams(building.type),
      amount: refund,
      referenceId: building.id,
    }),
  };
}

/**
 * Previews the exact atomic staffed-office close without changing the career.
 *
 * The low-level facility transaction runs first in the preview because its
 * refund is allowed to fund the assistant's severance. This also keeps every
 * facility guard (including active construction) identical between preview
 * and confirmation.
 */
export function staffedCoachingOfficeClosureConfirmation(
  state: GameState,
  buildingId: string,
): StaffedCoachingOfficeClosureConfirmation {
  return planStaffedCoachingOfficeClosure(state, buildingId).confirmation;
}

/**
 * Dismisses the assistant and closes their office as one pure transaction.
 *
 * There is no dismiss-first intermediate state for the caller to persist. A
 * failed affordability check throws before either immutable result is built,
 * while success returns one state containing both changes and two distinct
 * one-off cash lines.
 */
export function closeStaffedCareerCoachingOffice(
  state: GameState,
  buildingId: string,
): StaffedCoachingOfficeClosureTransaction {
  assertManagementPhase(state);
  const planned = planStaffedCoachingOfficeClosure(state, buildingId);
  const { confirmation } = planned;
  if (!confirmation.canConfirm) {
    throw new Error(
      `the club needs $${confirmation.shortage.toLocaleString('en-US')} more to cover assistant severance after the Coaching Office refund`,
    );
  }

  const facilityApplied = applyFacilityTransaction(
    state,
    planned.facilityTransaction,
  );
  const withClosureLine =
    confirmation.facilityRefund === 0
      ? facilityApplied.state
      : recordCashTransaction(facilityApplied.state, {
          kind: 'facility-closure',
          label: `Closed ${FACILITY_CATALOG['coaching-office'].name}`,
          labelKey: 'cashTransaction.facilityClosed',
          labelParams: facilityLabelParams('coaching-office'),
          amount: confirmation.facilityRefund,
          referenceId: buildingId,
        });
  const dismissed = dismissCareerCoach(
    withClosureLine,
    planned.market,
    'ASSISTANT',
  );
  return {
    confirmation,
    state: { ...dismissed.state, market: dismissed.market },
  };
}

interface CareerTrainingUpgradeTransaction {
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
  if (offer.blockedReason !== undefined)
    throw new Error(offer.blockedReason.text);
  const paid: GameState = {
    ...state,
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId
        ? { ...club, cash: club.cash - offer.cost }
        : club,
    ),
    ownedTrainingTiers: { ...state.ownedTrainingTiers, [pathId]: offer.tier },
  };
  return {
    offer,
    state: recordCashTransaction(paid, {
      kind: 'training-upgrade',
      label: `${trainingPathLabel(pathId)} Tier ${offer.tier} drill bought`,
      labelKey: 'cashTransaction.drillTierBought',
      // `pathKey` names `path`, so the ledger draws the path in the player's
      // language — the `<param>Key` pairing `translatedParams` applies.
      labelParams: {
        path: trainingPathLabel(pathId),
        pathKey: trainingPathLabelKey(pathId),
        tier: offer.tier,
      },
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
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId
        ? { ...club, cash: transaction.cashAfter }
        : club,
    ),
    facilities: {
      ...state.facilities,
      trainingGroundBuilt: transaction.grid.buildings.some(
        (building) =>
          building.type === 'training-pitch' &&
          isFacilityOperational(transaction.grid, building.id),
      ),
      grid: transaction.grid,
    },
  };
  return { ...transaction, state: stateAfter };
}

interface PlannedStaffedCoachingOfficeClosure {
  readonly confirmation: StaffedCoachingOfficeClosureConfirmation;
  readonly facilityTransaction: FacilityTransaction;
  readonly market: NonNullable<GameState['market']>;
}

function planStaffedCoachingOfficeClosure(
  state: GameState,
  buildingId: string,
): PlannedStaffedCoachingOfficeClosure {
  const grid = state.facilities.grid ?? createFacilityGrid();
  const building = grid.buildings.find(
    (candidate) => candidate.id === buildingId,
  );
  if (building === undefined) throw new Error(`unknown facility ${buildingId}`);
  if (building.type !== 'coaching-office') {
    throw new Error(`${buildingId} is not a Coaching Office`);
  }
  const market = state.market;
  const assistant = market?.assistantCoach;
  if (market === undefined || assistant === undefined) {
    throw new Error(
      'the Coaching Office does not have an assistant to dismiss',
    );
  }
  if (
    !Number.isSafeInteger(assistant.weeklyWage) ||
    assistant.weeklyWage <= 0
  ) {
    throw new Error('assistant weekly wage must be a positive safe integer');
  }

  const cashBefore = userCash(state);
  const facilityTransaction = closeFacility(grid, buildingId, cashBefore);
  const facilityRefund = -facilityTransaction.cost;
  const severanceCost = assistant.weeklyWage;
  const shortage = Math.max(0, severanceCost - facilityTransaction.cashAfter);
  return {
    facilityTransaction,
    market,
    confirmation: {
      buildingId,
      assistantId: assistant.id,
      assistantName: assistant.name,
      cashBefore,
      severanceCost,
      facilityRefund,
      netCashEffect: facilityRefund - severanceCost,
      cashAfter: Math.max(0, facilityTransaction.cashAfter - severanceCost),
      shortage,
      canConfirm: shortage === 0,
    },
  };
}

function userCash(state: GameState): number {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  return club.cash;
}

function assertManagementPhase(state: GameState): void {
  if (state.phase !== 'manage') {
    throw new Error(
      'facility transactions can only happen during the manage phase',
    );
  }
}
