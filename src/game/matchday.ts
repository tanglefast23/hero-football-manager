import * as simMatch from '../sim/match';
import type { MatchState, ReplayEnvelope, TeamDef } from '../sim/types';
import type { FixtureResult, LeagueFixture } from './types';

const UINT32_MAX = 4294967295;

export function quickResultForFixture(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): FixtureResult {
  return quickMatchForFixture(fixture, teamsByClubId).result;
}

export interface QuickFixtureMatch {
  result: FixtureResult;
  replay: ReplayEnvelope;
  /**
   * Final match state, kept so callers read participants (auto-substitutes
   * included) exactly the way a watched match does. Discarding it forced the
   * awakening roll to fall back to the starting XI, so a bench player could
   * awaken after a watched match but not after Quick Result of the same
   * fixture.
   */
  match: MatchState;
}

/** Runs Quick Result through the production engine and retains its replay. */
export function quickMatchForFixture(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): QuickFixtureMatch {
  validateScheduledFixture(fixture);
  const [home, away] = teamsForFixture(fixture, teamsByClubId);
  const match = simMatch.createMatch(fixture.matchSeed, home, away, {
    homePolicy: 'FIRE_WHEN_READY',
    awayPolicy: 'FIRE_WHEN_READY',
  });
  while (match.phase !== 'fulltime') simMatch.tick(match);
  return {
    result: fixtureResultFrom(fixture, match),
    replay: simMatch.envelopeFrom(match),
    match,
  };
}

/** A goal credited to whoever was actually wearing the shirt at the time. */
export interface MatchGoal {
  readonly playerId: string;
  readonly name: string;
  /** Tick the goal went in, for a match-clock label. */
  readonly tick: number;
}

/**
 * Who scored, resolved at the moment of each goal.
 *
 * A GOAL event names a lineup SLOT, not a player, and substitutes inherit the
 * slot they come on into. Reading the slot's occupant from the starting TeamDef
 * credited a substitute's goal to the player he replaced; reading it from the
 * final state makes the mirrored mistake, handing a starter's first-half goal
 * to whoever came on for him later. Substitutions record the outgoing player,
 * so rewinding them from the final state puts every slot back to the player who
 * held it when the ball went in.
 */
export function goalsFrom(match: MatchState): MatchGoal[] {
  const names = new Map<string, string>();
  for (const team of match.teams) {
    for (const def of [...team.players, ...(team.bench ?? [])]) names.set(def.id, def.name);
  }
  const slotOwners = new Map<number, string>();
  match.players.forEach((player, slot) => {
    slotOwners.set(slot, player.def.id);
    names.set(player.def.id, player.def.name);
  });

  const goals: MatchGoal[] = [];
  for (let index = match.events.length - 1; index >= 0; index--) {
    const event = match.events[index];
    if (event.kind === 'GOAL') {
      const playerId = slotOwners.get(event.by);
      if (playerId !== undefined) {
        goals.push({ playerId, name: names.get(playerId) ?? playerId, tick: event.t });
      }
      continue;
    }
    // Rewind: before this swap the shirt belonged to the player going off.
    if (event.kind === 'SUBSTITUTION') slotOwners.set(event.player, event.outPlayerId);
  }
  return goals.reverse();
}

function fixtureResultFrom(fixture: LeagueFixture, match: MatchState): FixtureResult {
  const scorerPlayerIds = goalsFrom(match).map(goal => goal.playerId);
  return {
    fixtureId: fixture.id,
    homeGoals: match.score[0],
    awayGoals: match.score[1],
    ...(scorerPlayerIds.length === match.score[0] + match.score[1]
      ? { scorerPlayerIds }
      : {}),
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
      throw new Error(`supplied result references unknown fixture ${result.fixtureId}`);
    }
    if (suppliedByFixtureId.has(result.fixtureId)) {
      throw new Error(`duplicate supplied result for fixture ${result.fixtureId}`);
    }
    suppliedByFixtureId.set(result.fixtureId, result);
  }

  return fixtures.map(fixture => {
    const supplied = suppliedByFixtureId.get(fixture.id);
    return supplied === undefined ? quickResultForFixture(fixture, teamsByClubId) : { ...supplied };
  });
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
  if (typeof fixture.homeClubId !== 'string' || fixture.homeClubId.trim().length === 0
    || typeof fixture.awayClubId !== 'string' || fixture.awayClubId.trim().length === 0
    || fixture.homeClubId === fixture.awayClubId) {
    throw new Error(`fixture ${fixture.id} must name two different clubs`);
  }
  if (!Number.isInteger(fixture.matchSeed)
    || fixture.matchSeed < 0
    || fixture.matchSeed > UINT32_MAX) {
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

function validateTeam(team: TeamDef | undefined, clubId: string): asserts team is TeamDef {
  if (!team) {
    throw new Error(`missing sim team for club ${clubId}`);
  }
  simMatch.validateTeamDef(team, `sim team for club ${clubId}`);
}

function validateSuppliedResult(result: FixtureResult): void {
  if (!result || typeof result !== 'object') {
    throw new Error('supplied result must be an object');
  }
  if (typeof result.fixtureId !== 'string' || result.fixtureId.trim().length === 0) {
    throw new Error('supplied result fixture ID must be a non-empty string');
  }
  if (!isValidGoalCount(result.homeGoals) || !isValidGoalCount(result.awayGoals)) {
    throw new Error(`supplied result for fixture ${result.fixtureId} must have non-negative integer goals`);
  }
  if (result.scorerPlayerIds !== undefined) {
    if (result.scorerPlayerIds.length !== result.homeGoals + result.awayGoals) {
      throw new Error(`supplied result for fixture ${result.fixtureId} scorer count must match the score`);
    }
    if (result.scorerPlayerIds.some(playerId => typeof playerId !== 'string' || playerId.length === 0)) {
      throw new Error(`supplied result for fixture ${result.fixtureId} has an invalid scorer ID`);
    }
  }
}

function isValidGoalCount(goals: number): boolean {
  return Number.isSafeInteger(goals) && goals >= 0;
}
