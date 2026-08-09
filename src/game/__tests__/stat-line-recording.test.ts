import { createLaunchCareerSetup } from '../../application/launch';
import { createMatch, tick } from '../../sim/match';
import type { MatchState } from '../../sim/types';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
} from '../career';
import { contributionsFrom } from '../match-contributions';
import { resolveMatchday } from '../matchday';
import { buildCareerMatchTeams } from '../squad';
import type {
  FixtureResult,
  GameState,
  LeagueFixture,
  PlayerSeasonStatLine,
} from '../types';

describe('season stat line recording', () => {
  it('records every count of a played league week against the scorer own club', () => {
    const state = careerAtMatchday(2468);
    const { fixtures, teams } = matchdayTeams(state);

    const settled = completeMatchday(state, resolveMatchday(fixtures, teams));

    const lines = settled.seasonStatLines ?? [];
    const clubByPlayerId = new Map(
      settled.players.map((player) => [player.id, player.clubId]),
    );
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((line) => line.competition === 'league')).toBe(true);
    expect(lines.every((line) => line.season === settled.season)).toBe(true);
    expect(
      lines.every((line) => line.clubId === clubByPlayerId.get(line.playerId)),
    ).toBe(true);
    // Goals alone would pass with the old scorer-only ledger still in place.
    expect(total(lines, 'goals')).toBeGreaterThan(0);
    expect(total(lines, 'assists')).toBeGreaterThan(0);
    expect(total(lines, 'tacklesWon')).toBeGreaterThan(0);
    expect(total(lines, 'saves')).toBeGreaterThan(0);
    expect(total(lines, 'passesCompleted')).toBeGreaterThan(0);
  });

  it('produces identical rows from an identical career and week', () => {
    const first = playOneWeek(careerAtMatchday(1357));
    const second = playOneWeek(careerAtMatchday(1357));

    expect(first.seasonStatLines).toEqual(second.seasonStatLines);
  });

  /**
   * The watched match is handed to `resolveMatchday` as a supplied result, and a
   * supplied result passes through verbatim — nothing downstream recomputes it.
   * Omit the contributions there and the leaderboard fills with the simulated
   * rivals while the player's own squad is the one team missing from it.
   */
  it('records the user squad from a supplied watched result', () => {
    const state = careerAtMatchday(9753);
    const { fixtures, teams } = matchdayTeams(state);
    const userFixture = fixtures.find(
      (fixture) =>
        fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId,
    )!;
    const watched = watchedResult(userFixture, teams);

    const settled = completeMatchday(
      state,
      resolveMatchday(fixtures, teams, [watched]),
    );

    const ownPlayerIds = new Set(
      settled.players
        .filter((player) => player.clubId === settled.userClubId)
        .map((player) => player.id),
    );
    const ownLines = (settled.seasonStatLines ?? []).filter(
      (line) => line.clubId === settled.userClubId,
    );
    expect(ownLines.length).toBeGreaterThan(0);
    expect(total(ownLines, 'saves')).toBeGreaterThan(0);
    expect(total(ownLines, 'tacklesWon')).toBeGreaterThan(0);
    expect(ownLines.map((line) => line.playerId).sort()).toEqual(
      watched
        .contributions!.map((row) => row.playerId)
        .filter((playerId) => ownPlayerIds.has(playerId))
        .sort(),
    );
  });
});

function careerAtMatchday(seed: number): GameState {
  let state = createCareer(createLaunchCareerSetup(seed));
  while (state.phase !== 'matchday') state = advanceWeek(state);
  return state;
}

function matchdayTeams(state: GameState): {
  fixtures: LeagueFixture[];
  teams: Readonly<
    Record<string, ReturnType<typeof buildCareerMatchTeams>[string]>
  >;
} {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('the career is not on a matchday');
  const clubIds = [
    ...new Set(
      matchday.fixtures.flatMap((fixture) => [
        fixture.homeClubId,
        fixture.awayClubId,
      ]),
    ),
  ];
  return {
    fixtures: matchday.fixtures,
    teams: buildCareerMatchTeams(state, clubIds),
  };
}

function playOneWeek(state: GameState): GameState {
  const { fixtures, teams } = matchdayTeams(state);
  return completeMatchday(state, resolveMatchday(fixtures, teams));
}

/** Exactly what `finishWatchedMatch` hands to `resolveMatchday`. */
function watchedResult(
  fixture: LeagueFixture,
  teams: Readonly<
    Record<string, ReturnType<typeof buildCareerMatchTeams>[string]>
  >,
): FixtureResult {
  const match: MatchState = createMatch(
    fixture.matchSeed,
    teams[fixture.homeClubId],
    teams[fixture.awayClubId],
    { homePolicy: 'FIRE_WHEN_READY', awayPolicy: 'FIRE_WHEN_READY' },
  );
  while (match.phase !== 'fulltime') tick(match);
  return {
    fixtureId: fixture.id,
    homeGoals: match.score[0],
    awayGoals: match.score[1],
    contributions: contributionsFrom(match),
  };
}

function total(
  lines: readonly PlayerSeasonStatLine[],
  key: 'goals' | 'assists' | 'tacklesWon' | 'saves' | 'passesCompleted',
): number {
  return lines.reduce((sum, line) => sum + line[key], 0);
}
