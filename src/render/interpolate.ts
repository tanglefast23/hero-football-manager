// Pure TS render-frame math: no React Native / Skia / Expo imports, no
// Math.random / Date.now — safe to unit test headless (same rule as src/sim/).
import { ballPos } from '../sim/engine';
import type { Vec } from '../sim/geometry';
import { ZONE_WINDOW_TICKS } from '../sim/powers';
import type { MatchState } from '../sim/types';

// No 'ready' state exists (Task 14 amendment ledger item 5) — a hero's
// zone window is its own status, distinct from an ordinary idle 'ok'.
export type PlayerStatus = 'ok' | 'windup' | 'active' | 'out' | 'ignited' | 'zone';

export interface PitchFrame {
  players: Vec[];
  ball: Vec;
  carrier: number; // -1 when ball not held
  statuses: PlayerStatus[];
  zoneFraction: number[]; // remainingTicks / ZONE_WINDOW_TICKS while in zone, else 0
  moved: boolean[]; // true if a player's position changed vs the passed prevPositions
  ballShooting: boolean; // the ball is a live shot (drives the shot trail); a pass/loose/held ball is false
}

export function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Captures one tick's render-relevant state. `prevPositions`, when supplied,
 * is the caller's previous snapshot's `players` array (positions entering
 * this tick) — used only to derive `moved` (whether each player's position
 * changed as a result of simulating this tick, for run-cycle animation
 * selection; ledger item 4). Omit it for a standalone snapshot (e.g. the
 * very first frame at mount, before any tick has run) — `moved` then
 * defaults to false for every player.
 */
export function snapshotFrame(state: MatchState, prevPositions?: readonly Vec[]): PitchFrame {
  return {
    players: state.players.map((p) => ({ ...p.pos })),
    // Copy, don't alias: a held ball's ballPos IS the carrier's live pos
    // object (and a loose/pass/shot ball's pos is live sim state too).
    ball: { ...ballPos(state) },
    carrier: state.ball.kind === 'held' ? state.ball.by : -1,
    statuses: state.players.map((p): PlayerStatus => {
      if (p.outUntilTick > state.tick) return p.outReason === 'ignited' ? 'ignited' : 'out';
      if (p.powerState.kind === 'zone') return 'zone';
      if (p.powerState.kind === 'winding') return 'windup';
      if (p.powerState.kind === 'active') return 'active';
      return 'ok';
    }),
    zoneFraction: state.players.map((p) => (p.powerState.kind === 'zone' ? p.powerState.remainingTicks / ZONE_WINDOW_TICKS : 0)),
    moved: state.players.map((p, i) => prevPositions !== undefined && (p.pos.x !== prevPositions[i].x || p.pos.y !== prevPositions[i].y)),
    ballShooting: state.ball.kind === 'shot',
  };
}

/**
 * Blends only the continuous quantities (positions) between two snapshots.
 * Discrete per-tick state (statuses, carrier, zoneFraction, moved) snaps to
 * `next` — there is no meaningful "half status" to interpolate.
 */
export function lerpFrame(prev: PitchFrame, next: PitchFrame, t: number): PitchFrame {
  return {
    players: prev.players.map((p, i) => lerpVec(p, next.players[i], t)),
    ball: lerpVec(prev.ball, next.ball, t),
    carrier: next.carrier,
    statuses: next.statuses,
    zoneFraction: next.zoneFraction,
    moved: next.moved,
    ballShooting: next.ballShooting,
  };
}
