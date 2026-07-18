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
// `role` picks the per-slot Y personality: FB fullback, CB1/CB2 staggered
// center-backs, WM wide mid, DM holding mid, AM attacking mid, TM target man,
// SS second striker.
const SLOTS = [
  { ax: 0.15, ay: 0.78, line: 'DEF', role: 'FB' },
  { ax: 0.38, ay: 0.80, line: 'DEF', role: 'CB1' },
  { ax: 0.62, ay: 0.80, line: 'DEF', role: 'CB2' },
  { ax: 0.85, ay: 0.78, line: 'DEF', role: 'FB' },
  { ax: 0.15, ay: 0.55, line: 'MID', role: 'WM' },
  { ax: 0.38, ay: 0.58, line: 'MID', role: 'DM' },
  { ax: 0.62, ay: 0.58, line: 'MID', role: 'AM' },
  { ax: 0.85, ay: 0.55, line: 'MID', role: 'WM' },
  { ax: 0.38, ay: 0.30, line: 'FWD', role: 'TM' },
  { ax: 0.62, ay: 0.30, line: 'FWD', role: 'SS' },
];

// Per-LINE X parameters: width scales the lateral spread around center, slide
// shifts the whole line toward the ball's side, near pulls the ball-side
// player toward the ball's x with a linear falloff over `reach` (this is what
// makes the near-side response >> far-side and tucks the far winger inward).
// attackRun (in possession): the ball-side player pushes forward a touch.
// press (out of possession): the ball-side player steps toward the ball's y
// line while the weak side holds; cover drops the WEAK-side player deeper —
// sign-opposed lateral y-responses (support pressure, measured not assumed).
// press/attackRun/cover use their own NARROW pressReach falloff, not the x
// reach: a wide falloff would give several teammates the same ball-y coupling
// at different gains (which is still one shared signal — correlation is
// scale-invariant); a narrow one makes pressing a hand-off duty that lateral
// ball movement passes from player to player.
const X_PARAMS = {
  inPossession: {
    // press IN possession = ball-side support: the nearest one-two teammates
    // converge toward the carrier's line (pass options, second balls after a
    // power KO frees the ball) — the narrow pressReach keeps it a duty, not a sheet.
    DEF: { width: 1.00, slide: 0.25, near: 0.25, reach: 0.45, pressReach: 0.20, attackRun: 0.05, press: 0.015, cover: 0.06 },
    MID: { width: 1.10, slide: 0.20, near: 0.30, reach: 0.45, pressReach: 0.22, attackRun: 0.14, press: 0.05, cover: 0.08 },
    FWD: { width: 1.15, slide: 0.15, near: 0.25, reach: 0.45, pressReach: 0.24, attackRun: 0.18, press: 0.05, cover: 0.04 },
  },
  outOfPossession: {
    DEF: { width: 0.72, slide: 0.26, near: 0.28, reach: 0.50, pressReach: 0.20, attackRun: 0, press: 0.06, cover: 0.06 },
    MID: { width: 0.68, slide: 0.35, near: 0.42, reach: 0.50, pressReach: 0.22, attackRun: 0, press: 0.10, cover: 0.08 },
    FWD: { width: 0.64, slide: 0.45, near: 0.35, reach: 0.50, pressReach: 0.24, attackRun: 0, press: 0.06, cover: 0.03 },
  },
};

// Per-ROLE Y parameters: each role tracks the ball's y ONLY inside its release
// window — y = lineY + follow * (clamp(by, winLo, winHi) - 0.5) — and holds
// flat outside it (strikers don't chase into their own box, defenders don't
// follow into the opponent's). The windows form a deliberately ragged MOSAIC
// across roles (fullbacks and wingers roam wide ranges, the staggered CBs and
// the holding mid guard narrow deep bands, the split strikers release at
// different heights), so any ball-y movement releases a different subset of
// the ten while the rest stay pinned. That per-slot zonal responsibility is
// what kills the m0.4 rigid sheet (the off-ball y-velocity correlation defect
// metric — one shared follow gain, however small, keeps every pair on one
// signal). minY/maxY stay as safety bands after the press/run/cover terms.
const Y_PARAMS = {
  inPossession: {
    // winHi caps on the back line make build-up outlets receive HIGHER up the
    // pitch (playing out under pressure): a deep keeper's easy 400-3500 outlet
    // sits inside the opposing forwards' camp, so regains happen in shooting
    // range instead of the keeper recycling forever.
    FB:  { lineY: 0.66, follow: 0.35, winLo: 0.35, winHi: 0.95, minY: 0.40, maxY: 0.90 },
    CB1: { lineY: 0.72, follow: 0.22, winLo: 0.55, winHi: 0.95, minY: 0.50, maxY: 0.90 },
    CB2: { lineY: 0.74, follow: 0.18, winLo: 0.60, winHi: 0.97, minY: 0.52, maxY: 0.92 },
    WM:  { lineY: 0.48, follow: 0.35, winLo: 0.15, winHi: 0.70, minY: 0.20, maxY: 0.80 },
    DM:  { lineY: 0.56, follow: 0.22, winLo: 0.40, winHi: 0.75, minY: 0.35, maxY: 0.82 },
    AM:  { lineY: 0.44, follow: 0.30, winLo: 0.15, winHi: 0.55, minY: 0.18, maxY: 0.75 },
    // Striker floors keep receiving positions just OUTSIDE the box — shots
    // then come from sane range (save-rate rail), not six-yard tap-ins.
    // winHi keeps strikers pinned high, OUT of a deepest-third carrier's 3500
    // pass range: build-up from one's own box cycles through mids (slow, safe)
    // instead of instant long balls to the front line.
    TM:  { lineY: 0.26, follow: 0.30, winLo: 0.08, winHi: 0.40, minY: 0.16, maxY: 0.55 },
    SS:  { lineY: 0.32, follow: 0.30, winLo: 0.12, winHi: 0.45, minY: 0.18, maxY: 0.60 },
  },
  outOfPossession: {
    // Three-tier defense, piecewise by ball cell (this is what a per-cell
    // table buys over any single linear response):
    // 1. COUNTER-PRESS cells — ball deep in the OPPONENT's third (by <
    //    pressTrigger): the WIDE MIDS jump to pressLine (only WM carries
    //    pressTrigger/pressLine params), hunting the keeper's outlets while
    //    the burst/pressure is on (post-shot regains).
    // 2. MID-BLOCK wall — ball at middle heights: winLo pins the midfield
    //    across the center, in a deep opposing carrier's path — a solo run
    //    must beat four mids, then the back line (GATE-2/GATE-3 regression
    //    guard: without the wall a speed burst crosses an open middle).
    // 3. DEEP HOLD — back-line maxY caps hold the last line at the edge of
    //    the box (m0.4's CBs stood ~0.80): defenders meet an arriving carrier
    //    at shot range — also what keeps the rival SUPER_STRENGTH CB inside
    //    his 1200 lock radius of carriers about to shoot.
    FB:  { lineY: 0.70, follow: 0.32, winLo: 0.50, winHi: 0.95, minY: 0.48, maxY: 0.87 },
    CB1: { lineY: 0.76, follow: 0.22, winLo: 0.55, winHi: 0.95, minY: 0.58, maxY: 0.85 },
    CB2: { lineY: 0.78, follow: 0.18, winLo: 0.60, winHi: 0.97, minY: 0.60, maxY: 0.815 },
    WM:  { lineY: 0.56, follow: 0.38, winLo: 0.30, winHi: 0.70, minY: 0.20, maxY: 0.82, pressTrigger: 0.25, pressLine: 0.17 },
    DM:  { lineY: 0.60, follow: 0.28, winLo: 0.38, winHi: 0.72, minY: 0.42, maxY: 0.82 },
    AM:  { lineY: 0.52, follow: 0.30, winLo: 0.30, winHi: 0.60, minY: 0.22, maxY: 0.78 },
    TM:  { lineY: 0.32, follow: 0.45, winLo: 0.10, winHi: 0.40, minY: 0.13, maxY: 0.62 },
    SS:  { lineY: 0.38, follow: 0.45, winLo: 0.12, winHi: 0.50, minY: 0.15, maxY: 0.68 },
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

// Ball-y STAIRCASE (the actual SWOS mechanism — coarse ball areas, discrete
// position shifts): each slot's followed ball-y snaps to the center of a
// step-wide band, with per-slot step SIZES and offset boundaries
// (incommensurate across slots). A slot holds its ground until the ball
// crosses ITS boundary, then steps — so a ball sweeping up the pitch moves
// the ten one at a time instead of dragging all of them along one continuous
// shared signal (the m0.4 rigid-sheet defect; smooth per-cell follow gains,
// however differentiated, keep every released pair co-tracking). Bilinear
// sampling across cells turns each step into a short one-cell ramp.
const stair = (v, step, offset) => (Math.floor((v - offset) / step) + 0.5) * step + offset;

function cellTarget(slot, phaseName, slotIdx, bx, by) {
  const px = X_PARAMS[phaseName][slot.line];
  const py = Y_PARAMS[phaseName][slot.role];
  const falloff = Math.max(0, 1 - Math.abs(bx - slot.ax) / px.reach);
  const pressFalloff = Math.max(0, 1 - Math.abs(bx - slot.ax) / px.pressReach);
  const x = 0.5 + (slot.ax - 0.5) * px.width + (bx - 0.5) * px.slide + (bx - slot.ax) * px.near * falloff;
  const step = 0.13 + slotIdx * 0.011;
  const steppedBy = clamp(stair(clamp(by, py.winLo, py.winHi), step, slotIdx * 0.031), py.winLo, py.winHi); // re-clamp: a step-center may overshoot the window
  let y = py.lineY + py.follow * (steppedBy - 0.5);
  if (py.pressTrigger !== undefined && by < py.pressTrigger) y = py.pressLine; // counter-press cells override the window model
  y += (by - y) * px.press * pressFalloff; // ball-side step toward the ball's y line
  y -= px.attackRun * pressFalloff;        // ball-side forward run in possession
  y += px.cover * (1 - pressFalloff);      // weak-side cover drop
  y = clamp(y, py.minY, py.maxY);
  return [round4(clamp(x, EDGE, 1 - EDGE)), round4(clamp(y, EDGE, 1 - EDGE))];
}

function buildPhase(name) {
  return SLOTS.map((slot, slotIdx) => {
    const cells = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        cells.push(cellTarget(slot, name, slotIdx, (col + 0.5) / COLS, (row + 0.5) / ROWS));
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
// Optional argv[2] output path lets the drift-guard test emit to scratch and
// byte-compare against the committed file (default stays the real target).
const outPath = process.argv[2] ?? 'src/sim/formation-tables.json';
writeFileSync(outPath, JSON.stringify(out));
console.log(`wrote ${outPath}: 2 phases x ${SLOTS.length} slots x ${COLS * ROWS} cells (+${KICKOFF.length} kickoff entries), ${overrides.length} override(s) applied`);
