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
  nextTrainingUpgradeOffer,
  resolveTrainingDrillForPath,
  roleOverall,
  selectCareerLicensedHeroes,
  setCareerLineup,
  startNextSeason,
  trainPlayerInstantly,
  type GameState,
} from '../../game';
import {
  buildCareerFacility,
  purchaseCareerTrainingUpgrade,
  upgradeCareerFacility,
} from '../../game/management';
import { willRetireAtSeasonTransition } from '../../game/m2-career';
import { renewCareerPlayer } from '../../game/squad';
import { runMatch } from '../../sim/match';
import type { Attrs } from '../../sim/types';

const describeProbe =
  process.env.DIVISION_ENTRY_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

const SEEDS = Array.from(
  { length: positiveIntegerEnv('DIVISION_ENTRY_SEEDS', 2) },
  (_, index) => 4_000_000 + index * 7919,
);
const SEASON_BUDGET = positiveIntegerEnv('DIVISION_ENTRY_SEASONS', 6);
const ENTRY_MATCHES = 5;
const ATTRS: readonly (keyof Attrs)[] = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
];
const AWAKENING_POWER_IDS = content.powers.powers.map((power) => power.id);
const AWAKENING_TRIGGER_IDS = content.onboarding.triggers.map(
  (trigger) => trigger.id,
);
const AWAKENING_TUNING = {
  weeklyChanceStepPercent: content.powers.awakening.weeklyChanceStepPercent,
  maxPerSeason: content.powers.awakening.maxPerSeason,
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
        `${String(row.seed).padStart(10)} ${String(row.season).padStart(6)}` +
          ` ${String(row.division).padStart(4)}` +
          ` ${row.squadMeanAtEntry.toFixed(1).padStart(7)}` +
          ` ${row.fieldMeanAtEntry.toFixed(1).padStart(7)}` +
          ` ${row.gapAtEntry.toFixed(1).padStart(7)}` +
          `   ${row.firstFiveWins}-${row.firstFiveDraws}-${row.firstFiveLosses}` +
          ` ${String(row.firstFiveGoalDifference).padStart(6)}` +
          ` ${String(row.finalPosition).padStart(6)}` +
          ` ${String(row.finalPoints).padStart(5)}` +
          `  ${row.promoted ? 'YES' : 'no'}`,
      );
    }

    lines.push(
      '',
      'entry gap by division (negative = arriving behind the field):',
    );
    for (const division of [5, 4, 3, 2, 1]) {
      const forDivision = rows.filter((row) => row.division === division);
      if (forDivision.length === 0) continue;
      const gap =
        forDivision.reduce((sum, row) => sum + row.gapAtEntry, 0) /
        forDivision.length;
      const wins = forDivision.reduce((sum, row) => sum + row.firstFiveWins, 0);
      const losses = forDivision.reduce(
        (sum, row) => sum + row.firstFiveLosses,
        0,
      );
      lines.push(
        `  D${division}: mean gap ${gap.toFixed(1)}` +
          `  first-5 record ${wins}W/${forDivision.length * ENTRY_MATCHES - wins - losses}D/${losses}L` +
          `  across ${forDivision.length} entries`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(rows.length).toBeGreaterThan(0);
  }, 7_200_000);
});

function playCareer(seed: number): EntryRow[] {
  let state = addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(createLaunchCareerSetup(seed, undefined, content, 'COZY')),
    ),
    {
      name: 'Entry Probe',
      ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 },
    },
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
        state = buyDrillUpgrades(state);
        state = trainWholeBank(state);
        state = advanceWeek(state);
        continue;
      }
      if (state.phase !== 'matchday')
        throw new Error(`unexpected phase ${state.phase}`);
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
    const mine = table.find((row) => row.clubId === state.userClubId);
    if (mine === undefined)
      throw new Error('user club missing from its own table');
    rows.push({
      seed,
      season,
      division,
      squadMeanAtEntry: entry?.squad ?? 0,
      fieldMeanAtEntry: entry?.field ?? 0,
      gapAtEntry: (entry?.squad ?? 0) - (entry?.field ?? 0),
      firstFiveWins: results.filter((outcome) => outcome === 'W').length,
      firstFiveDraws: results.filter((outcome) => outcome === 'D').length,
      firstFiveLosses: results.filter((outcome) => outcome === 'L').length,
      firstFiveGoalDifference,
      finalPosition: mine.position,
      finalPoints: mine.points,
      promoted: mine.position <= 2,
    });

    if (season === SEASON_BUDGET) break;
    for (const player of state.players.filter(
      (candidate) =>
        candidate.clubId === state.userClubId &&
        candidate.contractSeasonsRemaining === 0 &&
        !willRetireAtSeasonTransition(candidate, state.season),
    )) {
      state = renewCareerPlayer(state, player.id, 4, 1);
    }
    state = startNextSeason(state);
  }
  return rows;
}

function userDivision(state: GameState): number {
  return (
    state.m2?.pyramid.divisions.find((division) =>
      division.clubs.some((club) => club.id === state.userClubId),
    )?.level ?? 5
  );
}

function squadMean(state: GameState, clubId: string): number {
  const team = buildCareerMatchTeams(state, [clubId])[clubId];
  const perPlayer = team.players.map(
    (player) =>
      ATTRS.reduce((sum, key) => sum + player.attrs[key], 0) / ATTRS.length,
  );
  return perPlayer.reduce((left, right) => left + right, 0) / perPlayer.length;
}

function fieldMean(state: GameState, division: number): number {
  const clubs =
    state.m2?.pyramid.divisions.find(
      (candidate) => candidate.level === division,
    )?.clubs ?? [];
  const rivals = clubs.filter((club) => club.id !== state.userClubId);
  if (rivals.length === 0) return 0;
  return (
    rivals.reduce((sum, club) => sum + squadMean(state, club.id), 0) /
    rivals.length
  );
}

function playMatchday(state: GameState): {
  state: GameState;
  outcome?: 'W' | 'D' | 'L';
  goalDifference: number;
} {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('matchday phase without an active fixture');
  const clubIds = [
    ...new Set(matchday.fixtures.flatMap((f) => [f.homeClubId, f.awayClubId])),
  ];
  const teams = buildCareerMatchTeams(state, clubIds);
  const played = completeMatchday(
    state,
    matchday.fixtures.map((fixture) => {
      const result = runMatch(
        fixture.matchSeed,
        teams[fixture.homeClubId],
        teams[fixture.awayClubId],
        [],
        {
          homePolicy: 'FIRE_WHEN_READY',
          awayPolicy: 'FIRE_WHEN_READY',
        },
      );
      return {
        fixtureId: fixture.id,
        homeGoals: result.score[0],
        awayGoals: result.score[1],
      };
    }),
  );

  const userFixture = matchday.fixtures.find(
    (fixture) =>
      fixture.homeClubId === state.userClubId ||
      fixture.awayClubId === state.userClubId,
  );
  // A matchday the user sits out is real — a cup round they are not in — and
  // contributes no result rather than a 0-0.
  if (userFixture === undefined) return { state: played, goalDifference: 0 };

  const isHome = userFixture.homeClubId === state.userClubId;
  const side = teams[isHome ? userFixture.homeClubId : userFixture.awayClubId];

  // Cup ties resolve outside `state.fixtures`, so they cannot be read back the
  // way a league result can — and they are not division form anyway. They are
  // played for their real side effects and excluded from the record.
  //
  // Reading them from `played.fixtures` used to miss and fall back to 0-0, which
  // this probe counted as a draw. That is the whole of the "promoted club draws
  // 20 of its first 25 D3 matches" result reported on 2026-07-30: cup rounds
  // recorded as stalemates. Peer-versus-peer measurement in
  // `division-decisiveness-probe` shows D3 football producing 4.78 goals a match
  // and 16.7% draws, so no such stalemate exists.
  if (matchday.kind !== 'league') {
    return {
      state: awakenHero(
        played,
        userFixture.id,
        side.players.map((player) => player.id),
      ),
      goalDifference: 0,
    };
  }

  const settled = played.fixtures.find(
    (fixture) => fixture.id === userFixture.id,
  );
  if (settled === undefined) {
    throw new Error(
      `league fixture ${userFixture.id} vanished from the played matchday`,
    );
  }
  if (settled.score === undefined) {
    throw new Error(
      `league fixture ${userFixture.id} completed without a score`,
    );
  }
  const { score } = settled;
  const goalsFor = isHome ? score.homeGoals : score.awayGoals;
  const goalsAgainst = isHome ? score.awayGoals : score.homeGoals;

  return {
    state: awakenHero(
      played,
      userFixture.id,
      side.players.map((player) => player.id),
    ),
    outcome:
      goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L',
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
  return next.awakening.pending === undefined
    ? next
    : completePostMatchAwakening(next);
}

/**
 * A career awakens more heroes than the Hero License caps, and the surplus may
 * neither start nor hold a licence. Two rules, in this order:
 *
 * 1. Spend the licences on players who are actually in the eleven. Preferring
 *    whoever was licensed first strands a newly awakened starter without one,
 *    and `buildTeamDef` then refuses the eleven mid-season.
 * 2. Bench any powered starter still unlicensed after that.
 *
 * This is a policy gap rather than a game defect — production was correctly
 * rejecting an eleven the probe built — and it only bites past season seven,
 * which is why shorter budgets never saw it.
 */
function licenseHeroes(state: GameState): GameState {
  const powered = state.players.filter(
    (player) =>
      player.clubId === state.userClubId && player.power !== undefined,
  );
  if (powered.length === 0) return state;
  const starting = new Set(
    state.lineups.find((candidate) => candidate.clubId === state.userClubId)
      ?.playerIds ?? [],
  );
  const wanted = [...powered]
    .sort(
      (left, right) =>
        Number(starting.has(right.id)) - Number(starting.has(left.id)),
    )
    .slice(0, careerHeroLimit(state))
    .map((player) => player.id);
  const licensed = powered
    .filter((player) => player.licensed)
    .map((player) => player.id);
  const unchanged =
    wanted.length === licensed.length &&
    wanted.every((playerId) => licensed.includes(playerId));
  return benchUnlicensedHeroes(
    unchanged ? state : selectCareerLicensedHeroes(state, wanted),
  );
}

/** Swaps unlicensed powered starters out one at a time, trying every legal substitute. */
function benchUnlicensedHeroes(state: GameState): GameState {
  let current = state;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const lineup = current.lineups.find(
      (candidate) => candidate.clubId === current.userClubId,
    );
    if (lineup === undefined) return current;
    const roster = current.players.filter(
      (player) => player.clubId === current.userClubId,
    );
    const byId = new Map(roster.map((player) => [player.id, player]));
    const slot = lineup.playerIds.findIndex((playerId) => {
      const player = byId.get(playerId);
      return (
        player !== undefined && player.power !== undefined && !player.licensed
      );
    });
    if (slot === -1) return current;

    const starter = byId.get(lineup.playerIds[slot])!;
    const selected = new Set(lineup.playerIds);
    const eligible = roster.filter(
      (candidate) =>
        !selected.has(candidate.id) &&
        candidate.injuryWeeks === 0 &&
        candidate.power === undefined &&
        (slot === 0 ? candidate.role === 'GK' : candidate.role !== 'GK'),
    );
    // Same role first so the formation survives the swap.
    const ordered = [
      ...eligible.filter((candidate) => candidate.role === starter.role),
      ...eligible.filter((candidate) => candidate.role !== starter.role),
    ];

    let applied: GameState | undefined;
    for (const replacement of ordered) {
      const playerIds = [...lineup.playerIds];
      playerIds[slot] = replacement.id;
      try {
        applied = setCareerLineup(current, playerIds);
        break;
      } catch {
        continue; // a contract promise pins this substitute; try the next
      }
    }
    if (applied === undefined) return current; // nothing legal to swap in
    current = applied;
  }
  return current;
}

/**
 * Buys the next drill tier for each core path once the club can afford it above
 * a working reserve.
 *
 * Without this the probe modelled a manager permanently on Tier I — 5 points a
 * tap — for an entire career, while the shop opens Tier II in D4, III in D3, IV
 * in D2 and V in D1 at 8/12/17/23 points. That is the single largest lever a
 * climbing club has, and leaving it out is what made D4 look like a wall: the
 * squad grew about 5 points a season against a 48-point deficit.
 *
 * The reserve keeps the club solvent; a purchase that would trip the board's
 * intervention is not one a real manager makes.
 */
const DRILL_UPGRADE_CASH_RESERVE = 12_000;

function buyDrillUpgrades(state: GameState): GameState {
  let next = state;
  for (const pathId of [
    'finishing',
    'duels',
    'keeper-drills',
    'rondo',
    'first-touch',
  ]) {
    const offer = nextTrainingUpgradeOffer(next, pathId);
    if (offer === undefined || offer.blockedReason !== undefined) continue;
    const cash =
      next.clubs.find((club) => club.id === next.userClubId)?.cash ?? 0;
    if (cash - offer.cost < DRILL_UPGRADE_CASH_RESERVE) continue;
    next = purchaseCareerTrainingUpgrade(next, pathId).state;
  }
  return next;
}

function buildFacilities(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined || grid.construction !== undefined) return state;
  const pitch = grid.buildings.find(
    (building) => building.type === 'training-pitch',
  );
  try {
    if (pitch === undefined)
      return buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;
    if (pitch.level < 3) return upgradeCareerFacility(state, pitch.id).state;
  } catch {
    return state; // not affordable yet
  }
  return state;
}

/** The owner-approved "trains well" profile: one core per role, whole bank spent. */
function trainWholeBank(state: GameState): GameState {
  let next = state;
  const lineup = next.lineups.find(
    (candidate) => candidate.clubId === next.userClubId,
  );
  if (lineup === undefined) return next;
  const starters = lineup.playerIds
    .map((id) => next.players.find((player) => player.id === id))
    .filter(
      (player): player is NonNullable<typeof player> =>
        player !== undefined && player.injuryWeeks === 0,
    );
  const core = (['GK', 'DEF', 'MID', 'FWD'] as const)
    .map(
      (role) =>
        starters
          .filter((player) => player.role === role)
          .sort(
            (left, right) =>
              roleOverall(right.role, right.attrs) -
                roleOverall(left.role, left.attrs) ||
              left.id.localeCompare(right.id),
          )[0],
    )
    .filter((player) => player !== undefined);
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
    const attributes =
      player.role === 'GK'
        ? (['ref'] as const)
        : POSITION_TRAINING_ATTRIBUTES[player.role];
    const attribute =
      attributes[(next.season * 30 + next.week + index) % attributes.length];
    if (player.attrs[attribute] >= playerAttributeCaps(player)[attribute])
      continue;
    const pathId = pathByAttribute[attribute];
    if (resolveTrainingDrillForPath(next, pathId).tpCost > next.trainingPoints)
      continue;
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
