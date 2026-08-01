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
 *
 * The second test asks the follow-up question the first one cannot: assists
 * exist in bulk, but WHO gets them. It compares three candidate midfield
 * metrics by position line over full division seasons.
 *
 * This probe measures; it does not guard. The always-on guard on assist supply
 * is `src/game/__tests__/assist-yield-rail.test.ts`, which runs in CI on the
 * ROVERS/UNITED fixtures and asserts a share of goals rather than a rate.
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { buildCareerMatchTeams, createCareer, generateSeasonFixtures } from '../../game';
import { attributedPlayerIndex } from '../../sim/entities';
import { createMatch, runMatch, tick } from '../../sim/match';
import type { MatchEvent, MatchState, Role, TeamDef } from '../../sim/types';

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

  it('compares three candidate midfield metrics by position line', () => {
    const lines: string[] = [];
    for (const careerSeed of MIDFIELD_CAREER_SEEDS) {
      for (const level of MIDFIELD_DIVISIONS) {
        const block = measureDivisionSeason(careerSeed, level);
        lines.push(...block);
        // Printed per division: a run this long that only reports at the end is
        // a run you cannot read until it finishes.
        // eslint-disable-next-line no-console
        console.log(block.join('\n'));
      }
    }
    expect(lines.length).toBeGreaterThan(0);
  }, 3_600_000);
});

// --- Which metric could carry the Midfielders board -------------------------
//
// The first test counts assists; it does not say who receives them. Measured on
// production division squads, almost all of them land on forwards, because in
// this engine an attacker receives the ball and carries it a long way, so the
// last teammate to hold it before the scorer is usually another forward.
//
// Three candidates are measured side by side over a whole division season
// (10 clubs, double round robin, 90 matches — what one board actually spans):
//
//   assists          what ships today: the engine's `assistedById` stamp.
//   passes completed PASS events with ok: true, credited to `from`.
//   chances created  the same walk-back as an assist, anchored on a SHOT
//                    instead of a GOAL. There are ~6x more shots than goals,
//                    so a thin midfield share can still fill a board.
//
// Production squads, not ROVERS/UNITED: the question is about role composition,
// and the test fixtures are not built to be representative of one.
const MIDFIELD_DIVISIONS = [5, 3, 1] as const;
/** Extra career seeds, comma separated, to check a finding is not one seed's. */
const MIDFIELD_CAREER_SEEDS = (process.env.STAT_YIELD_CAREER_SEEDS ?? String(CAREER_SEED))
  .split(',')
  .map((raw: string) => {
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed)) throw new Error(`bad career seed ${raw}`);
    return parsed;
  });
/** Week the LEADERS tab unlocks — a board nobody can read yet is not a board. */
const LEADERS_UNLOCK_WEEK = 10;
const ROLE_ORDER: readonly Role[] = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * One match's events with every entity index already resolved to a stable
 * player id. Resolving live, as the match runs, is the only way to be right
 * about both substitutions (a slot changes owner mid-match) and decoy clones
 * (entities 22/23 have no slot of their own).
 */
interface ResolvedEvent {
  readonly kind: 'PASS' | 'SHOT' | 'GOAL' | 'SAVE' | 'MISS' | 'TACKLE' | 'KICKOFF';
  readonly team: 0 | 1;
  readonly byId?: string;
  readonly toId?: string;
  readonly ok?: boolean;
  readonly assistedById?: string;
}

function resolveMatch(seed: number, home: TeamDef, away: TeamDef): ResolvedEvent[] {
  const state: MatchState = createMatch(seed, home, away, POLICIES);
  const resolved: ResolvedEvent[] = [];
  const idOf = (entity: number): string | undefined =>
    state.players[attributedPlayerIndex(state, entity)]?.def.id;
  const teamOf = (entity: number): 0 | 1 =>
    state.players[attributedPlayerIndex(state, entity)]?.team ?? teamOfSlot(entity);

  let read = 0;
  while (state.phase !== 'fulltime') {
    tick(state);
    for (; read < state.events.length; read += 1) {
      const event = state.events[read];
      if (event.kind === 'PASS') {
        resolved.push({
          kind: 'PASS', team: teamOf(event.from), byId: idOf(event.from),
          toId: idOf(event.to), ok: event.ok,
        });
      } else if (event.kind === 'SHOT') {
        resolved.push({ kind: 'SHOT', team: teamOf(event.by), byId: idOf(event.by) });
      } else if (event.kind === 'GOAL') {
        resolved.push({
          kind: 'GOAL', team: event.team, byId: idOf(event.by),
          ...(event.assistedById === undefined ? {} : { assistedById: event.assistedById }),
        });
      } else if (event.kind === 'SAVE' || event.kind === 'MISS' || event.kind === 'TACKLE') {
        resolved.push({ kind: event.kind, team: teamOf(event.by), byId: idOf(event.by) });
      } else if (event.kind === 'KICKOFF') {
        resolved.push({ kind: 'KICKOFF', team: 0 });
      }
    }
  }
  return resolved;
}

/**
 * The teammate whose successful pass put the ball at the shooter's feet, or
 * undefined if the shot did not come from one. Walks back the way the assist
 * rule clears its candidate: a restart, a goal, a save or any touch by the
 * defending side ends the move.
 */
function chanceCreator(events: readonly ResolvedEvent[], shotIndex: number): string | undefined {
  const shot = events[shotIndex];
  for (let index = shotIndex - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind === 'KICKOFF' || event.kind === 'GOAL' || event.kind === 'SAVE') return undefined;
    if (event.team !== shot.team) return undefined;
    if (event.kind === 'PASS' && event.ok === true && event.toId === shot.byId) {
      return event.byId === shot.byId ? undefined : event.byId;
    }
  }
  return undefined;
}

type Tally = Map<string, number>;

interface MetricTallies {
  readonly assists: Tally;
  readonly passes: Tally;
  readonly chances: Tally;
  goals: number;
  shots: number;
}

function emptyTallies(): MetricTallies {
  return { assists: new Map(), passes: new Map(), chances: new Map(), goals: 0, shots: 0 };
}

function tallyMatch(events: readonly ResolvedEvent[], targets: readonly MetricTallies[]): void {
  const bump = (tally: Tally, playerId: string | undefined): void => {
    if (playerId === undefined) return;
    tally.set(playerId, (tally.get(playerId) ?? 0) + 1);
  };

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.kind === 'PASS' && event.ok === true) {
      for (const target of targets) bump(target.passes, event.byId);
    } else if (event.kind === 'GOAL') {
      for (const target of targets) {
        target.goals += 1;
        bump(target.assists, event.assistedById);
      }
    } else if (event.kind === 'SHOT') {
      const creator = chanceCreator(events, index);
      for (const target of targets) {
        target.shots += 1;
        bump(target.chances, creator);
      }
    }
  }
}

function measureDivisionSeason(careerSeed: number, level: number): string[] {
  const state = createCareer(createLaunchCareerSetup(careerSeed, undefined, content));
  const pyramid = state.m2?.pyramid;
  if (pyramid === undefined) throw new Error('the career must have a pyramid');
  const division = pyramid.divisions.find(candidate => candidate.level === level);
  if (division === undefined) throw new Error(`no division ${level}`);

  const clubIds = division.clubs.map(club => club.id);
  const teams = buildCareerMatchTeams(state, clubIds);
  const roleById = new Map<string, Role>();
  for (const clubId of clubIds) {
    for (const player of [...teams[clubId].players, ...(teams[clubId].bench ?? [])]) {
      roleById.set(player.id, player.role);
    }
  }

  const season = emptyTallies();
  const atUnlock = emptyTallies();
  for (const fixture of generateSeasonFixtures(clubIds, 1, careerSeed)) {
    const events = resolveMatch(
      fixture.matchSeed,
      teams[fixture.homeClubId],
      teams[fixture.awayClubId],
    );
    tallyMatch(events, fixture.week <= LEADERS_UNLOCK_WEEK ? [season, atUnlock] : [season]);
  }

  const headcount: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const role of roleById.values()) headcount[role] += 1;

  const lines: string[] = [
    '',
    `=== D${level}, career seed ${careerSeed}: one division season `
    + `(${season.goals} goals, ${season.shots} shots over 90 matches) ===`,
    `squad make-up  ${ROLE_ORDER.map(role => `${role} ${headcount[role]}`).join('  ')}`,
    'metric                GK    DEF    MID    FWD  total |  GK%  DEF%  MID%  FWD% | MIDs>0  top-5 MID board',
  ];
  const report = (label: string, tally: Tally): void => {
    const byRole: Record<Role, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const [playerId, value] of tally) {
      const role = roleById.get(playerId);
      if (role !== undefined) byRole[role] += value;
    }
    const total = ROLE_ORDER.reduce((sum, role) => sum + byRole[role], 0);
    const share = (role: Role): string =>
      (total === 0 ? '0%' : `${((byRole[role] / total) * 100).toFixed(0)}%`).padStart(5);
    const mids = [...tally.entries()]
      .filter(([playerId]) => roleById.get(playerId) === 'MID')
      .map(([, value]) => value)
      .filter(value => value > 0)
      .sort((left, right) => right - left);
    lines.push(
      label.padEnd(18)
      + ROLE_ORDER.map(role => String(byRole[role]).padStart(7)).join('')
      + String(total).padStart(7)
      + ' |' + ROLE_ORDER.map(share).join('')
      + ' | ' + String(mids.length).padStart(6)
      + '  ' + (mids.slice(0, 5).join(', ') || '-'),
    );
  };
  report('assists', season.assists);
  report('passes', season.passes);
  report('chances', season.chances);
  report(`assists w<=${LEADERS_UNLOCK_WEEK}`, atUnlock.assists);
  report(`passes w<=${LEADERS_UNLOCK_WEEK}`, atUnlock.passes);
  report(`chances w<=${LEADERS_UNLOCK_WEEK}`, atUnlock.chances);
  return lines;
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
