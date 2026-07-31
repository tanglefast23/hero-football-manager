/**
 * OPT-IN DECISION PROBE:
 *   DIVISION_DECISIVENESS_PROBE=1 npm run test:probe -- \
 *     src/audit/__tests__/division-decisiveness-probe.test.ts
 *
 * Asks whether a match stays decisive as the pyramid climbs.
 *
 * The division-entry probe found a promoted club drawing 20 of its first 25 D3
 * matches while 87 rating points behind the field — not losing, drawing. That
 * measured the user's own fixtures only, so it could not tell a scaling problem
 * apart from something specific to an outmatched newcomer.
 *
 * This runs peers against peers. For each division it takes production-generated
 * clubs from the real pyramid and plays them against each other, so the only
 * thing changing between rows is the rating band the clubs were generated at.
 * If goals per match fall and draws climb as the division rises, the ladder
 * itself is flattening football rather than the promoted club being outclassed.
 *
 * Two arms per division:
 *   peer      — mid-table against mid-table, the ordinary weekly fixture
 *   mismatch  — the division's strongest against its weakest, which is where a
 *               decisive result should be easiest to produce
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { buildCareerMatchTeams, createCareer, type GameState } from '../../game';
import { runMatch } from '../../sim/match';
import type { Attrs, TeamDef } from '../../sim/types';
import { mean } from '../opening/stats';

const describeProbe = process.env.DIVISION_DECISIVENESS_PROBE === '1' ? describe : describe.skip;
const content = loadLaunchContent();

const SEEDS_PER_PAIRING = positiveIntegerEnv('DECISIVENESS_MATCHES', 120);
const CAREER_SEED = 4_000_000;
const ATTRS: readonly (keyof Attrs)[] = ['pac', 'sho', 'pas', 'def', 'tec', 'sta', 'ref'];
const POLICIES = { homePolicy: 'FIRE_WHEN_READY' as const, awayPolicy: 'FIRE_WHEN_READY' as const };

interface Row {
  readonly division: number;
  readonly pairing: 'peer' | 'mismatch';
  readonly homeMean: number;
  readonly awayMean: number;
  readonly goalsPerMatch: number;
  readonly drawRate: number;
  readonly nilNilRate: number;
  readonly strongerWinRate: number;
  readonly shotsPerMatch: number;
}

function squadMean(state: GameState, clubId: string): number {
  const team = buildCareerMatchTeams(state, [clubId])[clubId];
  return mean(team.players.map(player => (
    ATTRS.reduce((sum, key) => sum + player.attrs[key], 0) / ATTRS.length
  )));
}

function play(home: TeamDef, away: TeamDef, pairing: Row['pairing'], division: number,
  homeMean: number, awayMean: number): Row {
  let goals = 0;
  let draws = 0;
  let nilNil = 0;
  let strongerWins = 0;
  let shots = 0;
  const total = SEEDS_PER_PAIRING * 2;

  for (let index = 0; index < SEEDS_PER_PAIRING; index += 1) {
    // Each seed is played both ways so home advantage cannot colour the row.
    const seed = 700_000 + index * 7919;
    for (const [first, second, firstIsStronger] of [
      [home, away, homeMean >= awayMean] as const,
      [away, home, awayMean >= homeMean] as const,
    ]) {
      const result = runMatch(seed, first, second, [], POLICIES);
      const [firstGoals, secondGoals] = result.score;
      goals += firstGoals + secondGoals;
      if (firstGoals === secondGoals) draws += 1;
      if (firstGoals === 0 && secondGoals === 0) nilNil += 1;
      if (firstIsStronger ? firstGoals > secondGoals : secondGoals > firstGoals) strongerWins += 1;
      shots += result.events.filter(event => event.kind === 'SHOT').length;
    }
  }

  return {
    division,
    pairing,
    homeMean,
    awayMean,
    goalsPerMatch: goals / total,
    drawRate: draws / total,
    nilNilRate: nilNil / total,
    strongerWinRate: strongerWins / total,
    shotsPerMatch: shots / total,
  };
}

describeProbe('division decisiveness', () => {
  it('reports whether matches stay decisive as the pyramid climbs', () => {
    const state = createCareer(createLaunchCareerSetup(CAREER_SEED, undefined, content));
    const pyramid = state.m2?.pyramid;
    if (pyramid === undefined) throw new Error('the career must have a pyramid');

    const rows: Row[] = [];
    for (const division of [5, 4, 3, 2, 1]) {
      const clubs = pyramid.divisions.find(candidate => candidate.level === division)?.clubs ?? [];
      if (clubs.length < 4) throw new Error(`division ${division} has too few clubs`);
      const ranked = [...clubs].sort((left, right) => right.squadStrength - left.squadStrength);
      const teamsFor = (clubId: string) => buildCareerMatchTeams(state, [clubId])[clubId];

      const midA = ranked[Math.floor(ranked.length / 2) - 1];
      const midB = ranked[Math.floor(ranked.length / 2)];
      rows.push(play(
        teamsFor(midA.id), teamsFor(midB.id), 'peer', division,
        squadMean(state, midA.id), squadMean(state, midB.id),
      ));

      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      rows.push(play(
        teamsFor(best.id), teamsFor(worst.id), 'mismatch', division,
        squadMean(state, best.id), squadMean(state, worst.id),
      ));
    }

    const lines: string[] = [
      '',
      `=== DIVISION DECISIVENESS (${SEEDS_PER_PAIRING} seeds each way per pairing) ===`,
      'div  pairing    squad means      goals/match  draw%   0-0%  strongerWin%  shots/match',
    ];
    for (const row of rows) {
      lines.push(
        `D${row.division}   ${row.pairing.padEnd(9)}`
        + ` ${row.homeMean.toFixed(1).padStart(6)} v ${row.awayMean.toFixed(1).padStart(6)}`
        + ` ${row.goalsPerMatch.toFixed(2).padStart(12)}`
        + ` ${pct(row.drawRate).padStart(7)}`
        + ` ${pct(row.nilNilRate).padStart(6)}`
        + ` ${pct(row.strongerWinRate).padStart(13)}`
        + ` ${row.shotsPerMatch.toFixed(1).padStart(12)}`,
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    expect(rows).toHaveLength(10);
  }, 7_200_000);
});

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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
