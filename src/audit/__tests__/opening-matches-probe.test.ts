/**
 * SCRATCH PROBE (not a gate): measures the shipped opening-match win rates by
 * playing real careers headlessly through the production boundaries the app
 * uses (buildCareerMatchTeams -> quickMatchForFixture -> completeMatchday).
 *
 * Only the user's own fixture is simulated; rival league fixtures get cheap
 * deterministic scores, which cannot affect the user's result in the opening
 * weeks and makes the sweep ~5x faster.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
  createCareer,
  createdPlayer,
  isFirstOnboardingFixture,
  quickMatchForFixture,
  resolvePostMatchAwakening,
  resolveTrainingDrillForPath,
  trainPlayerInstantly,
  withoutPowers,
  type CareerPlayer,
  type GameState,
} from '../../game';
import { mulberry32 } from '../../sim/rng';
import type { Attrs, TeamDef } from '../../sim/types';

const content = loadLaunchContent();
const powerIds = content.powers.powers.map(power => power.id);
const triggerIds = content.onboarding.triggers.map(trigger => trigger.id);
const tuning = {
  chancePercent: content.powers.awakening.postMatchChancePercent,
  minimumMatchesBetween: content.powers.awakening.minimumMatchesBetween,
};
const SEEDS = positiveIntegerEnv('OPENING_MATCHES_SEEDS', 300);
const MATCHES_TRACKED = positiveIntegerEnv('OPENING_MATCHES_TRACKED', 5);
const TRAINED_PLAYERS = 3;

interface PlayedMatch {
  kind: string;
  week: number;
  goalsFor: number;
  goalsAgainst: number;
  userStrength: number;
  oppStrength: number;
  heroCount: number;
  home: boolean;
  tpBefore: number;
  cashBefore: number;
}

interface CareerRun {
  matches: PlayedMatch[];
  weeksTrained: number;
  weeksBlockedByTp: number;
  weeksBlockedByCash: number;
  weeksBlockedByCaps: number;
  eligibleTraineeSessions: number;
  focusCashCommitted: number;
  focusTpCommitted: number;
}

describe('opening-match balance probe', () => {
  it('reports win/draw/loss for the first matches of a fresh career', () => {
    const trained = runCohort(true);
    const control = runCohort(false);
    report('TRAINS 3 PLAYERS EVERY WEEK', trained);
    report('NO FOCUS TRAINING (control)', control);

    // Guard the bug that made both cohorts identical: training must actually run.
    const totalTrainedWeeks = trained.reduce((sum, run) => sum + run.weeksTrained, 0);
    expect(totalTrainedWeeks).toBeGreaterThan(0);
    expect(control.reduce((sum, run) => sum + run.weeksTrained, 0)).toBe(0);
  }, 900_000);
});

function runCohort(train: boolean): CareerRun[] {
  const runs: CareerRun[] = [];
  for (let index = 0; index < SEEDS; index += 1) {
    runs.push(runCareer(4_000_000 + index * 7919, train));
  }
  return runs;
}

function runCareer(seed: number, train: boolean): CareerRun {
  let state = addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(
      seed, undefined, content, 'full', 'COZY',
    ))),
    // 15-point creation pool fully spent into a striker build.
    { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );

  const run: CareerRun = {
    matches: [],
    weeksTrained: 0,
    weeksBlockedByTp: 0,
    weeksBlockedByCash: 0,
    weeksBlockedByCaps: 0,
    eligibleTraineeSessions: 0,
    focusCashCommitted: 0,
    focusTpCommitted: 0,
  };

  let guard = 0;
  while (run.matches.length < MATCHES_TRACKED && guard < 400) {
    guard += 1;
    if (state.phase === 'manage') {
      if (train) state = planWeeklyTraining(state, run);
      state = advanceWeek(state);
      continue;
    }
    if (state.phase === 'matchday') {
      const outcome = playMatchday(state);
      state = outcome.state;
      run.matches.push(outcome.match);
      continue;
    }
    break;
  }
  return run;
}

/**
 * Models a player keeping a 3-player Sprints template running. Capped
 * player/drill pairs are skipped by production training; this probe selects
 * only players with PAC headroom so every counted trainee session is real.
 */
function planWeeklyTraining(state: GameState, run: CareerRun): GameState {
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
  const hero = createdPlayer(state);
  const roster = state.players.filter(player => player.clubId === state.userClubId);

  const hasPacHeadroom = (player: CareerPlayer): boolean => player.attrs.pac < 999;

  const candidates = [
    ...(hero !== undefined && hasPacHeadroom(hero) ? [hero] : []),
    ...roster
      .filter(player => player.id !== hero?.id
        && player.role !== 'GK'
        && lineup.playerIds.includes(player.id)
        && player.injuryWeeks === 0
        && hasPacHeadroom(player))
      .sort((left, right) => right.attrs.pac - left.attrs.pac),
  ].slice(0, TRAINED_PLAYERS);

  if (candidates.length === 0) {
    run.weeksBlockedByCaps += 1;
    return state;
  }

  // Drills resolve at tap time now: tap each candidate once for this week
  // while the bank affords it. Do not catch tap failures — a pricing mismatch
  // invalidates the cohort and must fail the probe loudly.
  let next = state;
  let tapped = 0;
  for (const player of candidates) {
    const drill = resolveTrainingDrillForPath(next, 'sprints');
    if (next.trainingPoints < drill.tpCost) break;
    next = trainPlayerInstantly(next, player.id, 'sprints').state;
    run.focusTpCommitted += drill.tpCost;
    tapped += 1;
  }
  if (tapped === 0) {
    run.weeksBlockedByTp += 1;
    return next;
  }
  run.weeksTrained += 1;
  run.eligibleTraineeSessions += tapped;
  return next;
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function playMatchday(state: GameState): { state: GameState; match: PlayedMatch } {
  const matchday = activeCareerMatchday(state)!;
  const { fixture, fixtures, kind } = matchday;
  const builtTeams = buildCareerMatchTeams(
    state,
    [...new Set([fixture.homeClubId, fixture.awayClubId])],
  );
  const teams = isFirstOnboardingFixture(state, fixture.id)
    ? {
        [fixture.homeClubId]: withoutPowers(builtTeams[fixture.homeClubId]),
        [fixture.awayClubId]: withoutPowers(builtTeams[fixture.awayClubId]),
      }
    : builtTeams;

  const userIsHome = fixture.homeClubId === state.userClubId;
  const userTeam = teams[userIsHome ? fixture.homeClubId : fixture.awayClubId];
  const oppTeam = teams[userIsHome ? fixture.awayClubId : fixture.homeClubId];
  const club = state.clubs.find(candidate => candidate.id === state.userClubId)!;

  const quick = quickMatchForFixture(fixture, teams);
  // Rival fixtures get cheap scores: they cannot influence the user's own
  // result this early, and simulating them dominated the sweep's runtime.
  const results = fixtures.map(candidate => candidate.id === fixture.id
    ? quick.result
    : cheapScore(candidate));

  const after = completeMatchday(state, results);
  const completed = isFirstOnboardingFixture(state, fixture.id)
    ? completeFirstOnboardingMatch(after, fixture.id)
    : after;

  let next = completed;
  if (kind === 'league') {
    const participantIds = (userIsHome ? quick.replay.home : quick.replay.away)
      .players.map(player => player.id);
    const awakening = resolvePostMatchAwakening(
      completed, fixture.id, participantIds, powerIds, triggerIds, tuning,
    );
    next = awakening.awakened ? completePostMatchAwakening(awakening.state) : awakening.state;
  }

  return {
    state: next,
    match: {
      kind,
      week: state.week,
      goalsFor: userIsHome ? quick.result.homeGoals : quick.result.awayGoals,
      goalsAgainst: userIsHome ? quick.result.awayGoals : quick.result.homeGoals,
      userStrength: lineupStrength(userTeam),
      oppStrength: lineupStrength(oppTeam),
      heroCount: userTeam.players.filter(player => player.power !== undefined).length,
      home: userIsHome,
      tpBefore: state.trainingPoints,
      cashBefore: club.cash,
    },
  };
}

function cheapScore(fixture: { id: string; matchSeed: number }) {
  const random = mulberry32(fixture.matchSeed);
  const roll = (value: number) => (value < 0.34 ? 0 : value < 0.68 ? 1 : value < 0.88 ? 2 : 3);
  return { fixtureId: fixture.id, homeGoals: roll(random()), awayGoals: roll(random()) };
}

function lineupStrength(team: TeamDef): number {
  const keys: readonly (keyof Attrs)[] = ['pac', 'sho', 'pas', 'def', 'tec', 'sta'];
  const total = team.players.reduce(
    (sum, player) => sum + keys.reduce((inner, key) => inner + player.attrs[key], 0),
    0,
  );
  return Math.round((total / (team.players.length * keys.length)) * 100) / 100;
}

function report(label: string, runs: CareerRun[]): void {
  const lines: string[] = ['', `=== ${label} (${runs.length} seeds) ===`];
  const avgOf = (pick: (run: CareerRun) => number) =>
    Math.round((runs.reduce((sum, run) => sum + pick(run), 0) / runs.length) * 100) / 100;
  lines.push(
    `weeks trained ${avgOf(r => r.weeksTrained)}`
    + `  blocked: TP ${avgOf(r => r.weeksBlockedByTp)}`
    + ` cash ${avgOf(r => r.weeksBlockedByCash)}`
    + ` caps ${avgOf(r => r.weeksBlockedByCaps)}`,
  );
  lines.push(
    `training commitments: trainee sessions ${avgOf(r => r.eligibleTraineeSessions)}`
    + `  cash ${avgOf(r => r.focusCashCommitted)}`
    + `  TP ${avgOf(r => r.focusTpCommitted)}`,
  );

  for (let index = 0; index < MATCHES_TRACKED; index += 1) {
    const matches = runs.map(run => run.matches[index]).filter(Boolean);
    if (matches.length === 0) continue;
    const wins = matches.filter(m => m.goalsFor > m.goalsAgainst).length;
    const draws = matches.filter(m => m.goalsFor === m.goalsAgainst).length;
    const losses = matches.filter(m => m.goalsFor < m.goalsAgainst).length;
    const pct = (value: number) => `${Math.round((value / matches.length) * 1000) / 10}%`;
    const avg = (pick: (m: PlayedMatch) => number) =>
      Math.round((matches.reduce((sum, m) => sum + pick(m), 0) / matches.length) * 100) / 100;
    lines.push(
      `Match ${index + 1} [${matches[0].kind} wk${matches[0].week}]  `
      + `W ${pct(wins)}  D ${pct(draws)}  L ${pct(losses)}`,
    );
    lines.push(
      `   score ${avg(m => m.goalsFor)}-${avg(m => m.goalsAgainst)}`
      + `  squad ${avg(m => m.userStrength)} vs ${avg(m => m.oppStrength)}`
      + `  heroes ${avg(m => m.heroCount)}  home ${pct(matches.filter(m => m.home).length)}`
      + `  TP ${avg(m => m.tpBefore)}  cash ${avg(m => m.cashBefore)}`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}
