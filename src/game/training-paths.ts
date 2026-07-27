import type { Attrs } from '../sim/types';
import {
  MAX_TRAINING_DRILL_TIER,
  trainingDrillBlockedReason,
  trainingDrillIdForTier,
  trainingDrillUpgradeCost,
  type TrainingDrillTier,
} from './promotion-progression';
import type { CareerTrainingDrill, GameState } from './types';

export interface TrainingPath {
  /** The tier-1 drill id, used as the stable path identifier. */
  readonly pathId: string;
  readonly attribute: keyof Attrs;
  readonly label: string;
}

export const TRAINING_PATHS: readonly TrainingPath[] = [
  { pathId: 'sprints', attribute: 'pac', label: 'Pace' },
  { pathId: 'finishing', attribute: 'sho', label: 'Shooting' },
  { pathId: 'rondo', attribute: 'pas', label: 'Passing' },
  { pathId: 'duels', attribute: 'def', label: 'Defense' },
  { pathId: 'first-touch', attribute: 'tec', label: 'Technique' },
  { pathId: 'circuit', attribute: 'sta', label: 'Stamina' },
  { pathId: 'keeper-drills', attribute: 'ref', label: 'Reflexes' },
];

const PATH_BY_ID = new Map(TRAINING_PATHS.map(path => [path.pathId, path]));

export function trainingPathLabel(pathId: string): string {
  const path = PATH_BY_ID.get(pathId);
  if (path === undefined) throw new Error(`unknown training path ${pathId}`);
  return path.label;
}

export function trainingPathAttribute(pathId: string): keyof Attrs {
  const path = PATH_BY_ID.get(pathId);
  if (path === undefined) throw new Error(`unknown training path ${pathId}`);
  return path.attribute;
}

/** Strips the tier suffix so any tier's drill id maps back to its path. */
export function trainingDrillPathId(drillId: string): string {
  return drillId.replace(/-(ii|iii|iv|v)$/, '');
}

/**
 * The tier the club has actually bought for a path. Every career starts owning
 * tier 1 everywhere, and saves written before upgrades were a purchase have no
 * record at all — both read as tier 1.
 */
export function ownedTrainingTier(state: GameState, pathId: string): TrainingDrillTier {
  if (!PATH_BY_ID.has(pathId)) throw new Error(`unknown training path ${pathId}`);
  const owned = state.ownedTrainingTiers?.[pathId] ?? 1;
  if (!Number.isInteger(owned) || owned < 1 || owned > MAX_TRAINING_DRILL_TIER) {
    throw new Error(`invalid owned training tier ${owned} for path ${pathId}`);
  }
  return owned as TrainingDrillTier;
}

/**
 * Returns the drill the club owns for a path. Promotion no longer hands the
 * better drill over — it only puts it up for sale — so this reads the purchase
 * record rather than the best tier the division allows.
 */
export function resolveTrainingDrillForPath(state: GameState, pathId: string): CareerTrainingDrill {
  const drillId = trainingDrillIdForTier(pathId, ownedTrainingTier(state, pathId));
  const drill = state.trainingRules?.focusDrills.find(candidate => candidate.id === drillId);
  if (drill === undefined) throw new Error(`no drill ${drillId} in the career catalog`);
  return drill;
}

export interface TrainingUpgradeOffer {
  readonly pathId: string;
  readonly tier: TrainingDrillTier;
  readonly drillId: string;
  readonly cost: number;
  /** Why the club cannot buy it right now; undefined when the purchase is legal. */
  readonly blockedReason?: string;
}

/**
 * The next tier on offer for a path, or undefined once the club owns tier 5.
 * The reason is resolved here so the squad room, the store action, and the
 * purchase itself all agree on one sentence.
 */
export function nextTrainingUpgradeOffer(
  state: GameState,
  pathId: string,
): TrainingUpgradeOffer | undefined {
  const owned = ownedTrainingTier(state, pathId);
  if (owned >= MAX_TRAINING_DRILL_TIER) return undefined;
  const tier = (owned + 1) as Exclude<TrainingDrillTier, 1>;
  const drillId = trainingDrillIdForTier(pathId, tier);
  const cost = trainingDrillUpgradeCost(tier);
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const blockedReason = trainingDrillBlockedReason(state, drillId)
    ?? (club.cash < cost ? 'Not enough money.' : undefined);
  return {
    pathId,
    tier,
    drillId,
    cost,
    ...(blockedReason === undefined ? {} : { blockedReason }),
  };
}
