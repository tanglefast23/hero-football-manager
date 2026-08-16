import { createMatch, tick } from '../../sim/match';
import { keeperSaveProbability } from '../../sim/engine';
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef } from '../../sim/types';

/**
 * Throwaway measurement: the distribution of "danger" = 1 - keeperSaveProbability
 * at the instant each shot launches, and whether it holds its shape as stats scale.
 * Delete after reading.
 */
const SEEDS = 24;

function scaled(team: TeamDef, factor: number): TeamDef {
  return {
    ...team,
    id: `${team.id}-x${factor}`,
    players: team.players.map((p) => ({
      ...p,
      id: `${p.id}x${factor}`,
      attrs: Object.fromEntries(
        Object.entries(p.attrs).map(([k, v]) => [
          k,
          Math.max(1, Math.min(999, Math.round(v * factor))),
        ]),
      ) as unknown as typeof p.attrs,
    })),
  };
}

function census(home: TeamDef, away: TeamDef) {
  const danger: number[] = [];
  let onTarget = 0;
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const s = createMatch(seed, home, away);
    let airborne = false;
    while (s.phase !== 'fulltime') {
      tick(s);
      const b = s.ball;
      if (b.kind === 'shot') {
        if (!airborne) {
          airborne = true;
          const shooterTeam = s.players[b.by]?.team ?? 0;
          const gkIdx = shooterTeam === 0 ? 11 : 0;
          danger.push(1 - keeperSaveProbability(s, gkIdx, b.shotStrengthD64));
          if (Math.abs(b.targetX - 3400) <= 700) onTarget += 1;
        }
      } else airborne = false;
    }
  }
  danger.sort((a, b) => a - b);
  const q = (f: number) =>
    +danger[Math.floor((danger.length - 1) * f)].toFixed(3);
  const over = (x: number) =>
    +((100 * danger.filter((d) => d >= x).length) / danger.length).toFixed(1);
  return {
    shots: danger.length,
    onTargetPct: +((100 * onTarget) / danger.length).toFixed(1),
    min: q(0),
    p50: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    p95: q(0.95),
    max: q(1),
    'pct>=0.5': over(0.5),
    'pct>=0.7': over(0.7),
    'pct>=0.85': over(0.85),
  };
}

test('shot danger distribution across stat scales', () => {
  const rows = [1, 2, 4, 8].map((f) => ({
    scale: `x${f}`,
    ...census(scaled(ROVERS, f), scaled(UNITED, f)),
  }));
  // A keeper-relative danger number should hold its shape as stats scale.
  // eslint-disable-next-line no-console
  console.table(rows);
  expect(rows).toHaveLength(4);
}, 300_000);
