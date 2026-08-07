/**
 * OPT-IN BALANCE PROBE:
 *   DIVISION_RAMP_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/division-ramp-probe.test.ts
 *
 * Answers the one question no existing harness could: can a Division 5 career
 * actually be won, and how fast?
 *
 * Why a new probe was needed. `runHeadlessFullCareer` scores every fixture from
 * `deterministicFixtureScore`, which reads only the fixture seed — squad
 * strength is ignored entirely, so it cannot measure a ramp. And
 * `active-manager-balance` ASSUMES a 3-0 win every week and measures the
 * economy under that assumption. Neither one asks whether winning is possible.
 *
 * This one plays every fixture in the user's division through the real engine
 * (10 clubs, double round robin = 90 matches per season) and reads the real
 * final table, so the answer comes from production paths only.
 *
 * Two manager profiles bracket the target ("D5 in 1 season if you are good, 2 at
 * most if you are not"): `trains` taps drills every week and builds a Training
 * Pitch as soon as it can afford one, `idle` does neither.
 *
 * Read the `played` column, not `end`. It averages the squad over every match
 * day, which is the strength that actually earned the points; `end` is the
 * season's final value and will overstate a squad that grew all year.
 * Promotion, measured against a squad strength held flat for a whole season,
 * needs a sustained +5 on the field — and the opening is deliberately -5.
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
  resolvePostMatchAwakening,
  resolveTrainingDrillForPath,
  roleOverall,
  selectCareerLicensedHeroes,
  startNextSeason,
  trainPlayerInstantly,
  POSITION_TRAINING_ATTRIBUTES,
} from '../../game';
import { willRetireAtSeasonTransition } from '../../game/m2-career';
import { renewCareerPlayer } from '../../game/squad';
import { buildCareerFacility, upgradeCareerFacility } from '../../game/management';
import { runMatch } from '../../sim/match';
import type { GameState } from '../../game';

const describeProbe = process.env.DIVISION_RAMP_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

const SEEDS = [4_000_000, 20_260_725];
const SEASONS = 2;
const AWAKENING_POWER_IDS = content.powers.powers.map(power => power.id);
const AWAKENING_TRIGGER_IDS = content.onboarding.triggers.map(trigger => trigger.id);
const AWAKENING_TUNING = {
  chancePercent: content.powers.awakening.postMatchChancePercent,
  secondInSeasonChancePercent: content.powers.awakening.secondInSeasonChancePercent,
  maxPerSeason: content.powers.awakening.maxPerSeason,
  minimumMatchesBetween: content.powers.awakening.minimumMatchesBetween,
};

function newCareer(seed: number): GameState {
  return addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(seed, undefined, content, 'COZY'))),
    { name: 'Ramp Probe', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );
}

/**
 * Rotates the available weekly TP across one starting GK, DEF, MID and FWD.
 * The keeper focuses REF; outfielders rotate their natural-role attributes.
 * This is the owner-approved "trains well" profile used to size the rebased
 * ladder: concentrated, sustainable development rather than spending the whole
 * bank indiscriminately across reserves and irrelevant attributes.
 */
function trainWithWholeBank(state: GameState): { state: GameState; drills: number; spent: number } {
  let next = state;
  let drills = 0;
  let spent = 0;
  const lineup = next.lineups.find(candidate => candidate.clubId === next.userClubId);
  if (lineup === undefined) throw new Error('the ramp probe needs a user lineup');
  const starters = lineup.playerIds
    .map(id => next.players.find(player => player.id === id)!)
    .filter(player => player.injuryWeeks === 0);
  const core = (['GK', 'DEF', 'MID', 'FWD'] as const).map(role => starters
    .filter(player => player.role === role)
    .sort((left, right) => (
      roleOverall(right.role, right.attrs) - roleOverall(left.role, left.attrs)
      || left.id.localeCompare(right.id)
    ))[0]).filter(player => player !== undefined);
  const pathByAttribute = {
    pac: 'sprints',
    sho: 'finishing',
    pas: 'rondo',
    def: 'duels',
    tec: 'first-touch',
    sta: 'circuit',
    ref: 'keeper-drills',
  } as const;

  const rotation = (next.season * 30 + next.week) % core.length;
  const trainingOrder = [...core.slice(rotation), ...core.slice(0, rotation)];
  for (let index = 0; index < trainingOrder.length; index += 1) {
    const player = trainingOrder[index];
    const attributes = player.role === 'GK'
      ? (['ref'] as const)
      : POSITION_TRAINING_ATTRIBUTES[player.role];
    const attribute = attributes[(next.season * 30 + next.week + index) % attributes.length];
    if (player.attrs[attribute] >= playerAttributeCaps(player)[attribute]) continue;
    const pathId = pathByAttribute[attribute];
    const cost = resolveTrainingDrillForPath(next, pathId).tpCost;
    if (cost > next.trainingPoints) continue;
    try {
      next = trainPlayerInstantly(next, player.id, pathId).state;
    } catch {
      continue; // a TRAINING_PRIORITY debt owns the next drills
    }
    drills += 1;
    spent += cost;
  }
  return { state: next, drills, spent };
}

/**
 * Plays one matchday with the real engine, then runs the post-match awakening
 * the application layer runs.
 *
 * Without the awakening the probe measures a career that never owns a power,
 * which is not the game: the first created hero is guaranteed after the
 * onboarding match. Heroes are worth roughly +4 league points a season in D5 at
 * an identical squad mean, and they are invisible to squadMeanFor because a
 * power is not an attribute.
 */
function playMatchday(state: GameState): GameState {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) throw new Error('matchday phase without an active fixture');
  const clubIds = [...new Set(matchday.fixtures.flatMap(f => [f.homeClubId, f.awayClubId]))];
  const teams = buildCareerMatchTeams(state, clubIds);
  const played = completeMatchday(state, matchday.fixtures.map(f => {
    const result = runMatch(f.matchSeed, teams[f.homeClubId], teams[f.awayClubId], [], {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    return { fixtureId: f.id, homeGoals: result.score[0], awayGoals: result.score[1] };
  }));
  if (matchday.kind !== 'league') return played;
  const userFixture = matchday.fixtures.find(f => (
    f.homeClubId === played.userClubId || f.awayClubId === played.userClubId
  ));
  if (userFixture === undefined) return played;
  const side = userFixture.homeClubId === played.userClubId
    ? teams[userFixture.homeClubId]
    : teams[userFixture.awayClubId];
  return awakenHero(played, userFixture.id, side.players.map(p => p.id));
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

/**
 * Licences whoever owns a power, up to the field cap. Never revokes one: an
 * unlicensed hero left in the XI fails the match boundary.
 */
function licenseHeroes(state: GameState): GameState {
  const powered = state.players.filter(p => p.clubId === state.userClubId && p.power !== undefined);
  if (powered.length === 0) return state;
  const licensed = powered.filter(p => p.licensed).map(p => p.id);
  const wanted = [...licensed, ...powered.filter(p => !p.licensed).map(p => p.id)]
    .slice(0, careerHeroLimit(state));
  if (wanted.length === licensed.length) return state;
  return selectCareerLicensedHeroes(state, wanted);
}

/**
 * Builds, then upgrades, a Training Pitch the moment the club can afford it.
 * The Pitch is the club's main TP income, so a probe that never builds one is
 * measuring the do-nothing floor rather than the intended play.
 */
function buildFacilities(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined || grid.construction !== undefined) return state;
  const pitch = grid.buildings.find(building => building.type === 'training-pitch');
  try {
    if (pitch === undefined) return buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;
    if (pitch.level < 2) return upgradeCareerFacility(state, pitch.id).state;
  } catch {
    return state; // cannot afford it yet
  }
  return state;
}

interface SeasonRow {
  season: number;
  division: number;
  position: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  promoted: boolean;
  /** Squad mean at season end, so growth per season is visible next to the bar. */
  squadMean: number;
  /**
   * Squad mean averaged over every match day. This, not squadMean, is the
   * number that belongs next to a points total: a squad that ends the season on
   * 54 but started it on 36 earned its points at neither value. Quoting the
   * end-of-season mean against a full season of results is what made an earlier
   * audit read "+12 stronger than the field and still 5th" as a contradiction.
   */
  playedSquadMean: number;
  fieldMean: number;
  drills: number;
  tpSpent: number;
  tpLeft: number;
  meanCondition: number;
  injured: number;
}

const ATTRS = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'] as const;

/** Mean of every outfield attribute across a club's match squad. */
function squadMeanFor(state: GameState, clubId: string): number {
  const team = buildCareerMatchTeams(state, [clubId])[clubId];
  const perPlayer = team.players.map(p => (
    ATTRS.reduce((sum, k) => sum + p.attrs[k], 0) / ATTRS.length
  ));
  return perPlayer.reduce((a, b) => a + b, 0) / perPlayer.length;
}

function playCareer(seed: number, train: boolean): SeasonRow[] {
  let state = newCareer(seed);
  const rows: SeasonRow[] = [];

  for (let season = 1; season <= SEASONS; season += 1) {
    const divisionBefore = state.m2?.pyramid.divisions
      .find(d => d.clubs.some(c => c.id === state.userClubId))?.level ?? 5;

    let seasonDrills = 0;
    let seasonSpent = 0;
    let guard = 0;
    const playedMeans: number[] = [];
    while (state.phase !== 'season-end') {
      if (guard++ > 400) throw new Error('season did not reach season-end');
      if (state.phase === 'manage') {
        state = licenseHeroes(state);
        if (train) {
          state = buildFacilities(state);
          const trained = trainWithWholeBank(state);
          state = trained.state;
          seasonDrills += trained.drills;
          seasonSpent += trained.spent;
        }
        state = advanceWeek(state);
      } else if (state.phase === 'matchday') {
        playedMeans.push(squadMeanFor(state, state.userClubId));
        state = playMatchday(state);
      } else {
        throw new Error(`unexpected phase ${state.phase}`);
      }
    }

    const table = leagueStandings(state);
    const mine = table.find(row => row.clubId === state.userClubId);
    if (mine === undefined) throw new Error('user club missing from its own table');
    const divisionNow = state.m2?.pyramid.divisions
      .find(d => d.clubs.some(c => c.id === state.userClubId));
    const rivalMeans = (divisionNow?.clubs ?? [])
      .filter(c => c.id !== state.userClubId)
      .map(c => squadMeanFor(state, c.id));
    rows.push({
      season,
      division: divisionBefore,
      position: mine.position,
      points: mine.points,
      goalsFor: mine.goalsFor,
      goalsAgainst: mine.goalsAgainst,
      promoted: mine.position <= 2,
      meanCondition: (() => {
        const mine = state.players.filter(p => p.clubId === state.userClubId);
        return mine.reduce((sum, p) => sum + (p.condition ?? 100), 0) / Math.max(1, mine.length);
      })(),
      injured: state.players.filter(p => (
        p.clubId === state.userClubId && (p.injuryWeeks ?? 0) > 0
      )).length,
      drills: seasonDrills,
      tpSpent: seasonSpent,
      tpLeft: state.trainingPoints,
      squadMean: squadMeanFor(state, state.userClubId),
      playedSquadMean: playedMeans.length === 0
        ? 0
        : playedMeans.reduce((a, b) => a + b, 0) / playedMeans.length,
      fieldMean: rivalMeans.length === 0
        ? 0
        : rivalMeans.reduce((a, b) => a + b, 0) / rivalMeans.length,
    });

    for (const player of state.players.filter(c => (
      c.clubId === state.userClubId
      && c.contractSeasonsRemaining === 0
      && !willRetireAtSeasonTransition(c, state.season)
    ))) {
      state = renewCareerPlayer(state, player.id, 4, 1);
    }
    state = startNextSeason(state);
  }
  return rows;
}

describeProbe('division ramp', () => {
  it('reports how many seasons Division 5 actually takes', () => {
    const lines = ['', '=== D5 RAMP: real engine for all 90 fixtures per season ==='];
    // Both profiles matter now that training and building can actually promote:
    // the idle run is the control that proves the difficulty still means
    // something. It was pinned to [true] while nobody could escape either way.
    for (const train of [true, false]) {
      lines.push('', `--- manager: ${train ? 'trains weekly' : 'never trains'} ---`);
      lines.push(
        'seed        season div pos  pts   GF  GA played   end field'
        + ' drills cond inj  promoted',
      );
      const promotedBySeason: number[] = [];
      for (const seed of SEEDS) {
        const rows = playCareer(seed, train);
        for (const r of rows) {
          lines.push(
            `${String(seed).padStart(10)} ${String(r.season).padStart(6)}`
            + ` ${String(r.division).padStart(3)} ${String(r.position).padStart(3)}`
            + ` ${String(r.points).padStart(4)} ${String(r.goalsFor).padStart(4)}`
            + ` ${String(r.goalsAgainst).padStart(3)}`
            + ` ${r.playedSquadMean.toFixed(1).padStart(6)}`
            + ` ${r.squadMean.toFixed(1).padStart(5)} ${r.fieldMean.toFixed(1).padStart(5)}`
            + ` ${String(r.drills).padStart(6)} ${r.meanCondition.toFixed(0).padStart(4)} ${String(r.injured).padStart(3)}`
            + `  ${r.promoted ? 'YES' : 'no'}`,
          );
        }
        const firstPromotion = rows.find(r => r.promoted);
        promotedBySeason.push(firstPromotion?.season ?? 0);
      }
      const escaped = promotedBySeason.filter(s => s > 0);
      lines.push(
        `SUMMARY promoted ${escaped.length}/${SEEDS.length} careers`
        + (escaped.length > 0
          ? `; first promotion in season ${escaped.join(',')}`
          : '; NOBODY escaped D5'),
      );
      if (
        (train && (escaped.length !== SEEDS.length || Math.max(...escaped) > 2))
        || (!train && escaped.length !== 0)
      ) {
        // Keep the diagnostic evidence visible when an acceptance assertion fails.
        // eslint-disable-next-line no-console
        console.log(lines.join('\n'));
      }
      if (train) {
        expect(escaped).toHaveLength(SEEDS.length);
        expect(Math.max(...escaped)).toBeLessThanOrEqual(2);
      } else {
        expect(escaped).toHaveLength(0);
      }
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(SEEDS.length).toBeGreaterThan(0);
  }, 3_600_000);
});
