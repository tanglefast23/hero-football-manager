import { emit } from './events';
import { dist2, PITCH_H, PITCH_W } from './geometry';
import type { MatchInput, MatchState, OutReason, PowerId } from './types';

export const WINDUP_TICKS = 15;
export const TAP_STRENGTH = 1.0;
export const CONTEXT_AUTO_STRENGTH = 0.85;
export const LAPSE_STRENGTH = 0.75;
export const GAUGE_TRICKLE = 0.02;
// Defensive heroes touch the ball less than attacking heroes, so nearby
// opposition must be a real Heat source or their powers disappear from natural
// matches. At 0.35, a defender needs roughly seventeen seconds of active engagement
// to earn one Zone before any tackle/possession rewards are counted.
const DEFENSIVE_ENGAGEMENT_TRICKLE = 0.35;
const DEFENSIVE_ENGAGEMENT_RANGE = 2000;

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

/** Heat cap. Heat can run well past 100 through ordinary involvement (passes, tackles, saves, shots) before the probabilistic Zone-entry roll fires; it never gates firing (only the Zone roll and taps do). */
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
  const ratePercent = state.teams[p.team].heroGaugeRatePercent ?? 100;
  p.gauge = Math.min(GAUGE_CAP, p.gauge + amount * ratePercent / 100);
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
export const STRENGTH_LOCK_RANGE = 1200;
// KO range checked when the charge windup completes (400 -> 500, Task 12.2 tuning).
const STRENGTH_LAND_RANGE = 500;

/**
 * Powers whose entire effect resolves against a locked target. These never take
 * the late-window lapse (0.75) auto-fire: a targetless fire is a stat smear,
 * while an expiring rival zone is visible, playable threat (design ruling,
 * Task 12.2 follow-up). Their fires come only from a tap or a useful context —
 * and a Super Strength context inside STRENGTH_LOCK_RANGE guarantees the lock.
 */
/** Ticks left in the Zone at which auto stops holding out for the ideal moment. */
export const LATE_WINDOW_TICKS = 20;

/**
 * The low bar for auto-fire: "can this power do anything at all right now?", as
 * opposed to inUsefulContext's "is this the moment I would pick?".
 *
 * Auto holds out for the ideal context for most of the Zone, then late in the
 * window settles for a usable one rather than wasting the window. Manual keeps
 * the same 70 ticks and full strength, so a tapping player is never worse off —
 * they can still wait for the perfect moment and hit at 100%.
 *
 * Target-requiring powers may only settle when a target genuinely resolves;
 * web-trapping empty grass is a no-op, not a fallback.
 */
function hasUsableTarget(state: MatchState, idx: number): boolean {
  const p = state.players[idx];
  const power = p.def.power;
  if (!power) return false;
  const b = state.ball;
  const oppCarrierNear = (range: number) =>
    b.kind === 'held' && state.players[b.by].team !== p.team && dist2(state.players[b.by].pos, p.pos) < range * range;
  const isCarrier = b.kind === 'held' && b.by === idx;

  // 1900 is the range startWindup already uses to lock a Web Trap / Future
  // Sight target, so settling can never select a target the windup would drop.
  if (power === 'SUPER_STRENGTH') return oppCarrierNear(STRENGTH_LOCK_RANGE);
  if (power === 'WEB_TRAP' || power === 'FUTURE_SIGHT') return oppCarrierNear(1900);
  if (power === 'PORTAL_PASS' || power === 'DECOY_DOUBLE') return isCarrier;
  if (power === 'ELASTIC_KEEPER') {
    if (p.def.role !== 'GK') return false;
    if (b.kind === 'shot') return state.players[b.by].team !== p.team;
    return b.kind === 'held' && state.players[b.by].team !== p.team;
  }
  return true;
}

function requiresTarget(power: PowerId): boolean {
  return power === 'PORTAL_PASS'
    || power === 'DECOY_DOUBLE'
    || power === 'FUTURE_SIGHT'
    || power === 'SUPER_STRENGTH'
    || power === 'WEB_TRAP'
    || power === 'ELASTIC_KEEPER';
}

// FIRE_TORCH's ignite radius. inUsefulContext references this SAME constant for
// the power's useful context (Task 13 pre-flight, Issue A) so "I see a context"
// and "someone is close enough to catch fire" can never drift apart, the same
// guarantee STRENGTH_LOCK_RANGE gives Super Strength.
const TORCH_IGNITE_RANGE = 800;
export const WEB_TRAP_TRIGGER_RANGE = 650;
const FUTURE_SIGHT_INTERCEPT_RANGE = 2400;
// SUPER_SPEED's useful context distance to a loose ball worth a sprint for.
const SPEED_LOOSE_BALL_RANGE = 1500;

/** True if any available opponent of idx is within `range`. */
function opponentWithin(state: MatchState, idx: number, range: number): boolean {
  const p = state.players[idx];
  const r2 = range * range;
  for (let i = 0; i < 22; i++) {
    const o = state.players[i];
    if (o.team === p.team || o.outUntilTick > state.tick) continue;
    if (dist2(o.pos, p.pos) < r2) return true;
  }
  return false;
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
  if (power === 'WEB_TRAP') return oppCarrierNear(1500);
  if (power === 'FUTURE_SIGHT') return oppCarrierNear(1900);
  if (power === 'ELASTIC_KEEPER') {
    if (p.def.role !== 'GK') return false;
    if (b.kind === 'shot') return state.players[b.by].team !== p.team;
    if (b.kind !== 'held' || state.players[b.by].team === p.team) return false;
    const carrier = state.players[b.by];
    const attackingProgress = carrier.team === 0 ? PITCH_H - carrier.pos.y : carrier.pos.y;
    return attackingProgress > PITCH_H * 0.72;
  }
  if (power === 'SUPER_SPEED') {
    // Self-carrier value is directional: a speedster in their own defensive half
    // is not breaking anything by sprinting, so only the attacking half counts.
    // A loose ball worth a sprint counts anywhere.
    const inAttackingHalf = p.team === 0 ? p.pos.y < PITCH_H / 2 : p.pos.y > PITCH_H / 2;
    return (b.kind === 'held' && b.by === idx && inAttackingHalf) ||
      (b.kind === 'loose' && dist2(b.pos, p.pos) < SPEED_LOOSE_BALL_RANGE * SPEED_LOOSE_BALL_RANGE);
  }
  const isCarrier = b.kind === 'held' && b.by === idx;
  const attackingProgress = p.team === 0 ? PITCH_H - p.pos.y : p.pos.y;
  if (power === 'BLINK_RUN') return isCarrier && attackingProgress > PITCH_H * 0.55;
  if (power === 'THUNDER_STRIKE') return isCarrier && attackingProgress > PITCH_H * 0.68
    && Math.abs(p.pos.x - 2250) < 1400;
  if (power === 'PHASE_RUN') return isCarrier && opponentWithin(state, idx, 700)
    && attackingProgress < PITCH_H * 0.82;
  if (power === 'PORTAL_PASS') return isCarrier && opponentWithin(state, idx, 1100);
  if (power === 'DECOY_DOUBLE') return isCarrier && attackingProgress > PITCH_H * 0.5
    && opponentWithin(state, idx, 1200);
  // FIRE_TORCH fires when its carrier has a close marker, or when it can directly
  // ignite the opposing carrier. The effect and context share one radius.
  return (b.kind === 'held' && b.by === idx && opponentWithin(state, idx, TORCH_IGNITE_RANGE)) ||
    oppCarrierNear(TORCH_IGNITE_RANGE);
}

function startWindup(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  let targetIdx: number | undefined;
  if ((p.def.power === 'SUPER_STRENGTH' || p.def.power === 'WEB_TRAP' || p.def.power === 'FUTURE_SIGHT')
    && state.ball.kind === 'held') {
    const carrier = state.players[state.ball.by];
    const range = p.def.power === 'SUPER_STRENGTH' ? STRENGTH_LOCK_RANGE : 1900;
    if (carrier.team !== p.team && dist2(carrier.pos, p.pos) < range * range) {
      targetIdx = state.ball.by;
    }
  }
  p.powerState = { kind: 'winding', untilTick: state.tick + WINDUP_TICKS, strength, targetIdx };
}

export function powerTick(state: MatchState, dueInputs: readonly MatchInput[] = []): void {
  // Taps only convert a hero already in the Zone, and only when their team isn't
  // frozen behind a busy teammate (one power active per team — a tap can't jump
  // the queue while a teammate is winding/active).
  // match.tick owns the due-input partition so coaching and power inputs share
  // one ordered replay stream. This function handles only power taps.
  for (const input of dueInputs) {
    if (input.kind !== 'POWER_TAP') continue;
    const p = state.players[input.player];
    // p.outUntilTick guard (audit R1): a tap on a downed hero must not start a
    // windup that the out-check below would instantly interrupt (spurious
    // POWER_INTERRUPTED).
    if (p.powerState.kind === 'zone' && p.outUntilTick <= state.tick
      && p.slideTackle === undefined && p.tackleRecoveryUntil <= state.tick && !teamPowerBusy(state, p.team)
      && (!requiresTarget(p.def.power!) || inUsefulContext(state, input.player))) {
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
    const tacklingBusy = p.slideTackle !== undefined || p.tackleRecoveryUntil > state.tick;
    if (tacklingBusy && (p.powerState.kind === 'idle' || p.powerState.kind === 'zone')) continue;

    // A busy teammate freezes this hero's heat/Zone timer — but a hero already
    // winding/active is never "frozen by itself" and must keep processing below.
    const selfBusy = p.powerState.kind === 'winding' || p.powerState.kind === 'active';
    if (!selfBusy && teamPowerBusy(state, p.team)) continue;

    if (p.powerState.kind === 'idle') {
      const defensiveEngagement = p.def.role === 'DEF' && state.ball.kind === 'held'
        && state.players[state.ball.by].team !== p.team
        && dist2(state.players[state.ball.by].pos, p.pos) < DEFENSIVE_ENGAGEMENT_RANGE * DEFENSIVE_ENGAGEMENT_RANGE;
      addGauge(state, idx, GAUGE_TRICKLE + (defensiveEngagement ? DEFENSIVE_ENGAGEMENT_TRICKLE : 0));
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
        // Late in the window, settle for a usable target rather than waste the
        // Zone. Target-requiring powers still only fire when one resolves, so a
        // power with nothing to act on expires like a manual miss.
        else if (p.powerState.remainingTicks <= LATE_WINDOW_TICKS && hasUsableTarget(state, idx)) {
          startWindup(state, idx, LAPSE_STRENGTH);
        }
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
      if (p.def.power === 'WEB_TRAP') springWebTrap(state, idx);
      if (p.powerState.kind === 'active' && state.tick >= p.powerState.untilTick) {
        p.powerState = { kind: 'idle' };
        p.powerAnchor = undefined;
        p.gauge = 0;
      }
    }
  }
}

// Tuning round 1 (Task 13 decision record): 40/80/50 → 70/110/80. GATE-1 measured
// the original durations at +0.065 goals/match — real but imperceptible against
// docs/09's 15-25% hero-uplift target.
const DUR: Record<PowerId, number> = {
  SUPER_SPEED: 70,
  BLINK_RUN: 35,
  THUNDER_STRIKE: 90,
  FIRE_TORCH: 80,
  PHASE_RUN: 70,
  PORTAL_PASS: 35,
  DECOY_DOUBLE: 70,
  FUTURE_SIGHT: 60,
  SUPER_STRENGTH: 110,
  WEB_TRAP: 70,
  ELASTIC_KEEPER: 90,
};

export function isActive(state: MatchState, idx: number): boolean {
  const ps = state.players[idx].powerState;
  return ps.kind === 'active' && state.tick < ps.untilTick;
}

/**
 * Centralizes "going out": if idx is holding the ball, release it to loose (at
 * their feet, no velocity) BEFORE marking them out — otherwise the ball stays
 * phantom-"held" by an unconscious player and possession freezes (the audit's
 * possession-freeze bug). In-progress power state is handled per canon
 * (docs/04): a winding hero gets the normal interrupt refund; an active hero
 * simply reverts to idle (the power already resolved — no refund) — otherwise a
 * permanently-out hero (red card) would keep teamPowerBusy true for their team
 * for the rest of the match (the audit's frozen-team bug). A hero knocked out
 * mid-Zone KEEPS the Zone: "a knocked-down hero stays hot" — the window is
 * paused (powerTick skips out players, so remainingTicks freezes) and resumes on
 * recovery. A Zone never sets teamPowerBusy, so a permanently-out (red-carded)
 * hero left in a frozen Zone is inert and cannot re-freeze the team.
 * `untilTick` is the absolute tick to return at, not a duration — sendOff passes
 * Number.MAX_SAFE_INTEGER straight through.
 */
export function knockOut(state: MatchState, idx: number, untilTick: number, reason: OutReason): void {
  const p = state.players[idx];
  if (state.ball.kind === 'held' && state.ball.by === idx) {
    state.ball = { kind: 'loose', pos: { ...p.pos }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
  }
  if (p.powerState.kind === 'winding') {
    interruptWindup(state, idx);
  } else if (p.powerState.kind === 'active') {
    p.powerState = { kind: 'idle' };
    p.powerAnchor = undefined;
    p.gauge = 0;
  }
  p.slideTackle = undefined;
  p.tackleRecoveryUntil = 0;
  // 'zone' is intentionally left untouched — see the pause/resume note above.
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
  p.powerAnchor = power === 'WEB_TRAP' ? { ...p.pos } : undefined;
  p.gauge = 0;

  if (power === 'FIRE_TORCH') {
    rollCard(state, idx, 0.15, 0);
    let nearest = -1, nearestD2 = TORCH_IGNITE_RANGE * TORCH_IGNITE_RANGE;
    for (let i = 0; i < 22; i++) {
      const o = state.players[i];
      if (o.team === p.team || o.outUntilTick > state.tick) continue;
      const d2 = dist2(o.pos, p.pos);
      if (d2 < nearestD2) { nearestD2 = d2; nearest = i; }
    }
    if (nearest !== -1) {
      // Stronger match fatigue otherwise made useful-context auto-fire lose to
      // blind immediate firing. The longer visible removal restores timing value
      // while keeping the approved contextual trigger and 0.85 strength intact.
      knockOut(state, nearest, state.tick + 180, 'ignited');
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
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: targetIdx, won: hadBall, style: 'power', contact: true });
      }
    }
  } else if (power === 'BLINK_RUN') {
    const direction = p.team === 0 ? -1 : 1;
    p.pos = {
      x: Math.max(150, Math.min(PITCH_W - 150, p.pos.x)),
      y: Math.max(300, Math.min(PITCH_H - 300, p.pos.y + direction * Math.round(1050 * strength))),
    };
  } else if (power === 'PORTAL_PASS') {
    if (state.ball.kind === 'held' && state.ball.by === idx) {
      const teammate = bestForwardTeammate(state, idx);
      if (teammate !== -1) state.ball = { kind: 'held', by: teammate };
    }
  } else if (power === 'DECOY_DOUBLE') {
    const marker = nearestOpponentIndex(state, idx, 1300);
    if (marker !== -1) {
      const opponent = state.players[marker];
      const direction = opponent.pos.x <= p.pos.x ? -1 : 1;
      opponent.pos = {
        x: Math.max(0, Math.min(PITCH_W, opponent.pos.x + direction * Math.round(650 * strength))),
        y: opponent.pos.y,
      };
    }
  }
}

/** Consumes the first active Future Sight that can arrive at the next receiver. */
export function futureSightInterceptor(
  state: MatchState,
  passingTeam: 0 | 1,
  receiverIdx: number,
): number {
  const first = passingTeam === 0 ? 11 : 0;
  const receiver = state.players[receiverIdx];
  for (let idx = first; idx < first + 11; idx += 1) {
    const hero = state.players[idx];
    if (hero.def.power !== 'FUTURE_SIGHT' || !isActive(state, idx)
      || hero.outUntilTick > state.tick
      || hero.slideTackle !== undefined
      || hero.tackleRecoveryUntil > state.tick
      || dist2(hero.pos, receiver.pos) > FUTURE_SIGHT_INTERCEPT_RANGE * FUTURE_SIGHT_INTERCEPT_RANGE) continue;
    hero.pos = { ...receiver.pos };
    hero.powerState = { kind: 'idle' };
    hero.gauge = 0;
    return idx;
  }
  return -1;
}

function springWebTrap(state: MatchState, idx: number): void {
  const hero = state.players[idx];
  const anchor = hero.powerAnchor;
  if (anchor === undefined || hero.powerState.kind !== 'active') return;
  let victim = -1;
  let nearestDistance = WEB_TRAP_TRIGGER_RANGE * WEB_TRAP_TRIGGER_RANGE;
  for (let candidate = 0; candidate < 22; candidate += 1) {
    const player = state.players[candidate];
    if (player.team === hero.team || player.outUntilTick > state.tick) continue;
    const distance = dist2(player.pos, anchor);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      victim = candidate;
    }
  }
  if (victim === -1) return;
  const strength = hero.powerState.strength;
  const hadBall = state.ball.kind === 'held' && state.ball.by === victim;
  knockOut(state, victim, state.tick + Math.round(50 * strength), 'ko');
  emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: victim, won: hadBall, style: 'power', contact: false });
  hero.powerState = { kind: 'idle' };
  hero.powerAnchor = undefined;
  hero.gauge = 0;
}

function bestForwardTeammate(state: MatchState, idx: number): number {
  const player = state.players[idx];
  let best = -1;
  let bestProgress = -Infinity;
  for (let candidate = 0; candidate < 22; candidate += 1) {
    const teammate = state.players[candidate];
    if (candidate === idx || teammate.team !== player.team || teammate.outUntilTick > state.tick) continue;
    const progress = teammate.team === 0 ? PITCH_H - teammate.pos.y : teammate.pos.y;
    if (progress > bestProgress) {
      best = candidate;
      bestProgress = progress;
    }
  }
  return best;
}

function nearestOpponentIndex(state: MatchState, idx: number, range: number): number {
  const player = state.players[idx];
  let best = -1;
  let bestDistance = range * range;
  for (let candidate = 0; candidate < 22; candidate += 1) {
    const opponent = state.players[candidate];
    if (opponent.team === player.team || opponent.outUntilTick > state.tick) continue;
    const distance = dist2(player.pos, opponent.pos);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function speedMultiplier(state: MatchState, idx: number): number {
  const p = state.players[idx];
  // Charging a locked Super Strength target accelerates the pursuit — the windup
  // telegraph is the counterplay, not a guaranteed whiff (Task 12.1/12.2 landing-rate fix).
  if (p.powerState.kind === 'winding' && p.powerState.targetIdx !== undefined) return PURSUIT_MULT;
  if (!isActive(state, idx)) return 1;
  if (p.def.power === 'SUPER_SPEED') return 2.2;
  if (p.def.power === 'BLINK_RUN') return 1.35;
  return 1;
}

export function dribbleBonus(state: MatchState, carrierIdx: number): number {
  const player = state.players[carrierIdx];
  // Super Speed visibly spools up during its interruptible wind-up. The bonus is
  // enough to resist an ordinary poke more often, but tackles can still cancel it.
  if (player.powerState.kind === 'winding' && player.def.power === 'SUPER_SPEED') return 25;
  if (!isActive(state, carrierIdx)) return 0;
  const power = player.def.power;
  if (power === 'SUPER_SPEED') return 15;
  if (power === 'FIRE_TORCH') return 25;
  if (power === 'PHASE_RUN') return 70;
  if (power === 'BLINK_RUN' || power === 'DECOY_DOUBLE') return 20;
  return 0;
}

export function fireSuppressed(state: MatchState, _tacklerIdx: number, carrierIdx: number): boolean {
  return isActive(state, carrierIdx)
    && (state.players[carrierIdx].def.power === 'FIRE_TORCH'
      || state.players[carrierIdx].def.power === 'PHASE_RUN');
}

export function defenseBonus(state: MatchState, idx: number): number {
  if (!isActive(state, idx)) return 0;
  const power = state.players[idx].def.power;
  if (power === 'SUPER_STRENGTH') return 35;
  if (power === 'FUTURE_SIGHT') return 45;
  if (power === 'WEB_TRAP') return 30;
  return 0;
}

export function keeperSaveBonus(state: MatchState, idx: number): number {
  return isActive(state, idx) && state.players[idx].def.power === 'ELASTIC_KEEPER' ? 70 : 0;
}

export function phaseRunPreventsShot(state: MatchState, idx: number): boolean {
  return isActive(state, idx) && state.players[idx].def.power === 'PHASE_RUN';
}
