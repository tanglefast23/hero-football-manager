import { emit } from './events';
import { dist2, PITCH_H, PITCH_W } from './geometry';
import type { MatchInput, MatchState, OutReason, PowerId } from './types';

export const WINDUP_TICKS = 15;
export const TAP_STRENGTH = 1.0;
export const ARMED_STRENGTH = 0.9;
export const CONTEXT_AUTO_STRENGTH = 0.85;
export const LAPSE_STRENGTH = 0.75;
export const ARM_WINDOW_TICKS = 20;
export const GAUGE_TRICKLE = 0.02;
// Defensive heroes touch the ball less than attacking heroes, so nearby
// opposition must be a real Heat source or their powers disappear from natural
// matches. The role trickles below close the remaining natural-touch gap while
// keeping forwards, who already earn Heat from shots and carries, unchanged.
const DEFENSIVE_ENGAGEMENT_TRICKLE = 0.45;
const DEFENSIVE_ENGAGEMENT_RANGE = 2000;

// In-the-Zone activation model: Heat builds to the threshold, then stays banked
// until the power's authored situation exists. The conversion is immediate and
// deterministic, so a short defensive opening cannot be lost to a second random
// roll after the hero already earned the Heat.
export const ZONE_WINDOW_TICKS = 70;
export const ZONE_HEAT_THRESHOLD = 60;

// Charging Super Strength closes distance faster than normal movement (the
// windup telegraph is the counterplay window, not a free pass to escape it).
// The charge starts from a broad enough range to create repeated defender
// opportunities; its visible wind-up remains the counterplay window.
export const PURSUIT_MULT = 1.4;

/** Heat cap. Heat can run well past 100 through ordinary involvement before an authored situation converts it into a Zone; it never gates firing once that Zone exists. */
const GAUGE_CAP = 200;

export function addGauge(state: MatchState, idx: number, amount: number): void {
  const p = state.players[idx];
  if (!p.def.power || p.powerState.kind !== 'idle') return;
  const rally = rallyCryMultiplier(state, idx);
  const ratePercent = state.teams[p.team].heroGaugeRatePercent ?? 100;
  p.gauge = Math.min(GAUGE_CAP, p.gauge + amount * rally * ratePercent / 100);
}

/** Heat multiplier from a nearby teammate's active Rally Cry. */
function rallyCryMultiplier(state: MatchState, idx: number): number {
  const p = state.players[idx];
  for (let candidate = 0; candidate < 22; candidate += 1) {
    if (candidate === idx) continue;
    const mate = state.players[candidate];
    if (mate.team !== p.team || mate.def.power !== 'RALLY_CRY') continue;
    if (!isActive(state, candidate)) continue;
    if (dist2(p.pos, mate.pos) < RALLY_CRY_RANGE * RALLY_CRY_RANGE) {
      const strength = mate.powerState.kind === 'active' ? mate.powerState.strength : 1;
      return 1 + (RALLY_CRY_MULTIPLIER - 1) * strength;
    }
  }
  return 1;
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
export const STRENGTH_LOCK_RANGE = 2000;
// KO range checked when the charge windup completes (400 -> 500, Task 12.2 tuning).
const STRENGTH_LAND_RANGE = 900;

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
 * window settles for a usable one rather than wasting the window. A manual tap
 * in the ideal moment fires at 100%; an early commitment instead places the
 * fixed two-second 90% arm window.
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
  const friendlyCarrier = b.kind === 'held' && state.players[b.by].team === p.team ? b.by : -1;

  // 1900 is the range startWindup already uses to lock a Web Trap / Future
  // Sight target, so settling can never select a target the windup would drop.
  if (power === 'SUPER_STRENGTH') return oppCarrierNear(STRENGTH_LOCK_RANGE);
  if (power === 'WEB_TRAP' || power === 'FUTURE_SIGHT') return oppCarrierNear(1900);
  if (power === 'ICE_RINK' || power === 'GRAVITY_WELL' || power === 'SHADOW_MARK') {
    return oppCarrierNear(1900);
  }
  if (power === 'GIANT_GK') {
    if (p.def.role !== 'GK') return false;
    if (b.kind === 'shot') return state.players[b.by].team !== p.team;
    return b.kind === 'held' && state.players[b.by].team !== p.team;
  }
  if (power === 'PORTAL_PASS') return friendlyCarrier !== -1;
  if (power === 'DECOY_DOUBLE') {
    return friendlyCarrier !== -1
      && nearestOpponentIndex(state, friendlyCarrier, DECOY_MARKER_RANGE) !== -1;
  }
  if (power === 'GUST') return b.kind === 'held' && state.players[b.by].team !== p.team;
  if (power === 'ELASTIC_KEEPER') {
    if (p.def.role !== 'GK') return false;
    if (b.kind === 'shot') return state.players[b.by].team !== p.team;
    return b.kind === 'held' && state.players[b.by].team !== p.team;
  }
  return true;
}

// FIRE_TORCH's ignite radius. inUsefulContext references this SAME constant for
// the power's useful context (Task 13 pre-flight, Issue A) so "I see a context"
// and "someone is close enough to catch fire" can never drift apart, the same
// guarantee STRENGTH_LOCK_RANGE gives Super Strength.
export const TORCH_IGNITE_RANGE = 1400;
/** m1.13 ranges, sized against the existing proximity powers (Web Trap 1500, Future Sight 1900). */
const ICE_RINK_RANGE = 1500;
const ICE_RINK_SLOW_RADIUS = 1100;
const ICE_RINK_SLOW = 0.4;
const GRAVITY_WELL_RANGE = 1500;
const GRAVITY_WELL_PULL = 180;
const SHADOW_MARK_RANGE = 1900;
const RALLY_CRY_RANGE = 2600;
const RALLY_CRY_TEAMMATE_HEAT = 35;
const RALLY_CRY_MULTIPLIER = 3;
const DECOY_MARKER_RANGE = 1900;
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
  // m1.13 powers: every trigger is a sustained situation, never "hold the ball
  // this instant", so they stay usable from any outfield position.
  if (power === 'RALLY_CRY') {
    // Worth firing once a teammate is genuinely close to their own window.
    return state.players.some((mate, i) => i !== idx && mate.team === p.team
      && mate.def.power !== undefined && mate.powerState.kind === 'idle'
      && mate.gauge >= RALLY_CRY_TEAMMATE_HEAT);
  }
  if (power === 'ICE_RINK') return oppCarrierNear(ICE_RINK_RANGE);
  if (power === 'GRAVITY_WELL') return oppCarrierNear(GRAVITY_WELL_RANGE);
  if (power === 'SHADOW_MARK') return oppCarrierNear(SHADOW_MARK_RANGE);
  if (power === 'GIANT_GK') {
    if (p.def.role !== 'GK') return false;
    if (b.kind === 'shot') return state.players[b.by].team !== p.team;
    return b.kind === 'held' && state.players[b.by].team !== p.team;
  }
  if (power === 'GUST') {
    return b.kind === 'held' && state.players[b.by].team !== p.team;
  }
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
  const friendlyCarrier = b.kind === 'held' && state.players[b.by].team === p.team ? b.by : -1;
  const attackingProgress = p.team === 0 ? PITCH_H - p.pos.y : p.pos.y;
  if (power === 'BLINK_RUN') return isCarrier && attackingProgress > PITCH_H * 0.55;
  if (power === 'THUNDER_STRIKE') return isCarrier && attackingProgress > PITCH_H * 0.62
    && Math.abs(p.pos.x - 2250) < 1600;
  if (power === 'PHASE_RUN') return isCarrier && opponentWithin(state, idx, 700)
    && attackingProgress < PITCH_H * 0.82;
  if (power === 'PORTAL_PASS') {
    return friendlyCarrier !== -1 && opponentWithin(state, friendlyCarrier, 1100);
  }
  if (power === 'DECOY_DOUBLE') {
    if (friendlyCarrier === -1) return false;
    const carrier = state.players[friendlyCarrier];
    const carrierProgress = carrier.team === 0 ? PITCH_H - carrier.pos.y : carrier.pos.y;
    return carrierProgress > PITCH_H * 0.38
      && nearestOpponentIndex(state, friendlyCarrier, DECOY_MARKER_RANGE) !== -1;
  }
  // Fire Torch's instant effect ignites the nearest opponent to the hero, so
  // its useful context must be the same condition. Requiring the hero to carry
  // here made contextual auto pass up valuable removals that blind firing got
  // by accident. The effect and context share one radius.
  return opponentWithin(state, idx, TORCH_IGNITE_RANGE);
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
  // A tap is a commitment, not extra Zone time. An already-good situation fires
  // at full strength; an early tap places a fixed two-second armed window that
  // fires at slightly reduced strength when its authored context appears.
  // match.tick owns the due-input partition so coaching and power inputs share
  // one ordered replay stream. This function handles only power taps.
  for (const input of dueInputs) {
    if (input.kind !== 'POWER_TAP') continue;
    const p = state.players[input.player];
    if (p.powerState.kind === 'zone') {
      const available = p.outUntilTick <= state.tick
        && p.slideTackle === undefined
        && p.tackleRecoveryUntil <= state.tick;
      if (available && inUsefulContext(state, input.player)) {
        startWindup(state, input.player, TAP_STRENGTH);
      }
      // The armed branch below runs later in this same tick, so seed one extra
      // count to expose a full 20 subsequent decision ticks.
      else p.powerState = { kind: 'armed', remainingTicks: ARM_WINDOW_TICKS + 1 };
    }
  }

  for (let idx = 0; idx < 22; idx++) {
    const p = state.players[idx];
    if (!p.def.power) continue;
    if (p.outUntilTick > state.tick) {
      if (p.powerState.kind === 'winding') interruptWindup(state, idx);
      // An untouched Zone still pauses while its hero is down. Pressing commits
      // that Zone to a real 20-tick armed placement, which continues to expire
      // even if the hero is knocked down before the context appears.
      if (p.powerState.kind !== 'armed') continue;
    }
    const tacklingBusy = p.slideTackle !== undefined || p.tackleRecoveryUntil > state.tick;
    if (tacklingBusy && (p.powerState.kind === 'idle' || p.powerState.kind === 'zone')) continue;

    if (p.powerState.kind === 'idle') {
      const defensiveEngagement = p.def.role === 'DEF' && state.ball.kind === 'held'
        && state.players[state.ball.by].team !== p.team
        && dist2(state.players[state.ball.by].pos, p.pos) < DEFENSIVE_ENGAGEMENT_RANGE * DEFENSIVE_ENGAGEMENT_RANGE;
      const roleTrickle = p.def.role === 'GK' ? 0.055
        : p.def.role === 'DEF' ? 0.06
          : p.def.role === 'MID' ? 0.035
            : GAUGE_TRICKLE;
      addGauge(state, idx, roleTrickle + (defensiveEngagement ? DEFENSIVE_ENGAGEMENT_TRICKLE : 0));
      // Heat is never spent on an unusable window. It remains banked until the
      // authored situation appears, then converts without a second luck check.
      // This runs before movement/possession in ascending player order, so the
      // context and event remain byte-identical for the same replay inputs.
      if (p.gauge >= ZONE_HEAT_THRESHOLD && inUsefulContext(state, idx)) {
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
    } else if (p.powerState.kind === 'armed') {
      const available = p.outUntilTick <= state.tick && !tacklingBusy;
      if (available && inUsefulContext(state, idx)) {
        startWindup(state, idx, ARMED_STRENGTH);
      } else {
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
      if (p.powerState.kind === 'active' && p.def.power === 'GRAVITY_WELL'
        && state.tick % 5 === 0) {
        applyGravityWell(state, idx);
      }
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
  // Keep the two launch attackers short enough that authored timing still
  // beats firing blindly; their magnitude is calibrated per family in m1.15.
  SUPER_SPEED: 70,
  BLINK_RUN: 40,
  THUNDER_STRIKE: 100,
  FIRE_TORCH: 80,
  PHASE_RUN: 80,
  PORTAL_PASS: 40,
  DECOY_DOUBLE: 80,
  FUTURE_SIGHT: 100,
  SUPER_STRENGTH: 120,
  WEB_TRAP: 80,
  ELASTIC_KEEPER: 100,
  RALLY_CRY: 130,
  ICE_RINK: 100,
  SHADOW_MARK: 110,
  GRAVITY_WELL: 60,
  GIANT_GK: 100,
  GUST: 130,
};

/** Tier 1 is the balance floor. Tiers 2/3 increase both potency and, for
 * sustained powers, duration; Tier 3 therefore lands near twice Tier 1's total
 * influence without doubling any single on-pitch displacement or stat spike. */
function tierEffectScale(tier: 1 | 2 | 3 | undefined): number {
  if (tier === 3) return 1.45;
  if (tier === 2) return 1.2;
  return 1;
}

/** Family calibration turns a successful fire into a match-shaping moment.
 * It deliberately affects the visible authored effect, not every unrelated
 * action by the hero. */
function familyEffectScale(power: PowerId): number {
  switch (power) {
    case 'THUNDER_STRIKE':
    case 'ELASTIC_KEEPER':
    case 'GIANT_GK':
      return 1.65;
    case 'SUPER_SPEED':
    case 'BLINK_RUN':
    case 'FIRE_TORCH':
    case 'PORTAL_PASS':
      return 1.75;
    case 'PHASE_RUN':
    case 'FUTURE_SIGHT':
    case 'SUPER_STRENGTH':
    case 'RALLY_CRY':
    case 'GRAVITY_WELL':
    case 'GUST':
      return 1.9;
    case 'DECOY_DOUBLE':
    case 'WEB_TRAP':
    case 'ICE_RINK':
    case 'SHADOW_MARK':
      return 2.1;
  }
}

/** A well-placed tap has a larger effect than contextual automatic play. The
 * public POWER_FIRED strength stays the timing grade (1.0/0.9/0.85); this is
 * only the gameplay reward behind that grade. */
function manualTimingScale(strength: number): number {
  if (strength >= TAP_STRENGTH) return 1.15;
  if (strength >= ARMED_STRENGTH) return 1.06;
  return 1;
}

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
 * simply reverts to idle (the power already resolved — no refund). A hero knocked out
 * mid-Zone KEEPS the Zone: "a knocked-down hero stays hot" — the window is
 * paused (powerTick skips out players, so remainingTicks freezes) and resumes on
 * recovery. A permanently-out (red-carded) hero left in a paused Zone is inert.
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

// Hero License canon (docs/04): a licensed power is sanctioned play, so firing
// one never books its user. Fire Torch and Super Strength were the only sources
// of cards in the sim, so sendOff/rollCard went with them. SimPlayer.cards, the
// CARD event and the 'redcard' out-reason remain in the schema but are now
// unreachable — kept so saved replays and their UI still deserialize.

export function activatePower(state: MatchState, idx: number, strength: number, targetIdx?: number): void {
  const p = state.players[idx];
  const power = p.def.power!;
  emit(state, { t: state.tick, kind: 'POWER_FIRED', player: idx, power, strength });
  const tierScale = tierEffectScale(p.def.powerTier);
  const timingScale = manualTimingScale(strength);
  const effectStrength = strength * timingScale * tierScale * familyEffectScale(power);
  // Portal Pass resolves completely at activation. Its active state is only a
  // short cooldown/Heat lock, so extending that inert state would make a
  // higher-tier hero strictly worse after the same instantaneous transfer.
  const durationStrength = power === 'PORTAL_PASS' ? 1 : strength * timingScale * tierScale;
  p.powerState = {
    kind: 'active',
    untilTick: state.tick + Math.round(DUR[power] * durationStrength),
    strength: effectStrength,
  };
  p.powerAnchor = power === 'WEB_TRAP' && targetIdx !== undefined
    ? { ...state.players[targetIdx].pos }
    : power === 'ICE_RINK' && state.ball.kind === 'held'
      ? { ...state.players[state.ball.by].pos }
      : power === 'WEB_TRAP' || power === 'ICE_RINK'
        ? { ...p.pos }
        : undefined;
  p.gauge = 0;

  if (power === 'FIRE_TORCH') {
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
      knockOut(state, nearest, state.tick + Math.round(230 * effectStrength), 'ignited');
      emit(state, { t: state.tick, kind: 'IGNITED', player: nearest });
    }
  } else if (power === 'SUPER_STRENGTH') {
    if (p.outUntilTick <= state.tick && targetIdx !== undefined) {
      const target = state.players[targetIdx];
      if (target.outUntilTick <= state.tick && dist2(target.pos, p.pos) < STRENGTH_LAND_RANGE * STRENGTH_LAND_RANGE) {
        const hadBall = state.ball.kind === 'held' && state.ball.by === targetIdx;
        knockOut(state, targetIdx, state.tick + Math.round(150 * effectStrength), 'ko');
        if (hadBall) state.ball = { kind: 'held', by: idx };
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: targetIdx, won: hadBall, style: 'power', contact: true });
      }
    }
  } else if (power === 'BLINK_RUN') {
    const direction = p.team === 0 ? -1 : 1;
    p.pos = {
      x: Math.max(150, Math.min(PITCH_W - 150, p.pos.x)),
      y: Math.max(300, Math.min(PITCH_H - 300, p.pos.y + direction * Math.round(1150 * effectStrength))),
    };
  } else if (power === 'PORTAL_PASS') {
    if (state.ball.kind === 'held' && state.players[state.ball.by].team === p.team) {
      const teammate = bestForwardTeammate(state, state.ball.by);
      if (teammate !== -1) {
        const receiver = state.players[teammate];
        const direction = receiver.team === 0 ? -1 : 1;
        receiver.pos = {
          x: receiver.pos.x,
          y: Math.max(300, Math.min(PITCH_H - 300,
            receiver.pos.y + direction * Math.round(450 * effectStrength))),
        };
        state.ball = { kind: 'held', by: teammate };
      }
    }
  } else if (power === 'GRAVITY_WELL') {
    applyGravityWell(state, idx);
  } else if (power === 'DECOY_DOUBLE') {
    const carrier = state.ball.kind === 'held' && state.players[state.ball.by].team === p.team
      ? state.ball.by : idx;
    const marker = nearestOpponentIndex(state, carrier, DECOY_MARKER_RANGE);
    if (marker !== -1) {
      const opponent = state.players[marker];
      const carrierPlayer = state.players[carrier];
      const direction = opponent.pos.x <= carrierPlayer.pos.x ? -1 : 1;
      opponent.pos = {
        x: Math.max(0, Math.min(PITCH_W,
          opponent.pos.x + direction * Math.round(600 * effectStrength))),
        y: opponent.pos.y,
      };
    }
  }
}

function applyGravityWell(state: MatchState, idx: number): void {
  const hero = state.players[idx];
  if (hero.powerState.kind !== 'active') return;
  for (let candidate = 0; candidate < 22; candidate += 1) {
    const opponent = state.players[candidate];
    if (opponent.team === hero.team || opponent.outUntilTick > state.tick) continue;
    if (dist2(opponent.pos, hero.pos) >= GRAVITY_WELL_RANGE * GRAVITY_WELL_RANGE) continue;
    const pull = Math.round(GRAVITY_WELL_PULL * hero.powerState.strength);
    opponent.pos = {
      x: opponent.pos.x + Math.sign(hero.pos.x - opponent.pos.x) * pull,
      y: opponent.pos.y + Math.sign(hero.pos.y - opponent.pos.y) * pull,
    };
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
    return idx;
  }
  return -1;
}

/** Consumes the first active enemy Gust. Unlike Future Sight, it does not give
 * a defender possession; the pass continues toward its receiver and breaks
 * loose on arrival. */
export function gustDisruptsPass(state: MatchState, passingTeam: 0 | 1): boolean {
  const first = passingTeam === 0 ? 11 : 0;
  for (let idx = first; idx < first + 11; idx += 1) {
    const hero = state.players[idx];
    if (hero.def.power !== 'GUST' || !isActive(state, idx)
      || hero.outUntilTick > state.tick
      || hero.slideTackle !== undefined
      || hero.tackleRecoveryUntil > state.tick) continue;
    return true;
  }
  return false;
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
  knockOut(state, victim, state.tick + Math.round(100 * strength), 'ko');
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
  if (p.powerState.kind !== 'active') return 1;
  if (p.def.power === 'SUPER_SPEED') return 1 + 1.3 * p.powerState.strength;
  if (p.def.power === 'BLINK_RUN') return 1 + 0.4 * p.powerState.strength;
  if (p.def.power === 'SHADOW_MARK') return 1 + 0.3 * p.powerState.strength;
  return 1;
}

/** Opponents crossing an active enemy Ice Rink lose their footing. */
export function iceRinkSlow(state: MatchState, idx: number): number {
  const p = state.players[idx];
  for (let candidate = 0; candidate < 22; candidate += 1) {
    const hero = state.players[candidate];
    if (hero.team === p.team || hero.def.power !== 'ICE_RINK') continue;
    const anchor = hero.powerAnchor;
    if (anchor === undefined || !isActive(state, candidate)) continue;
    if (dist2(p.pos, anchor) < ICE_RINK_SLOW_RADIUS * ICE_RINK_SLOW_RADIUS) {
      const strength = hero.powerState.kind === 'active' ? hero.powerState.strength : 1;
      return Math.max(0.3, 1 - (1 - ICE_RINK_SLOW) * strength);
    }
  }
  return 1;
}

/** Shadow Mark: passers stop accounting for this defender while it is active. */
export function isShadowMarked(state: MatchState, idx: number): boolean {
  return isActive(state, idx) && state.players[idx].def.power === 'SHADOW_MARK';
}

/** Shadow Mark's authored contract is one ambush, not a timed stat smear. */
export function consumeShadowMark(state: MatchState, idx: number): boolean {
  if (!isShadowMarked(state, idx)) return false;
  const player = state.players[idx];
  player.powerState = { kind: 'idle' };
  player.powerAnchor = undefined;
  player.gauge = 0;
  return true;
}

export function dribbleBonus(state: MatchState, carrierIdx: number): number {
  const player = state.players[carrierIdx];
  // Super Speed visibly spools up during its interruptible wind-up. The bonus is
  // enough to resist an ordinary poke more often, but tackles can still cancel it.
  if (player.powerState.kind === 'winding' && player.def.power === 'SUPER_SPEED') {
    return Math.round(25 * tierEffectScale(player.def.powerTier));
  }
  let bonus = 0;
  if (isActive(state, carrierIdx) && player.powerState.kind === 'active') {
    const power = player.def.power;
    if (power === 'SUPER_SPEED') bonus = Math.round(20 * player.powerState.strength);
    if (power === 'FIRE_TORCH') bonus = Math.round(30 * player.powerState.strength);
    if (power === 'PHASE_RUN') bonus = Math.round(75 * player.powerState.strength);
    if (power === 'BLINK_RUN' || power === 'DECOY_DOUBLE') {
      bonus = Math.round(25 * player.powerState.strength);
    }
  }
  // Decoy Double distracts the marker from whoever actually has the ball; the
  // hero does not need to be the carrier for the visible fake to pay off.
  for (let idx = player.team === 0 ? 0 : 11; idx < (player.team === 0 ? 11 : 22); idx += 1) {
    const hero = state.players[idx];
    if (hero.def.power === 'DECOY_DOUBLE' && isActive(state, idx)
      && hero.powerState.kind === 'active') {
      bonus = Math.max(bonus, Math.round(35 * hero.powerState.strength));
    }
  }
  return bonus;
}

export function fireSuppressed(state: MatchState, _tacklerIdx: number, carrierIdx: number): boolean {
  return isActive(state, carrierIdx)
    && (state.players[carrierIdx].def.power === 'FIRE_TORCH'
      || state.players[carrierIdx].def.power === 'PHASE_RUN');
}

export function defenseBonus(state: MatchState, idx: number): number {
  if (!isActive(state, idx)) return 0;
  const player = state.players[idx];
  if (player.powerState.kind !== 'active') return 0;
  const power = player.def.power;
  if (power === 'SUPER_STRENGTH') return Math.round(40 * player.powerState.strength);
  if (power === 'FUTURE_SIGHT') return Math.round(50 * player.powerState.strength);
  if (power === 'WEB_TRAP') return Math.round(35 * player.powerState.strength);
  if (power === 'SHADOW_MARK') return Math.round(60 * player.powerState.strength);
  return 0;
}

export function keeperSaveBonus(state: MatchState, idx: number): number {
  if (!isActive(state, idx)) return 0;
  const player = state.players[idx];
  if (player.powerState.kind !== 'active') return 0;
  const power = player.def.power;
  if (power === 'ELASTIC_KEEPER') return Math.round(75 * player.powerState.strength);
  // Giant GK covers less than a full stretch but holds it for a whole attack.
  return power === 'GIANT_GK' ? Math.round(60 * player.powerState.strength) : 0;
}

export function phaseRunPreventsShot(state: MatchState, idx: number): boolean {
  return isActive(state, idx) && state.players[idx].def.power === 'PHASE_RUN';
}
