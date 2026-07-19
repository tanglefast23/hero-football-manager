import * as simMatch from '../sim/match';
import type { ReplayEnvelope, TeamDef } from '../sim/types';
import type { FixtureResult, LeagueFixture } from './types';

const UINT32_MAX = 4294967295;

export function quickResultForFixture(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): FixtureResult {
  validateScheduledFixture(fixture);
  const [home, away] = teamsForFixture(fixture, teamsByClubId);
  const result = simMatch.runMatch(fixture.matchSeed, home, away, [], {
    homePolicy: 'FIRE_WHEN_READY',
    awayPolicy: 'FIRE_WHEN_READY',
  });
  const scorerPlayerIds = scorerIdsFromEvents(result.events, home, away);
  return {
    fixtureId: fixture.id,
    homeGoals: result.score[0],
    awayGoals: result.score[1],
    ...(scorerPlayerIds.length === result.score[0] + result.score[1]
      ? { scorerPlayerIds }
      : {}),
  };
}

export interface QuickFixtureMatch {
  result: FixtureResult;
  replay: ReplayEnvelope;
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
  const scorerPlayerIds = match.events
    .filter(event => event.kind === 'GOAL')
    .map(event => match.players[event.by]?.def.id)
    .filter((playerId): playerId is string => playerId !== undefined);

  return {
    result: {
      fixtureId: fixture.id,
      homeGoals: match.score[0],
      awayGoals: match.score[1],
      ...(scorerPlayerIds.length === match.score[0] + match.score[1]
        ? { scorerPlayerIds }
        : {}),
    },
    replay: simMatch.envelopeFrom(match),
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

function scorerIdsFromEvents(
  events: ReturnType<typeof simMatch.runMatch>['events'],
  home: TeamDef,
  away: TeamDef,
): string[] {
  return events
    .filter(event => event.kind === 'GOAL')
    .map(event => event.by < 11
      ? home.players[event.by]?.id
      : away.players[event.by - 11]?.id)
    .filter((playerId): playerId is string => playerId !== undefined);
}

function isValidGoalCount(goals: number): boolean {
  return Number.isSafeInteger(goals) && goals >= 0;
}
