/**
 * OPT-IN DECISION PROBE:
 *   DIVISION_ENTRY_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/division-entry-probe.test.ts
 *
 * Answers "when a player reaches a new division, are they set up to lose
 * enough to still have somewhere to grow?"
 *
 * A promotion should land the club behind its new field — far enough back that
 * the season is a climb, close enough that matches stay competitive. Two ways
 * to get this wrong: arriving level with the field (nothing left to build
 * toward) or arriving so far behind that the division is a wall rather than a
 * ladder.
 *
 * The probe plays real careers through the production promotion path and, at
 * the first matchday of every division it reaches, records the squad-vs-field
 * gap and the first five results earned at that gap.
 *
 * Env:
 *   DIVISION_ENTRY_SEEDS    careers to play (default 2)
 *   DIVISION_ENTRY_SEASONS  season budget per career (default 6)
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  careerHeroLimit,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
  createCareer,
  isFirstOnboardingFixture,
  leagueStandings,
  playerAttributeCaps,
  POSITION_TRAINING_ATTRIBUTES,
  resolvePostMatchAwakening,
  resolveTrainingDrillForPath,
  roleOverall,
  selectCareerLicensedHeroes,
  setCareerLineup,
  startNextSeason,
  trainPlayerInstantly,
  type GameState,
} from '../../game';
import { buildCareerFacility, upgradeCareerFacility } from '../../game/management';
import { renewCareerPlayer } from '../../game/squad';
import { runMatch } from '../../sim/match';
import type { Attrs } from '../../sim/types';

const describeProbe = process.env.DIVISION_ENTRY_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

const SEEDS = Array.from(
  { length: positiveIntegerEnv('DIVISION_ENTRY_SEEDS', 2) },
  (_, index) => 4_000_000 + index * 7919,
);
const SEASON_BUDGET = positiveIntegerEnv('DIVISION_ENTRY_SEASONS', 6);
const ENTRY_MATCHES = 5;
const ATTRS: readonly (keyof Attrs)[] = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'];
const AWAKENING_POWER_IDS = content.powers.powers.map(power => power.id);
const AWAKENING_TRIGGER_IDS = content.onboarding.triggers.map(trigger => trigger.id);
const AWAKENING_TUNING = {
  chancePercent: content.powers.awakening.postMatchChancePercent,
  minimumMatchesBetween: content.powers.awakening.minimumMatchesBetween,
};

interface EntryRow {
  readonly seed: number;
  readonly season: number;
  readonly division: number;
  readonly squadMeanAtEntry: number;
  readonly fieldMeanAtEntry: number;
  readonly gapAtEntry: number;
  readonly firstFiveWins: number;
  readonly firstFiveDraws: number;
  readonly firstFiveLosses: number;
  readonly firstFiveGoalDifference: number;
  readonly finalPosition: number;
  readonly finalPoints: number;
  readonly promoted: boolean;
}

describeProbe('division entry scaling', () => {
  it('reports the squad-vs-field gap a promoted club actually arrives with', () => {
    const rows: EntryRow[] = [];
    for (const seed of SEEDS) rows.push(...playCareer(seed));

    const lines: string[] = [
      '',
      `=== DIVISION ENTRY (${SEEDS.length} careers, ${SEASON_BUDGET}-season budget) ===`,
      'seed        season  div   squad   field     gap   first5 W-D-L    GD   endPos  pts  promoted',
    ];
    for (const row of rows) {
      lines.push(
        `${String(row.seed).padStart(10)} ${String(row.season).padStart(6)}`
        + ` ${String(row.division).padStart(4)}`
        + ` ${row.squadMeanAtEntry.toFixed(1).padStart(7)}`
        + ` ${row.fieldMeanAtEntry.toFixed(1).padStart(7)}`
        + ` ${row.gapAtEntry.toFixed(1).padStart(7)}`
        + `   ${row.firstFiveWins}-${row.firstFiveDraws}-${row.firstFiveLosses}`
        + ` ${String(row.firstFiveGoalDifference).padStart(6)}`
        + ` ${String(row.finalPosition).padStart(6)}`
        + ` ${String(row.finalPoints).padStart(5)}`
        + `  ${row.promoted ? 'YES' : 'no'}`,
      );
    }

    lines.push('', 'entry gap by division (negative = arriving behind the field):');
    for (const division of [5, 4, 3, 2, 1]) {
      const forDivision = rows.filter(row => row.division === division);
      if (forDivision.length === 0) continue;
      const gap = forDivision.reduce((sum, row) => sum + row.gapAtEntry, 0) / forDivision.length;
      const wins = forDivision.reduce((sum, row) => sum + row.firstFiveWins, 0);
      const losses = forDivision.reduce((sum, row) => sum + row.firstFiveLosses, 0);
      lines.push(
        `  D${division}: mean gap ${gap.toFixed(1)}`
        + `  first-5 record ${wins}W/${forDivision.length * ENTRY_MATCHES - wins - losses}D/${losses}L`
        + `  across ${forDivision.length} entries`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(rows.length).toBeGreaterThan(0);
  }, 7_200_000);
});

function playCareer(seed: number): EntryRow[] {
  let state = addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(seed, undefined, content, 'COZY'))),
    { name: 'Entry Probe', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );
  const rows: EntryRow[] = [];

  for (let season = 1; season <= SEASON_BUDGET; season += 1) {
    const division = userDivision(state);
    let entry: { squad: number; field: number } | undefined;
    const results: ('W' | 'D' | 'L')[] = [];
    let firstFiveGoalDifference = 0;
    let guard = 0;

    while (state.phase !== 'season-end') {
      if (guard++ > 400) throw new Error('season did not reach season-end');
      if (state.phase === 'manage') {
        state = licenseHeroes(state);
        state = buildFacilities(state);
        state = trainWholeBank(state);
        state = advanceWeek(state);
        continue;
      }
      if (state.phase !== 'matchday') throw new Error(`unexpected phase ${state.phase}`);
      if (entry === undefined) {
        entry = {
          squad: squadMean(state, state.userClubId),
          field: fieldMean(state, division),
        };
      }
      const played = playMatchday(state);
      if (results.length < ENTRY_MATCHES && played.outcome !== undefined) {
        results.push(played.outcome);
        firstFiveGoalDifference += played.goalDifference;
      }
      state = played.state;
    }

    const table = leagueStandings(state);
    const mine = table.find(row => row.clubId === state.userClubId);
    if (mine === undefined) throw new Error('user club missing from its own table');
    rows.push({
      seed,
      season,
      division,
      squadMeanAtEntry: entry?.squad ?? 0,
      fieldMeanAtEntry: entry?.field ?? 0,
      gapAtEntry: (entry?.squad ?? 0) - (entry?.field ?? 0),
      firstFiveWins: results.filter(outcome => outcome === 'W').length,
      firstFiveDraws: results.filter(outcome => outcome === 'D').length,
      firstFiveLosses: results.filter(outcome => outcome === 'L').length,
      firstFiveGoalDifference,
      finalPosition: mine.position,
      finalPoints: mine.points,
      promoted: mine.position <= 2,
    });

    if (season === SEASON_BUDGET) break;
    for (const player of state.players.filter(candidate => (
      candidate.clubId === state.userClubId && candidate.contractSeasonsRemaining === 0
    ))) {
      state = renewCareerPlayer(state, player.id, 4, 1);
    }
    state = startNextSeason(state);
  }
  return rows;
}

function userDivision(state: GameState): number {
  return state.m2?.pyramid.divisions
    .find(division => division.clubs.some(club => club.id === state.userClubId))?.level ?? 5;
}

function squadMean(state: GameState, clubId: string): number {
  const team = buildCareerMatchTeams(state, [clubId])[clubId];
  const perPlayer = team.players.map(player => (
    ATTRS.reduce((sum, key) => sum + player.attrs[key], 0) / ATTRS.length
  ));
  return perPlayer.reduce((left, right) => left + right, 0) / perPlayer.length;
}

function fieldMean(state: GameState, division: number): number {
  const clubs = state.m2?.pyramid.divisions.find(candidate => candidate.level === division)?.clubs
    ?? [];
  const rivals = clubs.filter(club => club.id !== state.userClubId);
  if (rivals.length === 0) return 0;
  return rivals.reduce((sum, club) => sum + squadMean(state, club.id), 0) / rivals.length;
}

function playMatchday(state: GameState): {
  state: GameState;
  outcome?: 'W' | 'D' | 'L';
  goalDifference: number;
} {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) throw new Error('matchday phase without an active fixture');
  const clubIds = [...new Set(matchday.fixtures.flatMap(f => [f.homeClubId, f.awayClubId]))];
  const teams = buildCareerMatchTeams(state, clubIds);
  const played = completeMatchday(state, matchday.fixtures.map(fixture => {
    const result = runMatch(fixture.matchSeed, teams[fixture.homeClubId], teams[fixture.awayClubId], [], {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    return { fixtureId: fixture.id, homeGoals: result.score[0], awayGoals: result.score[1] };
  }));

  const userFixture = matchday.fixtures.find(fixture => (
    fixture.homeClubId === state.userClubId || fixture.awayClubId === state.userClubId
  ));
  if (userFixture === undefined) return { state: played, goalDifference: 0 };

  const isHome = userFixture.homeClubId === state.userClubId;
  const side = teams[isHome ? userFixture.homeClubId : userFixture.awayClubId];

  // A National Cup tie is played against another division, so it says nothing
  // about the gap to *this* division's field. It is resolved but never sampled.
  // Cup scores also live in `state.m2.nationalCups` rather than `state.fixtures`,
  // so an earlier version that looked them up here found nothing and scored
  // every cup week 0-0 — which is what produced the phantom D3 draw-lock.
  if (matchday.kind !== 'league') return { state: played, goalDifference: 0 };

  const settled = played.fixtures.find(fixture => fixture.id === userFixture.id);
  const score = settled?.score;
  if (score === undefined) {
    throw new Error(`league fixture ${userFixture.id} was played without recording a score`);
  }
  const goalsFor = isHome ? score.homeGoals : score.awayGoals;
  const goalsAgainst = isHome ? score.awayGoals : score.homeGoals;

  return {
    state: awakenHero(played, userFixture.id, side.players.map(player => player.id)),
    outcome: goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L',
    goalDifference: goalsFor - goalsAgainst,
  };
}

function awakenHero(
  state: GameState,
  fixtureId: string,
  participantIds: readonly string[],
): GameState {
  const onboarded = isFirstOnboardingFixture(state, fixtureId)
    ? completeFirstOnboardingMatch(state, fixtureId)
    : state;
  let next: GameState;
  try {
    next = resolvePostMatchAwakening(
      onboarded,
      fixtureId,
      participantIds,
      AWAKENING_POWER_IDS,
      AWAKENING_TRIGGER_IDS,
      AWAKENING_TUNING,
    ).state;
  } catch {
    return onboarded; // no eligible candidate this week
  }
  return next.awakening.pending === undefined ? next : completePostMatchAwakening(next);
}

function licenseHeroes(state: GameState): GameState {
  const powered = state.players.filter(player => (
    player.clubId === state.userClubId && player.power !== undefined
  ));
  if (powered.length === 0) return state;
  const licensed = powered.filter(player => player.licensed).map(player => player.id);
  const wanted = [...licensed, ...powered.filter(player => !player.licensed).map(player => player.id)]
    .slice(0, careerHeroLimit(state));
  const selected = wanted.length === licensed.length
    ? state
    : selectCareerLicensedHeroes(state, wanted);
  return benchUnlicensedHeroes(selected);
}

/**
 * A career awakens more heroes than the Hero License caps, and the surplus may
 * not start. Without this the probe left an unlicensed hero in the eleven and
 * production's lineup rule rejected it mid-season — a policy gap, not a game
 * defect: `buildTeamDef` was correctly refusing an eleven the probe built. It
 * only bites past season seven, which is why shorter budgets never saw it.
 */
function benchUnlicensedHeroes(state: GameState): GameState {
  const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId);
  if (lineup === undefined) return state;
  const roster = state.players.filter(player => player.clubId === state.userClubId);
  const byId = new Map(roster.map(player => [player.id, player]));
  const selected = new Set(lineup.playerIds);
  const playerIds = [...lineup.playerIds];
  let changed = false;

  for (let slot = 0; slot < playerIds.length; slot += 1) {
    const starter = byId.get(playerIds[slot]);
    if (starter === undefined || starter.power === undefined || starter.licensed) continue;
    const eligible = roster.filter(candidate => (
      !selected.has(candidate.id)
      && candidate.injuryWeeks === 0
      && candidate.power === undefined
      && (slot === 0 ? candidate.role === 'GK' : candidate.role !== 'GK')
    ));
    // Same role first so the formation survives the swap.
    const replacement = eligible.find(candidate => candidate.role === starter.role) ?? eligible[0];
    if (replacement === undefined) continue;
    selected.delete(starter.id);
    selected.add(replacement.id);
    playerIds[slot] = replacement.id;
    changed = true;
  }

  if (!changed) return state;
  try {
    return setCareerLineup(state, playerIds);
  } catch {
    return state; // a contract promise pins the eleven this week
  }
}

function buildFacilities(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined || grid.construction !== undefined) return state;
  const pitch = grid.buildings.find(building => building.type === 'training-pitch');
  try {
    if (pitch === undefined) return buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;
    if (pitch.level < 3) return upgradeCareerFacility(state, pitch.id).state;
  } catch {
    return state; // not affordable yet
  }
  return state;
}

/** The owner-approved "trains well" profile: one core per role, whole bank spent. */
function trainWholeBank(state: GameState): GameState {
  let next = state;
  const lineup = next.lineups.find(candidate => candidate.clubId === next.userClubId);
  if (lineup === undefined) return next;
  const starters = lineup.playerIds
    .map(id => next.players.find(player => player.id === id))
    .filter((player): player is NonNullable<typeof player> => player !== undefined
      && player.injuryWeeks === 0);
  const core = (['GK', 'DEF', 'MID', 'FWD'] as const)
    .map(role => starters
      .filter(player => player.role === role)
      .sort((left, right) => (
        roleOverall(right.role, right.attrs) - roleOverall(left.role, left.attrs)
        || left.id.localeCompare(right.id)
      ))[0])
    .filter(player => player !== undefined);
  const pathByAttribute = {
    pac: 'sprints',
    sho: 'finishing',
    pas: 'rondo',
    def: 'duels',
    tec: 'first-touch',
    sta: 'circuit',
    ref: 'keeper-drills',
  } as const;

  const rotation = (next.season * 30 + next.week) % Math.max(1, core.length);
  const order = [...core.slice(rotation), ...core.slice(0, rotation)];
  for (let index = 0; index < order.length; index += 1) {
    const player = order[index];
    const attributes = player.role === 'GK' ? (['ref'] as const) : POSITION_TRAINING_ATTRIBUTES[player.role];
    const attribute = attributes[(next.season * 30 + next.week + index) % attributes.length];
    if (player.attrs[attribute] >= playerAttributeCaps(player)[attribute]) continue;
    const pathId = pathByAttribute[attribute];
    if (resolveTrainingDrillForPath(next, pathId).tpCost > next.trainingPoints) continue;
    try {
      next = trainPlayerInstantly(next, player.id, pathId).state;
    } catch {
      continue; // a TRAINING_PRIORITY debt owns the next drills
    }
  }
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
