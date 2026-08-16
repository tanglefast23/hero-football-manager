import { createMatch, tick } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { TeamDef, MatchEvent } from '../../sim/types';

/**
 * Throwaway measurement: how `SHOT.power` is distributed at three stat scales,
 * and what fraction crosses the render ring's fixed `HARD_SHOT_POWER_MIN`.
 * Delete after reading; this is not an acceptance gate.
 */
const SEEDS = 24;
/** The retired absolute threshold, kept to show why it could not survive. */
const RETIRED_HARD_SHOT_POWER_MIN = 55;

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
  const powers: number[] = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const s = createMatch(seed, home, away);
    let seen = 0;
    while (s.phase !== 'fulltime') {
      tick(s);
      for (; seen < s.events.length; seen += 1) {
        const e: MatchEvent = s.events[seen];
        if (e.kind === 'SHOT') powers.push(e.power);
      }
    }
  }
  powers.sort((a, b) => a - b);
  const q = (f: number) => powers[Math.floor((powers.length - 1) * f)];
  return {
    shots: powers.length,
    perMatch: +(powers.length / SEEDS).toFixed(1),
    min: powers[0],
    p25: q(0.25),
    median: q(0.5),
    p75: q(0.75),
    p95: q(0.95),
    max: powers[powers.length - 1],
    pctOverThreshold: +(
      (100 * powers.filter((p) => p >= RETIRED_HARD_SHOT_POWER_MIN).length) /
      powers.length
    ).toFixed(1),
  };
}

test('shot power distribution across stat scales', () => {
  const rows = [1, 2, 4, 8].map((f) => ({
    scale: `x${f}`,
    ...census(scaled(ROVERS, f), scaled(UNITED, f)),
  }));
  // eslint-disable-next-line no-console
  console.table(rows);
  expect(rows).toHaveLength(4);
}, 300_000);
