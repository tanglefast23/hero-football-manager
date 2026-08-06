import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
  homeGateIncome,
  weeklyMerchandiseIncome,
} from '../career';
import {
  advanceFacilityConstruction,
  buildFacility,
  createFacilityGrid,
  upgradeFacility,
} from '../facilities';
import type { FacilityGridState } from '../facilities';

function completeFacilityProject(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined) next = advanceFacilityConstruction(next).grid;
  return next;
}
import { matchdayVarianceRoll } from '../finance-variance';
import { SEASON_WEEKS } from '../types';
import type { GameState, LedgerLine } from '../types';
import { createLaunchCareerSetup } from '../../application/launch';

function fullCareer(seed: number): GameState {
  return createCareer(createLaunchCareerSetup(seed));
}

/** Settle the current week; the user wins every match so cup runs continue. */
function settleScheduledWeek(state: GameState): GameState {
  let next = advanceWeek(state);
  while (next.phase === 'matchday') {
    const matchday = activeCareerMatchday(next)!;
    next = completeMatchday(next, matchday.fixtures.map(fixture => {
      const userHome = fixture.homeClubId === next.userClubId;
      const userAway = fixture.awayClubId === next.userClubId;
      return {
        fixtureId: fixture.id,
        homeGoals: userHome ? 2 : userAway ? 0 : 1,
        awayGoals: userAway ? 2 : userHome ? 0 : 1,
      };
    }));
  }
  return next;
}

/** Settle forward until the week before settling satisfies `wanted`. */
function settleUntil(
  state: GameState,
  wanted: (pre: GameState) => boolean,
): { pre: GameState; post: GameState } {
  let current = state;
  for (let guard = 0; guard < SEASON_WEEKS; guard += 1) {
    const isWanted = wanted(current);
    const post = settleScheduledWeek(current);
    if (isWanted) return { pre: current, post };
    current = post;
  }
  throw new Error('wanted week not found within a season');
}

const hasUserHomeLeagueFixture = (state: GameState): boolean => fixturesForCurrentWeek(state)
  .some(fixture => fixture.homeClubId === state.userClubId);

const hasUserAwayLeagueFixture = (state: GameState): boolean => fixturesForCurrentWeek(state)
  .some(fixture => fixture.awayClubId === state.userClubId);

const hasNoUserFixture = (state: GameState): boolean => !fixturesForCurrentWeek(state)
  .some(fixture => (
    fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId
  ));

function latestLines(state: GameState): readonly LedgerLine[] {
  const ledger = state.ledgers[state.ledgers.length - 1];
  if (ledger === undefined) throw new Error('no settled ledger');
  return ledger.lines;
}

function leagueGateLine(state: GameState): LedgerLine | undefined {
  return latestLines(state).find(line => line.label === 'League home gate');
}

function cupGateLine(state: GameState): LedgerLine | undefined {
  return latestLines(state).find(line => (
    line.kind === 'tickets' && line.label !== 'League home gate'
  ));
}

function merchLine(state: GameState): LedgerLine | undefined {
  return latestLines(state).find(line => line.kind === 'merch');
}

function userClub(state: GameState) {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('missing user club');
  return club;
}

/** Two Lv1 stands (2x2 footprints) and three Lv1 shops, all operational. */
function standsAndShopsGrid(): FacilityGridState {
  let grid = createFacilityGrid();
  grid = completeFacilityProject(buildFacility(grid, 'stadium-stand', { x: 0, y: 0 }, 1_000_000).grid);
  grid = completeFacilityProject(buildFacility(grid, 'stadium-stand', { x: 2, y: 0 }, 1_000_000).grid);
  grid = completeFacilityProject(buildFacility(grid, 'fan-shop', { x: 4, y: 0 }, 1_000_000).grid);
  grid = completeFacilityProject(buildFacility(grid, 'fan-shop', { x: 5, y: 0 }, 1_000_000).grid);
  grid = completeFacilityProject(buildFacility(grid, 'fan-shop', { x: 6, y: 0 }, 1_000_000).grid);
  return grid;
}

function withGrid(state: GameState, grid: FacilityGridState): GameState {
  return { ...state, facilities: { ...state.facilities, grid } };
}

function gateReconstructs(line: LedgerLine): void {
  const reveal = line.reveal;
  if (reveal === undefined || reveal.source === 'merch') throw new Error('expected a gate reveal');
  expect(reveal.base).toBeGreaterThan(0);
  expect(line.amount).toBe(
    reveal.base + Math.floor(reveal.base * (reveal.multiplierPercent - 100) / 100),
  );
}

function merchReconstructs(line: LedgerLine): void {
  const reveal = line.reveal;
  if (reveal === undefined || reveal.source !== 'merch') throw new Error('expected a merch reveal');
  expect(reveal.base).toBeGreaterThan(0);
  expect(reveal.adjacencyAmount).toBe(
    Math.floor(reveal.base * reveal.multiplierTimes * reveal.adjacencyPercent / 100),
  );
  expect(line.amount).toBe(reveal.base * reveal.multiplierTimes + reveal.adjacencyAmount);
}

describe('settlement reveals', () => {
  test('settling identical states is byte-identical', () => {
    const state = withGrid(fullCareer(801), standsAndShopsGrid());
    const { pre } = settleUntil(state, hasUserHomeLeagueFixture);
    const once = settleScheduledWeek(structuredClone(pre));
    const twice = settleScheduledWeek(structuredClone(pre));
    expect(JSON.stringify(once.ledgers)).toBe(JSON.stringify(twice.ledgers));
  });

  test('a home league week reveals the gate with the seeded roll and exact reconstruction', () => {
    const state = withGrid(fullCareer(801), standsAndShopsGrid());
    const { pre, post } = settleUntil(state, hasUserHomeLeagueFixture);
    const line = leagueGateLine(post);
    expect(line?.reveal?.source).toBe('league-gate');
    const roll = matchdayVarianceRoll(post.careerSeed, pre.season, pre.week, 'league-gate');
    expect(line?.reveal?.variancePercent).toBe(roll.percent);
    expect(line?.reveal?.surge).toBe(roll.surge);
    if (line?.reveal?.source !== 'merch') {
      expect(line?.reveal?.multiplierPercent).toBe(200); // two Lv1 stands
      expect(line?.reveal?.facilityCount).toBe(2);
    }
    gateReconstructs(line!);
  });

  test('merchandise reveals with multiplier, adjacency, and exact reconstruction', () => {
    const state = withGrid(fullCareer(801), standsAndShopsGrid());
    const { pre, post } = settleUntil(state, hasUserHomeLeagueFixture);
    const line = merchLine(post);
    expect(line?.reveal?.source).toBe('merch');
    const roll = matchdayVarianceRoll(post.careerSeed, pre.season, pre.week, 'merch');
    expect(line?.reveal?.variancePercent).toBe(roll.percent);
    if (line?.reveal?.source === 'merch') {
      expect(line.reveal.multiplierTimes).toBe(3); // three Lv1 shops
      expect(line.reveal.facilityCount).toBe(3);
    }
    merchReconstructs(line!);
  });

  test('an away-match week has no gate line but still rolls merchandise', () => {
    const state = withGrid(fullCareer(801), standsAndShopsGrid());
    const { post } = settleUntil(state, hasUserAwayLeagueFixture);
    expect(leagueGateLine(post)).toBeUndefined();
    const line = merchLine(post);
    expect(line?.reveal?.source).toBe('merch');
    merchReconstructs(line!);
  });

  test('a quiet week banks baseline merchandise with no reveal', () => {
    const state = withGrid(fullCareer(801), standsAndShopsGrid());
    const { pre, post } = settleUntil(state, hasNoUserFixture);
    const line = merchLine(post);
    expect(line).toBeDefined();
    expect(line?.reveal).toBeUndefined();
    expect(line?.amount).toBe(weeklyMerchandiseIncome(pre, userClub(pre)));
  });

  test('the season-final settlement carries no reveals', () => {
    const state = withGrid(fullCareer(801), standsAndShopsGrid());
    const atFinalWeek = { ...state, week: SEASON_WEEKS };
    const post = settleScheduledWeek(atFinalWeek);
    for (const line of latestLines(post)) {
      expect(line.reveal).toBeUndefined();
    }
  });

  test('a home cup week reveals the cup gate; a double-header carries independent rolls', () => {
    // The cup draw decides home-ness, so hunt across seeds for a season that
    // produces a user home cup tie (and ideally a league+cup double-header).
    let cupPost: GameState | undefined;
    let cupPre: GameState | undefined;
    for (const seed of [801, 802, 803, 804, 805, 806, 807, 808]) {
      let current = withGrid(fullCareer(seed), standsAndShopsGrid());
      for (let guard = 0; guard < SEASON_WEEKS - 2; guard += 1) {
        const pre = current;
        current = settleScheduledWeek(current);
        if (cupGateLine(current)?.reveal !== undefined) {
          cupPost = current;
          cupPre = pre;
          break;
        }
        if (current.phase !== 'manage') break;
      }
      if (cupPost !== undefined) break;
    }
    expect(cupPost).toBeDefined();
    const cupLine = cupGateLine(cupPost!)!;
    expect(cupLine.reveal?.source).toBe('cup-gate');
    const roll = matchdayVarianceRoll(cupPost!.careerSeed, cupPre!.season, cupPre!.week, 'cup-gate');
    expect(cupLine.reveal?.variancePercent).toBe(roll.percent);
    gateReconstructs(cupLine);
    // Merch rolled the same week from its own stream.
    const merch = merchLine(cupPost!);
    expect(merch?.reveal?.source).toBe('merch');
    // If the draw also produced a league home game this week, the league gate
    // reveals independently alongside the cup gate.
    const league = leagueGateLine(cupPost!);
    if (league !== undefined) {
      expect(league.reveal?.source).toBe('league-gate');
      gateReconstructs(league);
    }
  });

  test('a zero-fan home gate banks $0 with no reveal', () => {
    const base = fullCareer(801);
    const clubs = base.clubs.map(club => (
      club.id === base.userClubId ? { ...club, fans: 0 } : club
    ));
    const { post } = settleUntil({ ...base, clubs }, hasUserHomeLeagueFixture);
    const line = leagueGateLine(post);
    expect(line?.amount).toBe(0);
    expect(line?.reveal).toBeUndefined();
  });

  test('constant lines never carry a reveal', () => {
    const state = withGrid(fullCareer(801), standsAndShopsGrid());
    const { post } = settleUntil(state, hasUserHomeLeagueFixture);
    for (const line of latestLines(post)) {
      if (line.kind === 'tickets' || line.kind === 'merch') continue;
      expect(line.reveal).toBeUndefined();
    }
  });

  test('a zero-roll week settles exactly the baseline projections (gate and merch)', () => {
    // Search the seed space for careers whose first home-match week rolls
    // percent === 0 — a real gate line on a real eligible week, matching the
    // variance-free projection exactly.
    const found: { source: 'league-gate' | 'merch'; pre: GameState; post: GameState }[] = [];
    for (let seed = 1; seed < 400 && found.length < 2; seed += 1) {
      const career = withGrid(fullCareer(seed), standsAndShopsGrid());
      const { pre, post } = settleUntil(career, hasUserHomeLeagueFixture);
      const gateRoll = matchdayVarianceRoll(post.careerSeed, pre.season, pre.week, 'league-gate');
      const merchRoll = matchdayVarianceRoll(post.careerSeed, pre.season, pre.week, 'merch');
      if (gateRoll.percent === 0 && !found.some(entry => entry.source === 'league-gate')) {
        found.push({ source: 'league-gate', pre, post });
      }
      if (merchRoll.percent === 0 && !found.some(entry => entry.source === 'merch')) {
        found.push({ source: 'merch', pre, post });
      }
    }
    expect(found.map(entry => entry.source).sort()).toEqual(['league-gate', 'merch']);
    for (const { source, pre, post } of found) {
      if (source === 'league-gate') {
        expect(leagueGateLine(post)?.amount).toBe(homeGateIncome(pre, userClub(pre), 'test'));
      } else {
        expect(merchLine(post)?.amount).toBe(weeklyMerchandiseIncome(pre, userClub(pre)));
      }
    }
  });

  test('reveal bounds hold across careers', () => {
    for (const seed of [11, 22, 33, 44, 55, 66, 77, 88, 99, 110]) {
      const state = withGrid(fullCareer(seed), standsAndShopsGrid());
      const { post } = settleUntil(state, hasUserHomeLeagueFixture);
      for (const line of latestLines(post)) {
        if (line.reveal === undefined) continue;
        expect(line.reveal.variancePercent).toBeGreaterThanOrEqual(-10);
        expect(line.reveal.variancePercent).toBeLessThanOrEqual(20);
        expect(line.reveal.surge).toBe(line.reveal.variancePercent >= 11);
      }
    }
  });

  test('an upgraded stand raises the multiplier through combined level', () => {
    let grid = createFacilityGrid();
    const built = buildFacility(grid, 'stadium-stand', { x: 0, y: 0 }, 1_000_000);
    grid = completeFacilityProject(built.grid);
    const standId = grid.buildings[grid.buildings.length - 1].id;
    grid = completeFacilityProject(upgradeFacility(grid, standId, 1_000_000).grid);
    const state = withGrid(fullCareer(801), grid);
    const { post } = settleUntil(state, hasUserHomeLeagueFixture);
    const line = leagueGateLine(post);
    if (line?.reveal === undefined || line.reveal.source === 'merch') {
      throw new Error('expected a gate reveal');
    }
    expect(line.reveal.multiplierPercent).toBe(200); // one Lv2 stand
    expect(line.reveal.facilityCount).toBe(1);
    gateReconstructs(line);
  });
});
