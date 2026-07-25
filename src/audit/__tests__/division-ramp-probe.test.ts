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
 * most if you are not"): `trains` taps drills every week, `idle` never trains.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  completeMatchday,
  createCareer,
  leagueStandings,
  playerAttributeCaps,
  resolveTrainingDrillForPath,
  startNextSeason,
  trainPlayerInstantly,
  TRAINING_PATHS,
} from '../../game';
import { renewCareerPlayer } from '../../game/squad';
import { runMatch } from '../../sim/match';
import type { GameState } from '../../game';

const describeProbe = process.env.DIVISION_RAMP_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

const SEEDS = [4_000_000, 20_260_725];
const SEASONS = 2;

function newCareer(seed: number): GameState {
  return addCreatedPlayer(
    beginStoryOnboarding(createCareer(createLaunchCareerSetup(seed, undefined, content, 'COZY'))),
    { name: 'Ramp Probe', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );
}

/**
 * Spends the ENTIRE TP bank every week, across every eligible player.
 *
 * An earlier version of this probe capped at three drills a week, copied from
 * active-manager-balance's "sustainable cadence" helper. That cap does not exist
 * in the game: trainPlayerInstantly gates on TP cost, injury, and the
 * TRAINING_PRIORITY debt only, and pushing condition below
 * OVERTRAINING_CONDITION_THRESHOLD is an injury GAMBLE, not a block. Capping the
 * probe therefore under-trained the squad and made development look weaker than
 * it is. Drill spend is now limited only by the bank, which is what the player
 * actually experiences.
 */
function trainWithWholeBank(state: GameState): { state: GameState; drills: number; spent: number } {
  let next = state;
  let drills = 0;
  let spent = 0;
  // Re-rank after every tap: a drill changes headroom, condition and the bank.
  for (let guard = 0; guard < 200; guard += 1) {
    const roster = next.players.filter(p => (
      p.clubId === next.userClubId && (p.injuryWeeks ?? 0) === 0
    ));
    const candidates = roster.flatMap(p => {
      const caps = playerAttributeCaps(p);
      return TRAINING_PATHS
        .map(path => ({
          playerId: p.id,
          pathId: path.pathId,
          room: caps[path.attribute] - p.attrs[path.attribute],
          condition: p.condition ?? 100,
        }))
        .filter(c => c.room > 0);
    }).sort((a, b) => b.condition - a.condition || b.room - a.room);

    let tapped = false;
    for (const c of candidates) {
      const cost = resolveTrainingDrillForPath(next, c.pathId).tpCost;
      if (cost > next.trainingPoints) continue;
      try {
        next = trainPlayerInstantly(next, c.playerId, c.pathId).state;
      } catch {
        continue; // a TRAINING_PRIORITY debt owns the next drills
      }
      drills += 1;
      spent += cost;
      tapped = true;
      break;
    }
    if (!tapped) break;
  }
  return { state: next, drills, spent };
}

/** Plays one matchday with the real engine for every fixture on it. */
function playMatchday(state: GameState): GameState {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) throw new Error('matchday phase without an active fixture');
  const clubIds = [...new Set(matchday.fixtures.flatMap(f => [f.homeClubId, f.awayClubId]))];
  const teams = buildCareerMatchTeams(state, clubIds);
  return completeMatchday(state, matchday.fixtures.map(f => {
    const result = runMatch(f.matchSeed, teams[f.homeClubId], teams[f.awayClubId], [], {
      homePolicy: 'FIRE_WHEN_READY',
      awayPolicy: 'FIRE_WHEN_READY',
    });
    return { fixtureId: f.id, homeGoals: result.score[0], awayGoals: result.score[1] };
  }));
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
  fieldMean: number;
  drills: number;
  tpSpent: number;
  tpLeft: number;
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
    while (state.phase !== 'season-end') {
      if (guard++ > 400) throw new Error('season did not reach season-end');
      if (state.phase === 'manage') {
        if (train) {
          const trained = trainWithWholeBank(state);
          state = trained.state;
          seasonDrills += trained.drills;
          seasonSpent += trained.spent;
        }
        state = advanceWeek(state);
      } else if (state.phase === 'matchday') {
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
      drills: seasonDrills,
      tpSpent: seasonSpent,
      tpLeft: state.trainingPoints,
      squadMean: squadMeanFor(state, state.userClubId),
      fieldMean: rivalMeans.length === 0
        ? 0
        : rivalMeans.reduce((a, b) => a + b, 0) / rivalMeans.length,
    });

    for (const player of state.players.filter(c => (
      c.clubId === state.userClubId && c.contractSeasonsRemaining === 0
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
    for (const train of [true]) {
      lines.push('', `--- manager: ${train ? 'trains weekly' : 'never trains'} ---`);
      lines.push('seed        season div pos  pts   GF  GA  promoted');
      const promotedBySeason: number[] = [];
      for (const seed of SEEDS) {
        const rows = playCareer(seed, train);
        for (const r of rows) {
          lines.push(
            `${String(seed).padStart(10)} ${String(r.season).padStart(6)}`
            + ` ${String(r.division).padStart(3)} ${String(r.position).padStart(3)}`
            + ` ${String(r.points).padStart(4)} ${String(r.goalsFor).padStart(4)}`
            + ` ${String(r.goalsAgainst).padStart(3)}`
            + ` ${r.squadMean.toFixed(1).padStart(5)} ${r.fieldMean.toFixed(1).padStart(5)}`
            + ` ${String(r.drills).padStart(6)} ${String(r.tpSpent).padStart(7)} ${String(r.tpLeft).padStart(6)}`
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
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(SEEDS.length).toBeGreaterThan(0);
  }, 3_600_000);
});
