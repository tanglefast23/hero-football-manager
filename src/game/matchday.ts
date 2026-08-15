import * as simMatch from '../sim/match';
import type { FormationId } from '../sim/tactics';
import type {
  MatchState,
  PowerId,
  ReplayEnvelope,
  TeamDef,
} from '../sim/types';
import { contributionsFrom } from './match-contributions';
import {
  controlledMatchOptions,
  queueControlledAutoSubstitution,
} from './match-policy';
import type { FixtureResult, LeagueFixture } from './types';

const UINT32_MAX = 4294967295;

export function quickResultForFixture(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  policy?: QuickMatchPolicy,
): FixtureResult {
  return quickMatchForFixture(fixture, teamsByClubId, policy).result;
}

/** The saved manager choices that make Quick an unattended watched match. */
export interface ManagerMatchPreferences {
  readonly initialFormation: FormationId;
  readonly autoSubs: boolean;
}

interface QuickMatchPolicy extends ManagerMatchPreferences {
  readonly userClubId: string;
}

export interface ProductionFixtureResult {
  readonly fixtureResult: FixtureResult;
  readonly goals: readonly MatchGoal[];
  /** Kickoff XI in shirt order, then substitutes in first-entry order. */
  readonly participantPlayerIds: readonly string[];
  /** Distinct user players in first-fire order, resolved at event time. */
  readonly powerFiredPlayerIds: readonly string[];
}

interface QuickFixtureMatch {
  result: FixtureResult;
  replay: ReplayEnvelope;
  /** Present for the production user path; rival/background resolution omits it. */
  production?: ProductionFixtureResult;
  /**
   * Final match state, kept so callers read participants (auto-substitutes
   * included) exactly the way a watched match does. Discarding it forced the
   * awakening roll to fall back to the starting XI, so a bench player could
   * awaken after a watched match but not after Quick Result of the same
   * fixture.
   */
  match: MatchState;
}

/**
 * The one place a fixture becomes a match. Both the all-at-once path and the
 * resumable one below go through here so validation and the auto-fire policies
 * cannot drift apart. `teamsForFixture` checks the teams map and each TeamDef
 * but not the fixture, so the `validateScheduledFixture` call is load-bearing
 * rather than belt-and-braces.
 */
function createFixtureMatch(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  policy?: QuickMatchPolicy,
): MatchState {
  validateScheduledFixture(fixture);
  const [home, away] = teamsForFixture(fixture, teamsByClubId);
  if (policy === undefined) {
    // Background/rival fixtures retain their existing fully automatic envelope.
    return simMatch.createMatch(fixture.matchSeed, home, away, {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
  }
  const controlledTeam = userTeamForFixture(fixture, policy.userClubId);
  return simMatch.createMatch(
    fixture.matchSeed,
    home,
    away,
    controlledMatchOptions(controlledTeam, policy.initialFormation),
  );
}

/** Runs Quick Result through the production engine and retains its replay. */
export function quickMatchForFixture(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  policy?: QuickMatchPolicy,
): QuickFixtureMatch {
  const match = createFixtureMatch(fixture, teamsByClubId, policy);
  while (match.phase !== 'fulltime') {
    simMatch.tick(match);
    if (policy !== undefined)
      queueControlledAutoSubstitution(match, policy.autoSubs);
  }
  const production =
    policy === undefined
      ? undefined
      : productionResultFromMatch(fixture, match, policy.userClubId);
  return {
    result: production?.fixtureResult ?? fixtureResultFromMatch(fixture, match),
    replay: simMatch.envelopeFrom(match),
    match,
    ...(production === undefined ? {} : { production }),
  };
}

/** A goal credited to whoever was actually wearing the shirt at the time. */
interface MatchGoal {
  readonly playerId: string;
  readonly name: string;
  /** Tick the goal went in, for a match-clock label. */
  readonly tick: number;
  /** The scorer's power when it launched this shot. */
  readonly power?: PowerId;
}

/**
 * A fixture whose simulation can be advanced a bounded number of ticks and then
 * put down.
 *
 * `quickMatchForFixture` runs ~2,000 ticks in one burst — ~500ms on device,
 * long enough to freeze the frame it lands on, and a league settle does that
 * four times over for the division's other fixtures. This lets a caller spread
 * the identical work across idle slices instead.
 *
 * Chunking cannot change the outcome: the seed is fixed at schedule time and
 * `tick` mutates only the state it is given. `fixture-resolver.test.ts` pins
 * that against slice sizes of 1 and 100,000.
 *
 * Pure by the rules of this ring — no timers, no clock. The caller decides when
 * to advance and by how much.
 */
export interface FixtureResolver {
  readonly fixtureId: string;
  readonly done: boolean;
  advance(maxTicks: number): void;
  result(): FixtureResult;
}

export function createFixtureResolver(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): FixtureResolver {
  const match = createFixtureMatch(fixture, teamsByClubId);

  return {
    fixtureId: fixture.id,
    get done(): boolean {
      return match.phase === 'fulltime';
    },
    advance(maxTicks: number): void {
      for (
        let step = 0;
        step < maxTicks && match.phase !== 'fulltime';
        step += 1
      ) {
        simMatch.tick(match);
      }
    },
    result(): FixtureResult {
      if (match.phase !== 'fulltime') {
        throw new Error(`fixture ${fixture.id} has not finished`);
      }
      return fixtureResultFromMatch(fixture, match);
    },
  };
}

/**
 * Who scored each goal. GOAL events carry the scorer's stable id, stamped at
 * shot launch, because a substitution can change a slot's occupant while the
 * shot is still in flight.
 */
export function goalsFrom(match: MatchState): MatchGoal[] {
  const names = new Map<string, string>();
  for (const team of match.teams) {
    for (const def of [...team.players, ...(team.bench ?? [])])
      names.set(def.id, def.name);
  }
  for (const player of match.players) names.set(player.def.id, player.def.name);

  const slotOwners = match.teams.flatMap((team) =>
    team.players.map((player) => player.id),
  );
  const readyPower = new Map<string, PowerId>();
  const shotPower = new Map<string, PowerId>();
  const goals: MatchGoal[] = [];
  for (const event of match.events) {
    if (event.kind === 'SUBSTITUTION') {
      slotOwners[event.player] = event.inPlayerId;
    } else if (event.kind === 'POWER_FIRED') {
      const owner = slotOwners[event.player];
      if (owner !== undefined) readyPower.set(owner, event.power);
    } else if (event.kind === 'SHOT') {
      const owner = slotOwners[event.by];
      const power = owner === undefined ? undefined : readyPower.get(owner);
      if (owner !== undefined) {
        if (power === undefined) shotPower.delete(owner);
        else shotPower.set(owner, power);
        readyPower.delete(owner);
      }
    } else if (event.kind === 'GOAL') {
      const power = shotPower.get(event.scoredById);
      goals.push({
        playerId: event.scoredById,
        name: names.get(event.scoredById) ?? event.scoredById,
        tick: event.t,
        ...(power === undefined ? {} : { power }),
      });
      readyPower.clear();
      shotPower.clear();
    } else if (event.kind === 'MISS' || event.kind === 'SAVE') {
      readyPower.clear();
      shotPower.clear();
    }
  }
  return goals;
}

function fixtureResultFromMatch(
  fixture: LeagueFixture,
  match: MatchState,
): FixtureResult {
  const scorerPlayerIds = goalsFrom(match).map((goal) => goal.playerId);
  const contributions = contributionsFrom(match);
  const [homeParticipantPlayerIds, awayParticipantPlayerIds] =
    participantPlayerIdsFromMatch(match);
  return {
    fixtureId: fixture.id,
    homeGoals: match.score[0],
    awayGoals: match.score[1],
    homeParticipantPlayerIds,
    awayParticipantPlayerIds,
    ...(scorerPlayerIds.length === match.score[0] + match.score[1]
      ? { scorerPlayerIds }
      : {}),
    ...(contributions.length > 0 ? { contributions } : {}),
  };
}

function participantPlayerIdsFromMatch(
  match: MatchState,
): readonly [string[], string[]] {
  const participants = match.teams.map((team) =>
    team.players.map((player) => player.id),
  ) as [string[], string[]];
  const seen = participants.map((ids) => new Set(ids));
  for (const event of match.events) {
    if (event.kind !== 'SUBSTITUTION') continue;
    if (!seen[event.team].has(event.inPlayerId)) {
      seen[event.team].add(event.inPlayerId);
      participants[event.team].push(event.inPlayerId);
    }
  }
  return participants;
}

/**
 * The single production adapter for Quick and watched user matches.
 *
 * It keeps the ordinary league result and the durable audience/appearance facts
 * on one event-time ownership walk. Persistence is intentionally left to the
 * caller; this function is pure and contains no Club Business state.
 */
export function productionResultFromMatch(
  fixture: LeagueFixture,
  match: MatchState,
  userClubId: string,
): ProductionFixtureResult {
  validateProductionMatchContext(fixture, match, userClubId);
  const goals = goalsFrom(match);
  const fixtureResult = fixtureResultFromMatch(fixture, match);
  const userTeam = userTeamForFixture(fixture, userClubId);
  const slotOwners = match.teams.flatMap((team) =>
    team.players.map((player) => player.id),
  );
  const rosterByTeam = match.teams.map(
    (team) =>
      new Set([
        ...team.players.map((player) => player.id),
        ...(team.bench ?? []).map((player) => player.id),
      ]),
  );
  const playerDefs = new Map(
    match.teams
      .flatMap((team) => [...team.players, ...(team.bench ?? [])])
      .map((player) => [player.id, player] as const),
  );
  const participants = [
    ...(userTeam === 0
      ? fixtureResult.homeParticipantPlayerIds!
      : fixtureResult.awayParticipantPlayerIds!),
  ];
  const participantSet = new Set(participants);
  const powerFiredPlayerIds: string[] = [];
  const powerFiredSet = new Set<string>();

  for (const event of match.events) {
    if (event.kind === 'POWER_FIRED') {
      const owner = slotOwners[event.player];
      if (owner === undefined) {
        throw new Error(
          `fixture ${fixture.id} power event references invalid player slot ${event.player}`,
        );
      }
      if (playerDefs.get(owner)?.power !== event.power) {
        throw new Error(
          `fixture ${fixture.id} power event does not match player ${owner}`,
        );
      }
      const eventTeam: 0 | 1 = event.player < 11 ? 0 : 1;
      if (eventTeam === userTeam && !powerFiredSet.has(owner)) {
        powerFiredSet.add(owner);
        powerFiredPlayerIds.push(owner);
      }
      continue;
    }
    if (event.kind !== 'SUBSTITUTION') continue;
    const slotTeam: 0 | 1 = event.player < 11 ? 0 : 1;
    if (event.player < 0 || event.player > 21 || slotTeam !== event.team) {
      throw new Error(
        `fixture ${fixture.id} substitution references invalid team slot ${event.player}`,
      );
    }
    if (slotOwners[event.player] !== event.outPlayerId) {
      throw new Error(
        `fixture ${fixture.id} substitution ownership is inconsistent at slot ${event.player}`,
      );
    }
    if (!rosterByTeam[event.team].has(event.inPlayerId)) {
      throw new Error(
        `fixture ${fixture.id} substitution uses a player outside team ${event.team}`,
      );
    }
    if (event.team === userTeam && !participantSet.has(event.inPlayerId)) {
      participantSet.add(event.inPlayerId);
      participants.push(event.inPlayerId);
    }
    slotOwners[event.player] = event.inPlayerId;
  }

  const userRosterIds = rosterByTeam[userTeam];
  if (participants.some((playerId) => !userRosterIds.has(playerId))) {
    throw new Error(
      `fixture ${fixture.id} participants contain a player outside the user roster`,
    );
  }
  if (powerFiredPlayerIds.some((playerId) => !participantSet.has(playerId))) {
    throw new Error(
      `fixture ${fixture.id} power owners must be match participants`,
    );
  }

  const matchRosterIds = new Set(
    match.teams.flatMap((team) => [
      ...team.players.map((player) => player.id),
      ...(team.bench ?? []).map((player) => player.id),
    ]),
  );
  const attributedIds = [
    ...(fixtureResult.scorerPlayerIds ?? []),
    ...(fixtureResult.contributions ?? []).map(
      (contribution) => contribution.playerId,
    ),
  ];
  if (attributedIds.some((playerId) => !matchRosterIds.has(playerId))) {
    throw new Error(
      `fixture ${fixture.id} result attributes a player outside the match roster`,
    );
  }

  return {
    fixtureResult,
    goals,
    participantPlayerIds: participants,
    powerFiredPlayerIds,
  };
}

export function resolveMatchday(
  fixtures: ReadonlyArray<LeagueFixture>,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  suppliedResults: ReadonlyArray<FixtureResult> = [],
): FixtureResult[] {
  const fixtureIds = new Set<string>();

  for (const fixture of fixtures) {
    validateScheduledFixture(fixture);
    if (fixtureIds.has(fixture.id)) {
      throw new Error(`matchday contains duplicate fixture ID ${fixture.id}`);
    }
    fixtureIds.add(fixture.id);
    teamsForFixture(fixture, teamsByClubId);
  }

  const suppliedByFixtureId = new Map<string, FixtureResult>();
  for (const result of suppliedResults) {
    validateSuppliedResult(result);
    if (!fixtureIds.has(result.fixtureId)) {
      throw new Error(
        `supplied result references unknown fixture ${result.fixtureId}`,
      );
    }
    if (suppliedByFixtureId.has(result.fixtureId)) {
      throw new Error(
        `duplicate supplied result for fixture ${result.fixtureId}`,
      );
    }
    suppliedByFixtureId.set(result.fixtureId, result);
  }

  return fixtures.map((fixture) => {
    const supplied = suppliedByFixtureId.get(fixture.id);
    return supplied === undefined
      ? quickResultForFixture(fixture, teamsByClubId)
      : { ...supplied };
  });
}

function validateProductionMatchContext(
  fixture: LeagueFixture,
  match: MatchState,
  userClubId: string,
): void {
  validateScheduledFixture(fixture);
  if (match.phase !== 'fulltime')
    throw new Error(`fixture ${fixture.id} has not finished`);
  if (match.seed !== fixture.matchSeed)
    throw new Error(`fixture ${fixture.id} match seed does not match`);
  if (
    match.teams[0]?.id !== fixture.homeClubId ||
    match.teams[1]?.id !== fixture.awayClubId
  ) {
    throw new Error(`fixture ${fixture.id} match teams do not match`);
  }
  userTeamForFixture(fixture, userClubId);
}

function userTeamForFixture(fixture: LeagueFixture, userClubId: string): 0 | 1 {
  if (fixture.homeClubId === userClubId) return 0;
  if (fixture.awayClubId === userClubId) return 1;
  throw new Error(
    `fixture ${fixture.id} does not contain user club ${userClubId}`,
  );
}

function validateScheduledFixture(fixture: LeagueFixture): void {
  if (!fixture || typeof fixture !== 'object') {
    throw new Error('fixture must be an object');
  }
  if (typeof fixture.id !== 'string' || fixture.id.trim().length === 0) {
    throw new Error('fixture ID must be a non-empty string');
  }
  if (fixture.status !== 'scheduled' || fixture.score !== undefined) {
    throw new Error(`fixture ${fixture.id} must be scheduled and unplayed`);
  }
  if (
    typeof fixture.homeClubId !== 'string' ||
    fixture.homeClubId.trim().length === 0 ||
    typeof fixture.awayClubId !== 'string' ||
    fixture.awayClubId.trim().length === 0 ||
    fixture.homeClubId === fixture.awayClubId
  ) {
    throw new Error(`fixture ${fixture.id} must name two different clubs`);
  }
  if (
    !Number.isInteger(fixture.matchSeed) ||
    fixture.matchSeed < 0 ||
    fixture.matchSeed > UINT32_MAX
  ) {
    throw new Error(`fixture ${fixture.id} match seed must be a uint32`);
  }
}

function teamsForFixture(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): [TeamDef, TeamDef] {
  if (!teamsByClubId || typeof teamsByClubId !== 'object') {
    throw new Error('teamsByClubId must be an object');
  }

  const home = teamsByClubId[fixture.homeClubId];
  const away = teamsByClubId[fixture.awayClubId];
  validateTeam(home, fixture.homeClubId);
  validateTeam(away, fixture.awayClubId);
  return [home, away];
}

function validateTeam(
  team: TeamDef | undefined,
  clubId: string,
): asserts team is TeamDef {
  if (!team) {
    throw new Error(`missing sim team for club ${clubId}`);
  }
  simMatch.validateTeamDef(team, `sim team for club ${clubId}`);
}

function validateSuppliedResult(result: FixtureResult): void {
  if (!result || typeof result !== 'object') {
    throw new Error('supplied result must be an object');
  }
  if (
    typeof result.fixtureId !== 'string' ||
    result.fixtureId.trim().length === 0
  ) {
    throw new Error('supplied result fixture ID must be a non-empty string');
  }
  if (
    !isValidGoalCount(result.homeGoals) ||
    !isValidGoalCount(result.awayGoals)
  ) {
    throw new Error(
      `supplied result for fixture ${result.fixtureId} must have non-negative integer goals`,
    );
  }
  if (result.scorerPlayerIds !== undefined) {
    if (result.scorerPlayerIds.length !== result.homeGoals + result.awayGoals) {
      throw new Error(
        `supplied result for fixture ${result.fixtureId} scorer count must match the score`,
      );
    }
    if (
      result.scorerPlayerIds.some(
        (playerId) => typeof playerId !== 'string' || playerId.length === 0,
      )
    ) {
      throw new Error(
        `supplied result for fixture ${result.fixtureId} has an invalid scorer ID`,
      );
    }
  }
  for (const [side, playerIds] of [
    ['home', result.homeParticipantPlayerIds],
    ['away', result.awayParticipantPlayerIds],
  ] as const) {
    if (playerIds === undefined) continue;
    if (
      playerIds.length < 11 ||
      new Set(playerIds).size !== playerIds.length ||
      playerIds.some(
        (playerId) => typeof playerId !== 'string' || playerId.length === 0,
      )
    ) {
      throw new Error(
        `supplied result for fixture ${result.fixtureId} has invalid ${side} participants`,
      );
    }
  }
}

function isValidGoalCount(goals: number): boolean {
  return Number.isSafeInteger(goals) && goals >= 0;
}
