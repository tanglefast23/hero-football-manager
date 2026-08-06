import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  CUP_DISPLAY_NAME,
  DIVISION_NAMES,
} from '../../game';
import type { GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { matchDayBannerViewModel } from '../view-models';

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
  const seen: { week: number; headline: string | null; hasFixture: boolean }[] = [];
  for (let step = 0; step < weeks * 4 && seen.length < weeks; step += 1) {
    if (state.phase !== 'manage') break;
    seen.push({
      week: state.week,
      headline: matchDayBannerViewModel(state)?.headline ?? null,
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

  it('keys the card to the week, so one week can only announce itself once', () => {
    let state = career(1);
    const first = matchDayBannerViewModel(state);
    expect(matchDayBannerViewModel(state)?.id).toBe(first?.id);
    state = advanceWeek(state);
    const next = matchDayBannerViewModel(state);
    if (next !== null && first !== null) expect(next.id).not.toBe(first.id);
  });
});
