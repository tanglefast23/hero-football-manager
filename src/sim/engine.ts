import { anchorFor } from './formation';
import { dist, dist2, moveToward, GOAL_CENTER_X, PITCH_W, PITCH_H, type Vec } from './geometry';
import { emit } from './events';
import { contest } from './contest';
import type { Attrs, MatchState, SimPlayer } from './types';

export function goalYFor(team: 0 | 1): number {
  return team === 0 ? 0 : PITCH_H;
}

export function isAvailable(state: MatchState, idx: number): boolean {
  return state.players[idx].outUntilTick <= state.tick;
}

/**
 * M1 fatigue hook: contested stats route through here. Deliberately raw in M0.
 * def.attrs must stay immutable at runtime — fatigue/power modifiers belong in
 * this function (or the powers queries), never in-place attrs mutation.
 */
export function effectiveStat(state: MatchState, idx: number, stat: keyof Attrs): number {
  return state.players[idx].def.attrs[stat];
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
    if (!isAvailable(state, i)) continue;
    const p = state.players[i];
    p.pos = anchorFor(p.team, i % 11, center);
  }
  let striker = toTeam === 0 ? 9 : 20;
  if (!isAvailable(state, striker)) {
    const base = toTeam === 0 ? 0 : 11;
    for (let s = base + 10; s >= base; s--) {
      if (isAvailable(state, s)) { striker = s; break; }
    }
  }
  state.players[striker].pos = { ...center };
  state.ball = { kind: 'held', by: striker };
}

export function movementTick(state: MatchState): void {
  const ball = ballPos(state);
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    if (!isAvailable(state, i)) continue;
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

export const PASS_SPEED = 250;

/** Task 11 replaces with the real gauge (import from ./powers). */
export function addGauge(_state: MatchState, _idx: number, _amount: number): void {}

export function nearestOpponent(state: MatchState, idx: number): number {
  const me = state.players[idx];
  let best = -1, bestD2 = Infinity;
  for (let i = 0; i < 22; i++) {
    const o = state.players[i];
    if (o.team === me.team || !isAvailable(state, i)) continue;
    const d2 = dist2(o.pos, me.pos);
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return best;
}

function bestPassTarget(state: MatchState, from: number): number {
  const me = state.players[from];
  const gy = goalYFor(me.team);
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < 22; i++) {
    const mate = state.players[i];
    if (i === from || mate.team !== me.team || !isAvailable(state, i)) continue;
    const d2 = dist2(mate.pos, me.pos);
    if (d2 < 400 * 400 || d2 > 3500 * 3500) continue;
    const forwardness = Math.abs(mate.pos.y - gy);
    const marker = nearestOpponent(state, i);
    const space = marker === -1 ? 1000 : dist(state.players[marker].pos, mate.pos);
    const score = -forwardness + space * 2;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

export function possessionTick(state: MatchState): void {
  const b = state.ball;

  if (b.kind === 'loose') {
    b.pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
    b.vel = { x: Math.trunc(b.vel.x * 0.8), y: Math.trunc(b.vel.y * 0.8) };
    for (let i = 0; i < 22; i++) {
      if (!isAvailable(state, i)) continue;
      const p = state.players[i];
      if (dist2(p.pos, b.pos) < 150 * 150) {
        state.ball = { kind: 'held', by: i };
        addGauge(state, i, 8);
        return;
      }
    }
    return;
  }

  if (b.kind === 'pass') {
    const targetIdx = b.willSucceed ? b.to : (b.interceptor !== -1 ? b.interceptor : b.to);
    const target = state.players[targetIdx].pos;
    b.pos = moveToward(b.pos, target, PASS_SPEED);
    if (dist2(b.pos, target) < 150 * 150) {
      if (b.willSucceed || b.interceptor !== -1) {
        state.ball = { kind: 'held', by: targetIdx };
        addGauge(state, targetIdx, 8);
      } else {
        state.ball = { kind: 'loose', pos: { ...b.pos }, vel: { x: 0, y: 0 } };
      }
    }
    return;
  }

  if (b.kind !== 'held') return; // 'shot' handled in Task 10
  if (state.players[b.by].outUntilTick > state.tick) return; // unconscious carriers don't play (Task 7 review)
  if (state.tick % 5 !== 0) return;

  const carrierIdx = b.by;
  const carrier = state.players[carrierIdx];
  const gy = goalYFor(carrier.team);
  const goal = { x: GOAL_CENTER_X, y: gy };
  const toGoal = dist(carrier.pos, goal);
  const marker = nearestOpponent(state, carrierIdx);
  const pressured = marker !== -1 && dist2(state.players[marker].pos, carrier.pos) < 400 * 400;

  if (toGoal < 2500 && carrier.def.role !== 'GK') {
    attemptShot(state, carrierIdx, toGoal); // real implementation in Task 10
    return;
  }

  // rng draw order here is replay-load-bearing: the draw happens only when unpressured, even if no pass results
  if (pressured || state.rng() < 0.35) {
    const to = bestPassTarget(state, carrierIdx);
    if (to !== -1) {
      const interceptorIdx = nearestOpponent(state, to);
      const interceptStat = interceptorIdx === -1 ? 20 : effectiveStat(state, interceptorIdx, 'def');
      const ok = contest(state.rng, effectiveStat(state, carrierIdx, 'pas'), interceptStat, 10);
      emit(state, { t: state.tick, kind: 'PASS', from: carrierIdx, to, ok });
      state.ball = { kind: 'pass', pos: { ...carrier.pos }, from: carrierIdx, to, willSucceed: ok, interceptor: interceptorIdx };
    }
  }
}

/** Task 10 replaces with real shooting. */
export function attemptShot(_state: MatchState, _by: number, _distToGoal: number): void {}
