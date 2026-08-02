/**
 * OPT-IN BALANCE PROBE:
 *   FAME_CURVE_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/fame-curve-probe.test.ts
 *
 * What fame actually looks like over a ten-season career, and whether it still
 * tells one player from another by the end of it.
 *
 * Fame is read by four things — the star weighting in `player-requests.ts`, the
 * club-legend gate in `pyramid.ts`, the renewal ask in `market.ts`, and the
 * endgame's choice of star — and every one of them is a threshold. A threshold
 * is only worth anything while the population still straddles it, so the
 * question this answers is not "how much fame" but "how spread out".
 *
 * The columns, per completed season:
 *   top/med/low  fame of the best starter, the median starter, the worst reserve
 *   cap          user-club players sitting exactly on the ceiling
 *   star         user-club players over the star fame threshold
 *   legend       user-club players over BOTH club-legend gates, fame and tenure
 *   clubFame     the summed club total the coach market gates on
 *
 * Scores come from `deterministicFixtureScore`, the same fixture-seeded roll
 * `runHeadlessFullCareer` uses, so the run is fast and needs no sim. The user's
 * own goals are attributed to real lineup players, because two of a striker's
 * fame points per goal is a channel a scoreless harness would silently drop —
 * roughly a fifth of a front man's season. Every other fixture is left
 * unattributed; nobody outside the user club earns fame.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  advanceWeek,
  CLUB_LEGEND_MIN_FAME,
  CLUB_LEGEND_MIN_SEASONS,
  completeMatchday,
  createCareer,
  FAME_CEILING,
  isClubLegend,
  startNextSeason,
  STAR_FAME_THRESHOLD,
  type CareerPlayer,
  type FixtureResult,
  type GameState,
  type LeagueFixture,
} from '../../game';
import { renewCareerPlayer } from '../../game/squad';
import { mulberry32 } from '../../sim/rng';

const describeProbe = process.env.FAME_CURVE_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

const SEEDS = [4_000_000, 20_260_725, 8801];
const SEASONS = 10;

interface SeasonRow {
  readonly season: number;
  readonly division: number;
  readonly topStarter: number;
  readonly medianStarter: number;
  readonly bottomReserve: number;
  readonly atCeiling: number;
  readonly stars: number;
  readonly legends: number;
  readonly clubFame: number;
}

function newCareer(seed: number): GameState {
  return createCareer(createLaunchCareerSetup(seed, undefined, content, 'COZY'));
}

function deterministicGoalRoll(roll: number): number {
  if (roll < 0.34) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.88) return 2;
  if (roll < 0.97) return 3;
  return 4;
}

/**
 * The headless fixture roll, with named scorers on the user's own match.
 *
 * `validateResults` demands one scorer per goal on both sides once any are
 * given, so the opponent's are named too even though only the user club's
 * scorers earn fame. Attribution walks the club's players front to back, which
 * puts most goals on forwards and midfielders without pretending to model
 * anything.
 */
function scoredFixture(state: GameState, fixture: LeagueFixture): FixtureResult {
  const random = mulberry32(fixture.matchSeed);
  const homeGoals = deterministicGoalRoll(random()) + (random() < 0.12 ? 1 : 0);
  const awayGoals = deterministicGoalRoll(random());
  const involvesUser = fixture.homeClubId === state.userClubId
    || fixture.awayClubId === state.userClubId;
  if (!involvesUser) return { fixtureId: fixture.id, homeGoals, awayGoals };

  const scorerPlayerIds = [
    ...pickScorers(state, fixture.homeClubId, homeGoals, random),
    ...pickScorers(state, fixture.awayClubId, awayGoals, random),
  ];
  if (scorerPlayerIds.length !== homeGoals + awayGoals) {
    return { fixtureId: fixture.id, homeGoals, awayGoals };
  }
  return { fixtureId: fixture.id, homeGoals, awayGoals, scorerPlayerIds };
}

const SCORER_ROLE_ORDER = ['FWD', 'MID', 'DEF'] as const;

function pickScorers(
  state: GameState,
  clubId: string,
  goals: number,
  random: () => number,
): string[] {
  if (goals === 0) return [];
  const lineup = state.lineups.find(candidate => candidate.clubId === clubId);
  const eligible = (lineup === undefined
    ? state.players.filter(player => player.clubId === clubId)
    : lineup.playerIds.map(id => state.players.find(player => player.id === id)!))
    .filter(player => player !== undefined && player.role !== 'GK')
    .sort((left, right) => (
      SCORER_ROLE_ORDER.indexOf(left.role as never) - SCORER_ROLE_ORDER.indexOf(right.role as never)
      || left.id.localeCompare(right.id)
    ));
  if (eligible.length === 0) return [];
  return Array.from({ length: goals }, () => (
    eligible[Math.floor(random() * Math.min(6, eligible.length))].id
  ));
}

function userSquad(state: GameState): CareerPlayer[] {
  return state.players.filter(player => player.clubId === state.userClubId);
}

function fame(player: CareerPlayer): number {
  return player.fame ?? 0;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function snapshot(state: GameState): SeasonRow {
  const squad = userSquad(state);
  const starterIds = new Set(
    state.lineups.find(lineup => lineup.clubId === state.userClubId)?.playerIds ?? [],
  );
  const starters = squad.filter(player => starterIds.has(player.id)).map(fame);
  const reserves = squad.filter(player => !starterIds.has(player.id)).map(fame);
  const division = state.m2?.pyramid.divisions.find(candidate => (
    candidate.clubs.some(club => club.id === state.userClubId)
  ))?.level ?? 5;

  return {
    season: state.season,
    division,
    topStarter: starters.length === 0 ? 0 : Math.max(...starters),
    medianStarter: median(starters),
    bottomReserve: reserves.length === 0 ? 0 : Math.min(...reserves),
    atCeiling: squad.filter(player => fame(player) >= FAME_CEILING).length,
    stars: squad.filter(player => fame(player) >= STAR_FAME_THRESHOLD).length,
    legends: squad.filter(player => isClubLegend({
      seasonsAtClub: player.seasonsAtClub ?? 0,
      fame: fame(player),
    })).length,
    clubFame: squad.reduce((sum, player) => sum + fame(player), 0),
  };
}

function runSeasons(seed: number): SeasonRow[] {
  let state = newCareer(seed);
  const rows: SeasonRow[] = [];
  let guard = 0;

  while (rows.length < SEASONS) {
    guard += 1;
    if (guard > SEASONS * 200) throw new Error('fame curve probe exceeded its transition budget');

    if (state.phase === 'manage') {
      state = advanceWeek(state);
    } else if (state.phase === 'matchday') {
      const matchday = activeCareerMatchday(state);
      if (matchday === undefined) throw new Error('matchday phase without an active fixture');
      const scored = state;
      state = completeMatchday(
        state,
        matchday.fixtures.map(fixture => scoredFixture(scored, fixture)),
      );
    } else if (state.phase === 'season-end') {
      rows.push(snapshot(state));
      if (rows.length === SEASONS) break;
      for (const player of userSquad(state).filter(candidate => (
        candidate.contractSeasonsRemaining === 0
      ))) {
        state = renewCareerPlayer(state, player.id, 4, 1);
      }
      state = startNextSeason(state);
    } else {
      throw new Error(`fame curve probe reached the ${state.phase} phase`);
    }
  }

  return rows;
}

describeProbe('fame curve over a ten-season career', () => {
  it('reports the spread, the ceiling crowd, and the threshold crossings', () => {
    const lines = [
      '',
      `ceiling=${FAME_CEILING} star>=${STAR_FAME_THRESHOLD} `
        + `legend>=${CLUB_LEGEND_MIN_FAME} fame + ${CLUB_LEGEND_MIN_SEASONS} seasons`,
      'seed       season div  top  med  low  cap star legend clubFame',
    ];

    for (const seed of SEEDS) {
      for (const row of runSeasons(seed)) {
        lines.push([
          String(seed).padStart(10),
          String(row.season).padStart(7),
          String(row.division).padStart(4),
          String(row.topStarter).padStart(5),
          String(row.medianStarter).padStart(5),
          String(row.bottomReserve).padStart(5),
          String(row.atCeiling).padStart(4),
          String(row.stars).padStart(5),
          String(row.legends).padStart(7),
          String(row.clubFame).padStart(9),
        ].join(''));
      }
      lines.push('');
    }

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(lines.length).toBeGreaterThan(3);
  }, 600_000);
});
