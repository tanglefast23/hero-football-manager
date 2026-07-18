// Generates the positional-movement tables used by src/sim/movement-table.ts
// (spec: docs/superpowers/specs/2026-07-18-positional-movement.md). Emits
// src/sim/formation-tables.json: 10 outfield slots x 35 ball cells (5 cols x
// 7 rows, cell index = row * cols + col) x 2 possession phases of normalized
// [x, y] fractions, plus the dedicated kickoff layout. Everything is authored
// for team 0 (attacks toward y=0); the runtime mirrors/rotates for team 1.
// The emitted JSON is authoritative and always regenerable — NEVER hand-edit
// it; corrections go in scripts/formation-overrides.json and get applied here.
import { readFileSync, writeFileSync } from 'node:fs';

const COLS = 5;
const ROWS = 7;

// 4-4-2 home anchors (from the retired m0.4 ANCHORS_442, GK excluded — the
// keeper keeps its m0.4 behavior in src/sim/movement-table.ts this milestone).
// Slot order matches engine slots 1..10: LB CB CB RB / LM CM CM RM / ST ST.
const SLOTS = [
  { ax: 0.15, ay: 0.78, line: 'DEF' },
  { ax: 0.38, ay: 0.80, line: 'DEF' },
  { ax: 0.62, ay: 0.80, line: 'DEF' },
  { ax: 0.85, ay: 0.78, line: 'DEF' },
  { ax: 0.15, ay: 0.55, line: 'MID' },
  { ax: 0.38, ay: 0.58, line: 'MID' },
  { ax: 0.62, ay: 0.58, line: 'MID' },
  { ax: 0.85, ay: 0.55, line: 'MID' },
  { ax: 0.38, ay: 0.30, line: 'FWD' },
  { ax: 0.62, ay: 0.30, line: 'FWD' },
];

// Per-line shape parameters. X: width scales the lateral spread around center,
// slide shifts the whole line toward the ball's side, near pulls the ball-side
// player toward the ball's x with a linear falloff over `reach` (this is what
// makes the near-side response >> far-side and tucks the far winger inward).
// Y: lineY + follow * (ball.y - 0.5) banded to [minY, maxY] — the band clamps
// pin different lines in different ball cells, which (with the press/run terms
// below) breaks the m0.4 everyone-shares-one-y-signal rigid sheet.
// attackRun (in possession): the ball-side player pushes forward a touch.
// press (out of possession): the ball-side player steps toward the ball's y
// line while the weak side holds — lateral ball movement now moves different
// players' y in different directions.
const PHASE_PARAMS = {
  inPossession: {
    DEF: { width: 1.00, slide: 0.25, near: 0.25, reach: 0.45, lineY: 0.70, follow: 0.35, minY: 0.45, maxY: 0.88, attackRun: 0.02, press: 0 },
    MID: { width: 1.10, slide: 0.20, near: 0.30, reach: 0.45, lineY: 0.50, follow: 0.45, minY: 0.28, maxY: 0.75, attackRun: 0.06, press: 0 },
    FWD: { width: 1.15, slide: 0.15, near: 0.25, reach: 0.45, lineY: 0.28, follow: 0.35, minY: 0.10, maxY: 0.55, attackRun: 0.08, press: 0 },
  },
  outOfPossession: {
    DEF: { width: 0.72, slide: 0.30, near: 0.45, reach: 0.50, lineY: 0.78, follow: 0.30, minY: 0.55, maxY: 0.92, attackRun: 0, press: 0.30 },
    MID: { width: 0.68, slide: 0.35, near: 0.50, reach: 0.50, lineY: 0.60, follow: 0.40, minY: 0.38, maxY: 0.82, attackRun: 0, press: 0.45 },
    FWD: { width: 0.70, slide: 0.25, near: 0.20, reach: 0.50, lineY: 0.42, follow: 0.30, minY: 0.25, maxY: 0.72, attackRun: 0, press: 0.15 },
  },
};

// Dedicated kickoff layout (own half for team 0 = y >= 0.5; strikers outside
// the ~915 cm center circle — restartKickoff moves the kicking striker to the
// spot itself). Same slot order as SLOTS.
const KICKOFF = [
  [0.16, 0.84], [0.38, 0.86], [0.62, 0.86], [0.84, 0.84],
  [0.16, 0.66], [0.40, 0.68], [0.60, 0.68], [0.84, 0.66],
  [0.40, 0.57], [0.60, 0.57],
];

const EDGE = 0.03; // global in-bounds margin
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const round4 = (v) => Math.round(v * 10000) / 10000;

function cellTarget(slot, params, bx, by) {
  const p = params[slot.line];
  const falloff = Math.max(0, 1 - Math.abs(bx - slot.ax) / p.reach);
  const x = 0.5 + (slot.ax - 0.5) * p.width + (bx - 0.5) * p.slide + (bx - slot.ax) * p.near * falloff;
  let y = p.lineY + p.follow * (by - 0.5);
  y += (by - y) * p.press * falloff; // ball-side step toward the ball's y line
  y -= p.attackRun * falloff;        // ball-side forward run in possession
  y = clamp(y, p.minY, p.maxY);
  return [round4(clamp(x, EDGE, 1 - EDGE)), round4(clamp(y, EDGE, 1 - EDGE))];
}

function buildPhase(name) {
  const params = PHASE_PARAMS[name];
  return SLOTS.map((slot) => {
    const cells = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        cells.push(cellTarget(slot, params, (col + 0.5) / COLS, (row + 0.5) / ROWS));
      }
    }
    return cells;
  });
}

const phases = { inPossession: buildPhase('inPossession'), outOfPossession: buildPhase('outOfPossession') };

// Apply the committed hand-correction overrides on top of the model.
const { overrides } = JSON.parse(readFileSync('scripts/formation-overrides.json', 'utf8'));
for (const o of overrides) {
  const table = phases[o.phase];
  if (!table || !(o.slot >= 0 && o.slot < SLOTS.length) || !(o.col >= 0 && o.col < COLS) || !(o.row >= 0 && o.row < ROWS)) {
    throw new Error(`bad override: ${JSON.stringify(o)}`);
  }
  const cell = table[o.slot][o.row * COLS + o.col];
  if (o.x !== undefined) cell[0] = round4(clamp(o.x, 0, 1));
  if (o.y !== undefined) cell[1] = round4(clamp(o.y, 0, 1));
}

const out = { grid: { cols: COLS, rows: ROWS }, phases, kickoff: KICKOFF };
writeFileSync('src/sim/formation-tables.json', JSON.stringify(out));
console.log(`wrote 2 phases x ${SLOTS.length} slots x ${COLS * ROWS} cells (+${KICKOFF.length} kickoff entries), ${overrides.length} override(s) applied`);
