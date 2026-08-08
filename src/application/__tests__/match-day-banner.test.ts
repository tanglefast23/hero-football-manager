import { readFileSync } from 'fs';
import { join } from 'path';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  CUP_DISPLAY_NAME,
  DEFAULT_CREATION_RATINGS,
  DIVISION_NAMES,
  SEASON_WEEKS,
} from '../../game';
import type { GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { useM1Store } from '../store';
import { matchDayBannerViewModel } from '../view-models';
import { withRivalHeroIntrosSeen } from './rival-hero-intro-test-helper';

/**
 * The banner announces the week, so the only thing it can never do is announce
 * a fixture the club does not have. It is derived from the same call the desk
 * uses for "This week", which is what these tests pin.
 */

function career(seed: number): GameState {
  return createCareer(createLaunchCareerSetup(seed));
}

/** Walks the career forward, playing every matchday, collecting one entry a week. */
function walkWeeks(seed: number, weeks: number) {
  let state = career(seed);
  const seen: {
    week: number;
    headline: string | null;
    isCup: boolean | null;
    hasFixture: boolean;
  }[] = [];
  for (let step = 0; step < weeks * 4 && seen.length < weeks; step += 1) {
    if (state.phase !== 'manage') break;
    seen.push({
      week: state.week,
      headline: matchDayBannerViewModel(state)?.headline ?? null,
      isCup: matchDayBannerViewModel(state)?.isCup ?? null,
      hasFixture: activeCareerMatchday(state) !== undefined,
    });
    state = advanceWeek(state);
    if (state.phase === 'matchday') {
      const matchday = activeCareerMatchday(state)!;
      state = completeMatchday(
        state,
        matchday.fixtures.map(fixture => ({
          fixtureId: fixture.id,
          homeGoals: 1,
          awayGoals: 1,
        })),
      );
    }
  }
  return seen;
}

describe('matchDayBannerViewModel', () => {
  it('announces nothing on a week with no user fixture', () => {
    const weeks = walkWeeks(1, 10);
    const quiet = weeks.filter(week => !week.hasFixture);
    expect(quiet.length).toBeGreaterThan(0);
    expect(quiet.every(week => week.headline === null)).toBe(true);
  });

  it('announces every week that does have one, and never any other', () => {
    const weeks = walkWeeks(1, 10);
    const busy = weeks.filter(week => week.hasFixture);
    expect(busy.length).toBeGreaterThan(0);
    expect(busy.every(week => week.headline !== null)).toBe(true);
  });

  it('names the division, not "Division 5", for a league week', () => {
    const weeks = walkWeeks(1, 10);
    const league = weeks.find(week => week.headline === `${DIVISION_NAMES[5]}: Match Day`);
    expect(league).toBeDefined();
    expect(weeks.every(week => week.headline === null || !/Division \d/.test(week.headline)))
      .toBe(true);
  });

  it('names the cup on a cup week', () => {
    // Seed 2 draws a Play-in tie inside the first eight weeks.
    const weeks = walkWeeks(2, 10);
    expect(weeks.some(week => week.headline === `${CUP_DISPLAY_NAME}: Match Day`)).toBe(true);
  });

  it('calls the last week of the season the final game, not another match day', () => {
    // The final league round is pinned to Week 30, so the week that settles the
    // season is itself a match. Announcing it as an ordinary match day would
    // bury the one fixture that decides promotion.
    const finale = { ...career(1), week: SEASON_WEEKS };
    expect(activeCareerMatchday(finale)?.kind).toBe('league');
    expect(matchDayBannerViewModel(finale)?.headline)
      .toBe(`${DIVISION_NAMES[5]}: Final Game!`);
  });

  it('keeps the ordinary announcement for every other league week', () => {
    const weeks = walkWeeks(1, 10);
    expect(weeks.every(week => week.headline === null || !/Final Game/.test(week.headline)))
      .toBe(true);
  });

  /**
   * The card draws the cup cabinet instead of the crowd on a tie, so the flag
   * has to track the competition exactly: a league week showing trophies would
   * promise a cup run the club is not on.
   */
  it('flags the cup week, and only the cup week, for the cabinet art', () => {
    const weeks = walkWeeks(2, 10).filter(week => week.headline !== null);
    const cup = weeks.filter(week => week.headline === `${CUP_DISPLAY_NAME}: Match Day`);
    expect(cup.length).toBeGreaterThan(0);
    expect(cup.every(week => week.isCup)).toBe(true);
    expect(weeks.filter(week => week.isCup === true)).toHaveLength(cup.length);
  });

  /**
   * The regression this file was missing: everything above tests the view
   * model, and the view model was never wrong. The bug was in who asked it.
   * Settling a match rolls the calendar into the next week, so back-to-back
   * fixture weeks arrived without ever passing through the Advance Week press
   * the announcement used to hang off — and went silent.
   */
  it('announces the next fixture week the club settles into after a match', () => {
    useM1Store.setState(useM1Store.getInitialState(), true);
    useM1Store.getState().startNewCareer(2);
    useM1Store.getState().completePlayerCreation({
      name: 'Back To Back',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const started = useM1Store.getState().career!;
    const userFixtures = started.fixtures.filter(fixture => (
      fixture.season === started.season
      && (fixture.homeClubId === started.userClubId || fixture.awayClubId === started.userClubId)
    ));
    const played = userFixtures[0];
    const next = userFixtures.find(fixture => fixture.week > played.week + 1);
    expect(next).toBeDefined();

    useM1Store.setState({
      career: withRivalHeroIntrosSeen({
        ...started,
        week: played.week,
        phase: 'matchday',
        // Pull a later fixture onto the week this match settles into, so the
        // manager leaves one match week straight into another.
        fixtures: started.fixtures.map(fixture => (
          fixture.id === next!.id ? { ...fixture, week: played.week + 1 } : fixture
        )),
      }),
      screen: 'matchday',
      matchDayBanner: null,
    });

    useM1Store.getState().quickResult();

    expect(useM1Store.getState().career).toMatchObject({ week: played.week + 1 });
    expect(useM1Store.getState().matchDayBanner?.id)
      .toBe(`match-day-banner-${started.season}-${played.week + 1}`);
  });

  /**
   * The report renders over the management screen instead of replacing it, so
   * `screen === 'management'` was true while the statement was still being
   * read and the bugle played behind it. Held, not dropped: the card is still
   * in the store, it just waits for Continue.
   */
  it('waits for the Financial Report to be dismissed before it announces', () => {
    const app = readFileSync(join(process.cwd(), 'App.tsx'), 'utf8');
    expect(app).toMatch(
      /store\.screen === 'management'\s*\n\s*&& !postMatchSummaryVisible\s*\n\s*&& store\.matchDayBanner !== null/,
    );
  });

  it('keys the card to the week, so one week can only announce itself once', () => {
    let state = career(1);
    const first = matchDayBannerViewModel(state);
    expect(matchDayBannerViewModel(state)?.id).toBe(first?.id);
    state = advanceWeek(state);
    const next = matchDayBannerViewModel(state);
    if (next !== null && first !== null) expect(next.id).not.toBe(first.id);
  });
});
