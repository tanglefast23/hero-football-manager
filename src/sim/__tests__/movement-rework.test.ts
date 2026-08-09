import tables from '../formation-tables.json';
import {
  kickoffPos,
  tableTarget,
  BLEND_TICKS,
  GRID_COLS,
  GRID_ROWS,
} from '../movement-table';
import { movementTick, movementTargets, PRESSER_LEASE_TICKS } from '../engine';
import { createMatch, tick } from '../match';
import { ROVERS, UNITED } from '../teams';
import { PITCH_W, PITCH_H, dist, type Vec } from '../geometry';
import {
  CORRELATION_SEEDS,
  meanOffBallYVelocityCorrelation,
} from './helpers/y-correlation';
import type { MatchState } from '../types';

// Verification suite for the positional-table movement rework (m0.5, spec:
// docs/superpowers/specs/2026-07-18-positional-movement.md). Band thresholds
// were set from measured values with headroom — measurements recorded inline.

const CELLS = GRID_COLS * GRID_ROWS;
const rot = (v: Vec): Vec => ({ x: PITCH_W - v.x, y: PITCH_H - v.y });

describe('formation tables: validity', () => {
  it('has 10 slots x 35 cells x 2 phases of in-bounds fractions, and a 10-entry kickoff list', () => {
    expect(GRID_COLS).toBe(5);
    expect(GRID_ROWS).toBe(7);
    for (const phase of [
      tables.phases.inPossession,
      tables.phases.outOfPossession,
    ]) {
      expect(phase).toHaveLength(10);
      for (const slot of phase) {
        expect(slot).toHaveLength(CELLS);
        for (const cell of slot) {
          expect(cell).toHaveLength(2);
          for (const v of cell) {
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(1);
          }
        }
      }
    }
    expect(tables.kickoff).toHaveLength(10);
    for (const [x, y] of tables.kickoff) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0.5); // kickoff legality: own half (team-0 frame)
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('coherence: defenders hold goal-side of midfielders for defensive-third cells, both phases', () => {
    // Team-0 frame: own goal at y=1, defensive third = rows 5-6 (cell centers 0.786, 0.929).
    for (const [name, phase] of Object.entries(tables.phases)) {
      for (const row of [5, 6]) {
        for (let col = 0; col < GRID_COLS; col++) {
          const cell = row * GRID_COLS + col;
          const meanY = (slots: number[]) =>
            slots.reduce((a, s) => a + phase[s][cell][1], 0) / slots.length;
          const def = meanY([0, 1, 2, 3]);
          const mid = meanY([4, 5, 6, 7]);
          if (!(def > mid))
            throw new Error(
              `coherence: ${name} cell (${col},${row}) def ${def} !> mid ${mid}`,
            );
        }
      }
    }
  });
});

describe('sampling convention', () => {
  const BALLS: Vec[] = [];
  for (const x of [0, 137, 1700, 3400, 5100, 6663, 6800]) {
    for (const y of [0, 251, 2625, 5250, 7875, 10249, 10500])
      BALLS.push({ x, y });
  }

  it('property: team 1 target == 180-degree rotation of team 0 sampled at the rotated ball (exact)', () => {
    for (const inPoss of [true, false]) {
      for (let slot = 1; slot <= 10; slot++) {
        for (const ball of BALLS) {
          expect(tableTarget(1, slot, inPoss, ball)).toEqual(
            rot(tableTarget(0, slot, inPoss, rot(ball))),
          );
        }
      }
    }
  });

  it('targets are integer cm and in bounds across the sweep', () => {
    for (const team of [0, 1] as const) {
      for (const inPoss of [true, false]) {
        for (let slot = 1; slot <= 10; slot++) {
          for (const ball of BALLS) {
            const t = tableTarget(team, slot, inPoss, ball);
            expect(Number.isInteger(t.x) && Number.isInteger(t.y)).toBe(true);
            expect(t.x).toBeGreaterThanOrEqual(0);
            expect(t.x).toBeLessThanOrEqual(PITCH_W);
            expect(t.y).toBeGreaterThanOrEqual(0);
            expect(t.y).toBeLessThanOrEqual(PITCH_H);
          }
        }
      }
    }
  });

  it('cell-center convention: a ball at a cell center samples that cell entry exactly', () => {
    const cellW = PITCH_W / GRID_COLS;
    const cellH = PITCH_H / GRID_ROWS;
    for (const [col, row] of [
      [0, 0],
      [2, 3],
      [4, 6],
      [1, 5],
    ]) {
      const ball = { x: (col + 0.5) * cellW, y: (row + 0.5) * cellH };
      for (let slot = 1; slot <= 10; slot++) {
        const entry =
          tables.phases.outOfPossession[slot - 1][row * GRID_COLS + col];
        expect(tableTarget(0, slot, false, ball)).toEqual({
          x: Math.round(entry[0] * PITCH_W),
          y: Math.round(entry[1] * PITCH_H),
        });
      }
    }
  });
});

describe('asymmetry (ball far left)', () => {
  // Measured on the shipped table: near/far x-response ratio 2.04 out of
  // possession, 1.74 in possession; the far winger tucks inward in both.
  const left = { x: 340, y: 5250 };
  const center = { x: 3400, y: 5250 };

  it('near-side x-response is much larger than far-side, both phases', () => {
    for (const [inPoss, minRatio] of [
      [false, 1.5],
      [true, 1.4],
    ] as Array<[boolean, number]>) {
      const resp = (slot: number) =>
        Math.abs(
          tableTarget(0, slot, inPoss, left).x -
            tableTarget(0, slot, inPoss, center).x,
        );
      const near = (resp(1) + resp(5)) / 2; // LB + LM
      const far = (resp(4) + resp(8)) / 2; // RB + RM
      expect(near).toBeGreaterThan(far * minRatio);
    }
  });

  it('the far winger tucks inward, both phases', () => {
    for (const inPoss of [false, true]) {
      expect(tableTarget(0, 8, inPoss, left).x).toBeLessThan(
        tableTarget(0, 8, inPoss, center).x,
      );
    }
  });
});

describe('possession phases', () => {
  it('same cell, opposite phases: materially different shapes (measured 12.4k-14.8k cm L1 across probes)', () => {
    for (const ball of [
      { x: 3400, y: 5250 },
      { x: 3400, y: 8250 },
      { x: 1700, y: 2250 },
    ]) {
      let l1 = 0;
      for (let slot = 1; slot <= 10; slot++) {
        const a = tableTarget(0, slot, true, ball);
        const b = tableTarget(0, slot, false, ball);
        l1 += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      }
      expect(l1).toBeGreaterThan(6000);
    }
  });

  it('turnover blend: targets travel the old->new phase segment smoothly and settle within the staggered window', () => {
    const m = createMatch(1, ROVERS, UNITED); // phase = 0 after kickoff
    // Turnover to team 1; the new carrier is rigged out so the ball (and thus
    // the sampled cell) stays put while only the blend advances.
    m.ball = { kind: 'held', by: 16 };
    m.players[16].outUntilTick = 100000;
    const ball = { ...m.players[16].pos };
    const watched = [2, 6, 10]; // one slot per line (CB, AM-mid, SS) — slot 9 is the presser here (nearest to the rigged carrier), so his target is the ball, not the table
    const from = watched.map((s) => tableTarget(0, s, true, ball)); // team 0 was in possession
    const to = watched.map((s) => tableTarget(0, s, false, ball));
    let prev = movementTargets(m).slice();
    const MAX_WINDOW = BLEND_TICKS + 12; // blend + stagger headroom (max per-slot delay is 9)
    for (let k = 1; k <= MAX_WINDOW + 2; k++) {
      m.tick++;
      movementTick(m);
      const cur = movementTargets(m);
      watched.forEach((slot, i) => {
        const gap = dist(from[i], to[i]);
        const step = dist(prev[slot], cur[slot]);
        expect(step).toBeLessThanOrEqual(Math.ceil(gap / BLEND_TICKS) + 2); // smooth: never jumps
        // never further from the destination than the previous tick (monotone approach)
        expect(dist(cur[slot], to[i])).toBeLessThanOrEqual(
          dist(prev[slot], to[i]) + 2,
        );
      });
      prev = cur.slice();
    }
    watched.forEach((slot, i) => expect(prev[slot]).toEqual(to[i])); // settled on the new phase
  });

  it('stagger: per-slot settle ticks are spread, not shared-start (accepted deviation, spec disposition record)', () => {
    const m = createMatch(1, ROVERS, UNITED);
    m.ball = { kind: 'held', by: 16 };
    m.players[16].outUntilTick = 100000;
    const ball = { ...m.players[16].pos };
    const slots = [1, 2, 3, 4, 5, 6, 7, 8, 10]; // outfield minus slot 9 (the presser in this rig)
    // Only slots whose target actually moves across the phase flip can express
    // a settle tick; a from==to slot settles instantly regardless of delay.
    const blending = slots.filter((s) => {
      const from = tableTarget(0, s, true, ball);
      const to = tableTarget(0, s, false, ball);
      return from.x !== to.x || from.y !== to.y;
    });
    const to = new Map(
      blending.map((s) => [s, tableTarget(0, s, false, ball)]),
    );
    const settle = new Map<number, number>();
    for (let k = 0; k < BLEND_TICKS + 15; k++) {
      m.tick++;
      movementTick(m);
      const cur = movementTargets(m);
      for (const s of blending) {
        const t = to.get(s)!;
        if (!settle.has(s) && cur[s].x === t.x && cur[s].y === t.y)
          settle.set(s, m.tick);
      }
    }
    expect(settle.size).toBe(blending.length); // everyone settled inside the window
    const distinct = new Set(blending.map((s) => settle.get(s)!));
    // Shared-start would settle every blending slot on the SAME tick
    // (distinct.size === 1); the stagger spreads them.
    expect(distinct.size).toBeGreaterThanOrEqual(5);
  });
});

describe('spacing and support pressure', () => {
  it('role-band spacing holds; crowding and support pressure reported as metrics', () => {
    // Measured (seeds 1-5, all ticks, both teams): mean nearest-teammate
    // distance DEF 1291 / MID 1243 / FWD 1308 cm; crowding (<300cm) 0.79%;
    // support pressure (non-presser opponents within 1200 of the carrier)
    // 0.970 per held tick (re-measured at ba9fb4b, post-R1). Bands are
    // means-with-headroom, not per-tick minima: compact defending
    // legitimately bunches.
    const LINES: Record<string, number[]> = {
      DEF: [1, 2, 3, 4],
      MID: [5, 6, 7, 8],
      FWD: [9, 10],
    };
    const sums: Record<string, [number, number]> = {
      DEF: [0, 0],
      MID: [0, 0],
      FWD: [0, 0],
    };
    let crowd = 0,
      crowdN = 0,
      support = 0,
      supportN = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const m = createMatch(seed, ROVERS, UNITED);
      while (m.phase !== 'fulltime') {
        tick(m);
        for (const team of [0, 1]) {
          const base = team * 11;
          for (const [line, slots] of Object.entries(LINES)) {
            for (const s of slots) {
              let best = Infinity;
              for (let j = base + 1; j < base + 11; j++) {
                if (j === base + s) continue;
                best = Math.min(
                  best,
                  dist(m.players[base + s].pos, m.players[j].pos),
                );
              }
              sums[line][0] += best;
              sums[line][1]++;
              crowdN++;
              if (best < 300) crowd++;
            }
          }
        }
        if (m.ball.kind === 'held') {
          const c = m.ball.by;
          for (let i = 0; i < 22; i++) {
            if (
              m.players[i].team === m.players[c].team ||
              i === m.movement.presserIdx
            )
              continue;
            if (dist(m.players[i].pos, m.players[c].pos) < 1200) support++;
          }
          supportN++;
        }
      }
    }
    for (const line of ['DEF', 'MID', 'FWD']) {
      const mean = sums[line][0] / sums[line][1];
      expect(mean).toBeGreaterThan(600);
      expect(mean).toBeLessThan(2400);
    }
    const supportPressure = support / supportN;
    console.log(
      `SPACING metrics: crowding<300cm=${((crowd / crowdN) * 100).toFixed(2)}% supportPressure=${supportPressure.toFixed(3)}/held-tick`,
    );
    expect(supportPressure).toBeGreaterThan(0.2); // table shapes do produce non-presser pressure — measured, not assumed
  }, 60000);
});

describe('rigid-sheet defect metric', () => {
  it(`off-ball y-velocity correlation DROPS vs m0.4 (seeds 1-${CORRELATION_SEEDS})`, () => {
    // m0.4 baseline: 0.46059936294381776 (measured at commit 092bd91, this
    // helper, seeds 1-40, before any movement change; independently re-derived
    // to the last digit at the m0.5 spec review). Reworked engine at the tuned
    // V5 tables: 0.4135364714434378 (re-measured at ba9fb4b, post-R1 — the
    // 0.4129 figure in mid-range commit messages was measured pre-R1, before
    // zone-knockout trajectories shifted). Assert with margin so the drop is
    // structural, not rounding: anything above baseline-0.02 means the sheet
    // is creeping back — retune the generator, never this bound.
    const M04_BASELINE = 0.46059936294381776;
    const r = meanOffBallYVelocityCorrelation();
    console.log(`Y-VELOCITY CORRELATION: m0.4=${M04_BASELINE} now=${r}`);
    expect(r).toBeLessThan(M04_BASELINE - 0.02);
  }, 120000);
});

describe('presser lease', () => {
  function rig(): MatchState {
    const m = createMatch(3, ROVERS, UNITED);
    m.ball = { kind: 'held', by: 9 };
    m.players[9].pos = { x: 3400, y: 3000 };
    m.players[14].pos = { x: 3400, y: 4000 };
    m.players[16].pos = { x: 3400, y: 4100 };
    for (const idx of [11, 12, 13, 15, 17, 18, 19, 20, 21])
      m.players[idx].pos = { x: 400, y: 900 };
    return m;
  }

  it('holds the selected presser for the lease window even when a rival becomes nearer', () => {
    const m = rig();
    m.tick++;
    movementTick(m);
    expect(m.movement.presserIdx).toBe(14); // nearest at selection
    const since = m.movement.presserSinceTick;
    for (let k = 0; k < PRESSER_LEASE_TICKS - 1; k++) {
      // keep 16 clearly nearer than 14 the whole time — without the lease this flips instantly
      m.players[16].pos = {
        x: m.players[9].pos.x,
        y: m.players[9].pos.y + 300,
      };
      m.players[14].pos = {
        x: m.players[9].pos.x,
        y: m.players[9].pos.y + 900,
      };
      m.tick++;
      movementTick(m);
      if (m.tick < since + PRESSER_LEASE_TICKS)
        expect(m.movement.presserIdx).toBe(14);
    }
    // lease expired: reselection picks the (still nearer) 16
    m.players[16].pos = { x: m.players[9].pos.x, y: m.players[9].pos.y + 300 };
    m.players[14].pos = { x: m.players[9].pos.x, y: m.players[9].pos.y + 900 };
    m.tick++;
    movementTick(m);
    expect(m.movement.presserIdx).toBe(16);
  });

  it('an unavailable presser is released before the lease expires', () => {
    const m = rig();
    m.tick++;
    movementTick(m);
    expect(m.movement.presserIdx).toBe(14);
    m.players[14].outUntilTick = m.tick + 500;
    m.tick++;
    movementTick(m);
    expect(m.movement.presserIdx).toBe(16);
  });
});

describe('kickoff layout', () => {
  it('every player restarts inside their own half; the GK keeps the frozen kickoff spot', () => {
    const m = createMatch(7, ROVERS, UNITED);
    for (let i = 0; i < 22; i++) {
      if (m.ball.kind === 'held' && m.ball.by === i) continue; // kicking striker stands on the spot
      if (m.players[i].team === 0)
        expect(m.players[i].pos.y).toBeGreaterThanOrEqual(PITCH_H / 2);
      else expect(m.players[i].pos.y).toBeLessThanOrEqual(PITCH_H / 2);
    }
    // Frozen GK kickoff spot: the retired m0.4 anchor rule sampled at the center
    // spot, kept verbatim through the m0.6 angle-narrowing change (T7).
    expect(m.players[0].pos).toEqual({ x: 3400, y: 9408 });
    expect(kickoffPos(1, 0)).toEqual({ x: PITCH_W - 3400, y: PITCH_H - 9408 });
  });
});

describe('movementTargets (debug overlay query)', () => {
  it('is pure, deterministic, consumes no rng, and reports 22 integer-cm targets', () => {
    const m = createMatch(11, ROVERS, UNITED);
    for (let i = 0; i < 50; i++) tick(m);
    // JSON.stringify omits the rng closure, so it cannot detect a draw — count
    // draws through a delegating wrapper instead (a real draw fails this).
    let draws = 0;
    const inner = m.rng;
    m.rng = () => {
      draws++;
      return inner();
    };
    const before = JSON.stringify(m);
    const a = movementTargets(m);
    const b = movementTargets(m);
    expect(draws).toBe(0); // no rng consumed
    expect(JSON.stringify(m)).toBe(before); // no state mutation
    expect(a).toEqual(b);
    expect(a).toHaveLength(22);
    for (const t of a) {
      expect(Number.isInteger(t.x) && Number.isInteger(t.y)).toBe(true);
    }
  });

  it('players move toward the reported targets on the next movement tick', () => {
    const m = createMatch(11, ROVERS, UNITED);
    for (let i = 0; i < 30; i++) tick(m);
    const targets = movementTargets(m);
    const before = m.players.map((p) => ({ ...p.pos }));
    m.tick++;
    movementTick(m);
    for (let i = 0; i < 22; i++) {
      const d0 = dist(before[i], targets[i]);
      const d1 = dist(m.players[i].pos, targets[i]);
      expect(d1).toBeLessThanOrEqual(d0); // never moves away from its own reported target
    }
  });
});

describe('determinism', () => {
  it('double-run: positions and movement bookkeeping are byte-identical after 400 ticks', () => {
    const a = createMatch(5, ROVERS, UNITED);
    const b = createMatch(5, ROVERS, UNITED);
    for (let i = 0; i < 400; i++) {
      tick(a);
      tick(b);
    }
    expect(a.players.map((p) => p.pos)).toEqual(b.players.map((p) => p.pos));
    expect(a.movement).toEqual(b.movement);
    expect(a.events).toEqual(b.events);
  });
});
