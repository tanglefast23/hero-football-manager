import type { Attrs } from '../sim/types';
import {
  MAX_TRAINING_DRILL_TIER,
  trainingDrillBlockedReason,
  trainingDrillIdForTier,
  trainingDrillTier,
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
/**
 * The path whose ladder every other outfield path shares, used as the reference
 * the keeper's is measured against. `keeper-ladder-parity.test.ts` asserts the
 * other five agree with it, so reading one is reading all six.
 */
const REFERENCE_OUTFIELD_PATH_ID = 'sprints';

/**
 * How far short of the ordinary ladder a given drill falls.
 *
 * Keyed on the drill rather than the path because the upgrade shop quotes tiers
 * the club has not bought yet, and a path's owned tier is the wrong answer for
 * those rows.
 *
 * Keeper Drills award exactly half the outfield gain at every tier for the same
 * TP — deliberately, because Reflexes is contested on every shot faced and
 * `training-leverage-rails` prices keeper training at 6.61x a striker's. This
 * returns 2 for the keeper path and 1 for everything else.
 *
 * Derived from the content rather than written as a literal 2 on purpose. The
 * keeper ladder is under active balance review and `keeper-drill-gain-probe`
 * only ever sweeps it *downward*; a hardcoded 2 would quietly stop meaning
 * "undo the halving" the first time those numbers move.
 */
export function keeperDisplayLadderMultiplier(state: GameState, drillId: string): number {
  const attribute = trainingPathAttribute(trainingDrillPathId(drillId));
  const drill = state.trainingRules?.focusDrills.find(candidate => candidate.id === drillId);
  const ownGain = drill?.gains[attribute] ?? 0;
  if (ownGain <= 0) return 1;

  const referenceId = trainingDrillIdForTier(
    REFERENCE_OUTFIELD_PATH_ID,
    trainingDrillTier(drillId),
  );
  const reference = state.trainingRules?.focusDrills.find(candidate => candidate.id === referenceId);
  const referenceGain = reference?.gains[trainingPathAttribute(REFERENCE_OUTFIELD_PATH_ID)] ?? 0;
  // A path that already matches the reference — every outfield path, and the
  // keeper's too if the ladders are ever equalised for real — returns 1 and no
  // display bonus is ever banked.
  if (referenceGain <= ownGain) return 1;
  return referenceGain / ownGain;
}

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
