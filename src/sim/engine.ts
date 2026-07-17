import { anchorFor } from './formation';
import { dist2, moveToward, PITCH_W, PITCH_H, type Vec } from './geometry';
import { emit } from './events';
import type { MatchState, SimPlayer } from './types';

export function goalYFor(team: 0 | 1): number {
  return team === 0 ? 0 : PITCH_H;
}

/** Authoritative speed: reads power state internally (Task 12 supplies the multiplier). */
export function speedFor(state: MatchState, idx: number): number {
  const p = state.players[idx];
  const conditionScale = 0.75 + 0.25 * (p.condition / 100);
  return Math.round((40 + p.def.attrs.pac) * conditionScale * speedMultiplier(state, idx));
}

/** Task 12 replaces via powers.ts re-import; v1 constant keeps the engine testable now. */
export function speedMultiplier(_state: MatchState, _idx: number): number {
  return 1;
}

export function ballPos(state: MatchState): Vec {
  const b = state.ball;
  return b.kind === 'held' ? state.players[b.by].pos : b.pos;
}

export function drainStamina(p: SimPlayer, movedFar: boolean): void {
  p.condition = Math.max(0, p.condition - (movedFar ? 0.02 : 0.005));
}

export function restartKickoff(state: MatchState, toTeam: 0 | 1): void {
  const center = { x: PITCH_W / 2, y: PITCH_H / 2 };
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    p.pos = anchorFor(p.team, i % 11, center);
  }
  const striker = toTeam === 0 ? 9 : 20;
  state.players[striker].pos = { ...center };
  state.ball = { kind: 'held', by: striker };
}

export function movementTick(state: MatchState): void {
  const ball = ballPos(state);
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    if (p.outUntilTick > state.tick) continue;
    if (p.outUntilTick !== 0) {
      if (p.outUntilTick !== Number.MAX_SAFE_INTEGER) {
        emit(state, { t: state.tick, kind: p.outReason === 'ignited' ? 'EXTINGUISHED' : 'RECOVERED', player: i });
      }
      p.outUntilTick = 0;
      p.outReason = undefined;
    }
    const isCarrier = state.ball.kind === 'held' && state.ball.by === i;
    const isPassReceiver = state.ball.kind === 'pass' && state.ball.to === i;
    const chaseLoose = state.ball.kind === 'loose' && dist2(p.pos, ball) < 1500 * 1500;
    const target: Vec = isCarrier
      ? { x: ball.x, y: goalYFor(p.team) === 0 ? Math.max(0, p.pos.y - 800) : Math.min(PITCH_H, p.pos.y + 800) }
      : isPassReceiver || chaseLoose ? ball
      : anchorFor(p.team, i % 11, ball);
    const before = p.pos;
    p.pos = moveToward(p.pos, target, speedFor(state, i));
    drainStamina(p, dist2(before, p.pos) > 6400);
  }
}
