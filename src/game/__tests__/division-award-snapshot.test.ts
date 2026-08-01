import { createLaunchCareerSetup } from '../../application/launch';
import type { Role } from '../../sim/types';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  startNextSeason,
} from '../career';
import { AWARD_CATEGORIES, PODIUM_SIZE, divisionPodium } from '../division-leaders';
import { resolveMatchday } from '../matchday';
import { prunedStatLines } from '../season-recap';
import { buildCareerMatchTeams } from '../squad';
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
    const state = stateWith(
      [player('p_live', 'club_a')],
      [],
      [line('p_live'), line('p_live', 2)],
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

    expect(prunedStatLines(state).map(row => row.playerId).sort())
      .toEqual(['p_live', 'p_retired']);
  });

  it('drops rows for players who exist nowhere', () => {
    const state = stateWith(
      [player('p_live', 'club_a')],
      [player('p_retired', 'club_a')],
      [line('p_live'), line('p_retired'), line('p_regenerated_rival')],
    );

    expect(prunedStatLines(state).map(row => row.playerId).sort())
      .toEqual(['p_live', 'p_retired']);
  });
});

describe('division award snapshots', () => {
  let seasonEnd: GameState;
  let nextSeason: GameState;

  beforeAll(() => {
    seasonEnd = simulatedSeason(createCareer(createLaunchCareerSetup(2468)));
    nextSeason = startNextSeason(seasonEnd);
  }, 300_000);

  it('records a renderable podium for every category', () => {
    const awards = recapFor(seasonEnd, seasonEnd.season).divisionAwards;
    if (awards === undefined) throw new Error('the recap recorded no division awards');

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
      expect(awards[category].map(placing => placing.value))
        .toEqual(awards[category].map(placing => placing.value).slice().sort((a, b) => b - a));
    }
  });

  /**
   * Every placed player belongs to a club the pyramid still names, so the
   * ceremony can label a placing without the snapshot carrying club names too.
   */
  it('leaves every placed club name derivable from the persisted pyramid', () => {
    const awards = recapFor(seasonEnd, seasonEnd.season).divisionAwards!;
    const pyramidClubIds = new Set((nextSeason.m2?.pyramid.divisions ?? [])
      .flatMap(division => division.clubs.map(club => club.id)));

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
    const survivingRows = new Set((nextSeason.seasonStatLines ?? []).map(row => row.playerId));

    expect((nextSeason.seasonStatLines ?? []).length)
      .toBeLessThan((seasonEnd.seasonStatLines ?? []).length);
    const orphaned = placings(stored).filter(placing => !survivingRows.has(placing.playerId));
    expect(orphaned.length).toBeGreaterThan(0);
    for (const placing of orphaned) {
      expect(nextSeason.players.some(candidate => candidate.id === placing.playerId)).toBe(false);
    }

    // What a prune-then-snapshot order would have produced instead.
    const rebuilt = Object.fromEntries(CATEGORY_IDS.map(category => [
      category,
      divisionPodium({
        category,
        season: completedSeason,
        players: nextSeason.players,
        statLines: nextSeason.seasonStatLines ?? [],
      }),
    ])) as Record<AwardCategoryId, DivisionAwardPlacement[]>;

    // The vacated places refill from below, so the loss shows as substitution
    // rather than a shorter podium: every orphaned placing is simply gone.
    const rebuiltIds = new Set(placings(rebuilt).map(placing => placing.playerId));
    for (const placing of orphaned) {
      expect(rebuiltIds.has(placing.playerId)).toBe(false);
    }
    expect(rebuilt).not.toEqual(stored);
  });
});

function simulatedSeason(initialState: GameState): GameState {
  let state = initialState;
  while (state.phase !== 'season-end') {
    if (state.phase === 'manage') {
      state = advanceWeek(state);
      continue;
    }
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined) throw new Error('the career lost its active matchday');
    const clubIds = [...new Set(matchday.fixtures.flatMap(
      fixture => [fixture.homeClubId, fixture.awayClubId],
    ))];
    state = completeMatchday(
      state,
      resolveMatchday(matchday.fixtures, buildCareerMatchTeams(state, clubIds)),
    );
  }
  return state;
}

function recapFor(state: GameState, season: number): SeasonRecap {
  const recap = state.seasonRecaps?.find(candidate => candidate.season === season);
  if (recap === undefined) throw new Error(`no recap recorded for season ${season}`);
  return recap;
}

function placings(
  awards: Record<AwardCategoryId, DivisionAwardPlacement[]>,
): DivisionAwardPlacement[] {
  return CATEGORY_IDS.flatMap(category => awards[category]);
}

function stateWith(
  players: CareerPlayer[],
  retiredPlayers: CareerPlayer[],
  seasonStatLines: PlayerSeasonStatLine[],
): GameState {
  return { players, retiredPlayers, seasonStatLines } as unknown as GameState;
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

function line(playerId: string, season = 1): PlayerSeasonStatLine {
  return {
    season,
    playerId,
    clubId: 'club_a',
    competition: 'league',
    goals: 1,
    assists: 0,
    tacklesWon: 0,
    saves: 0,
  };
}
