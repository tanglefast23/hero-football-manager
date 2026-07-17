import { emit } from './events';
import { dist2 } from './geometry';
import type { MatchState } from './types';

export const READY_WINDOW_TICKS = 80;
export const HARD_DEADLINE_TICKS = 120;
export const WINDUP_TICKS = 15;
export const TAP_STRENGTH = 1.0;
export const CONTEXT_AUTO_STRENGTH = 0.85;
export const LAPSE_STRENGTH = 0.75;
export const GAUGE_TRICKLE = 0.02;

export function addGauge(state: MatchState, idx: number, amount: number): void {
  const p = state.players[idx];
  if (!p.def.power || p.powerState.kind !== 'idle') return;
  p.gauge = Math.min(100, p.gauge + amount);
  if (p.gauge >= 100) {
    p.powerState = { kind: 'ready', sinceTick: state.tick };
    emit(state, { t: state.tick, kind: 'POWER_READY', player: idx });
  }
}

export function interruptWindup(state: MatchState, idx: number): void {
  const p = state.players[idx];
  if (p.powerState.kind !== 'winding') return;
  p.powerState = { kind: 'idle' };
  p.gauge = 50;
  emit(state, { t: state.tick, kind: 'POWER_INTERRUPTED', player: idx });
}

/** The "when should I fire?" answer, per power. Shown to players via chip glow. */
export function inUsefulContext(state: MatchState, idx: number): boolean {
  const p = state.players[idx];
  const power = p.def.power;
  if (!power) return false;
  const b = state.ball;
  const oppCarrierNear = (range: number) =>
    b.kind === 'held' && state.players[b.by].team !== p.team && dist2(state.players[b.by].pos, p.pos) < range * range;

  if (power === 'SUPER_STRENGTH') return oppCarrierNear(900);
  if (power === 'SUPER_SPEED') {
    return (b.kind === 'held' && b.by === idx) || (b.kind === 'loose' && dist2(b.pos, p.pos) < 1500 * 1500);
  }
  return (b.kind === 'held' && b.by === idx) || oppCarrierNear(800); // FIRE_TORCH
}

const STRENGTH_LOCK_RANGE = 1200;
const STRENGTH_LAND_RANGE = 400;

function startWindup(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  let targetIdx: number | undefined;
  if (p.def.power === 'SUPER_STRENGTH' && state.ball.kind === 'held') {
    const carrier = state.players[state.ball.by];
    if (carrier.team !== p.team && dist2(carrier.pos, p.pos) < STRENGTH_LOCK_RANGE * STRENGTH_LOCK_RANGE) {
      targetIdx = state.ball.by;
    }
  }
  p.powerState = { kind: 'winding', untilTick: state.tick + WINDUP_TICKS, strength, targetIdx };
}

export function powerTick(state: MatchState): void {
  const due = state.pendingInputs.filter(i => i.tick <= state.tick);
  state.pendingInputs = state.pendingInputs.filter(i => i.tick > state.tick);
  for (const input of due) {
    const p = state.players[input.player];
    if (input.kind === 'POWER_TAP' && p.powerState.kind === 'ready') {
      startWindup(state, input.player, TAP_STRENGTH);
    }
  }

  for (let idx = 0; idx < 22; idx++) {
    const p = state.players[idx];
    if (!p.def.power) continue;
    if (p.outUntilTick > state.tick) {
      if (p.powerState.kind === 'winding') interruptWindup(state, idx);
      continue; // out players neither charge nor fire (Task 7 review)
    }

    if (p.powerState.kind === 'idle') {
      addGauge(state, idx, GAUGE_TRICKLE);
    } else if (p.powerState.kind === 'ready') {
      const waited = state.tick - p.powerState.sinceTick;
      const blind = p.team === 0 && state.blindAutoHome;
      if (p.firePolicy === 'FIRE_WHEN_READY') {
        if (blind || inUsefulContext(state, idx)) startWindup(state, idx, CONTEXT_AUTO_STRENGTH);
        else if (waited >= HARD_DEADLINE_TICKS) startWindup(state, idx, LAPSE_STRENGTH);
      } else if (waited >= HARD_DEADLINE_TICKS) {
        startWindup(state, idx, LAPSE_STRENGTH);
      } else if (waited >= READY_WINDOW_TICKS && inUsefulContext(state, idx)) {
        startWindup(state, idx, LAPSE_STRENGTH);
      }
    } else if (p.powerState.kind === 'winding') {
      if (state.tick >= p.powerState.untilTick) activatePower(state, idx, p.powerState.strength, p.powerState.targetIdx);
    } else if (p.powerState.kind === 'active') {
      if (state.tick >= p.powerState.untilTick) {
        p.powerState = { kind: 'idle' };
        p.gauge = 0;
      }
    }
  }
}

const DUR = { SUPER_SPEED: 40, SUPER_STRENGTH: 80, FIRE_TORCH: 50 } as const;

export function isActive(state: MatchState, idx: number): boolean {
  const ps = state.players[idx].powerState;
  return ps.kind === 'active' && state.tick < ps.untilTick;
}

function sendOff(state: MatchState, idx: number): void {
  state.players[idx].outUntilTick = Number.MAX_SAFE_INTEGER;
  state.players[idx].outReason = 'redcard';
  emit(state, { t: state.tick, kind: 'CARD', player: idx, color: 'red' });
}

function rollCard(state: MatchState, idx: number, yellowP: number, redP: number): void {
  const r = state.rng();
  const p = state.players[idx];
  if (r < redP) {
    p.cards = 2;
    sendOff(state, idx);
  } else if (r < redP + yellowP) {
    p.cards = Math.min(2, p.cards + 1) as 0 | 1 | 2;
    emit(state, { t: state.tick, kind: 'CARD', player: idx, color: 'yellow' });
    if (p.cards === 2) sendOff(state, idx); // second yellow = red, real soccer rules (Task 5 review ruling)
  }
}

export function activatePower(state: MatchState, idx: number, strength: number, targetIdx?: number): void {
  const p = state.players[idx];
  const power = p.def.power!;
  emit(state, { t: state.tick, kind: 'POWER_FIRED', player: idx, power, strength });
  p.powerState = { kind: 'active', untilTick: state.tick + Math.round(DUR[power] * strength), strength };
  p.gauge = 0;

  if (power === 'FIRE_TORCH') {
    rollCard(state, idx, 0.15, 0);
    let nearest = -1, nearestD2 = 800 * 800;
    for (let i = 0; i < 22; i++) {
      const o = state.players[i];
      if (o.team === p.team || o.outUntilTick > state.tick) continue;
      const d2 = dist2(o.pos, p.pos);
      if (d2 < nearestD2) { nearestD2 = d2; nearest = i; }
    }
    if (nearest !== -1) {
      state.players[nearest].outUntilTick = state.tick + 100;
      state.players[nearest].outReason = 'ignited';
      emit(state, { t: state.tick, kind: 'IGNITED', player: nearest });
    }
  } else if (power === 'SUPER_STRENGTH') {
    rollCard(state, idx, 0.25, 0.05);
    if (p.outUntilTick <= state.tick && targetIdx !== undefined) {
      const target = state.players[targetIdx];
      if (target.outUntilTick <= state.tick && dist2(target.pos, p.pos) < STRENGTH_LAND_RANGE * STRENGTH_LAND_RANGE) {
        target.outUntilTick = state.tick + Math.round(80 * strength);
        target.outReason = 'ko';
        const hadBall = state.ball.kind === 'held' && state.ball.by === targetIdx;
        if (hadBall) state.ball = { kind: 'held', by: idx };
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: targetIdx, won: hadBall });
      }
    }
  }
}

export function speedMultiplier(state: MatchState, idx: number): number {
  return isActive(state, idx) && state.players[idx].def.power === 'SUPER_SPEED' ? 2.2 : 1;
}

export function dribbleBonus(state: MatchState, carrierIdx: number): number {
  if (!isActive(state, carrierIdx)) return 0;
  const power = state.players[carrierIdx].def.power;
  return power === 'SUPER_SPEED' ? 15 : power === 'FIRE_TORCH' ? 25 : 0;
}

export function fireSuppressed(state: MatchState, _tacklerIdx: number, carrierIdx: number): boolean {
  return isActive(state, carrierIdx) && state.players[carrierIdx].def.power === 'FIRE_TORCH';
}

export function defenseBonus(state: MatchState, idx: number): number {
  return isActive(state, idx) && state.players[idx].def.power === 'SUPER_STRENGTH' ? 35 : 0;
}
