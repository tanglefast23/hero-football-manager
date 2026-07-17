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

function startWindup(state: MatchState, idx: number, strength: number): void {
  state.players[idx].powerState = { kind: 'winding', untilTick: state.tick + WINDUP_TICKS, strength };
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
      if (p.outUntilTick <= state.tick) addGauge(state, idx, GAUGE_TRICKLE);
    } else if (p.powerState.kind === 'ready') {
      const waited = state.tick - p.powerState.sinceTick;
      const blind = p.team === 0 && state.blindAutoHome;
      if (p.firePolicy === 'FIRE_WHEN_READY') {
        if (blind || inUsefulContext(state, idx)) startWindup(state, idx, CONTEXT_AUTO_STRENGTH);
      } else if (waited >= HARD_DEADLINE_TICKS) {
        startWindup(state, idx, LAPSE_STRENGTH);
      } else if (waited >= READY_WINDOW_TICKS && inUsefulContext(state, idx)) {
        startWindup(state, idx, LAPSE_STRENGTH);
      }
    } else if (p.powerState.kind === 'winding') {
      if (state.tick >= p.powerState.untilTick) activatePower(state, idx, p.powerState.strength);
    } else if (p.powerState.kind === 'active') {
      if (state.tick >= p.powerState.untilTick) {
        p.powerState = { kind: 'idle' };
        p.gauge = 0;
      }
    }
  }
}

/** Task 12 replaces with real per-power effects. v1: 1-tick active flash. */
export function activatePower(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  emit(state, { t: state.tick, kind: 'POWER_FIRED', player: idx, power: p.def.power!, strength });
  p.powerState = { kind: 'active', untilTick: state.tick + 1, strength };
  p.gauge = 0;
}
