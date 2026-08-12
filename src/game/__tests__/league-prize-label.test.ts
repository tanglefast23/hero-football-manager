import { createLaunchCareerSetup } from '../../application/launch';
import { leagueStandings } from '../career';
import { runHeadlessFullCareer } from '../headless';
import { weeklySettlementAwardKeys } from '../weekly-settlement-awards';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `LEAGUE_PRIZES_BY_DIVISION` pays all ten places; the ledger label beside it
 * only had two branches, so every finish from 3rd to 10th banked a "League
 * runner-up prize" — "Prämie für den Zweiten" to a German manager who came 9th.
 * Measured 31 mislabelled lines out of 40 season-end prize lines.
 */
describe('season-end league prize label', () => {
  const seeds = [20_260_720, 7, 42, 99, 777, 8_311];
  const finishes = seeds.map((seed) => {
    const state = runHeadlessFullCareer(createLaunchCareerSetup(seed), 1);
    const position = leagueStandings(state).find(
      (row) => row.clubId === state.userClubId,
    )!.position;
    const line = state.ledgers
      .flatMap((ledger) => ledger.lines)
      .find(
        (candidate) =>
          candidate.idempotencyKey ===
          weeklySettlementAwardKeys.leaguePrize(state.userClubId, 1),
      )!;
    return { seed, position, line };
  });

  test('names the place it was actually won in', () => {
    // The bug only shows off the top two, so the fixture has to contain one.
    expect(finishes.some((finish) => finish.position > 2)).toBe(true);

    for (const { seed, position, line } of finishes) {
      const expected =
        position === 1
          ? {
              label: 'League champion prize',
              labelKey: 'ledger.leagueChampionPrize',
            }
          : position === 2
            ? {
                label: 'League runner-up prize',
                labelKey: 'ledger.leagueRunnerUpPrize',
              }
            : {
                label: `League prize · #${position}`,
                labelKey: 'ledger.leaguePlacePrize',
                labelParams: { position },
              };

      expect({ seed, ...line }).toMatchObject({ seed, ...expected });
      if (position > 2) {
        // Raw, never pre-formatted: ordinal suffixes are the catalog's job and
        // `src/game` cannot read `src/i18n`.
        expect(typeof line.labelParams?.position).toBe('number');
      }
    }
  });

  test('ships the English catalog key the ledger line asks for', () => {
    const english = JSON.parse(
      readFileSync(join(process.cwd(), 'content/i18n/en.json'), 'utf8'),
    ).strings as Record<string, string>;

    for (const key of [
      'ledger.leagueChampionPrize',
      'ledger.leagueRunnerUpPrize',
      'ledger.leaguePlacePrize',
    ]) {
      expect(english[key]).toBeDefined();
    }
    expect(english['ledger.leaguePlacePrize']).toContain('{position}');
  });
});
