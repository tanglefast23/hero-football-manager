/**
 * Opt-in Cup catch-up measurement.
 *
 * The paired trials scale a real opening Cup pairing until the attribute gap
 * is exact, then play that fixture twice with the same match seed: once as
 * built, and once after the current Semi-final 25% / Final 50% lift. Those
 * matches are a strength experiment. They are not an income source.
 *
 * `mirroredCupOpponent` is the audit copy of the private catch-up rule. A
 * fast test locks it with `toEqual` against `buildCareerMatchTeamDef`.
 */
import { createLaunchCareerSetup } from '../application/launch';
import { loadLaunchContent } from '../content';
import {
  aiClubHeroAssignments,
  buildCareerMatchTeamDef,
  buildCareerTeamDef,
  createCareer,
  CUP_SETTLEMENT_WEEKS,
  quickMatchForFixture,
  roleOverall,
  type DifficultyMode,
  type GameState,
  type LeagueFixture,
  type NationalCupFixture,
  type NationalCupRoundLabel,
} from '../game';
import { penaltyShootoutSeed, resolvePenaltyShootout } from '../game/penalties';
import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { FormationId } from '../sim/tactics';
import type { Attrs, Role, TeamDef } from '../sim/types';

export const CUP_CATCHUP_STUDY_SEED = 20261019;
export const CUP_CATCHUP_GAPS = [10, 20, 40] as const;
export const CUP_CATCHUP_ROUNDS = ['Semi-final', 'Final'] as const;

const CONTENT = loadLaunchContent();
const ATTRIBUTE_KEYS = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
] as const satisfies readonly (keyof Attrs)[];

export interface PowerDiagnosticPlayer {
  readonly id: string;
  readonly role: Role;
  readonly attrs: Attrs;
  readonly powered: boolean;
  readonly licensed: boolean;
}

export interface CupPowerDiagnostic {
  readonly xiPowers: number;
  readonly unlicensedPowers: number;
  readonly unlicensedHeroOutratesXi: number;
}

export interface CupGapMeasurement {
  readonly userAttrRating: number;
  readonly opponentAttrRating: number;
  readonly attrGap: number;
}

export type CupCatchUpArm = 'natural' | 'none' | 'catchup';

export interface CupCatchUpScale {
  readonly side: 'user' | 'opponent';
  readonly percent: number;
}

export interface CupCatchUpRow {
  readonly difficulty: DifficultyMode;
  readonly seed: number;
  readonly kind: 'natural' | 'paired';
  readonly roundLabel: NationalCupRoundLabel;
  readonly realRoundLabel: NationalCupRoundLabel;
  readonly gapTarget?: (typeof CUP_CATCHUP_GAPS)[number];
  readonly arm: CupCatchUpArm;
  readonly scale?: CupCatchUpScale;
  readonly homeClubId: string;
  readonly awayClubId: string;
  readonly userClubId: string;
  readonly opponentClubId: string;
  readonly matchSeed: number;
  readonly userAttrRating: number;
  readonly opponentAttrRating: number;
  readonly attrGap: number;
  readonly playedUserAttrRating: number;
  readonly playedOpponentAttrRating: number;
  readonly catchupWouldTrigger: boolean;
  readonly catchupApplied: boolean;
  readonly userXiPowers: number;
  readonly opponentXiPowers: number;
  readonly userUnlicensedPowers: number;
  readonly opponentUnlicensedPowers: number;
  readonly unlicensedHeroOutratesXi: number;
  readonly powerSignDisagreesWithAttrGap: boolean;
  readonly regulationHomeGoals: number;
  readonly regulationAwayGoals: number;
  readonly regulationOutcome: 'WIN' | 'DRAW' | 'LOSS';
  readonly penaltySource?: 'PRODUCTION_SHOOTOUT';
  readonly penaltyWinnerClubId?: string;
  readonly penaltyHomeGoals?: number;
  readonly penaltyAwayGoals?: number;
}

export interface CupCatchUpUnreachable {
  readonly difficulty: DifficultyMode;
  readonly seed: number;
  readonly roundLabel: (typeof CUP_CATCHUP_ROUNDS)[number];
  readonly gapTarget: (typeof CUP_CATCHUP_GAPS)[number];
  readonly reason: 'no exact attribute percent';
}

export interface CupCatchUpCandidate {
  readonly status: 'UNAPPROVED_NOT_APPLIED';
  readonly semiFinalCatchUpPercent: 25;
  readonly finalCatchUpPercent: 50;
  readonly proposal: 'no change';
  readonly reason: string;
}

export interface CupCatchUpStudy {
  readonly kind: 'cup-catchup-measurement';
  readonly status: 'MEASUREMENT_ONLY';
  readonly seed: number;
  readonly difficulties: readonly DifficultyMode[];
  readonly gaps: readonly number[];
  readonly rounds: readonly string[];
  readonly catchupPercent: { readonly 'Semi-final': 25; readonly Final: 50 };
  readonly penaltyCalibrationPath: 'artifacts/balance-design-2026-10-19/penalty-calibration.json';
  readonly rows: readonly CupCatchUpRow[];
  readonly unreachable: readonly CupCatchUpUnreachable[];
  readonly candidate: CupCatchUpCandidate;
}

/** Mean of the eleven role ratings, rounded once. This is the catch-up rating. */
export function meanXiRating(team: TeamDef): number {
  if (team.players.length === 0) {
    throw new Error(`club ${team.id} has no XI for a Cup rating`);
  }
  return Math.round(
    team.players.reduce(
      (sum, player) => sum + roleOverall(player.role, player.attrs),
      0,
    ) / team.players.length,
  );
}

export function measureCupGap(
  userTeam: TeamDef,
  opponentTeam: TeamDef,
): CupGapMeasurement {
  const userAttrRating = meanXiRating(userTeam);
  const opponentAttrRating = meanXiRating(opponentTeam);
  return {
    userAttrRating,
    opponentAttrRating,
    attrGap: userAttrRating - opponentAttrRating,
  };
}

/**
 * Same percent rule as the private match builder: every attribute of the
 * eleven and the bench, clamped to the legal range.
 */
export function scaleTeamAttributes(team: TeamDef, percent: number): TeamDef {
  if (percent === 100) return team;
  const scalePlayer = (player: TeamDef['players'][number]) => {
    const attrs = { ...player.attrs };
    for (const attribute of ATTRIBUTE_KEYS) {
      attrs[attribute] = Math.min(
        MAX_PLAYER_ATTRIBUTE,
        Math.max(1, Math.round((attrs[attribute] * percent) / 100)),
      );
    }
    return { ...player, attrs };
  };
  return {
    ...team,
    players: team.players.map(scalePlayer),
    ...(team.bench === undefined ? {} : { bench: team.bench.map(scalePlayer) }),
  };
}

/**
 * Audit copy of the Semi-final / Final lift.
 *
 * `userTeam` must be `buildCareerTeamDef` for the user. `opponent` must be
 * the opponent `buildCareerMatchTeamDef` returns before a Cup round is passed.
 */
export function mirroredCupOpponent(
  userTeam: TeamDef,
  opponent: TeamDef,
  roundLabel: 'Semi-final' | 'Final',
): TeamDef {
  const userRating = meanXiRating(userTeam);
  const opponentRating = meanXiRating(opponent);
  const gap = userRating - opponentRating;
  if (gap < 10) return opponent;
  const target =
    opponentRating +
    Math.floor((gap * (roundLabel === 'Final' ? 50 : 25)) / 100);
  return scaleTeamAttributes(
    opponent,
    Math.floor((target * 100) / opponentRating),
  );
}

export function diagnoseCupPowers(
  xi: TeamDef,
  roster: readonly PowerDiagnosticPlayer[],
): CupPowerDiagnostic {
  const xiIds = new Set(xi.players.map((player) => player.id));
  const weakestByRole = new Map<Role, number>();
  for (const player of xi.players) {
    const rating = roleOverall(player.role, player.attrs);
    const current = weakestByRole.get(player.role);
    if (current === undefined || rating < current) {
      weakestByRole.set(player.role, rating);
    }
  }
  const unlicensed = roster.filter(
    (player) => player.powered && !player.licensed,
  );
  let unlicensedHeroOutratesXi = 0;
  for (const player of unlicensed) {
    if (xiIds.has(player.id)) continue;
    const weakest = weakestByRole.get(player.role);
    if (weakest === undefined) continue;
    if (roleOverall(player.role, player.attrs) > weakest) {
      unlicensedHeroOutratesXi += 1;
    }
  }
  return {
    xiPowers: xi.players.filter((player) => player.power !== undefined).length,
    unlicensedPowers: unlicensed.length,
    unlicensedHeroOutratesXi,
  };
}

/** Fielded powers come from the match XI. Unlicensed powers come from the club roster. */
export function diagnosticRoster(
  state: GameState,
  clubId: string,
): PowerDiagnosticPlayer[] {
  if (state.clubs.some((club) => club.id === clubId)) {
    return state.players
      .filter((player) => player.clubId === clubId)
      .map((player) => ({
        id: player.id,
        role: player.role,
        attrs: player.attrs,
        powered: player.power !== undefined,
        licensed: player.licensed === true,
      }));
  }
  const placed = state.m2?.pyramid.divisions
    .flatMap((division) =>
      division.clubs.map((club) => ({ division: division.level, club })),
    )
    .find((entry) => entry.club.id === clubId);
  if (placed === undefined) throw new Error(`unknown Cup club ${clubId}`);
  const assignments = aiClubHeroAssignments(
    placed.club.id,
    placed.division,
    placed.club.squad,
  );
  return placed.club.squad.map((player) => {
    const assignment = assignments.get(player.id);
    return {
      id: player.id,
      role: player.role,
      attrs: player.attrs,
      powered: assignment?.power !== undefined,
      licensed: assignment?.licensed === true,
    };
  });
}

export function manufactureExactGap(
  userTeam: TeamDef,
  opponentTeam: TeamDef,
  targetGap: number,
): { user: TeamDef; opponent: TeamDef; scale: CupCatchUpScale } | undefined {
  for (let percent = 1; percent <= 2000; percent += 1) {
    const opponent = scaleTeamAttributes(opponentTeam, percent);
    if (meanXiRating(userTeam) - meanXiRating(opponent) === targetGap) {
      return {
        user: userTeam,
        opponent,
        scale: { side: 'opponent', percent },
      };
    }
  }
  for (let percent = 1; percent <= 2000; percent += 1) {
    const user = scaleTeamAttributes(userTeam, percent);
    if (meanXiRating(user) - meanXiRating(opponentTeam) === targetGap) {
      return {
        user,
        opponent: opponentTeam,
        scale: { side: 'user', percent },
      };
    }
  }
  return undefined;
}

function userRegulationOutcome(
  userClubId: string,
  fixture: { readonly homeClubId: string; readonly awayClubId: string },
  homeGoals: number,
  awayGoals: number,
): 'WIN' | 'DRAW' | 'LOSS' {
  const userGoals = fixture.homeClubId === userClubId ? homeGoals : awayGoals;
  const opponentGoals =
    fixture.homeClubId === userClubId ? awayGoals : homeGoals;
  if (userGoals > opponentGoals) return 'WIN';
  if (userGoals < opponentGoals) return 'LOSS';
  return 'DRAW';
}

function openingUserCup(state: GameState): {
  fixture: NationalCupFixture;
  roundLabel: NationalCupRoundLabel;
} {
  const cup = state.m2?.nationalCups.find(
    (candidate) => candidate.season === state.season,
  );
  if (cup === undefined) throw new Error('opening career has no Hero Cup');
  for (const round of cup.rounds) {
    const fixture = round.fixtures.find(
      (candidate) =>
        candidate.homeClubId === state.userClubId ||
        candidate.awayClubId === state.userClubId,
    );
    if (fixture !== undefined) return { fixture, roundLabel: round.label };
  }
  throw new Error('opening Hero Cup has no user fixture');
}

function asScheduledFixture(fixture: NationalCupFixture): LeagueFixture {
  const week = CUP_SETTLEMENT_WEEKS[fixture.round - 1];
  if (week === undefined) {
    throw new Error(`Cup fixture ${fixture.id} has no settlement week`);
  }
  return {
    id: fixture.id,
    season: fixture.season,
    round: fixture.round,
    week,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    matchSeed: fixture.matchSeed,
    status: 'scheduled',
  };
}

function powerSignDisagrees(attrGap: number, powerGap: number): boolean {
  return (
    attrGap !== 0 &&
    powerGap !== 0 &&
    Math.sign(attrGap) !== Math.sign(powerGap)
  );
}

function playProductionCup(input: {
  readonly state: GameState;
  readonly difficulty: DifficultyMode;
  readonly fixture: NationalCupFixture;
  readonly userTeam: TeamDef;
  readonly opponentTeam: TeamDef;
  readonly roundLabel: NationalCupRoundLabel;
  readonly realRoundLabel: NationalCupRoundLabel;
  readonly kind: 'natural' | 'paired';
  readonly arm: CupCatchUpArm;
  readonly gapTarget?: (typeof CUP_CATCHUP_GAPS)[number];
  readonly scale?: CupCatchUpScale;
  readonly trialUser: TeamDef;
  readonly trialOpponent: TeamDef;
  readonly catchupApplied: boolean;
}): CupCatchUpRow {
  const { state, fixture } = input;
  const opponentClubId =
    fixture.homeClubId === state.userClubId
      ? fixture.awayClubId
      : fixture.homeClubId;
  const scheduled = asScheduledFixture(fixture);
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  const formation: FormationId = lineup?.formation ?? '4-4-2';
  const quick = quickMatchForFixture(
    scheduled,
    {
      [input.userTeam.id]: input.userTeam,
      [input.opponentTeam.id]: input.opponentTeam,
    },
    {
      userClubId: state.userClubId,
      initialFormation: formation,
      autoSubs: true,
    },
  );
  if (quick.production === undefined) {
    throw new Error(`Cup fixture ${fixture.id} did not return production`);
  }
  const homeGoals = quick.result.homeGoals;
  const awayGoals = quick.result.awayGoals;
  const trialGap = measureCupGap(input.trialUser, input.trialOpponent);
  const playedGap = measureCupGap(input.userTeam, input.opponentTeam);
  const userPowers = diagnoseCupPowers(
    input.userTeam,
    diagnosticRoster(state, state.userClubId),
  );
  const opponentPowers = diagnoseCupPowers(
    input.opponentTeam,
    diagnosticRoster(state, opponentClubId),
  );
  const lateRound =
    input.roundLabel === 'Semi-final' || input.roundLabel === 'Final';
  let penalty:
    | {
        penaltySource: 'PRODUCTION_SHOOTOUT';
        penaltyWinnerClubId: string;
        penaltyHomeGoals: number;
        penaltyAwayGoals: number;
      }
    | undefined;
  if (homeGoals === awayGoals) {
    if (quick.production.penaltyFullTime === undefined) {
      throw new Error(
        `production Cup draw ${fixture.id} has no full-time shootout squads`,
      );
    }
    const shootout = resolvePenaltyShootout(
      penaltyShootoutSeed(state.careerSeed, fixture),
      quick.production.penaltyFullTime,
    );
    penalty = {
      penaltySource: 'PRODUCTION_SHOOTOUT',
      penaltyWinnerClubId:
        shootout.winner === 'home' ? fixture.homeClubId : fixture.awayClubId,
      penaltyHomeGoals: shootout.homeGoals,
      penaltyAwayGoals: shootout.awayGoals,
    };
  }
  return {
    difficulty: input.difficulty,
    seed: state.careerSeed,
    kind: input.kind,
    roundLabel: input.roundLabel,
    realRoundLabel: input.realRoundLabel,
    ...(input.gapTarget === undefined ? {} : { gapTarget: input.gapTarget }),
    arm: input.arm,
    ...(input.scale === undefined ? {} : { scale: input.scale }),
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    userClubId: state.userClubId,
    opponentClubId,
    matchSeed: fixture.matchSeed,
    userAttrRating: trialGap.userAttrRating,
    opponentAttrRating: trialGap.opponentAttrRating,
    attrGap: trialGap.attrGap,
    playedUserAttrRating: playedGap.userAttrRating,
    playedOpponentAttrRating: playedGap.opponentAttrRating,
    catchupWouldTrigger: lateRound && trialGap.attrGap >= 10,
    catchupApplied: input.catchupApplied,
    userXiPowers: userPowers.xiPowers,
    opponentXiPowers: opponentPowers.xiPowers,
    userUnlicensedPowers: userPowers.unlicensedPowers,
    opponentUnlicensedPowers: opponentPowers.unlicensedPowers,
    unlicensedHeroOutratesXi:
      userPowers.unlicensedHeroOutratesXi +
      opponentPowers.unlicensedHeroOutratesXi,
    powerSignDisagreesWithAttrGap: powerSignDisagrees(
      trialGap.attrGap,
      userPowers.xiPowers - opponentPowers.xiPowers,
    ),
    regulationHomeGoals: homeGoals,
    regulationAwayGoals: awayGoals,
    regulationOutcome: userRegulationOutcome(
      state.userClubId,
      fixture,
      homeGoals,
      awayGoals,
    ),
    ...penalty,
  };
}

export function buildCupCandidate(
  rows: readonly CupCatchUpRow[],
  unreachable: readonly CupCatchUpUnreachable[],
): CupCatchUpCandidate {
  const paired = rows.filter((row) => row.kind === 'paired').length;
  const seeds = new Set(rows.map((row) => row.seed)).size;
  return {
    status: 'UNAPPROVED_NOT_APPLIED',
    semiFinalCatchUpPercent: 25,
    finalCatchUpPercent: 50,
    proposal: 'no change',
    reason: `Keep 25 and 50. ${paired} paired rows across ${seeds} fixed seeds, plus ${unreachable.length} unreachable gaps, are not enough to change the percents.`,
  };
}

/** One opening Cup pairing per difficulty, then the manufactured gap pairs. */
export function runCupCatchUpStudy(
  seed = CUP_CATCHUP_STUDY_SEED,
  difficulties: readonly DifficultyMode[] = ['COZY', 'CHAIRMAN'],
): CupCatchUpStudy {
  const rows: CupCatchUpRow[] = [];
  const unreachable: CupCatchUpUnreachable[] = [];
  for (const difficulty of difficulties) {
    const state = createCareer(
      createLaunchCareerSetup(seed, undefined, CONTENT, difficulty),
    );
    const opening = openingUserCup(state);
    const opponentClubId =
      opening.fixture.homeClubId === state.userClubId
        ? opening.fixture.awayClubId
        : opening.fixture.homeClubId;
    const userTeam = buildCareerTeamDef(state, state.userClubId);
    const opponentTeam = buildCareerMatchTeamDef(state, opponentClubId);
    rows.push(
      playProductionCup({
        state,
        difficulty,
        fixture: opening.fixture,
        userTeam,
        opponentTeam,
        roundLabel: opening.roundLabel,
        realRoundLabel: opening.roundLabel,
        kind: 'natural',
        arm: 'natural',
        trialUser: userTeam,
        trialOpponent: opponentTeam,
        catchupApplied: false,
      }),
    );
    for (const roundLabel of CUP_CATCHUP_ROUNDS) {
      for (const gapTarget of CUP_CATCHUP_GAPS) {
        const made = manufactureExactGap(userTeam, opponentTeam, gapTarget);
        if (made === undefined) {
          unreachable.push({
            difficulty,
            seed,
            roundLabel,
            gapTarget,
            reason: 'no exact attribute percent',
          });
          continue;
        }
        const shared = {
          state,
          difficulty,
          fixture: opening.fixture,
          realRoundLabel: opening.roundLabel,
          kind: 'paired' as const,
          gapTarget,
          scale: made.scale,
          trialUser: made.user,
          trialOpponent: made.opponent,
          roundLabel,
        };
        rows.push(
          playProductionCup({
            ...shared,
            userTeam: made.user,
            opponentTeam: made.opponent,
            arm: 'none',
            catchupApplied: false,
          }),
        );
        rows.push(
          playProductionCup({
            ...shared,
            userTeam: made.user,
            opponentTeam: mirroredCupOpponent(
              made.user,
              made.opponent,
              roundLabel,
            ),
            arm: 'catchup',
            catchupApplied: true,
          }),
        );
      }
    }
  }
  return {
    kind: 'cup-catchup-measurement',
    status: 'MEASUREMENT_ONLY',
    seed,
    difficulties,
    gaps: CUP_CATCHUP_GAPS,
    rounds: CUP_CATCHUP_ROUNDS,
    catchupPercent: { 'Semi-final': 25, Final: 50 },
    penaltyCalibrationPath:
      'artifacts/balance-design-2026-10-19/penalty-calibration.json',
    rows,
    unreachable,
    candidate: buildCupCandidate(rows, unreachable),
  };
}
