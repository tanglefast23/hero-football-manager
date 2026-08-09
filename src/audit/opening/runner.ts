/**
 * Plays one opening career through production boundaries and records what
 * happened.
 *
 * Every state change comes from a production action. The runner never adds TP,
 * writes an attribute, resets condition, clears an injury, injects cash, or
 * authors a score — an intent that production refuses is recorded as skipped
 * with its real error message, never swallowed and papered over.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent, type LaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  completeFirstOnboardingMatch,
  completeMatchday,
  createCareer,
  hireCareerCoach,
  isFirstOnboardingFixture,
  quickMatchForFixture,
  resolveTrainingDrillForPath,
  trainPlayerInstantly,
  withoutPowers,
  type DifficultyMode,
  type GameState,
} from '../../game';
import { buildCareerFacility } from '../../game/management';
import { mulberry32 } from '../../sim/rng';
import type { Attrs, TeamDef } from '../../sim/types';
import { describeIntent, type OpeningIntent } from './intents';
import { buildOpeningObservation } from './observation';
import type { OpeningPolicy } from './policies';

const ATTRIBUTE_KEYS: readonly (keyof Attrs)[] = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
];

/** The 15-point creation pool each profile spends, as the app would. */
export interface CreationRatings {
  readonly pac: number;
  readonly sho: number;
  readonly pas: number;
  readonly def: number;
  readonly tec: number;
  readonly sta: number;
}

export interface ActionRecord {
  readonly season: number;
  readonly week: number;
  readonly phase: string;
  readonly action: string;
  readonly completed: boolean;
  /** The production error a player would have been shown, when skipped. */
  readonly reason?: string;
  readonly cashBefore: number;
  readonly cashAfter: number;
  readonly tpBefore: number;
  readonly tpAfter: number;
  readonly playerId?: string;
  readonly role?: string;
  readonly pathId?: string;
  readonly attribute?: string;
  readonly attributeBefore?: number;
  readonly attributeAfter?: number;
  readonly conditionBefore?: number;
  readonly conditionAfter?: number;
  readonly isSuper?: boolean;
  readonly injuryWeeks?: number;
}

export interface WeeklyTpRecord {
  readonly week: number;
  readonly opening: number;
  readonly spent: number;
  readonly granted: number;
  readonly closing: number;
}

export interface OpenerResult {
  readonly fixtureId: string;
  readonly opponentClubId: string;
  readonly isHome: boolean;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly outcome: 'W' | 'D' | 'L';
  readonly userStrength: number;
  readonly opponentStrength: number;
  readonly userShots: number;
  readonly opponentShots: number;
  readonly userSaves: number;
  readonly powersActive: boolean;
}

export interface OpeningRun {
  readonly seed: number;
  readonly difficulty: DifficultyMode;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly actions: readonly ActionRecord[];
  readonly weeklyTp: readonly WeeklyTpRecord[];
  readonly tapCount: number;
  readonly tpSpent: number;
  readonly tpBanked: number;
  readonly skippedIntents: number;
  /** Kickoff condition for every user-club starter, keyed by player id. */
  readonly kickoffCondition: Readonly<Record<string, number>>;
  readonly statGains: readonly {
    readonly playerId: string;
    readonly role: string;
    readonly attribute: string;
    readonly before: number;
    readonly after: number;
  }[];
  readonly opener: OpenerResult;
}

export interface OpeningRunOptions {
  readonly seed: number;
  readonly difficulty: DifficultyMode;
  readonly policy: OpeningPolicy;
  readonly creation: CreationRatings;
  readonly content?: LaunchContent;
  readonly playerName?: string;
  /**
   * Role-stat points added to a clone of the opening opponent, for the spec's
   * pre-registered opponent experiment. Zero or absent leaves the fixture
   * exactly as production builds it.
   */
  readonly opponentRoleBuff?: number;
  /**
   * Overrides the career's launch TP grant, for the preparation-budget
   * experiment. Absent uses production's 30. This changes the setup a career is
   * created with — it is not an injection into a running career.
   */
  readonly startingTrainingPoints?: number;
}

/** The production rating ceiling; a buffed clone may not exceed it. */
const MAXIMUM_RATING = 999;

/**
 * Clones the opponent and adds `buff` to each player's canonical role stat.
 *
 * The spec's sole exception to the no-direct-stat rule, and it stays an
 * exception: this touches a `TeamDef` built for one fixture, never saved career
 * state, caps, contracts, or any later match. Roles come from the roster
 * (`PlayerDef.role`), not from whatever slot the formation happened to assign.
 */
function buffedOpponent(team: TeamDef, buff: number): TeamDef {
  if (buff === 0) return team;
  if (!Number.isSafeInteger(buff) || buff < 0) {
    throw new Error(
      'the opponent role buff must be a non-negative safe integer',
    );
  }
  const buffPlayer = (player: TeamDef['players'][number]) => {
    const attribute =
      player.role === 'FWD'
        ? 'sho'
        : player.role === 'DEF'
          ? 'def'
          : player.role === 'GK'
            ? 'ref'
            : undefined; // MID is deliberately unchanged
    if (attribute === undefined) return player;
    return {
      ...player,
      attrs: {
        ...player.attrs,
        [attribute]: Math.min(MAXIMUM_RATING, player.attrs[attribute] + buff),
      },
    };
  };
  return {
    ...team,
    players: team.players.map(buffPlayer),
    ...(team.bench === undefined ? {} : { bench: team.bench.map(buffPlayer) }),
  };
}

/**
 * The launch TP grant production actually ships, read from the real setup.
 *
 * Probes reconcile their ledgers against this rather than a literal, so tuning
 * the grant retunes the harness with it instead of failing every arm. The
 * runner separately asserts that a created career really opened on the granted
 * amount, so the check this feeds is still a check.
 */
export function productionLaunchTrainingPoints(
  content?: LaunchContent,
): number {
  return (
    createLaunchCareerSetup(
      undefined,
      undefined,
      content ?? loadLaunchContent(),
    ).startingTrainingPoints ?? 0
  );
}

/** Plays weeks 1..N of a fresh career and resolves the first fixture. */
export function runOpening(options: OpeningRunOptions): OpeningRun {
  const content = options.content ?? loadLaunchContent();
  const launchSetup = createLaunchCareerSetup(
    options.seed,
    undefined,
    content,
    options.difficulty,
  );
  const setup =
    options.startingTrainingPoints === undefined
      ? launchSetup
      : {
          ...launchSetup,
          startingTrainingPoints: options.startingTrainingPoints,
        };
  const openingTrainingPoints = setup.startingTrainingPoints ?? 0;
  let state = addCreatedPlayer(beginStoryOnboarding(createCareer(setup)), {
    name: options.playerName ?? 'Harness Rookie',
    ratings: { ...options.creation },
  });
  if (state.trainingPoints !== openingTrainingPoints) {
    throw new Error(
      `career opened on ${state.trainingPoints} TP but the setup granted ${openingTrainingPoints}`,
    );
  }

  const openingAttributes = snapshotAttributes(state);
  const actions: ActionRecord[] = [];
  const weeklyTp: WeeklyTpRecord[] = [];
  let skippedIntents = 0;
  let guard = 0;

  while (state.phase === 'manage' && guard < 64) {
    guard += 1;
    const weekOpeningTp = state.trainingPoints;
    const intents = options.policy.plan(buildOpeningObservation(state));
    for (const intent of intents) {
      const applied = applyIntent(state, intent);
      actions.push(applied.record);
      if (!applied.record.completed) skippedIntents += 1;
      state = applied.state;
    }
    const beforeAdvanceTp = state.trainingPoints;
    const week = state.week;
    state = advanceWeek(state);
    weeklyTp.push({
      week,
      opening: weekOpeningTp,
      spent: weekOpeningTp - beforeAdvanceTp,
      // Weekly settlement is whatever production added crossing the boundary;
      // it stays a measured value so an unexplained grant fails reconciliation.
      granted: state.trainingPoints - beforeAdvanceTp,
      closing: state.trainingPoints,
    });
  }
  if (state.phase !== 'matchday') {
    throw new Error(
      `opening run reached phase ${state.phase} without a fixture`,
    );
  }

  const kickoffCondition: Record<string, number> = {};
  for (const player of state.players.filter(
    (candidate) => candidate.clubId === state.userClubId,
  )) {
    kickoffCondition[player.id] = player.condition ?? 100;
  }
  const statGains = diffAttributes(openingAttributes, state);
  const tpBanked = state.trainingPoints;
  const tpSpent = actions
    .filter((record) => record.completed && record.action.startsWith('train '))
    .reduce((sum, record) => sum + (record.tpBefore - record.tpAfter), 0);

  const opener = playOpener(state, options.opponentRoleBuff ?? 0);

  return {
    seed: options.seed,
    difficulty: options.difficulty,
    policyId: options.policy.id,
    policyVersion: options.policy.version,
    actions,
    weeklyTp,
    tapCount: actions.filter(
      (record) => record.completed && record.action.startsWith('train '),
    ).length,
    tpSpent,
    tpBanked,
    skippedIntents,
    kickoffCondition,
    statGains,
    opener,
  };
}

function applyIntent(
  state: GameState,
  intent: OpeningIntent,
): { state: GameState; record: ActionRecord } {
  const cashBefore = userCash(state);
  const tpBefore = state.trainingPoints;
  const base = {
    season: state.season,
    week: state.week,
    phase: state.phase,
    action: describeIntent(intent),
    cashBefore,
    tpBefore,
  };

  try {
    if (intent.kind === 'hire-head-coach') {
      const market = state.market;
      if (market === undefined)
        throw new Error('no career market to hire from');
      const next: GameState = {
        ...state,
        market: hireCareerCoach(state, market, intent.coachId),
      };
      return {
        state: next,
        record: {
          ...base,
          completed: true,
          cashAfter: userCash(next),
          tpAfter: next.trainingPoints,
        },
      };
    }

    if (intent.kind === 'build-facility') {
      const next = buildCareerFacility(
        state,
        intent.facilityType,
        intent.position,
      ).state;
      return {
        state: next,
        record: {
          ...base,
          completed: true,
          cashAfter: userCash(next),
          tpAfter: next.trainingPoints,
        },
      };
    }

    const player = state.players.find(
      (candidate) => candidate.id === intent.playerId,
    );
    if (player === undefined)
      throw new Error(`unknown player ${intent.playerId}`);
    const drill = resolveTrainingDrillForPath(state, intent.pathId);
    if (drill.tpCost > state.trainingPoints) {
      throw new Error(
        `training needs ${drill.tpCost} TP but only ${state.trainingPoints} are available`,
      );
    }
    const resolution = trainPlayerInstantly(
      state,
      intent.playerId,
      intent.pathId,
    );
    return {
      state: resolution.state,
      record: {
        ...base,
        completed: true,
        cashAfter: userCash(resolution.state),
        tpAfter: resolution.state.trainingPoints,
        playerId: player.id,
        role: player.role,
        pathId: intent.pathId,
        attribute: resolution.attribute,
        attributeBefore: resolution.before,
        attributeAfter: resolution.after,
        conditionBefore: player.condition ?? 100,
        conditionAfter: resolution.conditionAfter,
        isSuper: resolution.isSuper,
        ...(resolution.injury === undefined
          ? {}
          : { injuryWeeks: resolution.injury.recoveryWeeks }),
      },
    };
  } catch (error) {
    return {
      state,
      record: {
        ...base,
        completed: false,
        reason: error instanceof Error ? error.message : String(error),
        cashAfter: cashBefore,
        tpAfter: tpBefore,
      },
    };
  }
}

/**
 * Resolves the opening fixture through the same path the app uses. Rival league
 * fixtures take cheap deterministic scores: they cannot reach the user's own
 * result in week 3 and simulating them dominates the sweep's runtime.
 */
function playOpener(state: GameState, opponentRoleBuff: number): OpenerResult {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('matchday phase without an active fixture');
  const { fixture, fixtures } = matchday;
  const built = buildCareerMatchTeams(state, [
    ...new Set([fixture.homeClubId, fixture.awayClubId]),
  ]);
  const onboarding = isFirstOnboardingFixture(state, fixture.id);
  const stripped = onboarding
    ? {
        [fixture.homeClubId]: withoutPowers(built[fixture.homeClubId]),
        [fixture.awayClubId]: withoutPowers(built[fixture.awayClubId]),
      }
    : built;

  const isHome = fixture.homeClubId === state.userClubId;
  const opponentClubId = isHome ? fixture.awayClubId : fixture.homeClubId;
  const teams = {
    ...stripped,
    [opponentClubId]: buffedOpponent(
      stripped[opponentClubId],
      opponentRoleBuff,
    ),
  };
  const userTeam = teams[isHome ? fixture.homeClubId : fixture.awayClubId];
  const opponentTeam = teams[isHome ? fixture.awayClubId : fixture.homeClubId];
  const quick = quickMatchForFixture(fixture, teams);

  // Completing the matchday keeps the run on the production path even though
  // this harness stops at the opener; a half-applied matchday is not a state
  // the app can produce.
  completeMatchday(
    state,
    fixtures.map((candidate) =>
      candidate.id === fixture.id ? quick.result : cheapScore(candidate),
    ),
  );

  const goalsFor = isHome ? quick.result.homeGoals : quick.result.awayGoals;
  const goalsAgainst = isHome ? quick.result.awayGoals : quick.result.homeGoals;
  const userIndexIsHome = isHome;
  const shotsBy = (home: boolean) =>
    quick.replay === undefined ? 0 : countShots(quick, home);

  return {
    fixtureId: fixture.id,
    opponentClubId: isHome ? fixture.awayClubId : fixture.homeClubId,
    isHome,
    goalsFor,
    goalsAgainst,
    outcome:
      goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L',
    userStrength: lineupStrength(userTeam),
    opponentStrength: lineupStrength(opponentTeam),
    userShots: shotsBy(userIndexIsHome),
    opponentShots: shotsBy(!userIndexIsHome),
    userSaves: Math.max(0, shotsBy(!userIndexIsHome) - goalsAgainst),
    powersActive: !onboarding,
  };
}

function countShots(
  quick: ReturnType<typeof quickMatchForFixture>,
  home: boolean,
): number {
  const events = quick.match.events ?? [];
  return events.filter(
    (event) => event.kind === 'SHOT' && (home ? event.by < 11 : event.by >= 11),
  ).length;
}

function cheapScore(fixture: { id: string; matchSeed: number }) {
  const random = mulberry32(fixture.matchSeed);
  const roll = (value: number) =>
    value < 0.34 ? 0 : value < 0.68 ? 1 : value < 0.88 ? 2 : 3;
  return {
    fixtureId: fixture.id,
    homeGoals: roll(random()),
    awayGoals: roll(random()),
  };
}

function lineupStrength(team: TeamDef): number {
  const total = team.players.reduce(
    (sum, player) =>
      sum + ATTRIBUTE_KEYS.reduce((inner, key) => inner + player.attrs[key], 0),
    0,
  );
  return (
    Math.round((total / (team.players.length * ATTRIBUTE_KEYS.length)) * 100) /
    100
  );
}

function userCash(state: GameState): number {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  return club.cash;
}

function snapshotAttributes(state: GameState): Map<string, Attrs> {
  const snapshot = new Map<string, Attrs>();
  for (const player of state.players.filter(
    (p) => p.clubId === state.userClubId,
  )) {
    snapshot.set(player.id, { ...player.attrs });
  }
  return snapshot;
}

function diffAttributes(
  before: ReadonlyMap<string, Attrs>,
  state: GameState,
): OpeningRun['statGains'] {
  const gains: {
    playerId: string;
    role: string;
    attribute: string;
    before: number;
    after: number;
  }[] = [];
  for (const player of state.players.filter(
    (p) => p.clubId === state.userClubId,
  )) {
    const opening = before.get(player.id);
    if (opening === undefined) continue;
    for (const key of ATTRIBUTE_KEYS) {
      if (player.attrs[key] === opening[key]) continue;
      gains.push({
        playerId: player.id,
        role: player.role,
        attribute: key,
        before: opening[key],
        after: player.attrs[key],
      });
    }
  }
  return gains;
}

/**
 * The ledger identity every run must satisfy:
 * opening TP + every granted source - every production drill cost = closing TP.
 * A mismatch means something moved TP outside the recorded actions, which
 * invalidates the run rather than merely logging a warning.
 */
export function reconcileTrainingPoints(
  run: OpeningRun,
  openingTrainingPoints: number,
): void {
  let expected = openingTrainingPoints;
  for (const week of run.weeklyTp) {
    if (week.opening !== expected) {
      throw new Error(
        `week ${week.week} opened at ${week.opening} TP but the ledger expected ${expected}`,
      );
    }
    expected = week.closing;
  }
  if (expected !== run.tpBanked) {
    throw new Error(
      `closing TP ${run.tpBanked} does not match the ledger total ${expected}`,
    );
  }
  const spent = run.weeklyTp.reduce((sum, week) => sum + week.spent, 0);
  if (spent !== run.tpSpent) {
    throw new Error(
      `weekly TP spend ${spent} disagrees with recorded drill costs ${run.tpSpent}`,
    );
  }
}
