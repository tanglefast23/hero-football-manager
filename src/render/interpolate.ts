// Pure TS render-frame math: no React Native / Skia / Expo imports, no
// Math.random / Date.now — safe to unit test headless (same rule as src/sim/).
import { ballHeight, ballPos } from '../sim/engine';
import type { Vec } from '../sim/geometry';
import { ARM_WINDOW_TICKS, ZONE_WINDOW_TICKS } from '../sim/powers';
import type { MatchState } from '../sim/types';

// No 'ready' state exists (Task 14 amendment ledger item 5) — a hero's
// zone window is its own status, distinct from an ordinary idle 'ok'.
export type PlayerStatus = 'ok' | 'windup' | 'active' | 'out' | 'ignited' | 'zone' | 'sliding' | 'recovering';

export interface PitchFrame {
  players: Vec[];
  ball: Vec;
  ballHeight: number; // centimetres above the pitch plane
  carrier: number; // -1 when ball not held
  statuses: PlayerStatus[];
  zoneFraction: number[]; // remainingTicks / ZONE_WINDOW_TICKS while in zone, else 0
  moved: boolean[]; // true if a player's position changed vs the passed previous frame
  travel: number[]; // cumulative render-only distance, used to keep foot cadence tied to motion
  ballShooting: boolean; // the ball is a live shot (drives the shot trail); a pass/loose/held ball is false
}

export function lerpVec(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/**
 * Captures one tick's render-relevant state. `previous`, when supplied, is
 * the caller's prior render snapshot (positions entering this tick plus its
 * accumulated visual travel). It derives `moved` and advances the run-cycle
 * distance without changing sim state. Omit it for the first frame at mount.
 */
export function snapshotFrame(state: MatchState, previous?: Pick<PitchFrame, 'players' | 'travel'>): PitchFrame {
  return {
    players: state.players.map((p) => ({ ...p.pos })),
    // Copy, don't alias: a held ball's ballPos IS the carrier's live pos
    // object (and a loose/pass/shot ball's pos is live sim state too).
    ball: { ...ballPos(state) },
    ballHeight: ballHeight(state),
    carrier: state.ball.kind === 'held' ? state.ball.by : -1,
    statuses: state.players.map((p): PlayerStatus => {
      if (p.outUntilTick > state.tick) return p.outReason === 'ignited' ? 'ignited' : 'out';
      if (p.slideTackle) return 'sliding';
      if (p.tackleRecoveryUntil > state.tick) return 'recovering';
      if (p.powerState.kind === 'zone' || p.powerState.kind === 'armed') return 'zone';
      if (p.powerState.kind === 'winding') return 'windup';
      if (p.powerState.kind === 'active') return 'active';
      return 'ok';
    }),
    zoneFraction: state.players.map((p) => {
      if (p.powerState.kind === 'zone') return p.powerState.remainingTicks / ZONE_WINDOW_TICKS;
      if (p.powerState.kind === 'armed') return p.powerState.remainingTicks / ARM_WINDOW_TICKS;
      return 0;
    }),
    moved: state.players.map((p, i) => previous !== undefined && (p.pos.x !== previous.players[i].x || p.pos.y !== previous.players[i].y)),
    travel: state.players.map((p, i) => {
      if (!previous) return 0;
      const dx = p.pos.x - previous.players[i].x;
      const dy = p.pos.y - previous.players[i].y;
      return previous.travel[i] + Math.sqrt(dx * dx + dy * dy);
    }),
    ballShooting: state.ball.kind === 'shot',
  };
}

/**
 * Blends only the continuous quantities (positions, travel) between two
 * snapshots. Discrete per-tick state (statuses, carrier, zoneFraction, moved,
 * ballShooting) snaps to `next` — there is no meaningful "half status".
 */
export function lerpFrame(prev: PitchFrame, next: PitchFrame, t: number): PitchFrame {
  return {
    players: prev.players.map((p, i) => lerpVec(p, next.players[i], t)),
    ball: lerpVec(prev.ball, next.ball, t),
    ballHeight: prev.ballHeight + (next.ballHeight - prev.ballHeight) * t,
    carrier: next.carrier,
    statuses: next.statuses,
    zoneFraction: next.zoneFraction,
    moved: next.moved,
    travel: prev.travel.map((distance, i) => distance + (next.travel[i] - distance) * t),
    ballShooting: next.ballShooting,
  };
}
