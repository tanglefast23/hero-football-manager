/**
 * Versioned opening-policy arms.
 *
 * Every arm is a pure function of the public observation, so an arm can never
 * react to the difficulty label, the seed, or the opponent — only to state a
 * player could have read off the screen. Arms are behavioural hypotheses about
 * how people prepare, not engine rules: the engine imposes no weekly drill cap
 * and no distinct-player cap, so every "three taps" or "four players" here is a
 * modelling choice this file owns and names.
 */
import { OVERTRAINING_CONDITION_THRESHOLD, roleOverall } from '../../game';
import type { Role } from '../../sim/types';
import type { OpeningIntent } from './intents';
import type {
  OpeningObservation,
  VisibleCoachCandidate,
  VisiblePlayer,
} from './observation';

export interface OpeningPolicy {
  readonly id: string;
  readonly version: number;
  readonly description: string;
  /** Intents for one management week, applied in order. */
  plan(observation: OpeningObservation): readonly OpeningIntent[];
}

/** Role-natural fallback order, used when the primary path shows no visible gain. */
const ROLE_PATH_ORDER: Readonly<Record<Role, readonly string[]>> = {
  FWD: ['finishing', 'sprints', 'first-touch'],
  DEF: ['duels', 'circuit', 'rondo'],
  GK: ['keeper-drills', 'duels', 'circuit'],
  MID: ['rondo', 'first-touch', 'circuit'],
};

/** Coach specialty that boosts each training path, mirroring SPECIALTY_BY_ATTRIBUTE. */
const PATH_SPECIALTY: Readonly<Record<string, string>> = {
  sprints: 'FITNESS',
  finishing: 'ATTACK',
  rondo: 'TECHNIQUE',
  duels: 'DEFENSE',
  'first-touch': 'TECHNIQUE',
  circuit: 'FITNESS',
  'keeper-drills': 'GOALKEEPING',
};

const TRAINING_PITCH_POSITION = { x: 0, y: 0 } as const;

type CoachChoice = 'none' | 'first-eligible' | 'best-specialty';
type PassOrder = 'fixed' | 'rotate-weekly';

interface RoundRobinConfig {
  readonly id: string;
  readonly version: number;
  readonly description: string;
  readonly coach: CoachChoice;
  readonly buildTrainingPitch: boolean;
  /** Core roles in priority order; one member is chosen per role. */
  readonly core: readonly Role[];
  readonly maxTapsPerPlayerPerWeek: number;
  /**
   * `one-cycle` stops after a single pass over the core (an engaged player who
   * makes the obvious improvements and banks the rest). `spend-all` keeps
   * cycling while TP and the per-player cap allow.
   */
  readonly weeklyBudget: 'one-cycle' | 'spend-all';
  readonly passOrder: PassOrder;
}

/**
 * Builds the shared opening shape: optional Week 1 coach and Training Pitch,
 * then repeated passes over a role core spending the visible TP bank.
 */
function roundRobinPolicy(config: RoundRobinConfig): OpeningPolicy {
  return {
    id: config.id,
    version: config.version,
    description: config.description,
    plan(observation) {
      const intents: OpeningIntent[] = [
        ...openingKitIntents(
          observation,
          config.coach,
          config.buildTrainingPitch,
        ),
      ];

      const core = selectCore(observation, config.core);
      if (core.length === 0) return intents;

      const rotation =
        config.passOrder === 'rotate-weekly'
          ? (observation.week - 1) % core.length
          : 0;
      const ordered = [...core.slice(rotation), ...core.slice(0, rotation)];

      const tapsByPlayer = new Map<string, number>();
      const attributeValues = new Map<string, number>();
      let trainingPoints = observation.trainingPoints;
      const maxPasses =
        config.weeklyBudget === 'one-cycle'
          ? 1
          : config.maxTapsPerPlayerPerWeek;

      for (let pass = 0; pass < maxPasses; pass += 1) {
        let tappedThisPass = false;
        for (const player of ordered) {
          if (
            (tapsByPlayer.get(player.id) ?? 0) >= config.maxTapsPerPlayerPerWeek
          )
            continue;
          const choice = chooseDrill(player, attributeValues);
          if (choice === undefined) continue;
          if (choice.tpCost > trainingPoints) continue;
          intents.push({
            kind: 'train',
            playerId: player.id,
            pathId: choice.pathId,
          });
          trainingPoints -= choice.tpCost;
          tapsByPlayer.set(player.id, (tapsByPlayer.get(player.id) ?? 0) + 1);
          // Track the projected value so a second tap in the same week prices
          // its own headroom instead of re-reading the stale opening preview.
          attributeValues.set(
            `${player.id}:${choice.attribute}`,
            choice.adjustedAfter,
          );
          tappedThisPass = true;
        }
        if (!tappedThisPass) break;
      }
      return intents;
    },
  };
}

/**
 * Spends the whole visible bank on one path, applied to the role-natural best
 * target. This is the per-TP leverage arm: it answers "what does a week of
 * Duels buy against a week of Finishing" at the real opening roster, where the
 * stats start at different values and the Training Pitch multiplies only DEF.
 */
function singlePathPolicy(
  pathId: string,
  targetRole: Role,
  options: {
    readonly coach: CoachChoice;
    readonly buildTrainingPitch: boolean;
  },
): OpeningPolicy {
  const kit = options.buildTrainingPitch ? 'kit' : 'bare';
  return {
    id: `single-path-${pathId}-${kit}`,
    version: 1,
    description: `every affordable opening tap into ${pathId} on the best ${targetRole}`,
    plan(observation) {
      const intents: OpeningIntent[] = [
        ...openingKitIntents(
          observation,
          options.coach,
          options.buildTrainingPitch,
        ),
      ];
      const target = selectCore(observation, [targetRole])[0];
      if (target === undefined) return intents;

      let trainingPoints = observation.trainingPoints;
      let condition = target.condition;
      let value = target.attrs[drillFor(target, pathId)?.attribute ?? 'sta'];
      for (let guard = 0; guard < 32; guard += 1) {
        const drill = drillFor(target, pathId);
        if (drill === undefined) break;
        if (drill.tpCost > trainingPoints) break;
        // Never start a drill below the overtraining threshold: an injury would
        // be a policy blunder, not a measurement of the path's value.
        if (condition < OVERTRAINING_CONDITION_THRESHOLD) break;
        const projectedAfter =
          value + Math.max(0, drill.adjustedAfter - drill.currentValue);
        if (projectedAfter <= value) break; // the card shows no improvement
        intents.push({ kind: 'train', playerId: target.id, pathId });
        trainingPoints -= drill.tpCost;
        condition -= 8;
        value = projectedAfter;
      }
      return intents;
    },
  };
}

function openingKitIntents(
  observation: OpeningObservation,
  coach: CoachChoice,
  buildTrainingPitch: boolean,
): OpeningIntent[] {
  const intents: OpeningIntent[] = [];
  if (coach !== 'none' && !observation.headCoachHired) {
    const candidate =
      coach === 'first-eligible'
        ? observation.coachCandidates[0]
        : bestSpecialtyCoach(observation);
    if (candidate !== undefined && observation.cash >= candidate.weeklyWage) {
      intents.push({ kind: 'hire-head-coach', coachId: candidate.id });
    }
  }
  if (
    buildTrainingPitch &&
    !observation.constructionInProgress &&
    !observation.facilities.some(
      (facility) => facility.type === 'training-pitch',
    )
  ) {
    intents.push({
      kind: 'build-facility',
      facilityType: 'training-pitch',
      position: TRAINING_PITCH_POSITION,
    });
  }
  return intents;
}

/**
 * Scores candidates by how many of the club's role-natural primary paths their
 * specialties boost. Ties resolve by level, then cheaper wage, then the order
 * the list is displayed in — never by an opaque id.
 */
function bestSpecialtyCoach(
  observation: OpeningObservation,
): VisibleCoachCandidate | undefined {
  const wanted = new Set(
    selectCore(observation, ['FWD', 'DEF', 'GK', 'MID']).map(
      (player) => PATH_SPECIALTY[ROLE_PATH_ORDER[player.role][0]],
    ),
  );
  return observation.coachCandidates
    .map((candidate, order) => ({
      candidate,
      order,
      matches: candidate.specialties.filter((specialty) =>
        wanted.has(specialty),
      ).length,
    }))
    .sort(
      (left, right) =>
        right.matches - left.matches ||
        right.candidate.level - left.candidate.level ||
        left.candidate.weeklyWage - right.candidate.weeklyWage ||
        left.order - right.order,
    )[0]?.candidate;
}

/**
 * One trainable player per requested role.
 *
 * FWD prefers the created player — the app puts them at the centre of the
 * opening story — then falls back to the best visible role rating. Ties break
 * on the visible lineup order, with the opaque id as a last-resort
 * reproducibility tie-break only.
 */
function selectCore(
  observation: OpeningObservation,
  roles: readonly Role[],
): VisiblePlayer[] {
  const chosen: VisiblePlayer[] = [];
  for (const role of roles) {
    const eligible = observation.players.filter(
      (player) =>
        player.role === role &&
        player.isStarter &&
        player.injuryWeeks === 0 &&
        !chosen.some((already) => already.id === player.id),
    );
    const created =
      role === 'FWD'
        ? eligible.find((player) => player.isCreatedPlayer)
        : undefined;
    const best =
      created ??
      eligible.sort(
        (left, right) =>
          roleOverall(right.role, right.attrs) -
            roleOverall(left.role, left.attrs) ||
          left.lineupOrder - right.lineupOrder ||
          left.id.localeCompare(right.id),
      )[0];
    if (best !== undefined) chosen.push(best);
  }
  return chosen;
}

/**
 * The first role-natural path whose card still promises an improvement, priced
 * against any earlier tap already planned for the same attribute this week.
 */
function chooseDrill(
  player: VisiblePlayer,
  attributeValues: ReadonlyMap<string, number>,
):
  | { pathId: string; attribute: string; tpCost: number; adjustedAfter: number }
  | undefined {
  for (const pathId of ROLE_PATH_ORDER[player.role]) {
    const drill = player.drills.find((option) => option.pathId === pathId);
    if (drill === undefined) continue;
    const current =
      attributeValues.get(`${player.id}:${drill.attribute}`) ??
      drill.currentValue;
    const projected = current + drill.visibleGain;
    if (projected <= current) continue;
    return {
      pathId,
      attribute: drill.attribute,
      tpCost: drill.tpCost,
      adjustedAfter: projected,
    };
  }
  return undefined;
}

function drillFor(player: VisiblePlayer, pathId: string) {
  return player.drills.find((option) => option.pathId === pathId);
}

/**
 * The engaged-ordinary manager. Hires the first coach on the list, builds the
 * Training Pitch, makes the three obvious role improvements each week, and
 * banks whatever is left rather than emptying the bank.
 */
export const ORDINARY_POLICY = roundRobinPolicy({
  id: 'ordinary',
  version: 1,
  description:
    'coach + pitch, one tap each on FWD/DEF/GK per week, banks the remainder',
  coach: 'first-eligible',
  buildTrainingPitch: true,
  core: ['FWD', 'DEF', 'GK'],
  maxTapsPerPlayerPerWeek: 1,
  weeklyBudget: 'one-cycle',
  passOrder: 'fixed',
});

/** The smart manager who widens the development core to four starters. */
export const SMART_BREADTH_POLICY = roundRobinPolicy({
  id: 'smart-breadth',
  version: 1,
  description: 'specialty coach + pitch, spends the bank across FWD/DEF/GK/MID',
  coach: 'best-specialty',
  buildTrainingPitch: true,
  core: ['FWD', 'DEF', 'GK', 'MID'],
  maxTapsPerPlayerPerWeek: 1,
  weeklyBudget: 'spend-all',
  passOrder: 'fixed',
});

/** Sensitivity A: the spare tap goes back into the created striker instead. */
export const SMART_EXTRA_FWD_POLICY = roundRobinPolicy({
  id: 'smart-extra-fwd',
  version: 1,
  description:
    'specialty coach + pitch, three-player core, spare taps to the created FWD',
  coach: 'best-specialty',
  buildTrainingPitch: true,
  core: ['FWD', 'DEF', 'GK'],
  maxTapsPerPlayerPerWeek: 2,
  weeklyBudget: 'spend-all',
  passOrder: 'fixed',
});

/** Sensitivity B: the concentration ceiling — an exploit probe, not a person. */
export const SMART_CONCENTRATION_POLICY: OpeningPolicy = {
  ...singlePathPolicy('finishing', 'FWD', {
    coach: 'best-specialty',
    buildTrainingPitch: true,
  }),
  id: 'smart-concentration',
  description:
    'specialty coach + pitch, every safe affordable tap into the created FWD',
};

/**
 * Joe's observed opening, coach included: role-correct drills, at most three
 * taps per player per week, spending the bank, Training Pitch on Week 1.
 */
export const JOE_OBSERVED_COACH_POLICY = roundRobinPolicy({
  id: 'joe-observed-coach',
  version: 1,
  description:
    'coach + pitch, role-correct drills, <=3 taps per player per week, spends the bank',
  coach: 'first-eligible',
  buildTrainingPitch: true,
  core: ['FWD', 'DEF', 'GK'],
  maxTapsPerPlayerPerWeek: 3,
  weeklyBudget: 'spend-all',
  passOrder: 'rotate-weekly',
});

/** The same opening without a head coach: 78 TP before kickoff instead of 102. */
export const JOE_OBSERVED_NO_COACH_POLICY = roundRobinPolicy({
  id: 'joe-observed-no-coach',
  version: 1,
  description:
    'pitch only, role-correct drills, <=3 taps per player per week, spends the bank',
  coach: 'none',
  buildTrainingPitch: true,
  core: ['FWD', 'DEF', 'GK'],
  maxTapsPerPlayerPerWeek: 3,
  weeklyBudget: 'spend-all',
  passOrder: 'rotate-weekly',
});

/** Historical control: the PAC-only three-player probe policy, no kit. */
export const PAC_CONTROL_POLICY = roundRobinPolicy({
  id: 'pac-control',
  version: 1,
  description:
    'legacy control: no coach, no build, one Sprints tap each on three starters',
  coach: 'none',
  buildTrainingPitch: false,
  core: ['FWD', 'DEF', 'MID'],
  maxTapsPerPlayerPerWeek: 1,
  weeklyBudget: 'one-cycle',
  passOrder: 'fixed',
});

/** Control: a manager who touches nothing at all. */
export const NO_TRAINING_POLICY: OpeningPolicy = {
  id: 'no-training',
  version: 1,
  description: 'control: no coach, no build, no drills',
  plan: () => [],
};

/**
 * The matched control for a path-leverage arm: identical coach and facility
 * state, zero drills. Comparing a path against this rather than against a bare
 * career keeps the reported lift attributable to the drills instead of to the
 * Training Pitch's own presence.
 */
export function kitOnlyPolicy(options: {
  readonly coach: CoachChoice;
  readonly buildTrainingPitch: boolean;
}): OpeningPolicy {
  return {
    id: `kit-only-${options.buildTrainingPitch ? 'pitch' : 'bare'}`,
    version: 1,
    description: 'control: the opening kit with no drills at all',
    plan: (observation) =>
      openingKitIntents(observation, options.coach, options.buildTrainingPitch),
  };
}

const SINGLE_PATH_TARGETS: readonly (readonly [string, Role])[] = [
  ['finishing', 'FWD'],
  ['sprints', 'FWD'],
  ['first-touch', 'MID'],
  ['rondo', 'MID'],
  ['duels', 'DEF'],
  ['circuit', 'DEF'],
  ['keeper-drills', 'GK'],
];

/**
 * Seven arms that each pour the whole opening budget into one path, so the
 * per-TP value of Duels can be read directly against Finishing at the roster
 * and facility state a real opening actually has.
 */
export function singlePathPolicies(options: {
  readonly coach: CoachChoice;
  readonly buildTrainingPitch: boolean;
}): readonly OpeningPolicy[] {
  return SINGLE_PATH_TARGETS.map(([pathId, role]) =>
    singlePathPolicy(pathId, role, options),
  );
}

export const REALISTIC_POLICIES: readonly OpeningPolicy[] = [
  ORDINARY_POLICY,
  SMART_BREADTH_POLICY,
  SMART_EXTRA_FWD_POLICY,
  SMART_CONCENTRATION_POLICY,
  JOE_OBSERVED_COACH_POLICY,
  JOE_OBSERVED_NO_COACH_POLICY,
  PAC_CONTROL_POLICY,
  NO_TRAINING_POLICY,
];
