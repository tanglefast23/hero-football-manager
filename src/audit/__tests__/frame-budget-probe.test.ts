/**
 * SCRATCH PROBE (not a gate): polish-audit frame budget.
 *
 * Measures, on this machine's Node, the JS cost the UI thread must absorb — in PRODUCTION
 * shape. The recorded "fulltime sims 4 rival matches synchronously" premise predates the
 * rival-preload pump that ships today (src/ui/use-rival-preload.ts → createFixtureResolver;
 * matchday.ts falls back to quickResultForFixture only for fixtures the pump didn't finish).
 * So this probe measures three things:
 *   1. per-tick cost of a WATCHED user match, with a hero power granted and
 *      controlledMatchOptions — the game never runs a power-free, policy-free match;
 *   2. the pump's per-burst cost: 4 rival fixture resolvers advanced 8 ticks per burst
 *      (TICKS_PER_BURST in use-rival-preload.ts);
 *   3. the COLD WORST CASE: quickResultForFixture x 4 back-to-back — the player who taps
 *      straight to Quick Result before the pump has run. Always labeled cold, never typical.
 *
 * Node timings are order-of-magnitude honest for device (project record: the same path
 * measured ~571ms Node / ~2s phone-class Hermes). Results are written to
 * artifacts/polish-audit-2026-08-06/frame-budget.json; the assertions only prove the probe
 * ran and terminated — machine speed never gates CI.
 *
 * Run: npm run test:probe -- src/audit/__tests__/frame-budget-probe.test.ts
 * Spec: docs/superpowers/plans/2026-08-06-polish-audit-spec.md §7.3
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  createCareer,
} from '../../game';
import { createFixtureResolver, quickResultForFixture } from '../../game/matchday';
import { controlledMatchOptions } from '../../game/match-policy';
import { generateSeasonFixtures } from '../../game/schedule';
import { createMatch, tick } from '../../sim/match';
import type { PowerId, TeamDef } from '../../sim/types';

const content = loadLaunchContent();
const CAREER_SEED = 4_000_000;
const MAX_TICKS = 20_000; // hard guard — a match is ~2k ticks of 100ms, nowhere near this
const TICKS_PER_BURST = 8; // mirror of use-rival-preload.ts

interface TickStats {
  count: number;
  meanMs: number;
  p99Ms: number;
  worstMs: number;
  totalMs: number;
}

describe('frame-budget probe', () => {
  it('measures per-tick, pump-burst, and cold-worst-case spans', () => {
    const probe = buildProbeWorld();

    // 1. watched user match, production shape (hero + controlled options)
    const watched = timeMatchTicks(
      1234,
      grantPower(probe.user, 'SUPER_SPEED'),
      probe.opponent,
    );

    // 2. pump-burst spans over the 4 rival fixtures
    const burstMs: number[] = [];
    for (const fixture of probe.rivalFixtures) {
      const resolver = createFixtureResolver(fixture, probe.teamsByClubId);
      let guard = 0;
      while (!resolver.done && guard < MAX_TICKS / TICKS_PER_BURST) {
        const t0 = performance.now();
        resolver.advance(TICKS_PER_BURST);
        burstMs.push(performance.now() - t0);
        guard += 1;
      }
      expect(resolver.done).toBe(true);
    }

    // 3. cold worst case: all 4 rivals resolved synchronously, back-to-back
    const t0 = performance.now();
    for (const fixture of probe.rivalFixtures) {
      quickResultForFixture(fixture, probe.teamsByClubId);
    }
    const coldWorstCase4xMs = performance.now() - t0;

    const result = {
      node: process.version,
      commit: '96f45b1f',
      watchedMatch: watched,
      pump: { ...stats(burstMs), ticksPerBurst: TICKS_PER_BURST },
      coldWorstCase4xMs: round2(coldWorstCase4xMs),
    };
    const out = path.resolve('artifacts/polish-audit-2026-08-06/frame-budget.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
    // eslint-disable-next-line no-console
    console.log(`frame-budget probe: ${JSON.stringify(result)}`);

    expect(watched.count).toBeGreaterThan(0);
    expect(burstMs.length).toBeGreaterThan(0);
  }, 900_000);
});

function timeMatchTicks(seed: number, home: TeamDef, away: TeamDef): TickStats {
  const state = createMatch(seed, home, away, controlledMatchOptions(0, '4-4-2'));
  const tickMs: number[] = [];
  let guard = 0;
  while (state.phase === 'play' && guard < MAX_TICKS) {
    const t0 = performance.now();
    tick(state);
    tickMs.push(performance.now() - t0);
    guard += 1;
  }
  expect(guard).toBeLessThan(MAX_TICKS); // ends by reaching fulltime, never by the guard
  return stats(tickMs);
}

function buildProbeWorld(): {
  user: TeamDef;
  opponent: TeamDef;
  rivalFixtures: ReturnType<typeof generateSeasonFixtures>;
  teamsByClubId: Record<string, TeamDef>;
} {
  const state = addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(createLaunchCareerSetup(CAREER_SEED, undefined, content, 'COZY')),
    ),
    { name: 'Probe Rookie', ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 } },
  );
  const allIds = content.clubs.clubs.map((club) => club.id);
  const divisionIds = [
    state.userClubId,
    ...allIds.filter((id) => id !== state.userClubId),
  ].slice(0, 10);
  const nonUser = generateSeasonFixtures(divisionIds, 1, CAREER_SEED).filter(
    (fixture) =>
      fixture.homeClubId !== state.userClubId && fixture.awayClubId !== state.userClubId,
  );
  // Match weeks don't start at 1 (the season opener sits weeks into the calendar), so take
  // the earliest week that has rival fixtures — that IS the production settle shape.
  const firstWeek = Math.min(...nonUser.map((fixture) => fixture.week));
  const rivalFixtures = nonUser.filter((fixture) => fixture.week === firstWeek).slice(0, 4);
  expect(rivalFixtures.length).toBe(4); // the production shape: 4 rival fixtures per week
  const involved = [
    state.userClubId,
    ...new Set(rivalFixtures.flatMap((f) => [f.homeClubId, f.awayClubId])),
  ];
  const teamsByClubId = buildCareerMatchTeams(state, involved);
  const opponentId = involved.find((id) => id !== state.userClubId)!;
  return {
    user: teamsByClubId[state.userClubId],
    opponent: teamsByClubId[opponentId],
    rivalFixtures,
    teamsByClubId,
  };
}

/** Copied from strength-gap-probe: first FWD gets the power — production matches carry powers. */
function grantPower(team: TeamDef, power: PowerId): TeamDef {
  let granted = false;
  return {
    ...team,
    players: team.players.map((player) => {
      if (granted || player.role !== 'FWD') return player;
      granted = true;
      return { ...player, power };
    }),
  };
}

function stats(samples: number[]): TickStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    meanMs: round2(total / Math.max(1, sorted.length)),
    p99Ms: round2(sorted[Math.min(sorted.length - 1, Math.floor(0.99 * sorted.length))] ?? 0),
    worstMs: round2(sorted[sorted.length - 1] ?? 0),
    totalMs: round2(total),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
