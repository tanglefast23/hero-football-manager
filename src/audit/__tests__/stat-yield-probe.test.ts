/**
 * OPT-IN DECISION PROBE:
 *   STAT_YIELD_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/stat-yield-probe.test.ts
 *
 * Asks whether the four proposed division-leader categories — goals, assists,
 * tackles won and saves — each produce enough events per season to fill a
 * leaderboard.
 *
 * Goals and saves are emitted directly by the engine, so they are only counted
 * here for scale. Assists are the open question: nothing in the sim emits one,
 * so an assist has to be reconstructed by walking back from each GOAL to a
 * preceding PASS to the scorer. If most goals arrive via turnovers, rebounds or
 * power activations, that reconstruction returns nothing and the midfielder
 * category is dead before it ships.
 *
 * Two reconstruction rules are measured side by side:
 *   strict — the pass must be the last thing that happened to the scorer.
 *            Walking back stops at a KICKOFF, an earlier GOAL, a SAVE (so a
 *            rebound is unassisted, as in real football) or a tackle won by the
 *            defending side (possession changed, so the pass did not create it).
 *   loose  — the most recent successful pass to the scorer at any point in the
 *            current passage of play. Generous; measured as the ceiling.
 *
 * Tackles are split by style because a power-assisted steal is emitted as a
 * real TACKLE and would otherwise silently inflate the defender category.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { buildCareerMatchTeams, createCareer } from '../../game';
import { runMatch } from '../../sim/match';
import type { MatchEvent, TeamDef } from '../../sim/types';

const describeProbe = process.env.STAT_YIELD_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

const MATCHES_PER_DIVISION = positiveIntegerEnv('STAT_YIELD_MATCHES', 90);
const CAREER_SEED = 4_000_000;
const POLICIES = { homePolicy: 'FIRE_WHEN_READY' as const, awayPolicy: 'FIRE_WHEN_READY' as const };

/**
 * Candidate "the pass must be recent" windows, in ticks. A half is HALF_TICKS
 * (1000) for 45 minutes, so one tick is ~2.7 seconds of match time.
 */
const GAP_WINDOWS = [1, 2, 3, 5, 10, 25] as const;

/** Slots 0-10 are the home eleven, 11-21 the away eleven; see gkIdx in engine.ts. */
function teamOfSlot(slot: number): 0 | 1 {
  return slot < 11 ? 0 : 1;
}

interface AssistCount {
  readonly strict: number;
  readonly loose: number;
  /**
   * Nothing at all happened between the pass and the goal — no other pass, no
   * shot, no miss, no tackle. The pass is unambiguously what created the goal.
   */
  readonly adjacent: number;
  /**
   * Like strict, but the walk-back also stops the moment the defending team
   * touches the ball at all — not only when it wins a tackle. This is the
   * closest the event log gets to "the pass and the goal were the same move".
   */
  readonly possession: number;
  /** Tick gap between the crediting pass and the goal, per strict assist. */
  readonly gaps: number[];
}

/**
 * Reconstructs assists for one finished match under both candidate rules.
 * Returns counts only — slot-to-player attribution is a separate concern and
 * does not change how many assists exist.
 */
function assistsIn(events: readonly MatchEvent[]): AssistCount {
  let strict = 0;
  let loose = 0;
  let adjacent = 0;
  let possession = 0;
  const gaps: number[] = [];

  for (let goalIndex = 0; goalIndex < events.length; goalIndex += 1) {
    const goal = events[goalIndex];
    if (goal.kind !== 'GOAL') continue;
    const scorer = goal.by;
    const scoringTeam = teamOfSlot(scorer);

    let strictOpen = true;
    let strictFound = false;
    let looseFound = false;
    let adjacentOpen = true;
    let adjacentFound = false;
    let possessionOpen = true;
    let possessionFound = false;
    let gap = -1;

    for (let index = goalIndex - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (event.kind === 'KICKOFF' || event.kind === 'GOAL') break;

      if (event.kind === 'PASS'
        && event.ok
        && event.to === scorer
        && event.from !== scorer
        && teamOfSlot(event.from) === scoringTeam) {
        if (strictOpen && !strictFound) {
          strictFound = true;
          gap = goal.t - event.t;
        }
        if (adjacentOpen) adjacentFound = true;
        if (possessionOpen) possessionFound = true;
        looseFound = true;
        break;
      }

      // Any other on-ball event between the pass and the goal means the pass
      // was not the thing that created it. The scorer's own shot is the one
      // exception: every goal is preceded by the shot that scored it.
      const scorersOwnShot = event.kind === 'SHOT' && event.by === scorer;
      if (!scorersOwnShot && (event.kind === 'PASS' || event.kind === 'SHOT'
        || event.kind === 'MISS' || event.kind === 'TACKLE' || event.kind === 'SAVE')) {
        adjacentOpen = false;
      }

      // Any on-ball action by the defending side ends the move.
      const actor = event.kind === 'PASS' ? event.from
        : (event.kind === 'SHOT' || event.kind === 'MISS' || event.kind === 'TACKLE'
          || event.kind === 'SAVE') ? event.by
          : undefined;
      if (actor !== undefined && teamOfSlot(actor) !== scoringTeam) possessionOpen = false;

      if (!strictOpen) continue;
      // A save means the goal came from a rebound; a tackle won by the other
      // side means possession turned over. Neither leaves an assist behind.
      if (event.kind === 'SAVE') strictOpen = false;
      if (event.kind === 'TACKLE' && event.won && teamOfSlot(event.by) === scoringTeam
        && teamOfSlot(event.on) !== scoringTeam) strictOpen = false;
    }

    if (strictFound) {
      strict += 1;
      gaps.push(gap);
    }
    if (looseFound) loose += 1;
    if (adjacentFound) adjacent += 1;
    if (possessionFound) possession += 1;
  }

  return { strict, loose, adjacent, possession, gaps };
}

interface Row {
  readonly division: number;
  readonly goals: number;
  readonly assistsStrict: number;
  readonly assistsLoose: number;
  readonly assistsAdjacent: number;
  readonly assistsPossession: number;
  readonly tacklesOpen: number;
  readonly tacklesPower: number;
  readonly saves: number;
  /** Share of strict assists whose pass landed within N ticks of the goal. */
  readonly within: Readonly<Record<number, number>>;
}

function play(division: number, home: TeamDef, away: TeamDef): Row {
  let goals = 0;
  let assistsStrict = 0;
  let assistsLoose = 0;
  let assistsAdjacent = 0;
  let assistsPossession = 0;
  let tacklesOpen = 0;
  let tacklesPower = 0;
  let saves = 0;
  const allGaps: number[] = [];

  for (let index = 0; index < MATCHES_PER_DIVISION; index += 1) {
    const seed = 900_000 + index * 7919;
    const result = runMatch(seed, home, away, [], POLICIES);
    goals += result.score[0] + result.score[1];
    const assists = assistsIn(result.events);
    assistsStrict += assists.strict;
    assistsLoose += assists.loose;
    assistsAdjacent += assists.adjacent;
    assistsPossession += assists.possession;
    allGaps.push(...assists.gaps);
    for (const event of result.events) {
      if (event.kind === 'SAVE') saves += 1;
      if (event.kind !== 'TACKLE' || !event.won) continue;
      if (event.style === 'power') tacklesPower += 1;
      else tacklesOpen += 1;
    }
  }

  const per = (total: number) => total / MATCHES_PER_DIVISION;
  const within: Record<number, number> = {};
  for (const window of GAP_WINDOWS) {
    within[window] = allGaps.length === 0
      ? 0
      : allGaps.filter(gap => gap <= window).length / allGaps.length;
  }
  return {
    division,
    goals: per(goals),
    assistsStrict: per(assistsStrict),
    assistsLoose: per(assistsLoose),
    assistsAdjacent: per(assistsAdjacent),
    assistsPossession: per(assistsPossession),
    tacklesOpen: per(tacklesOpen),
    tacklesPower: per(tacklesPower),
    saves: per(saves),
    within,
  };
}

describeProbe('division-leader stat yield', () => {
  it('reports whether each proposed category produces enough events to rank', () => {
    const state = createCareer(createLaunchCareerSetup(CAREER_SEED, undefined, content));
    const pyramid = state.m2?.pyramid;
    if (pyramid === undefined) throw new Error('the career must have a pyramid');

    const rows: Row[] = [];
    for (const division of [5, 3, 1]) {
      const clubs = pyramid.divisions.find(candidate => candidate.level === division)?.clubs ?? [];
      if (clubs.length < 4) throw new Error(`division ${division} has too few clubs`);
      const ranked = [...clubs].sort((left, right) => right.squadStrength - left.squadStrength);
      const teamsFor = (clubId: string) => buildCareerMatchTeams(state, [clubId])[clubId];
      const midA = ranked[Math.floor(ranked.length / 2) - 1];
      const midB = ranked[Math.floor(ranked.length / 2)];
      rows.push(play(division, teamsFor(midA.id), teamsFor(midB.id)));
    }

    // An 18-match league season is what a division-leader table actually spans.
    const SEASON_MATCHES = 18;
    const lines: string[] = [
      '',
      `=== STAT YIELD PER MATCH (${MATCHES_PER_DIVISION} peer matches per division) ===`,
      'div   goals  assist(adj)  assist(poss)  assist(strict)  assist(loose)  tackles(open)  tackles(power)   saves',
    ];
    for (const row of rows) {
      lines.push(
        `D${row.division} ${row.goals.toFixed(2).padStart(8)}`
        + ` ${row.assistsAdjacent.toFixed(2).padStart(12)}`
        + ` ${row.assistsPossession.toFixed(2).padStart(13)}`
        + ` ${row.assistsStrict.toFixed(2).padStart(15)}`
        + ` ${row.assistsLoose.toFixed(2).padStart(14)}`
        + ` ${row.tacklesOpen.toFixed(2).padStart(14)}`
        + ` ${row.tacklesPower.toFixed(2).padStart(15)}`
        + ` ${row.saves.toFixed(2).padStart(7)}`,
      );
    }
    lines.push('');
    lines.push(`=== PROJECTED CLUB TOTALS OVER AN ${SEASON_MATCHES}-MATCH SEASON (both sides) ===`);
    lines.push('div   goals  assist(strict)  assist(loose)  tackles(open)   saves   strict assist rate');
    for (const row of rows) {
      const season = (perMatch: number) => (perMatch * SEASON_MATCHES).toFixed(0).padStart(7);
      const rate = row.goals === 0 ? 0 : row.assistsStrict / row.goals;
      lines.push(
        `D${row.division} ${season(row.goals)}`
        + ` ${season(row.assistsStrict).padStart(15)}`
        + ` ${season(row.assistsLoose).padStart(14)}`
        + ` ${season(row.tacklesOpen).padStart(14)}`
        + ` ${season(row.saves).padStart(7)}`
        + ` ${`${(rate * 100).toFixed(0)}%`.padStart(18)}`,
      );
    }
    lines.push('');
    lines.push('=== HOW RECENT IS THE CREDITING PASS? (share of strict assists within N ticks) ===');
    lines.push(`div  ${GAP_WINDOWS.map(window => `<=${window}t`.padStart(7)).join('')}`);
    for (const row of rows) {
      lines.push(
        `D${row.division}  `
        + GAP_WINDOWS.map(window => `${(row.within[window] * 100).toFixed(0)}%`.padStart(7)).join(''),
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));

    expect(rows).toHaveLength(3);
  }, 600_000);
});

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
