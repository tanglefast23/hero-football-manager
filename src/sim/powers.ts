import { emit } from './events';
import { dist2 } from './geometry';
import type { MatchState, OutReason, PowerId } from './types';

export const WINDUP_TICKS = 15;
export const TAP_STRENGTH = 1.0;
export const CONTEXT_AUTO_STRENGTH = 0.85;
export const LAPSE_STRENGTH = 0.75;
export const GAUGE_TRICKLE = 0.02;

// In-the-Zone activation model (2026-07-17, replaces the fixed READY window):
// heat builds via addGauge, and above ZONE_HEAT_THRESHOLD each tick rolls a small
// seeded chance to enter a 7s Zone window (see powerTick). ZONE_ENTRY_RATE is the
// per-heat-point-above-threshold, per-tick roll rate — tuned so seeds 1-20 average
// ~1.5-3.5 zone entries per hero per match (docs/04 target: ~2-3).
export const ZONE_WINDOW_TICKS = 70;
export const ZONE_HEAT_THRESHOLD = 60;
export const ZONE_ENTRY_RATE = 0.0009;

// Charging Super Strength closes distance faster than normal movement (the
// windup telegraph is the counterplay window, not a free pass to escape it).
// 1.3 -> 1.4 (Task 12.2 follow-up): with context/lock widened to 1200, charges
// start from farther out; 1.3 left the seeds 1-20 KO landing rate at 85.7%,
// one whiffed fire under the 90% gate.
export const PURSUIT_MULT = 1.4;

/** Heat cap. Heat can run well past 100 while frozen behind a busy teammate; it never gates firing (only the Zone roll and taps do). */
const GAUGE_CAP = 200;

/** Any teammate currently winding or active — freezes the rest of the team's heat and Zone timers (one power active per team). */
export function teamPowerBusy(state: MatchState, team: 0 | 1): boolean {
  const base = team === 0 ? 0 : 11;
  for (let i = base; i < base + 11; i++) {
    const kind = state.players[i].powerState.kind;
    if (kind === 'winding' || kind === 'active') return true;
  }
  return false;
}

export function addGauge(state: MatchState, idx: number, amount: number): void {
  const p = state.players[idx];
  if (!p.def.power || p.powerState.kind !== 'idle') return;
  if (teamPowerBusy(state, p.team)) return; // heat freezes while a teammate's power is winding/active
  p.gauge = Math.min(GAUGE_CAP, p.gauge + amount);
}

export function interruptWindup(state: MatchState, idx: number): void {
  const p = state.players[idx];
  if (p.powerState.kind !== 'winding') return;
  p.powerState = { kind: 'idle' };
  p.gauge = 50;
  emit(state, { t: state.tick, kind: 'POWER_INTERRUPTED', player: idx });
}

// A Super Strength windup locks the opposing carrier inside this range and
// charges them. inUsefulContext references this SAME constant for the power's
// useful context, so "I see a context" and "I can acquire a lock" can never
// drift apart (Task 12.2 ruling).
const STRENGTH_LOCK_RANGE = 1200;
// KO range checked when the charge windup completes (400 -> 500, Task 12.2 tuning).
const STRENGTH_LAND_RANGE = 500;

/**
 * Powers whose entire effect resolves against a locked target. These never take
 * the late-window lapse (0.75) auto-fire: a targetless fire is a stat smear,
 * while an expiring rival zone is visible, playable threat (design ruling,
 * Task 12.2 follow-up). Their fires come only from a tap or a useful context —
 * and a Super Strength context inside STRENGTH_LOCK_RANGE guarantees the lock.
 */
function requiresTarget(power: PowerId): boolean {
  return power === 'SUPER_STRENGTH';
}

/** The "when should I fire?" answer, per power. Shown to players via chip glow. */
export function inUsefulContext(state: MatchState, idx: number): boolean {
  const p = state.players[idx];
  const power = p.def.power;
  if (!power) return false;
  const b = state.ball;
  const oppCarrierNear = (range: number) =>
    b.kind === 'held' && state.players[b.by].team !== p.team && dist2(state.players[b.by].pos, p.pos) < range * range;

  if (power === 'SUPER_STRENGTH') return oppCarrierNear(STRENGTH_LOCK_RANGE);
  if (power === 'SUPER_SPEED') {
    return (b.kind === 'held' && b.by === idx) || (b.kind === 'loose' && dist2(b.pos, p.pos) < 1500 * 1500);
  }
  return (b.kind === 'held' && b.by === idx) || oppCarrierNear(800); // FIRE_TORCH
}

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
  // Taps only convert a hero already in the Zone, and only when their team isn't
  // frozen behind a busy teammate (one power active per team — a tap can't jump
  // the queue while a teammate is winding/active).
  const due = state.pendingInputs.filter(i => i.tick <= state.tick);
  state.pendingInputs = state.pendingInputs.filter(i => i.tick > state.tick);
  for (const input of due) {
    const p = state.players[input.player];
    if (input.kind === 'POWER_TAP' && p.powerState.kind === 'zone' && !teamPowerBusy(state, p.team)) {
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

    // A busy teammate freezes this hero's heat/Zone timer — but a hero already
    // winding/active is never "frozen by itself" and must keep processing below.
    const selfBusy = p.powerState.kind === 'winding' || p.powerState.kind === 'active';
    if (!selfBusy && teamPowerBusy(state, p.team)) continue;

    if (p.powerState.kind === 'idle') {
      addGauge(state, idx, GAUGE_TRICKLE);
      // Zone-entry roll: state-dependent (heat-weighted) but still a conditional
      // rng() draw, so it is replay-load-bearing. It must run here — before
      // movementTick/possessionTick/tackleTick/shotFlightTick — and in ascending
      // player index order every tick, or replays taped against an older build
      // diverge even with identical inputs.
      if (p.gauge >= ZONE_HEAT_THRESHOLD && state.rng() < (p.gauge - ZONE_HEAT_THRESHOLD) * ZONE_ENTRY_RATE) {
        p.powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
        p.gauge = 0;
        emit(state, { t: state.tick, kind: 'POWER_READY', player: idx }); // event kind retained; now means Zone entry
      }
    } else if (p.powerState.kind === 'zone') {
      if (p.firePolicy === 'FIRE_WHEN_READY') {
        const blind = p.team === 0 && state.blindAutoHome;
        if (blind || inUsefulContext(state, idx)) startWindup(state, idx, CONTEXT_AUTO_STRENGTH);
        // Target-requiring powers skip the targetless late-window fallback: their
        // window expires like a manual miss instead (POWER_EXPIRED, heat 50).
        else if (p.powerState.remainingTicks <= 20 && !requiresTarget(p.def.power)) startWindup(state, idx, LAPSE_STRENGTH);
      }
      // SAVE_FOR_TAP heroes never auto-fire — a missed window only decays heat.
      if (p.powerState.kind === 'zone') {
        p.powerState.remainingTicks--;
        if (p.powerState.remainingTicks <= 0) {
          emit(state, { t: state.tick, kind: 'POWER_EXPIRED', player: idx });
          p.gauge = 50;
          p.powerState = { kind: 'idle' };
        }
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

/**
 * Centralizes "going out": if idx is holding the ball, release it to loose (at
 * their feet, no velocity) BEFORE marking them out — otherwise the ball stays
 * phantom-"held" by an unconscious player and possession freezes (the audit's
 * possession-freeze bug). `untilTick` is the absolute tick to return at, not a
 * duration — sendOff passes Number.MAX_SAFE_INTEGER straight through.
 */
export function knockOut(state: MatchState, idx: number, untilTick: number, reason: OutReason): void {
  const p = state.players[idx];
  if (state.ball.kind === 'held' && state.ball.by === idx) {
    state.ball = { kind: 'loose', pos: { ...p.pos }, vel: { x: 0, y: 0 } };
  }
  p.outUntilTick = untilTick;
  p.outReason = reason;
}

function sendOff(state: MatchState, idx: number): void {
  knockOut(state, idx, Number.MAX_SAFE_INTEGER, 'redcard');
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
      knockOut(state, nearest, state.tick + 100, 'ignited');
      emit(state, { t: state.tick, kind: 'IGNITED', player: nearest });
    }
  } else if (power === 'SUPER_STRENGTH') {
    rollCard(state, idx, 0.25, 0.05);
    if (p.outUntilTick <= state.tick && targetIdx !== undefined) {
      const target = state.players[targetIdx];
      if (target.outUntilTick <= state.tick && dist2(target.pos, p.pos) < STRENGTH_LAND_RANGE * STRENGTH_LAND_RANGE) {
        const hadBall = state.ball.kind === 'held' && state.ball.by === targetIdx;
        knockOut(state, targetIdx, state.tick + Math.round(80 * strength), 'ko');
        if (hadBall) state.ball = { kind: 'held', by: idx };
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: targetIdx, won: hadBall });
      }
    }
  }
}

export function speedMultiplier(state: MatchState, idx: number): number {
  const p = state.players[idx];
  // Charging a locked Super Strength target accelerates the pursuit — the windup
  // telegraph is the counterplay, not a guaranteed whiff (Task 12.1/12.2 landing-rate fix).
  if (p.powerState.kind === 'winding' && p.powerState.targetIdx !== undefined) return PURSUIT_MULT;
  return isActive(state, idx) && p.def.power === 'SUPER_SPEED' ? 2.2 : 1;
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
