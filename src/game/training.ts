import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { mulberry32 } from '../sim/rng';
import {
  FACILITY_CATALOG,
  cappedFacilityBoost,
  facilityEffects,
  isFacilityOperational,
  type FacilityType,
  type PlacedFacility,
} from './facilities';
import { trainingMultiplierForAge } from './pyramid';
import { careerCoachTrainingModifiers } from './coach-weekly';
import {
  archetypeTrainingBonusPercent,
  attributeAffectsPlay,
  capPlayerTrainingGain,
  playerPotentialGrade,
  POTENTIAL_GRADES,
  positionTrainingBonusPercent,
  superTrainingChancePercent,
  type PotentialGrade,
} from './archetype-caps';
import {
  gridMedicalBayLevel,
  medicalBayRecoveryWeeks,
  overtrainingInjuryChancePercent,
  OVERTRAINING_CONDITION_THRESHOLD,
} from './player-wellbeing';
import {
  hasActiveCareerContractPromise,
  pendingTrainingPriorityHolder,
} from './contract-promises';
import { tryRepairCareerLineupForInjuries } from './squad';
import { isAvailableForSelection } from './lineup';
import { drillMultiplierPercent } from './player-requests';
import {
  keeperDisplayLadderMultiplier,
  resolveTrainingDrillForPath,
  trainingPathAttribute,
  trainingPathLabel,
} from './training-paths';
import type { CareerPlayer, GameState } from './types';

export const INSTANT_DRILL_CONDITION_COST = 8;
export const SUPER_TRAINING_PITY_DRILLS = 12;

export interface InstantDrillResolution {
  state: GameState;
  playerId: string;
  pathId: string;
  drillId: string;
  attribute: keyof CareerPlayer['attrs'];
  tpSpent: number;
  isSuper: boolean;
  /** The stored stat before the drill — what the sim, scout and wage all see. */
  before: number;
  /** The stored stat after the drill. Never the displayed one; see `displayedAfter`. */
  after: number;
  /**
   * What the card shows, which for a keeper's Reflexes runs ahead of the stored
   * value so the halved Keeper Drills ladder reads like the outfield one. Equal
   * to `before` / `after` for every other player and every other drill.
   */
  displayedBefore: number;
  displayedAfter: number;
  conditionAfter: number;
  injury?: { chancePercent: number; recoveryWeeks: number };
}

/**
 * One named influence on a drill's result, and which way it pushes.
 *
 * `helps` exists because the card colours each name individually: "Veteran + GK
 * + Prodigy" mixes one modifier that costs with two that pay, and a single
 * colour across the row cannot say which is which. Today only the veteran age
 * band sets it false — every other entry is added to the list solely when it is
 * a bonus.
 */
export type TrainingModifierKind =
  'YOUTH' | 'VETERAN' | 'ROLE' | 'ARCHETYPE' | 'FACILITY' | 'COACH';

export interface TrainingModifier {
  /**
   * What this modifier IS, in a form no language owns.
   *
   * The drill card used to receive only `label`, built here — "Youth",
   * "Prodigy", "Gym Lv2" — so a Vietnamese confirmation card listed its bonuses
   * in English. This ring may not import `src/i18n` (see
   * `src/game/__tests__/architecture.test.ts`), and it certainly may not call
   * `facilityName()` in the application ring, so it emits the kind plus the
   * token the kind needs and the view model looks the words up.
   */
  readonly kind: TrainingModifierKind;
  /**
   * The archetype id (`ARCHETYPE`), the facility type (`FACILITY`) or the role
   * code (`ROLE`). Absent for the kinds that name no game object.
   */
  readonly token?: string;
  /** Facility level, so `FACILITY` can render "Gym Lv2". */
  readonly level?: number;
  /**
   * @i18n-fallback — English, for a consumer with no translator: the balance
   * harness in `src/audit` reads these, and an old save's preview is rebuilt
   * every time it is shown, so nothing persists this half.
   */
  readonly label: string;
  readonly helps: boolean;
}

interface InstantTrainingPreview {
  /** The authored drill result before any player or club modifiers. */
  baseAfter: number;
  /** The ordinary-session result after every active modifier and banked fraction. */
  adjustedAfter: number;
  /** Signed difference between the authored base result and adjusted result. */
  adjustment: number;
  /** Every modifier participating in the result, each with its own direction. */
  modifiers: readonly TrainingModifier[];
  /** Fractional bonus ledgers after this drill, kept as exact hundredths. */
  fractionalBonusBanks: readonly {
    kind: 'TRAINING' | 'STAMINA';
    hundredths: number;
  }[];
}

/**
 * Previews the exact ordinary result for the confirmation card.
 *
 * SUPER remains a chance and therefore stays separate. Everything deterministic
 * — age, position, archetype, facilities, coaches, and banked fractions — uses
 * the same growth path as the drill itself so the card cannot promise +5 and
 * then quietly award +9.
 */
export function instantTrainingPreview(
  state: GameState,
  playerId: string,
  pathId: string,
): InstantTrainingPreview {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined || player.clubId !== state.userClubId) {
    throw new Error(`player ${playerId} is not on the user club`);
  }
  const drill = resolveTrainingDrillForPath(state, pathId);
  const attribute = trainingPathAttribute(pathId);
  const currentValue = player.attrs[attribute];

  /**
   * The card previews the *displayed* result, because the count-up that follows
   * it does. Both halves shadow, not just the adjusted one: the card's top line
   * is `baseValueAfter - currentValue`, so leaving it on the authored gain would
   * promise `+2` over a `+4` count-up — a worse defect than the uniform `+2` the
   * whole change exists to remove.
   *
   * The ceiling here is the displayed one, deliberately. `capPlayerTrainingGain`
   * clamps against the stored value, and near the top of the range that would
   * keep promising a full step after the display had already stalled at 999.
   */
  const displayMultiplier = keeperDisplayLadderMultiplier(state, drill.id);
  const displayedCurrent = displayedValue(player, attribute);
  const baseGain = (drill.gains[attribute] ?? 0) * displayMultiplier;
  const baseAfter = Math.min(
    MAX_PLAYER_ATTRIBUTE,
    checkedAdd(displayedCurrent, baseGain, 'base training attribute'),
  );
  const adjusted = applyInstantGrowthModifiers(
    state,
    player,
    attribute,
    baseGain,
  );
  const adjustedGain = adjusted.value - currentValue;
  const adjustedAfter = Math.min(
    MAX_PLAYER_ATTRIBUTE,
    displayedCurrent + adjustedGain,
  );
  const trainingHundredths = adjusted.trainingBonusRemainders?.[attribute];
  return {
    baseAfter,
    adjustedAfter,
    adjustment: adjustedAfter - baseAfter,
    modifiers: instantGrowthModifierLabels(state, player, attribute),
    fractionalBonusBanks: [
      ...(trainingHundredths === undefined
        ? []
        : [{ kind: 'TRAINING' as const, hundredths: trainingHundredths }]),
      ...(adjusted.facilityStaBonusRemainder === undefined
        ? []
        : [
            {
              kind: 'STAMINA' as const,
              hundredths: adjusted.facilityStaBonusRemainder,
            },
          ]),
    ],
  };
}

/**
 * The value a card shows for one attribute — the stored stat plus whatever the
 * keeper's Reflexes display bonus has banked, stalled at the shared ceiling.
 *
 * Lives here rather than in `src/application/displayed-attributes.ts` because
 * `src/game/` cannot import the application layer. That module re-exports the
 * same rule for the UI; both are one line and the tests pin them together.
 */
export function displayedValue(
  player: CareerPlayer,
  attribute: keyof CareerPlayer['attrs'],
): number {
  const stored = player.attrs[attribute];
  if (attribute !== 'ref') return stored;
  return Math.min(MAX_PLAYER_ATTRIBUTE, stored + (player.refDisplayBonus ?? 0));
}

/**
 * Resolves one drill for one player the moment the user taps it. Pure and
 * deterministic: SUPER, injury, and injury-duration rolls derive from the
 * career seed and the persisted lifetime drill nonce, so replaying the same
 * state yields the same result while back-to-back taps roll fresh.
 */
export function trainPlayerInstantly(
  state: GameState,
  playerId: string,
  pathId: string,
): InstantDrillResolution {
  // Every other squad mutation asserts its phase; training used to run happily
  // during season-end, which is the renewals desk, not the training ground.
  if (state.phase !== 'manage' && state.phase !== 'matchday') {
    throw new Error('training can only run before a match');
  }
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined || player.clubId !== state.userClubId) {
    throw new Error(`player ${playerId} is not on the user club`);
  }
  // Two messages, not one "unavailable". The manager can act on an injury —
  // the Medical Bay shortens it — and can only wait out leave, so collapsing
  // them would throw away the one useful thing the error says.
  if (player.injuryWeeks > 0)
    throw new Error(`${player.name} is injured and cannot train`);
  if ((player.awayWeeks ?? 0) > 0)
    throw new Error(`${player.name} is away and cannot train`);
  const attribute = trainingPathAttribute(pathId);
  // TP is one of two currencies and deliberately scarce, so a drill that cannot
  // change anything must not take any. Both refusals are backstops: the drill
  // picker already hides an inert stat (`selectedPlayerStatOptions` filters on
  // the same `attributeAffectsPlay`), and the ceiling is only reachable after a
  // very long career.
  if (!attributeAffectsPlay(player.role, attribute)) {
    throw new Error(
      `${trainingPathLabel(pathId)} does nothing for a ${player.role}`,
    );
  }
  if (player.attrs[attribute] >= MAX_PLAYER_ATTRIBUTE) {
    throw new Error(
      `${player.name}'s ${trainingPathLabel(pathId)} is already at the maximum`,
    );
  }
  // A TRAINING_PRIORITY promise is a debt: the promised player owns the next
  // drills until their countdown drains. They remind the manager; an injured
  // holder pauses the debt instead of deadlocking training.
  const targetOwedDrills =
    (player.priorityDrillsRemaining ?? 0) > 0 &&
    hasActiveCareerContractPromise(player, 'TRAINING_PRIORITY');
  const priorityHolder = pendingTrainingPriorityHolder(state);
  if (!targetOwedDrills && priorityHolder !== undefined) {
    throw new Error(
      `${priorityHolder.playerName} was promised the next ` +
        `${priorityHolder.remaining} drill${priorityHolder.remaining === 1 ? '' : 's'}, train them first`,
    );
  }
  const drill = resolveTrainingDrillForPath(state, pathId);
  if (drill.tpCost > state.trainingPoints) {
    throw new Error(
      `training needs ${drill.tpCost} TP but only ${state.trainingPoints} are available`,
    );
  }

  const nonce = state.totalInstantDrills ?? 0;
  const superChance = superTrainingChancePercent(playerPotentialGrade(player));
  const pityReached =
    (player.drillsSinceSuper ?? 0) + 1 >= SUPER_TRAINING_PITY_DRILLS;
  const isSuper =
    pityReached ||
    instantDrillRoll(state.careerSeed, nonce, playerId, 0, 100) < superChance;

  const baseDrillGain = drill.gains[attribute] ?? 0;
  const rolledGain = isSuper ? Math.round(baseDrillGain * 1.5) : baseDrillGain;
  const growth = applyInstantGrowthModifiers(
    state,
    player,
    attribute,
    rolledGain,
  );

  /**
   * Keeper Drills award less than the outfield ladder for the same TP, so a
   * keeper's card would look short-changed when the truth is the opposite. Bank
   * the shortfall for display only.
   *
   * Computed by running this player's own modifiers a second time over the
   * outfield-ladder base instead of multiplying the realised gain by a fixed
   * ratio. Rounding age and facility modifiers can make those paths differ.
   *
   * **Only `growth`'s remainders are persisted; the shadow's are discarded.**
   * That is the invariant the whole trick rests on: `applyInstantGrowthModifiers`
   * banks sub-point percent bonuses, and a goalkeeper always earns one on REF,
   * so letting the shadow's ledger through would hand the keeper genuine extra
   * attribute points off a presentation feature. The call is pure — it returns a
   * fresh remainder object and mutates nothing — so running it twice is free of
   * ordering effects and consumes no RNG.
   *
   * Not clamped here. The ceiling belongs to the *display*, and an earlier draft
   * that capped the banked figure at `999 - stored` quietly destroyed it as the
   * stat climbed: measured over a long keeper career the bonus peaked at 405 and
   * then fell to 5 while the card still read a stalled 999. That made the field
   * mean "whatever fits under the ceiling" rather than "how far the display has
   * been allowed to run ahead", and left §6's drift rail measuring nothing.
   * `displayedValue` applies the ceiling on the way out instead.
   */
  // `drill.id`, not `pathId`. `pathId` is the TIER-1 drill id, so the resolve was
  // banking the display bonus at tier 1's ratio however far the path had been
  // upgraded, while the preview a few lines up used the owned tier's. The
  // keeper-to-outfield ratio differs by tier, so both paths must use the same
  // resolved drill.
  const displayMultiplier = keeperDisplayLadderMultiplier(state, drill.id);
  const displayBonusBefore =
    attribute === 'ref' ? (player.refDisplayBonus ?? 0) : 0;
  const displayBonusAfter =
    displayMultiplier <= 1
      ? displayBonusBefore
      : displayBonusBefore +
        (applyInstantGrowthModifiers(
          state,
          player,
          attribute,
          rolledGain * displayMultiplier,
        ).value -
          growth.value);

  const conditionBefore = player.condition ?? 100;
  const injuryRiskReductionPercent =
    state.facilities.grid === undefined
      ? 0
      : facilityEffects(state.facilities.grid).injuryRiskReductionPercent;
  const injuryChancePercent =
    conditionBefore >= OVERTRAINING_CONDITION_THRESHOLD
      ? 0
      : overtrainingInjuryChancePercent(
          conditionBefore,
          injuryRiskReductionPercent,
        );
  const injured =
    injuryChancePercent > 0 &&
    instantDrillRoll(state.careerSeed, nonce, playerId, 1, 100) <
      injuryChancePercent;
  const rolledRecoveryWeeks = injured
    ? medicalBayRecoveryWeeks(
        2 + instantDrillRoll(state.careerSeed, nonce, playerId, 2, 5),
        gridMedicalBayLevel(state.facilities.grid),
      )
    : undefined;
  const conditionAfter = Math.max(
    0,
    conditionBefore - INSTANT_DRILL_CONDITION_COST,
  );

  const drilledState = (injuryWeeks: number | undefined): GameState => {
    const trainedPlayer: CareerPlayer = {
      ...player,
      attrs: { ...player.attrs, [attribute]: growth.value },
      condition: conditionAfter,
      drillsSinceSuper: isSuper ? 0 : (player.drillsSinceSuper ?? 0) + 1,
      ...(targetOwedDrills
        ? { priorityDrillsRemaining: (player.priorityDrillsRemaining ?? 0) - 1 }
        : {}),
      ...(growth.trainingBonusRemainders === undefined
        ? {}
        : { trainingBonusRemainders: growth.trainingBonusRemainders }),
      ...(growth.facilityStaBonusRemainder === undefined
        ? {}
        : { facilityStaBonusRemainder: growth.facilityStaBonusRemainder }),
      ...(displayBonusAfter > 0 ? { refDisplayBonus: displayBonusAfter } : {}),
      ...(injuryWeeks === undefined ? {} : { injuryWeeks }),
    };
    return {
      ...state,
      players: state.players.map((candidate) =>
        candidate.id === playerId ? trainedPlayer : candidate,
      ),
      trainingPoints: state.trainingPoints - drill.tpCost,
      totalInstantDrills: nonce + 1,
    };
  };

  /**
   * A tap-time injury must bench the starter right away — settlement no longer
   * stands between training and the next matchday to repair it. The repair is
   * therefore asked BEFORE the injury is kept: it used to be applied first and
   * the throw handed straight to the Training screen, so drilling the last
   * coverable starter turned the TRAIN button into a red banner carrying an
   * internal player id, and training somebody else first re-rolled the injury
   * away — a hidden reroll for a deterministic tap. A drill the squad cannot
   * absorb simply does not injure.
   *
   * `tryRepair`, not `repairCareerLineupForInjuries`: settlement's fail-soft
   * mints an emergency academy youth, which would turn "drill your keeper until
   * he pulls up" into a way to conjure a free player.
   *
   * RNG: every roll above is an independent hash of
   * (careerSeed, nonce, playerId, stream) rather than a position in a stream,
   * so no draw moved and no draw was added or removed by this reordering.
   */
  const injuredState =
    rolledRecoveryWeeks === undefined
      ? undefined
      : tryRepairCareerLineupForInjuries(drilledState(rolledRecoveryWeeks));
  const recoveryWeeks =
    injuredState === undefined ? undefined : rolledRecoveryWeeks;

  return {
    state: injuredState ?? drilledState(undefined),
    playerId,
    pathId,
    drillId: drill.id,
    attribute,
    tpSpent: drill.tpCost,
    isSuper,
    before: player.attrs[attribute],
    after: growth.value,
    // Clamped on the way out, like every other read of the displayed value.
    displayedBefore: Math.min(
      MAX_PLAYER_ATTRIBUTE,
      player.attrs[attribute] + displayBonusBefore,
    ),
    displayedAfter: Math.min(
      MAX_PLAYER_ATTRIBUTE,
      growth.value + displayBonusAfter,
    ),
    conditionAfter,
    ...(recoveryWeeks === undefined
      ? {}
      : { injury: { chancePercent: injuryChancePercent, recoveryWeeks } }),
  };
}

/**
 * Single-drill version of the M2 growth pipeline: age and facility structural
 * multipliers plus banked-hundredth percent bonuses (archetype, position,
 * coach). Potential no longer contributes a percent bonus — its job moved to
 * the SUPER session roll.
 */
function applyInstantGrowthModifiers(
  state: GameState,
  player: CareerPlayer,
  attribute: keyof CareerPlayer['attrs'],
  rolledGain: number,
): {
  value: number;
  trainingBonusRemainders?: Partial<
    Record<keyof CareerPlayer['attrs'], number>
  >;
  facilityStaBonusRemainder?: number;
} {
  const coachModifiers =
    state.market === undefined
      ? undefined
      : careerCoachTrainingModifiers(state.market);
  const structuralMultiplier =
    trainingMultiplierForAge(player.age ?? 24) *
    facilityTrainingMultiplier(state, attribute);
  // A granted "my own guru" or "ease off the lads" scales gains for its spell.
  // The floor of 1 stays: a drill must always be worth something, even at a
  // compounded 30%, or the manager pays TP for literally nothing.
  const requestScale = drillMultiplierPercent(
    state.playerRequests?.effects ?? [],
    player.id,
  );
  const baseGain = Math.max(
    1,
    Math.round((rolledGain * structuralMultiplier * requestScale) / 100),
  );
  const coachBonusPercent =
    (coachModifiers?.gainScalePercentByAttribute[attribute] ?? 100) - 100;
  const developmentBonusPercent =
    archetypeTrainingBonusPercent(player.archetype, attribute) +
    positionTrainingBonusPercent(player.role, attribute) +
    coachBonusPercent;

  const trainingBonusRemainders = {
    ...(player.trainingBonusRemainders ??
      player.coachTrainingBonusRemainders ??
      {}),
  };
  const previousRemainder = trainingBonusRemainders[attribute] ?? 0;
  validateCoachTrainingRemainder(previousRemainder, player.id, attribute);
  // Bank hundredths so small percent bonuses remain exact even when one drill
  // cannot award a whole extra attribute point.
  const earnedHundredths =
    developmentBonusPercent === 0
      ? 0
      : Math.round(rolledGain * structuralMultiplier * developmentBonusPercent);
  const totalHundredths = checkedAdd(
    previousRemainder,
    earnedHundredths,
    'training bonus progress',
  );
  const extraGain = Math.floor(totalHundredths / 100);
  const nextRemainder = totalHundredths % 100;
  const proposedValue = checkedAdd(
    player.attrs[attribute],
    checkedAdd(baseGain, extraGain, 'adjusted training gain'),
    'adjusted training attribute',
  );
  let value = capPlayerTrainingGain(
    player,
    attribute,
    player.attrs[attribute],
    proposedValue,
  );
  if (developmentBonusPercent > 0) {
    trainingBonusRemainders[attribute] =
      value < proposedValue ? 0 : nextRemainder;
  }

  let facilityStaBonusRemainder: number | undefined;
  if (attribute === 'sta') {
    const staminaBonusPercent =
      state.facilities.grid === undefined
        ? 0
        : facilityEffects(state.facilities.grid).staminaTrainingBonusPercent;
    const realizedGain = value - player.attrs.sta;
    if (staminaBonusPercent > 0 && realizedGain > 0) {
      const previousStaRemainder = player.facilityStaBonusRemainder ?? 0;
      const totalPercentagePoints = checkedAdd(
        previousStaRemainder,
        checkedMultiply(
          realizedGain,
          staminaBonusPercent,
          'facility stamina bonus progress',
        ),
        'facility stamina bonus progress',
      );
      const staExtra = Math.floor(totalPercentagePoints / 100);
      facilityStaBonusRemainder = totalPercentagePoints % 100;
      value = capPlayerTrainingGain(
        player,
        'sta',
        player.attrs.sta,
        checkedAdd(value, staExtra, 'facility stamina attribute'),
      );
    }
  }

  const hasPercentBonusState =
    developmentBonusPercent > 0 ||
    player.trainingBonusRemainders !== undefined ||
    player.coachTrainingBonusRemainders !== undefined;
  return {
    value,
    ...(hasPercentBonusState ? { trainingBonusRemainders } : {}),
    ...(facilityStaBonusRemainder === undefined
      ? {}
      : { facilityStaBonusRemainder }),
  };
}

/**
 * How much of the grade is the training the manager can act on today, and how
 * much is the SUPER lottery. Three quarters to the former: it is deterministic,
 * it is the reason one player outgrows another, and it is what the column is
 * read for.
 */
const GROWTH_MULTIPLIER_WEIGHT = 0.75;
const GROWTH_SUPER_WEIGHT = 0.25;

/**
 * The span the training multiplier can occupy, used to put it on the same 0-1
 * scale as the SUPER chance before the two are blended. Derived, not guessed:
 * the floor is the veteran band with no bonuses at all, and the ceiling is the
 * youth band carrying Prodigy on every attribute plus the position bonus on the
 * three it applies to. `stays inside the grade scale at both extremes` is the
 * test that keeps these honest, and the clamp below means a content change that
 * outruns them degrades to a boundary grade rather than an index crash.
 */
const GROWTH_MULTIPLIER_FLOOR = 0.6;
const GROWTH_MULTIPLIER_CEILING = 1.1 * 1.25;
const GROWTH_SUPER_FLOOR = 5;
const GROWTH_SUPER_CEILING = 33;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * What the register's Potential column measures: how fast this player still
 * improves, not how good they were once capable of becoming.
 *
 * The old column was raw talent, and it flattered exactly the player a manager
 * should be wary of — a thirty-one-year-old at potential 5 shows a grade they
 * can no longer reach, because the veteran age band divides every gain they
 * take by more than two. Read as *remaining* potential the name still holds,
 * and now the number agrees with it.
 *
 * Deliberately excludes the facility and coach multipliers. Those are club-wide,
 * so folding them in would move all sixteen grades together and never reorder
 * them — the column would twitch on every upgrade while saying nothing new about
 * who to train. Only per-player terms count.
 *
 * `player.potential` itself is untouched. It still sets the SUPER chance, the
 * transfer valuation (`market.ts`) and what the scouts hunt for; this is a
 * reading of it, not a replacement.
 */
export function playerGrowthGrade(player: CareerPlayer): PotentialGrade {
  const trainable = (
    Object.keys(player.attrs) as (keyof CareerPlayer['attrs'])[]
  ).filter((attribute) => attributeAffectsPlay(player.role, attribute));
  // Averaged across the attributes this role actually uses, because the bonuses
  // are per-attribute — a Sniper is +15% on Shooting and nothing on Defense, and
  // one letter cannot say so. The mean is what they get over a season of drills.
  const averageBonusPercent =
    trainable.length === 0
      ? 0
      : trainable.reduce(
          (total, attribute) =>
            total +
            positionTrainingBonusPercent(player.role, attribute) +
            archetypeTrainingBonusPercent(player.archetype, attribute),
          0,
        ) / trainable.length;

  const multiplier =
    trainingMultiplierForAge(player.age ?? 24) *
    (1 + averageBonusPercent / 100);
  const multiplierScore = clamp01(
    (multiplier - GROWTH_MULTIPLIER_FLOOR) /
      (GROWTH_MULTIPLIER_CEILING - GROWTH_MULTIPLIER_FLOOR),
  );
  const superScore = clamp01(
    (superTrainingChancePercent(playerPotentialGrade(player)) -
      GROWTH_SUPER_FLOOR) /
      (GROWTH_SUPER_CEILING - GROWTH_SUPER_FLOOR),
  );

  const blended =
    GROWTH_MULTIPLIER_WEIGHT * multiplierScore +
    GROWTH_SUPER_WEIGHT * superScore;
  return POTENTIAL_GRADES[Math.round(blended * (POTENTIAL_GRADES.length - 1))];
}

function instantGrowthModifierLabels(
  state: GameState,
  player: CareerPlayer,
  attribute: keyof CareerPlayer['attrs'],
): TrainingModifier[] {
  const modifiers: TrainingModifier[] = [];
  const ageMultiplier = trainingMultiplierForAge(player.age ?? 24);
  // The only entry on this list that can cost the player anything. Every other
  // modifier below is pushed solely when it pays, so `helps` is false here and
  // nowhere else — which is exactly what the card colours on.
  if (ageMultiplier > 1)
    modifiers.push({ kind: 'YOUTH', label: 'Youth', helps: true });
  if (ageMultiplier < 1)
    modifiers.push({ kind: 'VETERAN', label: 'Veteran', helps: false });
  if (positionTrainingBonusPercent(player.role, attribute) > 0) {
    // The role CODE is the label. GK/DEF/MID/FWD are drawn untranslated
    // everywhere else in the game — the register column, the squad chips — so
    // translating them only here would make the same player two things at once.
    modifiers.push({
      kind: 'ROLE',
      token: player.role,
      label: player.role,
      helps: true,
    });
  }
  if (archetypeTrainingBonusPercent(player.archetype, attribute) > 0) {
    modifiers.push({
      kind: 'ARCHETYPE',
      ...(player.archetype === undefined ? {} : { token: player.archetype }),
      label: player.archetype ?? 'Archetype',
      helps: true,
    });
  }
  const facilityLevel = facilityTrainingLevel(state, attribute);
  if (facilityLevel > 0) {
    const facilityType = trainingFacilityType(attribute);
    modifiers.push({
      kind: 'FACILITY',
      token: facilityType,
      level: facilityLevel,
      label: `${FACILITY_CATALOG[facilityType].name} Lv${facilityLevel}`,
      helps: true,
    });
  }
  const coachScale =
    state.market === undefined
      ? 100
      : careerCoachTrainingModifiers(state.market).gainScalePercentByAttribute[
          attribute
        ];
  if (coachScale > 100)
    modifiers.push({ kind: 'COACH', label: 'Coach', helps: true });
  return modifiers;
}

function instantDrillRoll(
  careerSeed: number,
  nonce: number,
  playerId: string,
  stream: number,
  upperExclusive: number,
): number {
  const seed =
    (careerSeed ^
      Math.imul(nonce + 1, 0x9e3779b1) ^
      Math.imul(fnvHashString(playerId), stream + 1)) >>>
    0;
  return Math.floor(mulberry32(seed)() * upperExclusive);
}

function fnvHashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

function validateCoachTrainingRemainder(
  remainder: number,
  playerId: string,
  attribute: keyof CareerPlayer['attrs'],
): void {
  if (!Number.isSafeInteger(remainder) || remainder < 0 || remainder >= 100) {
    throw new Error(
      `player ${playerId} ${attribute} coach training remainder must be from 0 to 99`,
    );
  }
}

/**
 * Indexed by facility level; index 0 means the club owns no such building.
 * These bonuses stay useful without doubling late-career drill gains. Level 1
 * still changes a drill, while Levels 2 and 3 now add 20% and 30%.
 */
export const FACILITY_TRAINING_MULTIPLIER: readonly number[] = [
  1, 1.1, 1.2, 1.3,
];

function facilityTrainingMultiplier(
  state: GameState,
  attribute: keyof CareerPlayer['attrs'],
): number {
  const building = bestTrainingBuilding(state, attribute);
  const base = FACILITY_TRAINING_MULTIPLIER[building?.level ?? 0] ?? 1;
  const boost = cappedFacilityBoost(building?.boosts, 'trainingBonusPercent');
  if (boost === 0) return base;
  /**
   * The bonus part only.
   *
   * Scaling the whole multiplier would let a −20% building drag a club *below*
   * the 1.0 a club with no building at all gets — a story about a bad gym
   * making your players worse than owning no gym. Scaling `base − 1` keeps the
   * floor at exactly 1.0 and still moves the part the building actually earned.
   */
  return 1 + ((base - 1) * (100 + boost)) / 100;
}

function trainingFacilityType(
  attribute: keyof CareerPlayer['attrs'],
): FacilityType {
  return attribute === 'sho'
    ? 'shooting-range'
    : attribute === 'ref'
      ? 'keeper-court'
      : attribute === 'pas' || attribute === 'tec'
        ? 'tech-center'
        : attribute === 'pac' || attribute === 'sta'
          ? 'gym'
          : 'training-pitch';
}

function facilityTrainingLevel(
  state: GameState,
  attribute: keyof CareerPlayer['attrs'],
): number {
  return bestTrainingBuilding(state, attribute)?.level ?? 0;
}

/**
 * The building whose level decides the multiplier — returned whole so its own
 * boost is read from the same place, never from a different copy.
 */
function bestTrainingBuilding(
  state: GameState,
  attribute: keyof CareerPlayer['attrs'],
): PlacedFacility | undefined {
  const facilityType = trainingFacilityType(attribute);
  const grid = state.facilities.grid;
  if (grid === undefined) return undefined;
  let best: PlacedFacility | undefined;
  for (const building of grid.buildings) {
    if (building.type !== facilityType) continue;
    // A building under construction trains nobody — the same rule the Medical
    // Bay, dorm, and income lookups already follow.
    if (!isFacilityOperational(grid, building.id)) continue;
    if (best === undefined || building.level > best.level) best = building;
  }
  return best;
}

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result))
    throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
