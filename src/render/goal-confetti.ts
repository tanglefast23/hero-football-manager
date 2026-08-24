// Pure geometry for the goal burst. Split out from GoalConfetti.tsx because the
// Jest env has no React Native: importing the component pulls in react-native
// and the suite dies on its Flow syntax, so the arithmetic lives here.

/** Burst, hang, drop, fade. The goal SFX clip is cut to exactly this long. */
export const GOAL_CONFETTI_MS = 2_200;
/** Dense enough to read as "everywhere" without a per-piece cost that shows. */
export const GOAL_CONFETTI_PIECE_COUNT = 220;
export const GOAL_CONFETTI_SPARSE_PIECE_COUNT = 60;
const COLORS = [
  '#edb54a',
  '#d94f52',
  '#5a8fd6',
  '#f4f1ea',
  '#5cb85c',
  '#f7d894',
  '#b06fd0',
  '#4fc3c7',
];
// The R2 low-discrepancy sequence: two irrational strides that scatter points
// evenly over the screen without clumping, which is what an `index % width`
// grid and a seeded random both get wrong at this density.
const STRIDE_X = 0.7548776662466927;
const STRIDE_Y = 0.5698402909980532;

/** Classic one-line hash. The strides place the pieces evenly, but reusing
 * them (or `index % n`) for fall distance made every piece with the same drop
 * line up along the lattice diagonals — visible as stripes mid-fall. */
function hash(index: number): number {
  return Math.abs(Math.sin((index + 1) * 12.9898) * 43758.5453) % 1;
}

export interface ConfettiPiece {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  /** How far this piece sinks over its life, in points. */
  readonly drop: number;
  readonly spin: string;
}

export function makeGoalConfetti(
  width: number,
  height: number,
  pieceCount = GOAL_CONFETTI_PIECE_COUNT,
): ConfettiPiece[] {
  return Array.from({ length: pieceCount }, (_unused, index) => {
    const w = 6 + (index % 3) * 3;
    const h = 9 + (index % 2) * 6;
    return {
      id: `goal-confetti-${index}`,
      left: (((index + 1) * STRIDE_X) % 1) * Math.max(width - w, 0),
      top: (((index + 1) * STRIDE_Y) % 1) * Math.max(height - h, 0),
      width: w,
      height: h,
      color: COLORS[index % COLORS.length],
      drop: 40 + hash(index) * 90,
      // Alternating direction, so the field does not appear to rotate as one.
      spin: `${(index % 2 === 0 ? 1 : -1) * (180 + hash(index + 977) * 540)}deg`,
    };
  });
}
