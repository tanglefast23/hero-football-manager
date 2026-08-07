import type { Attrs } from '../sim/types';
import {
  MAX_TRAINING_DRILL_TIER,
  trainingDrillBlockedReason,
  trainingDrillIdForTier,
  trainingDrillTier,
  trainingDrillUpgradeCost,
  type BlockedCopy,
  type TrainingDrillTier,
} from './promotion-progression';
import type { CareerTrainingDrill, GameState } from './types';

interface TrainingPath {
  /** The tier-1 drill id, used as the stable path identifier. */
  readonly pathId: string;
  readonly attribute: keyof Attrs;
  /**
   * @i18n-fallback — English, and the source the translations were written from.
   *
   * `src/game` may not import `src/i18n`, so the name is written twice: this
   * English, and `labelKey` beside it that the app ring resolves through
   * `copyOrEnglish`. The same dual write as `DIVISION_NAME_KEYS` and
   * `FACILITY_CATALOG.nameKey`. Without it the drill shop chips, the stat
   * picker, the purchase toast and the ledger line all say "Pace" and
   * "Reflexes" inside otherwise translated screens, in all seven languages.
   */
  readonly label: string;
  /**
   * Keyed on the ATTRIBUTE rather than the path id, because the label is the
   * attribute's name — a translator reading `trainingPath.ref` is naming the
   * same thing `squadTraining.attribute.ref` explains at length. That key holds
   * the long explainer and cannot be reused here: these are boxed chips.
   */
  readonly labelKey: string;
}

export const TRAINING_PATHS: readonly TrainingPath[] = [
  { pathId: 'sprints', attribute: 'pac', label: 'Pace', labelKey: 'trainingPath.pac' },
  { pathId: 'finishing', attribute: 'sho', label: 'Shooting', labelKey: 'trainingPath.sho' },
  { pathId: 'rondo', attribute: 'pas', label: 'Passing', labelKey: 'trainingPath.pas' },
  { pathId: 'duels', attribute: 'def', label: 'Defense', labelKey: 'trainingPath.def' },
  { pathId: 'first-touch', attribute: 'tec', label: 'Technique', labelKey: 'trainingPath.tec' },
  { pathId: 'circuit', attribute: 'sta', label: 'Stamina', labelKey: 'trainingPath.sta' },
  { pathId: 'keeper-drills', attribute: 'ref', label: 'Reflexes', labelKey: 'trainingPath.ref' },
];

const PATH_BY_ID = new Map(TRAINING_PATHS.map(path => [path.pathId, path]));

/** English. Pair it with `trainingPathLabelKey` wherever a player will read it. */
export function trainingPathLabel(pathId: string): string {
  const path = PATH_BY_ID.get(pathId);
  if (path === undefined) throw new Error(`unknown training path ${pathId}`);
  return path.label;
}

/** The catalog key for the same name, for `copyOrEnglish` at the app edge. */
export function trainingPathLabelKey(pathId: string): string {
  const path = PATH_BY_ID.get(pathId);
  if (path === undefined) throw new Error(`unknown training path ${pathId}`);
  return path.labelKey;
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
 * **This number feeds a deliberate lie.** It is what lets a keeper's card show
 * the outfield gain while only the halved one is stored, so lowering the keeper
 * ladder in `content/training.json` does not break this function — it silently
 * makes the lie roughly twice as large (measured: 412 points of drift over a
 * long career today, 776 at a halved ladder). Read the tripwire at the top of
 * `src/audit/__tests__/keeper-display-drift-rail.test.ts` before changing those
 * gains; that rail will fail and is the decision point, not an obstacle.
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

/** The path that trains one attribute. One-to-one: seven attributes, seven paths. */
export function trainingPathForAttribute(attribute: keyof Attrs): string {
  const path = TRAINING_PATHS.find(candidate => candidate.attribute === attribute);
  if (path === undefined) throw new Error(`no training path trains ${attribute}`);
  return path.pathId;
}

/**
 * What N sessions of the club's own best drill are worth, in attribute points.
 *
 * Read from the drill the club has actually bought rather than a ladder copied
 * into the caller, for two reasons. The obvious one: a frozen table goes stale
 * the day `content/training.json` moves. The one that would have shipped a bug:
 * the keeper ladder is deliberately half the outfield one (2/4/6/8/11 against
 * 4/7/11/16/22), because REF is the most leveraged attribute in the game — so a
 * hardcoded outfield table would have doubled every keeper reward and re-opened
 * exactly the leverage that ladder exists to price out.
 *
 * Base gain only. Facility multipliers, coach specialty scales, archetype
 * modifiers and the SUPER roll all live in the drill pipeline; a story reward
 * that compounded with them would scale with every other investment at once.
 */
export function trainingSessionPoints(
  state: GameState,
  attribute: keyof Attrs,
  sessions: number,
): number {
  if (!Number.isSafeInteger(sessions)) throw new Error('training sessions must be a safe integer');
  const drill = resolveTrainingDrillForPath(state, trainingPathForAttribute(attribute));
  return sessions * (drill.gains[attribute] ?? 0);
}

/**
 * The attribute points a story's authored sessions are worth to one player,
 * floor included. This is the whole conversion, in one place, so the app ring
 * and the audit harness cannot drift into computing it differently.
 *
 * A loss is capped at a quarter of what the player currently has. One session
 * at a tier-5 club is 22 points and the attribute clamp bottoms out at 1 — not
 * at the value he started with — so without this a youth on 35 PAC loses two
 * thirds of it to a single card, which is not the "a little" the design
 * promises. It never binds on a developed player: at 88 the quarter is 22, so
 * a full session still lands.
 */
export function sessionAttributeDelta(
  state: GameState,
  player: { readonly attrs: Attrs },
  attribute: keyof Attrs,
  sessions: number,
): number {
  const points = trainingSessionPoints(state, attribute, sessions);
  if (points >= 0) return points;
  return -Math.min(Math.abs(points), Math.floor(player.attrs[attribute] / 4));
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
  /**
   * Why the club cannot buy it right now; undefined when the purchase is legal.
   *
   * Both halves, as `RingCopy`: the app ring renders `textKey`, and
   * `src/game/management.ts` throws `text` because an engine error message is
   * not player-facing copy.
   */
  readonly blockedReason?: BlockedCopy;
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
    ?? (club.cash < cost
      ? {
        /** @i18n-fallback for `squadTraining.drillNotEnoughMoney`. */
        text: 'Not enough money.',
        textKey: 'squadTraining.drillNotEnoughMoney',
      }
      : undefined);
  return {
    pathId,
    tier,
    drillId,
    cost,
    ...(blockedReason === undefined ? {} : { blockedReason }),
  };
}
