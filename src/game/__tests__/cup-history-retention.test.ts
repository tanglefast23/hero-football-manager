import { createLaunchCareerSetup } from '../../application/launch';
import { runHeadlessFullCareer } from '../headless';
import { RETAINED_CUP_BRACKET_SEASONS } from '../m2-career';
import { m2LeagueViewModel } from '../../application/m2-league-view-model';
import { copyOrEnglish } from '../../application/copy-fallback';
import { copyFor } from '../../i18n';
import { serializeGameState } from '../../persistence/game-state-codec';

/**
 * The M2 clock never ends, so every season's Hero Cup bracket used to be kept
 * forever: measured 13 kb per season, 769 kb by season 60, re-serialised into
 * the save after every action. Only the most recent brackets are reachable
 * from the Cup tab's season picker, so older cups keep their result and give
 * up their rounds.
 */
describe('Hero Cup bracket retention', () => {
  const state = runHeadlessFullCareer(createLaunchCareerSetup(8_311), 14);
  const cups = state.m2!.nationalCups.slice().sort((left, right) => left.season - right.season);

  test('keeps a cup record for every season ever played', () => {
    expect(cups.map(cup => cup.season)).toEqual(
      Array.from({ length: 14 }, (unused, index) => index + 1),
    );
  });

  test('keeps the full bracket only for the most recent seasons', () => {
    const withRounds = cups.filter(cup => cup.rounds.length > 0).map(cup => cup.season);

    expect(withRounds).toEqual(
      Array.from({ length: RETAINED_CUP_BRACKET_SEASONS }, (unused, index) => 14 - index).reverse(),
    );
  });

  /**
   * The champion is what Hall of Fame, the endgame trigger and "cups won" all
   * read. Dropping it with the bracket would rewrite the player's history.
   */
  test('keeps the champion of every pruned season', () => {
    const pruned = cups.filter(cup => cup.rounds.length === 0);

    expect(pruned.length).toBeGreaterThan(0);
    for (const cup of pruned) {
      expect(cup.championClubId).toBeDefined();
      expect(cup.careerSeed).toBe(state.careerSeed);
    }
  });

  test('never prunes a cup that is still being played', () => {
    for (const cup of cups) {
      if (cup.championClubId === undefined) expect(cup.rounds.length).toBeGreaterThan(0);
    }
  });

  /**
   * The Cup tab renders a bracket for whichever season is picked, so a season
   * whose rounds are gone must not be offered — selecting it threw
   * "Season N cup has no rounds".
   */
  test('offers only browsable seasons in the Cup tab picker', () => {
    const division = state.m2!.pyramid.divisions.find(candidate =>
      candidate.clubs.some(club => club.id === state.userClubId),
    )!;
    const view = m2LeagueViewModel({
      career: state.m2!,
      season: state.season,
      week: state.week,
      activeStandings: division.clubs.map((club, index) => ({
        position: index + 1,
        clubId: club.id,
        played: 8,
        won: Math.max(0, 7 - index),
        drawn: index % 2,
        lost: Math.max(0, index - 2),
        goalsFor: 20 - index,
        goalsAgainst: 5 + index,
        goalDifference: 15 - 2 * index,
        points: Math.max(0, 7 - index) * 3 + (index % 2),
      })),
    });
    const offered = view.cup.seasonOptions.map(option => option.season).sort((a, b) => a - b);
    const browsable = cups.filter(cup => cup.rounds.length > 0).map(cup => cup.season);

    expect(offered).toEqual(browsable);
    expect(offered).toHaveLength(RETAINED_CUP_BRACKET_SEASONS);
  });

  /**
   * The recap is denormalised into the save and read back by the SeasonEnd
   * panel, which never sees the bracket — so the named-round branch shipping
   * without a key put an English "Quarter-final" on that panel title in every
   * language, for every season of every new career. Fourteen real seasons here
   * guarantee several named-round exits to catch it with.
   */
  test('keys the cup result of every season, including the round it ended at', () => {
    const de = copyFor('de');
    const recaps = state.seasonRecaps ?? [];
    const namedRounds = recaps.filter(recap => (
      recap.cupResultKey?.startsWith('m2League.cupRound.') === true
    ));

    expect(recaps.length).toBe(14);
    expect(namedRounds.length).toBeGreaterThan(0);
    for (const recap of recaps) {
      expect(recap.cupResultKey).toBeDefined();
      // The English half stays the save's fallback and must not itself move.
      const german = copyOrEnglish(de, recap.cupResultKey, recap.cupResult);
      expect(german).not.toBe(recap.cupResultKey);
    }
    for (const recap of namedRounds) {
      expect(copyOrEnglish(de, recap.cupResultKey, recap.cupResult)).not.toBe(recap.cupResult);
    }
  });

  test('holds the save well under the unpruned size', () => {
    // Unpruned, 14 seasons of brackets alone measured ~180 kb.
    const cupKb = JSON.stringify(cups).length / 1024;

    expect(cupKb).toBeLessThan(150);
    expect(serializeGameState(state)).toBeTruthy();
  });
});
