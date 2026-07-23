// Pure TS render-frame math: no React Native / Skia / Expo imports, no
// Math.random / Date.now — safe to unit test headless (same rule as src/sim/).
import { ballHeight, ballPos } from '../sim/engine';
import type { Vec } from '../sim/geometry';
import { ARM_WINDOW_TICKS, ZONE_WINDOW_TICKS } from '../sim/powers';
import type { MatchState } from '../sim/types';
import { playerAt, RENDER_PLAYER_COUNT } from '../sim/entities';

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
  visible: boolean[]; // two reserved Decoy slots stay hidden while unused
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
  const entities = Array.from({ length: RENDER_PLAYER_COUNT }, (_, index) => playerAt(state, index));
  const positions = entities.map(player => player === undefined
    ? { x: -1000, y: -1000 }
    : { ...player.pos });
  const visible = entities.map(player => player !== undefined);
  return {
    players: positions,
    // Copy, don't alias: a held ball's ballPos IS the carrier's live pos
    // object (and a loose/pass/shot ball's pos is live sim state too).
    ball: { ...ballPos(state) },
    ballHeight: ballHeight(state),
    carrier: state.ball.kind === 'held' ? state.ball.by : -1,
    statuses: entities.map((p): PlayerStatus => {
      if (p === undefined) return 'out';
      if (p.outUntilTick > state.tick) return p.outReason === 'ignited' ? 'ignited' : 'out';
      if (p.slideTackle) return 'sliding';
      if (p.tackleRecoveryUntil > state.tick) return 'recovering';
      if (p.powerState.kind === 'zone' || p.powerState.kind === 'armed') return 'zone';
      if (p.powerState.kind === 'winding') return 'windup';
      if (p.powerState.kind === 'active') return 'active';
      return 'ok';
    }),
    zoneFraction: entities.map((p) => {
      if (p === undefined) return 0;
      if (p.powerState.kind === 'zone') return p.powerState.remainingTicks / ZONE_WINDOW_TICKS;
      if (p.powerState.kind === 'armed') return p.powerState.remainingTicks / ARM_WINDOW_TICKS;
      return 0;
    }),
    moved: positions.map((p, i) => previous !== undefined
      && visible[i] && previous.players[i].x >= 0
      && (p.x !== previous.players[i].x || p.y !== previous.players[i].y)),
    travel: positions.map((p, i) => {
      if (!previous || !visible[i] || previous.players[i].x < 0) return 0;
      const dx = p.x - previous.players[i].x;
      const dy = p.y - previous.players[i].y;
      return previous.travel[i] + Math.sqrt(dx * dx + dy * dy);
    }),
    visible,
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
    visible: next.visible,
    ballShooting: next.ballShooting,
  };
}
