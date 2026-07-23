import type { Attrs } from '../sim/types';
import { trainingDrillTier, trainingDrillBlockedReason } from './promotion-progression';
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
  return drillId.replace(/-(ii|iii)$/, '');
}

/**
 * Returns the highest-tier drill for a path that the club has unlocked. Tier I
 * is always unlocked, so this never fails for a valid path.
 */
export function resolveTrainingDrillForPath(state: GameState, pathId: string): CareerTrainingDrill {
  if (!PATH_BY_ID.has(pathId)) throw new Error(`unknown training path ${pathId}`);
  const catalog = state.trainingRules?.focusDrills ?? [];
  const best = catalog
    .filter(drill => trainingDrillPathId(drill.id) === pathId)
    .sort((a, b) => trainingDrillTier(b.id) - trainingDrillTier(a.id))
    .find(drill => trainingDrillBlockedReason(state, drill.id) === undefined);
  if (best === undefined) throw new Error(`no unlocked drill for path ${pathId}`);
  return best;
}
