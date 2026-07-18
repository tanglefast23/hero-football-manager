import { createMatch, tick } from '../../match';
import { ROVERS, UNITED } from '../../teams';

// Off-ball y-velocity correlation — the "rigid sheet" measurement from the
// positional-movement spec's Verification section. High mean correlation means
// the formation translates as one sheet (the m0.4 defect: a uniform linear
// ball-pull gives every off-ball player the same y-signal); the rework must
// make this number DROP.
//
// Definition (fixed — the baseline constant in movement-rework.test.ts was
// measured with exactly this procedure):
// - Full default matches (ROVERS vs UNITED, no taps, default policies) on
//   seeds 1..CORRELATION_SEEDS.
// - Per tick, record each OUTFIELDER's y-delta. A player's tick sample is
//   dropped when they are out (before or after the tick), are the held-ball
//   carrier (before or after — carrier movement is ball logic, not shape
//   logic), or moved > TELEPORT_CM in one tick (restart repositioning is
//   placement, not movement).
// - For every SAME-TEAM outfield pair (2 × C(10,2) = 90 pairs), accumulate a
//   Pearson correlation over the ticks where both samples are valid; a
//   pair-seed series shorter than MIN_SAMPLES ticks or with zero variance is
//   skipped. The statistic is the mean over all pair-seed correlations.

export const CORRELATION_SEEDS = 40;
const TELEPORT_CM = 400; // > max legal per-tick move (~306 cm at pac 99, SUPER_SPEED burst)
const MIN_SAMPLES = 100;

const TEAM_OUTFIELD: ReadonlyArray<readonly number[]> = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
];

interface PairAcc { n: number; sa: number; sb: number; saa: number; sbb: number; sab: number; }

function newAcc(): PairAcc {
  return { n: 0, sa: 0, sb: 0, saa: 0, sbb: 0, sab: 0 };
}

function pearson(acc: PairAcc): number | undefined {
  if (acc.n < MIN_SAMPLES) return undefined;
  const cov = acc.sab - (acc.sa * acc.sb) / acc.n;
  const va = acc.saa - (acc.sa * acc.sa) / acc.n;
  const vb = acc.sbb - (acc.sb * acc.sb) / acc.n;
  if (va <= 0 || vb <= 0) return undefined;
  return cov / Math.sqrt(va * vb);
}

export function meanOffBallYVelocityCorrelation(seeds: number = CORRELATION_SEEDS): number {
  const correlations: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const m = createMatch(seed, ROVERS, UNITED);
    // accs[t] holds one accumulator per unordered pair of team t's outfielders
    const accs: PairAcc[][] = TEAM_OUTFIELD.map(ids => ids.flatMap((_, i) => ids.slice(i + 1).map(newAcc)));
    while (m.phase !== 'fulltime') {
      const prevY = m.players.map(p => p.pos.y);
      const prevCarrier = m.ball.kind === 'held' ? m.ball.by : -1;
      tick(m);
      const carrier = m.ball.kind === 'held' ? m.ball.by : -1;
      const dy: Array<number | undefined> = m.players.map((p, i) => {
        if (p.outUntilTick > m.tick || i === prevCarrier || i === carrier) return undefined;
        const d = p.pos.y - prevY[i];
        return Math.abs(d) > TELEPORT_CM ? undefined : d;
      });
      for (let t = 0; t < 2; t++) {
        const ids = TEAM_OUTFIELD[t];
        let pair = 0;
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++, pair++) {
            const a = dy[ids[i]], b = dy[ids[j]];
            if (a === undefined || b === undefined) continue;
            const acc = accs[t][pair];
            acc.n++; acc.sa += a; acc.sb += b;
            acc.saa += a * a; acc.sbb += b * b; acc.sab += a * b;
          }
        }
      }
    }
    for (const teamAccs of accs) {
      for (const acc of teamAccs) {
        const r = pearson(acc);
        if (r !== undefined) correlations.push(r);
      }
    }
  }
  return correlations.reduce((a, b) => a + b, 0) / correlations.length;
}
