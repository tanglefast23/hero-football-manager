import { DIVISION_NAMES } from '../../game/pyramid';
import { buildSeasonRecap } from '../../game/season-recap';
import type { CareerPlayer, GameState, SeasonRecap } from '../../game/types';
import { devHarnessCareerAtSeasonEnd } from '../../ui/dev-harness/career';
import {
  GLOBAL_LEAGUE_WON_FLAG,
  NATIONAL_CUP_WON_FLAG,
  TRUE_ENDING_SEEN_FLAG,
} from '../endgame-celebration';
import {
  captureHallOfFameRecord,
  goldenBootGoals,
  hallOfFameViewModel,
  recordHallOfFame,
} from '../hall-of-fame';
import { useM1Store } from '../store';

/**
 * A real career, run by the real season clock: the capture reads recaps, cup
 * records and a live roster, and a hand-built state would only prove that the
 * fixture was built to match the reader.
 */
const PLAYED_SEASONS = 2;

function playedCareer(): GameState {
  return devHarnessCareerAtSeasonEnd(PLAYED_SEASONS);
}

function userRoster(state: GameState): CareerPlayer[] {
  return state.players.filter(player => player.clubId === state.userClubId);
}

/**
 * A Golden Boot row, fabricated.
 *
 * The seeded career settles its fixtures from the fixture seed rather than by
 * running the match engine, so its scorelines carry no scorers and no stat
 * rows: goals exist, and nobody scored them. Everything else the capture reads
 * is the career's own, and the award is four denormalised strings, so this is
 * the one input worth writing by hand.
 */
function bootedRecap(
  base: SeasonRecap,
  season: number,
  player: CareerPlayer,
  goals: number,
): SeasonRecap {
  return {
    ...base,
    season,
    topScorer: {
      playerId: player.id,
      playerName: player.name,
      label: 'Golden Boot',
      detail: `${goals} goals`,
    },
  };
}

/** A career that finished the climb, with the honours a finished one must have. */
function finishedCareer(state: GameState = playedCareer()): GameState {
  const striker = userRoster(state)[0];
  const recaps = (state.seasonRecaps ?? []).map((recap): SeasonRecap => ({
    ...bootedRecap(recap, recap.season, striker, 10 + recap.season),
    division: recap.season === 1 ? 5 : 1,
    finalPosition: recap.season === 1 ? 4 : 1,
  }));
  return recordHallOfFame({
    ...state,
    seasonRecaps: recaps,
    eventFlags: [...state.eventFlags, TRUE_ENDING_SEEN_FLAG],
    ...(state.m2 === undefined ? {} : {
      m2: {
        ...state.m2,
        nationalCups: state.m2.nationalCups.map(cup => (cup.season === PLAYED_SEASONS
          ? { ...cup, championClubId: state.userClubId }
          : cup)),
      },
    }),
  });
}

describe('capturing the Hall of Fame record', () => {
  it('totals every season the career played', () => {
    const state = playedCareer();
    const recaps = state.seasonRecaps ?? [];
    const record = captureHallOfFameRecord(state);

    expect(recaps).toHaveLength(PLAYED_SEASONS);
    expect(record.season).toBe(state.season);
    expect(record.clubName)
      .toBe(state.clubs.find(club => club.id === state.userClubId)?.name);
    expect(record.played).toBe(recaps.reduce((sum, recap) => sum + recap.played, 0));
    expect(record.won).toBe(recaps.reduce((sum, recap) => sum + recap.won, 0));
    expect(record.drawn).toBe(recaps.reduce((sum, recap) => sum + recap.drawn, 0));
    expect(record.lost).toBe(recaps.reduce((sum, recap) => sum + recap.lost, 0));
    expect(record.goalsFor).toBe(recaps.reduce((sum, recap) => sum + recap.goalsFor, 0));
    expect(record.goalsAgainst).toBe(recaps.reduce((sum, recap) => sum + recap.goalsAgainst, 0));
    expect(record.won + record.drawn + record.lost).toBe(record.played);
  });

  it('keeps one row per tier, in the order the club reached them', () => {
    const state = playedCareer();
    const record = captureHallOfFameRecord({
      ...state,
      seasonRecaps: (state.seasonRecaps ?? []).map(recap => ({
        ...recap,
        division: recap.season === 1 ? 5 : 4,
        finalPosition: recap.season === 1 ? 2 : 6,
      })),
    });

    expect(record.tiers).toEqual([
      { division: 5, firstSeason: 1, seasons: 1, bestPosition: 2 },
      { division: 4, firstSeason: 2, seasons: 1, bestPosition: 6 },
    ]);
  });

  it('folds a second spell at a tier into the same row', () => {
    const state = playedCareer();
    const record = captureHallOfFameRecord({
      ...state,
      seasonRecaps: (state.seasonRecaps ?? []).map(recap => ({
        ...recap,
        division: 5,
        finalPosition: recap.season === 1 ? 9 : 3,
      })),
    });

    expect(record.tiers).toEqual([
      { division: 5, firstSeason: 1, seasons: 2, bestPosition: 3 },
    ]);
  });

  it('records a title for every season the club finished top', () => {
    const record = captureHallOfFameRecord(finishedCareer());

    expect(record.divisionTitles).toEqual([{ season: PLAYED_SEASONS, division: 1 }]);
  });

  /**
   * Read from the cup records rather than from the recap's `cupResult`
   * sentence, so the trophy that ends the game is never counted by matching a
   * display string.
   */
  it('counts a Cup from the cup record, not from the recap wording', () => {
    const state = finishedCareer();
    const record = captureHallOfFameRecord(state);

    expect(record.cupWinSeasons).toEqual([PLAYED_SEASONS]);
    expect(state.seasonRecaps?.every(recap => recap.cupResult !== 'Winners')).toBe(true);
  });

  it('names the most famous man in the squad', () => {
    const state = playedCareer();
    const record = captureHallOfFameRecord(state);
    const bestFame = Math.max(...state.players
      .filter(player => player.clubId === state.userClubId)
      .map(player => player.fame ?? 0));

    expect(record.star?.fame).toBe(bestFame);
    expect(record.star?.playerName)
      .toBe(state.players.find(player => player.id === record.star?.playerId)?.name);
  });

  /**
   * The top scorer is summed from the per-season Golden Boot, which is the only
   * career-long scoring evidence a save keeps: `seasonStatLines` is pruned at
   * every season transition.
   */
  it('sums the club Golden Boots into one career top scorer', () => {
    const state = playedCareer();
    const [base] = state.seasonRecaps ?? [];
    const [alma, bruno] = userRoster(state);
    const record = captureHallOfFameRecord({
      ...state,
      seasonRecaps: [
        bootedRecap(base, 1, alma, 12),
        bootedRecap(base, 2, bruno, 14),
        bootedRecap(base, 3, alma, 15),
        bootedRecap(base, 4, bruno, 12),
      ],
    });

    // 27 to 26, on two Golden Boots each: the goals decide it, not the count.
    expect(record.topScorer).toEqual({
      playerId: alma.id,
      playerName: alma.name,
      goals: 27,
      goldenBoots: 2,
    });
  });

  it('breaks a dead heat on goals with the number of Golden Boots', () => {
    const state = playedCareer();
    const [base] = state.seasonRecaps ?? [];
    const [alma, bruno] = userRoster(state);
    const record = captureHallOfFameRecord({
      ...state,
      seasonRecaps: [
        bootedRecap(base, 1, alma, 10),
        bootedRecap(base, 2, alma, 10),
        bootedRecap(base, 3, bruno, 20),
      ],
    });

    expect(record.topScorer?.playerId).toBe(alma.id);
    expect(record.topScorer?.goldenBoots).toBe(2);
  });

  /**
   * The number lives only inside the award's display string, so this pins the
   * parse against the SHIPPED recap builder: a reworded detail fails here
   * rather than silently zeroing every career total.
   */
  it('reads the Golden Boot goals the recap builder writes', () => {
    const state = playedCareer();
    const scorer = userRoster(state)[0];
    const scored = 17;
    const recap = buildSeasonRecap({
      ...state,
      seasonStatLines: [{
        season: state.season,
        playerId: scorer.id,
        clubId: state.userClubId,
        competition: 'league',
        goals: scored,
        assists: 0,
        tacklesWon: 0,
        saves: 0,
        passesCompleted: 0,
      }],
    });
    if (recap.topScorer === undefined) throw new Error('the recap recorded no Golden Boot');

    expect(recap.topScorer.playerId).toBe(scorer.id);
    expect(goldenBootGoals(recap.topScorer.detail)).toBe(scored);
  });

  it('counts an unreadable Golden Boot as no goals rather than throwing', () => {
    const state = playedCareer();
    const [base] = state.seasonRecaps ?? [];
    const scorer = userRoster(state)[0];
    const reworded = {
      ...bootedRecap(base, 1, scorer, 12),
      topScorer: {
        playerId: scorer.id,
        playerName: scorer.name,
        label: 'Golden Boot',
        detail: 'led the line all season',
      },
    };

    expect(captureHallOfFameRecord({ ...state, seasonRecaps: [reworded] }).topScorer)
      .toEqual({ playerId: scorer.id, playerName: scorer.name, goals: 0, goldenBoots: 1 });
  });

  /** A career missing its recaps still reaches its own record. */
  it('records zeroes rather than throwing on a career with no recaps', () => {
    const record = captureHallOfFameRecord({ ...playedCareer(), seasonRecaps: [] });

    expect(record.played).toBe(0);
    expect(record.divisionTitles).toEqual([]);
    expect(record.tiers).toEqual([]);
    expect(record.topScorer).toBeUndefined();
  });
});

describe('banking the record', () => {
  it('writes nothing until the climb is complete', () => {
    const state = playedCareer();

    expect(recordHallOfFame(state)).toBe(state);
    expect(recordHallOfFame(state).hallOfFame).toBeUndefined();
  });

  it('writes once and never overwrites', () => {
    const finished = finishedCareer();
    if (finished.hallOfFame === undefined) throw new Error('the climb recorded nothing');

    expect(recordHallOfFame(finished)).toBe(finished);

    // A later career state cannot replace the record with a thinner version of
    // itself — which is the whole reason it is captured rather than derived.
    const later = recordHallOfFame({ ...finished, seasonRecaps: [], season: 40 });
    expect(later.hallOfFame).toEqual(finished.hallOfFame);
  });
});

/**
 * The wiring, driven through the store the way the app drives it.
 *
 * The capture has exactly one caller — the way off the true ending — and it has
 * to happen there, before the season transition regenerates the rosters and
 * prunes the stat rows the record is made of.
 */
describe('watching the true ending', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('banks the record on the way out of the summit', () => {
    const career = playedCareer();
    // Both trophies flagged and the ending unseen is what makes the pending
    // celebration the true one, without simulating nine promotions to D1.
    useM1Store.setState({
      career: { ...career, eventFlags: [GLOBAL_LEAGUE_WON_FLAG, NATIONAL_CUP_WON_FLAG] },
      screen: 'endgame-celebration',
    });

    useM1Store.getState().completeEndgameCelebration();

    const after = useM1Store.getState().career;
    expect(after?.eventFlags).toContain(TRUE_ENDING_SEEN_FLAG);
    expect(after?.hallOfFame?.season).toBe(career.season);
    expect(after?.hallOfFame?.played)
      .toBe((career.seasonRecaps ?? []).reduce((sum, recap) => sum + recap.played, 0));
  });

  it('leaves a career that has not finished the climb without a record', () => {
    const career = playedCareer();
    useM1Store.setState({
      career: { ...career, eventFlags: [GLOBAL_LEAGUE_WON_FLAG] },
      screen: 'endgame-celebration',
    });

    useM1Store.getState().completeEndgameCelebration();

    expect(useM1Store.getState().career?.hallOfFame).toBeUndefined();
  });
});

describe('the Hall of Fame page', () => {
  it('is locked, and says what unlocks it, before the climb ends', () => {
    const viewModel = hallOfFameViewModel(playedCareer());
    if (viewModel.status !== 'locked') throw new Error('an unfinished career unlocked the page');

    expect(viewModel.lines[0]).toBe('Finish the climb to see your record.');
    expect(viewModel.lines.join(' ')).toContain('Hero Cup');
    expect(viewModel.accessibilityLabel).toContain('Finish the climb');
  });

  it('draws the record a finished career banked', () => {
    const state = finishedCareer();
    const record = state.hallOfFame;
    const viewModel = hallOfFameViewModel(state);
    if (viewModel.status !== 'complete' || record === undefined) {
      throw new Error('a finished career did not unlock the page');
    }

    expect(viewModel.headline).toBe(record.clubName);
    expect(viewModel.subheading).toContain(`${record.season} seasons`);
    expect(viewModel.stats.map(stat => stat.id)).toEqual([
      'seasons', 'record', 'goals', 'titles', 'cups', 'top-scorer', 'star',
    ]);
    expect(viewModel.stats.find(stat => stat.id === 'record')?.value)
      .toBe(`${record.won} / ${record.drawn} / ${record.lost}`);
    expect(viewModel.tiers).toHaveLength(record.tiers.length);
    // Every figure says what it is a total of; a bare number on this page is a
    // number nobody can check.
    expect(viewModel.stats.every(stat => stat.detail.length > 0)).toBe(true);
  });

  /**
   * The ladder is read on a phone, where a tier row has about 255pt of text.
   * Written as one sentence, the row breaks after "best" and strands the
   * finish on a line of its own, which reads as a broken renderer.
   */
  it('splits a tier into its finish and its spell', () => {
    const state = finishedCareer();
    const record = state.hallOfFame;
    if (record === undefined) throw new Error('the climb recorded nothing');
    const viewModel = hallOfFameViewModel({
      ...state,
      hallOfFame: {
        ...record,
        tiers: [{ division: 2, firstSeason: 5, seasons: 1, bestPosition: 2 }],
      },
    });
    if (viewModel.status !== 'complete') throw new Error('the page did not unlock');

    expect(viewModel.tiers[0].best).toBe('Best 2nd');
    expect(viewModel.tiers[0].detail).toBe('Reached in season 5 · 1 season');
  });

  it('lists honours oldest first, whichever trophy came first', () => {
    const state = finishedCareer();
    const record = state.hallOfFame;
    if (record === undefined) throw new Error('the climb recorded nothing');
    const viewModel = hallOfFameViewModel({
      ...state,
      hallOfFame: {
        ...record,
        divisionTitles: [{ season: 3, division: 2 }, { season: 1, division: 5 }],
        cupWinSeasons: [2, 4],
      },
    });
    if (viewModel.status !== 'complete') throw new Error('the page did not unlock');

    expect(viewModel.honours.map(honour => honour.label)).toEqual([
      'Season 1', 'Season 2', 'Season 3', 'Season 4',
    ]);
    // Named the way the league table names it, never invented here.
    expect(viewModel.honours[0].value).toBe(`${DIVISION_NAMES[5]} champions`);
    expect(viewModel.honours[1].value).toBe('Hero Cup winners');
  });

  it('says so when a Cup-only career never topped a table', () => {
    const state = finishedCareer();
    const record = state.hallOfFame;
    if (record === undefined) throw new Error('the climb recorded nothing');
    const viewModel = hallOfFameViewModel({
      ...state,
      hallOfFame: { ...record, divisionTitles: [], cupWinSeasons: [] },
    });
    if (viewModel.status !== 'complete') throw new Error('the page did not unlock');

    expect(viewModel.honours).toEqual([]);
    expect(viewModel.honoursEmptyLabel.length).toBeGreaterThan(0);
    expect(viewModel.stats.find(stat => stat.id === 'titles')?.detail)
      .toBe('Promoted without a title');
  });
});
