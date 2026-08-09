import { createLaunchCareerSetup } from '../../application/launch';
import type { Role } from '../../sim/types';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  startNextSeason,
} from '../career';
import {
  AWARD_CATEGORIES,
  PODIUM_SIZE,
  divisionPodium,
} from '../division-leaders';
import { resolveMatchday } from '../matchday';
import { prunedStatLines } from '../season-recap';
import { buildCareerMatchTeams, renewCareerPlayer } from '../squad';
import type {
  AwardCategoryId,
  CareerPlayer,
  DivisionAwardPlacement,
  GameState,
  PlayerSeasonStatLine,
  SeasonRecap,
} from '../types';

const CATEGORY_IDS = Object.keys(AWARD_CATEGORIES) as AwardCategoryId[];

describe('pruning dead stat rows', () => {
  it('keeps rows for players still on a roster', () => {
    // A player transferred inside the division owns one row per club, and both
    // belong to the season the board is still ranking.
    const state = stateWith(
      [player('p_live', 'club_b')],
      [],
      [line('p_live'), line('p_live', 1, 'club_b')],
    );

    expect(prunedStatLines(state)).toEqual(state.seasonStatLines);
  });

  /**
   * Retired players leave `state.players` at the season transition. A rule
   * keyed on that array alone would delete the career record of the club's own
   * retired heroes — the players the legacy screen exists to remember.
   */
  it('keeps rows for the club own retired players', () => {
    const state = stateWith(
      [player('p_live', 'club_a')],
      [player('p_retired', 'club_a')],
      [line('p_live'), line('p_retired')],
    );

    expect(
      prunedStatLines(state)
        .map((row) => row.playerId)
        .sort(),
    ).toEqual(['p_live', 'p_retired']);
  });

  it('drops rows for players who exist nowhere', () => {
    const state = stateWith(
      [player('p_live', 'club_a')],
      [player('p_retired', 'club_a')],
      [line('p_live'), line('p_retired'), line('p_regenerated_rival')],
    );

    expect(
      prunedStatLines(state)
        .map((row) => row.playerId)
        .sort(),
    ).toEqual(['p_live', 'p_retired']);
  });

  /**
   * The unbounded-growth rule: a player who stays fifteen seasons used to carry
   * fifteen rows forever, because existing on the roster was the only test.
   */
  it('drops a still-rostered player rows from earlier seasons', () => {
    const state = stateWith(
      [player('p_live', 'club_a')],
      [],
      [line('p_live', 1), line('p_live', 2), line('p_live', 3)],
      3,
    );

    expect(prunedStatLines(state).map((row) => row.season)).toEqual([3]);
  });

  it('keeps the season that just finished', () => {
    const state = stateWith(
      [player('p_live', 'club_a')],
      [],
      [line('p_live', 4)],
      4,
    );

    expect(prunedStatLines(state)).toEqual(state.seasonStatLines);
  });

  it('keeps a retired player last season but not his earlier ones', () => {
    const state = stateWith(
      [player('p_live', 'club_a')],
      [player('p_retired', 'club_a')],
      [line('p_retired', 1), line('p_retired', 2), line('p_live', 2)],
      2,
    );

    expect(
      prunedStatLines(state)
        .map((row) => `${row.playerId}:${row.season}`)
        .sort(),
    ).toEqual(['p_live:2', 'p_retired:2']);
  });
});

/** Enough transitions that unbounded growth would be unmistakable. */
const SEASONS_PLAYED = 4;

let seasonEnd: GameState;
let nextSeason: GameState;
/** The season each transition left behind, and the rows the save kept after it. */
const completedSeasons: number[] = [];
const rowsAfterTransition: PlayerSeasonStatLine[][] = [];

// One career serves both suites: simulating a season is the expensive part, and
// the growth property needs several of them.
beforeAll(() => {
  let state = createCareer(createLaunchCareerSetup(2468));
  for (let index = 0; index < SEASONS_PLAYED; index += 1) {
    state = simulatedSeason(state);
    if (index === 0) seasonEnd = state;
    completedSeasons.push(state.season);
    state = startNextCareerSeason(state);
    if (index === 0) nextSeason = state;
    rowsAfterTransition.push(state.seasonStatLines ?? []);
  }
}, 900_000);

describe('division award snapshots', () => {
  it('records a renderable podium for every category', () => {
    const awards = recapFor(seasonEnd, seasonEnd.season).divisionAwards;
    if (awards === undefined)
      throw new Error('the recap recorded no division awards');

    expect(Object.keys(awards).sort()).toEqual(CATEGORY_IDS.slice().sort());
    expect(placings(awards).length).toBeGreaterThan(0);
    for (const category of CATEGORY_IDS) {
      expect(awards[category].length).toBeLessThanOrEqual(PODIUM_SIZE);
      for (const placing of awards[category]) {
        expect(placing.playerName.length).toBeGreaterThan(0);
        expect(placing.clubId.length).toBeGreaterThan(0);
        expect(Number.isSafeInteger(placing.value)).toBe(true);
        expect(placing.value).toBeGreaterThan(0);
      }
      // Descending, so the ceremony can read the order straight off the array.
      expect(awards[category].map((placing) => placing.value)).toEqual(
        awards[category]
          .map((placing) => placing.value)
          .slice()
          .sort((a, b) => b - a),
      );
    }
  });

  /**
   * Every placed player belongs to a club the pyramid still names, so the
   * ceremony can label a placing without the snapshot carrying club names too.
   */
  it('leaves every placed club name derivable from the persisted pyramid', () => {
    const awards = recapFor(seasonEnd, seasonEnd.season).divisionAwards!;
    const pyramidClubIds = new Set(
      (nextSeason.m2?.pyramid.divisions ?? []).flatMap((division) =>
        division.clubs.map((club) => club.id),
      ),
    );

    expect(placings(awards).length).toBeGreaterThan(0);
    for (const placing of placings(awards)) {
      expect(pyramidClubIds.has(placing.clubId)).toBe(true);
    }
  });

  /**
   * The ordering guarantee, stated as the failure it prevents: the transition
   * prunes rows for rival players the new roster no longer contains, so a
   * podium computed after the prune has already lost those placings. The stored
   * snapshot keeps them because it was taken while the players still existed.
   */
  it('snapshots the podiums before the transition prunes the rows behind them', () => {
    const completedSeason = seasonEnd.season;
    const stored = recapFor(nextSeason, completedSeason).divisionAwards!;
    const survivingRows = new Set(
      (nextSeason.seasonStatLines ?? []).map((row) => row.playerId),
    );

    expect((nextSeason.seasonStatLines ?? []).length).toBeLessThan(
      (seasonEnd.seasonStatLines ?? []).length,
    );
    const orphaned = placings(stored).filter(
      (placing) => !survivingRows.has(placing.playerId),
    );
    expect(orphaned.length).toBeGreaterThan(0);
    for (const placing of orphaned) {
      expect(
        nextSeason.players.some(
          (candidate) => candidate.id === placing.playerId,
        ),
      ).toBe(false);
    }

    // What a prune-then-snapshot order would have produced instead.
    const rebuilt = Object.fromEntries(
      CATEGORY_IDS.map((category) => [
        category,
        divisionPodium({
          category,
          season: completedSeason,
          players: nextSeason.players,
          statLines: nextSeason.seasonStatLines ?? [],
        }),
      ]),
    ) as Record<AwardCategoryId, DivisionAwardPlacement[]>;

    // The vacated places refill from below, so the loss shows as substitution
    // rather than a shorter podium: every orphaned placing is simply gone.
    const rebuiltIds = new Set(
      placings(rebuilt).map((placing) => placing.playerId),
    );
    for (const placing of orphaned) {
      expect(rebuiltIds.has(placing.playerId)).toBe(false);
    }
    expect(rebuilt).not.toEqual(stored);
  });
});

/**
 * The reason past seasons are pruned at all. `seasonStatLines` used to keep
 * every row a surviving player ever produced, so a fifteen-season career
 * carried fifteen seasons of rows in the save. Measured before the season rule
 * landed: 136, 270, 376 and 515 rows after the first four transitions.
 */
describe('bounded stat-line growth', () => {
  it('keeps no row older than the season just completed', () => {
    expect(rowsAfterTransition).toHaveLength(SEASONS_PLAYED);
    rowsAfterTransition.forEach((rows, index) => {
      expect(rows.length).toBeGreaterThan(0);
      expect([...new Set(rows.map((row) => row.season))]).toEqual([
        completedSeasons[index],
      ]);
    });
  });

  /**
   * Stated as a bound rather than a fixed count: one season's rows vary with
   * who played, but they cannot accumulate. Unbounded growth reaches 3.8x by
   * the fourth transition, so this catches a regression well before the ratio
   * gets close.
   */
  it('does not grow with the number of seasons played', () => {
    const counts = rowsAfterTransition.map((rows) => rows.length);

    expect(Math.max(...counts)).toBeLessThanOrEqual(counts[0]! * 2);
  });
});

/** Renews what expired, since an unresolved contract blocks the transition. */
function startNextCareerSeason(state: GameState): GameState {
  let renewed = state;
  for (const player of state.players.filter(
    (candidate) =>
      candidate.clubId === state.userClubId &&
      candidate.contractSeasonsRemaining === 0,
  )) {
    renewed = renewCareerPlayer(renewed, player.id, 4, 1);
  }
  return startNextSeason(renewed);
}

function simulatedSeason(initialState: GameState): GameState {
  let state = initialState;
  while (state.phase !== 'season-end') {
    if (state.phase === 'manage') {
      state = advanceWeek(state);
      continue;
    }
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined)
      throw new Error('the career lost its active matchday');
    const clubIds = [
      ...new Set(
        matchday.fixtures.flatMap((fixture) => [
          fixture.homeClubId,
          fixture.awayClubId,
        ]),
      ),
    ];
    state = completeMatchday(
      state,
      resolveMatchday(matchday.fixtures, buildCareerMatchTeams(state, clubIds)),
    );
  }
  return state;
}

function recapFor(state: GameState, season: number): SeasonRecap {
  const recap = state.seasonRecaps?.find(
    (candidate) => candidate.season === season,
  );
  if (recap === undefined)
    throw new Error(`no recap recorded for season ${season}`);
  return recap;
}

function placings(
  awards: Record<AwardCategoryId, DivisionAwardPlacement[]>,
): DivisionAwardPlacement[] {
  return CATEGORY_IDS.flatMap((category) => awards[category]);
}

function stateWith(
  players: CareerPlayer[],
  retiredPlayers: CareerPlayer[],
  seasonStatLines: PlayerSeasonStatLine[],
  season = 1,
): GameState {
  return {
    season,
    players,
    retiredPlayers,
    seasonStatLines,
  } as unknown as GameState;
}

function player(id: string, clubId: string, role: Role = 'FWD'): CareerPlayer {
  return {
    id,
    clubId,
    name: `${id} name`,
    role,
    attrs: { pac: 50, sho: 50, pas: 50, def: 50, tec: 50, sta: 50, ref: 50 },
    licensed: false,
    weeklyWage: 100,
    onHeroWage: false,
    contractSeasonsRemaining: 2,
    morale: 70,
    injuryWeeks: 0,
  };
}

function line(
  playerId: string,
  season = 1,
  clubId = 'club_a',
): PlayerSeasonStatLine {
  return {
    season,
    playerId,
    clubId,
    competition: 'league',
    goals: 1,
    assists: 0,
    tacklesWon: 0,
    saves: 0,
    passesCompleted: 0,
  };
}
