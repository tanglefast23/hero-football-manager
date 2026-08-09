import { createLaunchCareerSetup } from '../../application/launch';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
  startNextSeason,
} from '../../game/career';
import { willRetireAtSeasonTransition } from '../../game/m2-career';
import { renewCareerPlayer } from '../../game/squad';
import { mulberry32 } from '../../sim/rng';
import type { GameState } from '../../game/types';

/**
 * A seeded career, run forward to the point an entry wants to look at.
 *
 * The awards ceremony fabricates its one input by hand, because a podium is
 * four short lists. Most of what is still unreviewed cannot be reached that
 * way — a board ultimatum, a retirement, a promotion, a player request, Bert's
 * beats — because those read a whole `GameState`, and a hand-built one proves
 * only that the fixture was built to match the screen. So an entry asks for a
 * real career instead, run by the real season clock from a fixed seed.
 *
 * Pure TypeScript on purpose: no React, no react-native, so it is testable in
 * Jest, which runs with `testEnvironment: 'node'`.
 *
 * Cost is the catch. Every simulated week settles the whole division, so a
 * season is on the order of a second of blocking work. Results are therefore
 * cached for the life of the bundle: opening an entry pays once, and switching
 * away and back is free.
 */

/** Fixed so a harness address always opens the same career. */
const DEFAULT_SEED = 20260801;

/**
 * The clock is bounded per requested week, not per career: a run that is asked
 * for season 6 is allowed six seasons of transitions. Generous, because a
 * matchday week costs two transitions and a season boundary costs one more.
 */
const TRANSITIONS_PER_SEASON = 64;

export interface DevHarnessCareerRequest {
  /**
   * Cache key. Two requests sharing an id must describe the same career, so
   * fold anything you vary — the seed, the stopping point — into it.
   */
  readonly id: string;
  readonly seed?: number;
  /**
   * Stop at the first state this accepts, checked before every transition and
   * on the freshly created career. Never accepting anything is the one way to
   * fail: the run gives up at the transition rail and throws.
   */
  readonly stopAt: (state: GameState) => boolean;
  /** Seasons of clock the run is allowed before it gives up. Default 12. */
  readonly seasonBudget?: number;
}

/**
 * The career an entry asked for, cached.
 *
 * Deterministic: the same request always returns the same state, because the
 * seed fixes the fixture list and every simulated score is derived from the
 * fixture's own seed rather than from a running RNG.
 *
 * Throws rather than returning a half-run career. A stop condition that never
 * fires is a bug in the entry, and a silently truncated career would be
 * reviewed as if it were the real thing.
 */
export function devHarnessCareer(request: DevHarnessCareerRequest): GameState {
  const cached = CACHE.get(request.id);
  if (cached !== undefined) return cached;

  const state = runCareer(request);
  CACHE.set(request.id, state);
  return state;
}

/**
 * The career as it stands in one particular management week.
 *
 * The common request by a distance, and the one worth a convenience: nearly
 * every management screen is reviewed at "season S, week W, nothing in
 * progress". Season and week are the whole address, so they are the whole
 * cache key too.
 */
export function devHarnessCareerAtWeek(
  season: number,
  week: number,
  seed: number = DEFAULT_SEED,
): GameState {
  return devHarnessCareer({
    id: `week:${seed}:${season}:${week}`,
    seed,
    seasonBudget: season + 1,
    stopAt: (state) =>
      state.phase === 'manage' && state.season === season && state.week >= week,
  });
}

/**
 * The career at the moment a season has finished and the next has not started.
 *
 * Where the season-end screens live: the recap, the awards, promotion and
 * relegation, the board's verdict.
 */
export function devHarnessCareerAtSeasonEnd(
  season: number,
  seed: number = DEFAULT_SEED,
): GameState {
  return devHarnessCareer({
    id: `season-end:${seed}:${season}`,
    seed,
    seasonBudget: season + 1,
    stopAt: (state) => state.phase === 'season-end' && state.season === season,
  });
}

/** Cleared by nothing: the bundle is thrown away when the reviewer reloads. */
const CACHE = new Map<string, GameState>();

function runCareer(request: DevHarnessCareerRequest): GameState {
  const seed = request.seed ?? DEFAULT_SEED;
  let state = createCareer(createLaunchCareerSetup(seed));

  const budget = (request.seasonBudget ?? 12) * TRANSITIONS_PER_SEASON;
  for (let transitions = 0; transitions <= budget; transitions += 1) {
    if (request.stopAt(state)) return state;
    state = nextState(state);
  }
  throw new Error(
    `dev harness career "${request.id}" never reached its stopping point`,
  );
}

/**
 * One turn of the season clock, played the way a manager who never intervenes
 * would play it: matches settled, expiring contracts renewed at the cheapest
 * terms, seasons rolled over.
 */
function nextState(state: GameState): GameState {
  if (state.phase === 'manage') return advanceWeek(state);

  if (state.phase === 'matchday') {
    const matchday = activeCareerMatchday(state);
    if (matchday === undefined) {
      throw new Error(
        'a dev harness career entered matchday with no active fixture',
      );
    }
    return completeMatchday(
      state,
      matchday.fixtures.map(deterministicFixtureScore),
    );
  }

  if (state.phase === 'season-end') {
    // Letting a contract lapse would shrink the squad a screen is being
    // reviewed against, so everyone signs again at the cheapest terms.
    //
    // Everyone except a player leaving at this very transition. The same filter
    // `startNextSeason` and `runHeadlessFullCareer` gate on: an announced
    // retirement is exempt from the expiry gate, the season review never offers
    // him a renewal, and `renewCareerPlayer` now refuses one outright — so
    // renewing him here was work the shipped game never does.
    let renewed = state;
    for (const player of state.players.filter(
      (candidate) =>
        candidate.clubId === state.userClubId &&
        candidate.contractSeasonsRemaining === 0 &&
        !willRetireAtSeasonTransition(candidate, state.season),
    )) {
      renewed = renewCareerPlayer(renewed, player.id, 4, 1);
    }
    return startNextSeason(renewed);
  }

  throw new Error('a dev harness career reached the complete phase');
}

/**
 * A scoreline from the fixture's own seed.
 *
 * Matches the headless balance runner's roll deliberately: the same weightings
 * (0-4 goals, home nudged) keep the division tables a reviewer sees in the
 * shape the balance rails were tuned against, without the cost of running the
 * match engine 18 weeks a season.
 */
function deterministicFixtureScore(fixture: GameState['fixtures'][number]) {
  const random = mulberry32(fixture.matchSeed);
  const homeGoals = deterministicGoalRoll(random()) + (random() < 0.12 ? 1 : 0);
  const awayGoals = deterministicGoalRoll(random());
  return { fixtureId: fixture.id, homeGoals, awayGoals };
}

function deterministicGoalRoll(roll: number): number {
  if (roll < 0.34) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.88) return 2;
  if (roll < 0.97) return 3;
  return 4;
}
