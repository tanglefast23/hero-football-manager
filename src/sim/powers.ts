import { emit } from './events';
import { dist2, moveToward, GOAL_CENTER_X, GOAL_W, PITCH_H, PITCH_W } from './geometry';
import type { MatchInput, MatchState, OutReason, PowerId } from './types';

export const WINDUP_TICKS = 15;
export const TAP_STRENGTH = 1.0;
export const ARMED_STRENGTH = 0.9;
export const CONTEXT_AUTO_STRENGTH = 0.85;
export const LAPSE_STRENGTH = 0.75;
export const ARM_WINDOW_TICKS = 20;
export const GAUGE_TRICKLE = 0.02;
export const MAX_ZONES_PER_PLAYER = 3;
const STRENGTH_WINDUP_TICKS = 5;
const PORTAL_PROTECTION_TICKS = 10;
const WEB_ROOT_TICKS = 20;
const ICE_SLIDE_TICKS = 10;
const SHADOW_BURROW_TICKS = 20;
const SHADOW_HUNT_TICKS = 100;
const SHADOW_HUNT_RADIUS = 1900;
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
const GK_ZONE_HEAT_THRESHOLD = 5;

// Charging Super Strength closes distance faster than normal movement (the
// windup telegraph is the counterplay window, not a free pass to escape it).
// The charge starts from a broad enough range to create repeated defender
// opportunities; its visible wind-up remains the counterplay window.
export const PURSUIT_MULT = 1.65;

/** Heat cap. Heat can run well past 100 through ordinary involvement before an authored situation converts it into a Zone; it never gates firing once that Zone exists. */
const GAUGE_CAP = 200;

export function addGauge(state: MatchState, idx: number, amount: number): void {
  const p = state.players[idx];
  if (!p.def.power || p.powerState.kind !== 'idle' || p.zonesOpened >= zoneLimit(p)) return;
  const ratePercent = state.teams[p.team].heroGaugeRatePercent ?? 100;
  p.gauge = Math.min(GAUGE_CAP, p.gauge + amount * ratePercent / 100);
}

function zoneLimit(player: MatchState['players'][number]): number {
  return MAX_ZONES_PER_PLAYER + (player.encoreState === 'BANKED' ? 1 : 0);
}

/** Power-authored states that suspend ordinary movement and interaction. */
export function powerInteractionBlocked(state: MatchState, idx: number): boolean {
  const player = state.players[idx];
  return (player.webbedUntilTick ?? 0) > state.tick
    || (player.forcedMovement?.untilTick ?? 0) > state.tick
    || (player.powerState.kind === 'active'
      && player.powerState.commitment === 'SHADOW_HUNT');
}

/** Ordinary decisions are also suppressed during Strength's visible charge,
 * while the locked carrier remains free to keep moving with the ball. */
export function powerActionBlocked(state: MatchState, idx: number): boolean {
  return powerInteractionBlocked(state, idx)
    || (state.players[idx].actionLockedUntilTick ?? 0) > state.tick;
}

export function interruptWindup(state: MatchState, idx: number): void {
  const p = state.players[idx];
  if (p.powerState.kind !== 'winding') return;
  clearStrengthLock(state, idx, p.powerState.targetIdx);
  p.powerState = { kind: 'idle' };
  p.powerAnchor = undefined;
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
  if (power === 'ICE_RINK' || power === 'SHADOW_MARK') {
    return oppCarrierNear(1900);
  }
  if (power === 'GIANT_GK') return enemyOnTargetShot(state, idx);
  if (power === 'PORTAL_PASS') return friendlyCarrier !== -1
    && portalDestination(state, friendlyCarrier, projectedEffectStrength(p, LAPSE_STRENGTH)) !== null;
  if (power === 'DECOY_DOUBLE') {
    return friendlyCarrier !== -1
      && bestDecoyMarker(state, friendlyCarrier, DECOY_MARKER_RANGE,
        projectedEffectStrength(p, LAPSE_STRENGTH)) !== -1
      && bestDecoyForward(state, idx, friendlyCarrier) !== -1;
  }
  if (power === 'GUST') return b.kind === 'held' && state.players[b.by].team !== p.team;
  if (power === 'ELASTIC_KEEPER') return enemyOnTargetShot(state, idx);
  if (power === 'GRAVITY_WELL') return gravityWellContext(state, idx);
  if (power === 'FIRE_TORCH') {
    return relevantTorchMarker(state, idx, torchAcquisitionRange(p, LAPSE_STRENGTH)) !== -1;
  }
  if (power === 'BLINK_RUN' || power === 'THUNDER_STRIKE') {
    return b.kind === 'held' && b.by === idx
      && attackingProgress(p.team, p.pos) > PITCH_H * 0.45;
  }
  if (power === 'PHASE_RUN') {
    return b.kind === 'held' && b.by === idx && phaseChallenger(state, idx) !== -1;
  }
  if (power === 'SUPER_SPEED') {
    return (b.kind === 'held' && b.by === idx
      && attackingProgress(p.team, p.pos) > PITCH_H * 0.5)
      || (b.kind === 'loose'
        && dist2(b.pos, p.pos) < SPEED_LOOSE_BALL_RANGE * SPEED_LOOSE_BALL_RANGE);
  }
  return true;
}

// FIRE_TORCH's ignite radius. inUsefulContext references this SAME constant for
// the power's useful context (Task 13 pre-flight, Issue A) so "I see a context"
// and "someone is close enough to catch fire" can never drift apart, the same
// guarantee STRENGTH_LOCK_RANGE gives Super Strength.
export const TORCH_IGNITE_RANGE = 1400;
const FIRE_FULL_MATCHUP_ADVANTAGE = 4;
const FIRE_SATURATED_MATCHUP_ADVANTAGE = 15;
const FIRE_MIN_MARKER_TICKS = 4;
/** m1.13 ranges, sized against the existing proximity powers (Web Trap 1500, Future Sight 1900). */
const ICE_RINK_RANGE = 1500;
const ICE_RINK_TRIGGER_RANGE = 1300;
const GRAVITY_WELL_RANGE = 1500;
const SHADOW_MARK_RANGE = 1900;
const PHASE_REVALIDATE_RANGE = 1400;
const RALLY_CRY_RANGE = 2600;
const RALLY_CRY_TEAMMATE_HEAT = 35;
const DECOY_MARKER_RANGE = 1900;
export const WEB_TRAP_TRIGGER_RANGE = 1500;
// SUPER_SPEED's useful context distance to a loose ball worth a sprint for.
const SPEED_LOOSE_BALL_RANGE = 1500;

/** A useful moment is developing. Heat may open the Zone here, while firing
 * still waits for the stricter inUsefulContext below. */
export function zoneEntryContext(state: MatchState, idx: number): boolean {
  const player = state.players[idx];
  const power = player.def.power;
  if (!power) return false;
  const carrying = state.ball.kind === 'held' && state.ball.by === idx;
  const progress = player.team === 0 ? PITCH_H - player.pos.y : player.pos.y;
  if (power === 'BLINK_RUN' || power === 'THUNDER_STRIKE') {
    return carrying && progress > PITCH_H * 0.45;
  }
  if (power === 'SUPER_SPEED') {
    return (carrying && progress > PITCH_H * 0.38)
      || (state.ball.kind === 'loose'
        && dist2(state.ball.pos, player.pos) < SPEED_LOOSE_BALL_RANGE * SPEED_LOOSE_BALL_RANGE);
  }
  if (power === 'FIRE_TORCH') return carrying && progress > PITCH_H * 0.52;
  if (power === 'PORTAL_PASS' && state.ball.kind === 'held') {
    const carrier = state.players[state.ball.by];
    const portalStrength = player.firePolicy === 'SAVE_FOR_TAP'
      ? TAP_STRENGTH : CONTEXT_AUTO_STRENGTH;
    return carrier.team === player.team
      && portalDestination(
        state,
        state.ball.by,
        projectedEffectStrength(player, portalStrength),
      ) !== null;
  }
  if (power === 'GRAVITY_WELL') {
    return gravityWellContext(state, idx);
  }
  if (power === 'ELASTIC_KEEPER' || power === 'GIANT_GK') {
    return dangerousKeeperPossession(state, idx) || enemyOnTargetShot(state, idx);
  }
  return inUsefulContext(state, idx);
}

function dangerousKeeperPossession(state: MatchState, idx: number): boolean {
  const keeper = state.players[idx];
  if (keeper.def.role !== 'GK' || state.ball.kind !== 'held') return false;
  const carrier = state.players[state.ball.by];
  if (carrier.team === keeper.team) return false;
  const progress = carrier.team === 0 ? PITCH_H - carrier.pos.y : carrier.pos.y;
  return progress > PITCH_H * 0.72;
}

function enemyOnTargetShot(state: MatchState, idx: number): boolean {
  const keeper = state.players[idx];
  const ball = state.ball;
  return keeper.def.role === 'GK' && ball.kind === 'shot'
    && state.players[ball.by].team !== keeper.team
    && !ball.keeperChecked
    && Math.abs(ball.targetX - GOAL_CENTER_X) <= GOAL_W / 2;
}

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

/** The next available defender genuinely between a Phase runner and goal. */
function phaseChallenger(state: MatchState, idx: number, range = 700): number {
  const runner = state.players[idx];
  const direction = runner.team === 0 ? -1 : 1;
  let best = -1;
  let bestDistance = range * range;
  for (let candidate = 0; candidate < 22; candidate += 1) {
    const opponent = state.players[candidate];
    if (opponent.team === runner.team || opponent.outUntilTick > state.tick
      || opponent.slideTackle !== undefined || opponent.tackleRecoveryUntil > state.tick) continue;
    const forwardDistance = (opponent.pos.y - runner.pos.y) * direction;
    const distance = dist2(opponent.pos, runner.pos);
    if (forwardDistance <= 0 || distance >= bestDistance) continue;
    best = candidate;
    bestDistance = distance;
  }
  return best;
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
    return bestEncoreCandidate(state, idx) !== -1;
  }
  if (power === 'ICE_RINK') return oppCarrierNear(ICE_RINK_RANGE);
  if (power === 'GRAVITY_WELL') return gravityWellContext(state, idx);
  if (power === 'SHADOW_MARK') return oppCarrierNear(SHADOW_MARK_RANGE);
  if (power === 'GIANT_GK') return enemyOnTargetShot(state, idx);
  if (power === 'GUST') {
    return b.kind === 'held' && state.players[b.by].team !== p.team;
  }
  if (power === 'ELASTIC_KEEPER') return enemyOnTargetShot(state, idx);
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
    && Math.abs(p.pos.x - PITCH_W / 2) < 1600;
  if (power === 'PHASE_RUN') return isCarrier && phaseChallenger(state, idx) !== -1
    && attackingProgress < PITCH_H * 0.82;
  if (power === 'PORTAL_PASS') {
    const portalStrength = p.firePolicy === 'SAVE_FOR_TAP' ? TAP_STRENGTH : CONTEXT_AUTO_STRENGTH;
    return friendlyCarrier !== -1 && opponentWithin(state, friendlyCarrier, 1100)
      && portalDestination(state, friendlyCarrier, projectedEffectStrength(p, portalStrength)) !== null;
  }
  if (power === 'DECOY_DOUBLE') {
    if (friendlyCarrier === -1) return false;
    const carrier = state.players[friendlyCarrier];
    const carrierProgress = carrier.team === 0 ? PITCH_H - carrier.pos.y : carrier.pos.y;
    const decoyStrength = p.firePolicy === 'SAVE_FOR_TAP' ? TAP_STRENGTH : CONTEXT_AUTO_STRENGTH;
    return carrierProgress > PITCH_H * 0.38
      && bestDecoyMarker(state, friendlyCarrier, DECOY_MARKER_RANGE,
        projectedEffectStrength(p, decoyStrength)) !== -1
      && bestDecoyForward(state, idx, friendlyCarrier) !== -1;
  }
  // Fire Torch cashes out an attacking run by removing the marker between the
  // carrier and goal. A nearby defender behind the play is not useful.
  const torchStrength = p.firePolicy === 'SAVE_FOR_TAP' ? TAP_STRENGTH : CONTEXT_AUTO_STRENGTH;
  return attackingProgress > PITCH_H * 0.58
    && relevantTorchMarker(state, idx, torchAcquisitionRange(p, torchStrength)) !== -1;
}

function startWindup(state: MatchState, idx: number, strength: number): void {
  const p = state.players[idx];
  let targetIdx: number | undefined;
  let secondaryTargetIdx: number | undefined;
  let secondaryAnchor: { x: number; y: number } | undefined;
  let carrierIdx: number | undefined;
  let runnerIdx: number | undefined;
  let runnerAnchor: { x: number; y: number } | undefined;
  p.powerAnchor = undefined;
  if ((p.def.power === 'SUPER_STRENGTH' || p.def.power === 'WEB_TRAP'
    || p.def.power === 'ICE_RINK')
    && state.ball.kind === 'held') {
    const carrier = state.players[state.ball.by];
    const range = p.def.power === 'SUPER_STRENGTH' ? STRENGTH_LOCK_RANGE
      : p.def.power === 'ICE_RINK' ? ICE_RINK_RANGE
        : 1900;
    if (carrier.team !== p.team && dist2(carrier.pos, p.pos) < range * range) {
      targetIdx = state.ball.by;
      if (p.def.power === 'SUPER_STRENGTH') {
        carrier.actionLockedUntilTick = state.tick + STRENGTH_WINDUP_TICKS;
        carrier.actionLockSourceIdx = idx;
      }
    }
  }
  if (p.def.power === 'FIRE_TORCH') {
    const marker = relevantTorchMarkers(state, idx, torchAcquisitionRange(p, strength), 1)[0] ?? -1;
    if (marker !== -1) targetIdx = marker;
  }
  if (p.def.power === 'PHASE_RUN' && state.ball.kind === 'held' && state.ball.by === idx) {
    const challenger = phaseChallenger(state, idx, PHASE_REVALIDATE_RANGE);
    if (challenger !== -1) targetIdx = challenger;
  }
  if (p.def.power === 'DECOY_DOUBLE' && state.ball.kind === 'held'
    && state.players[state.ball.by].team === p.team) {
    const effectStrength = projectedEffectStrength(p, strength);
    const marker = bestDecoyMarker(state, state.ball.by, DECOY_MARKER_RANGE, effectStrength);
    if (marker !== -1) {
      carrierIdx = state.ball.by;
      targetIdx = marker;
      p.powerAnchor = decoyFalseLane(state, carrierIdx, marker, effectStrength);
      const receiver = bestDecoyForward(state, idx, carrierIdx);
      if (receiver !== -1) {
        runnerIdx = receiver;
        runnerAnchor = decoyClonePosition(state, carrierIdx, marker, effectStrength);
      }
    }
  }
  if (p.def.power === 'GRAVITY_WELL' && state.ball.kind === 'held'
    && state.players[state.ball.by].team === p.team) {
    const [blocker, secondBlocker] = gravityLaneBlockers(state, idx).slice(0, 2);
    if (blocker !== undefined) {
      carrierIdx = state.ball.by;
      targetIdx = blocker;
      p.powerAnchor = gravityPullDestination(
        state,
        idx,
        carrierIdx,
        blocker,
        activationGrade(p, strength),
      );
      if (secondBlocker !== undefined) {
        secondaryTargetIdx = secondBlocker;
        secondaryAnchor = gravityPullDestination(
          state,
          idx,
          carrierIdx,
          secondBlocker,
          activationGrade(p, strength),
        );
      }
      const runner = gravityRunner(state, idx, carrierIdx, blocker);
      if (runner !== null) {
        runnerIdx = runner.idx;
        runnerAnchor = runner.pos;
      }
    }
  }
  p.powerState = {
    kind: 'winding',
    untilTick: state.tick + (p.def.power === 'SUPER_STRENGTH' ? STRENGTH_WINDUP_TICKS : WINDUP_TICKS),
    strength,
    targetIdx,
    targetPlayerId: targetIdx === undefined ? undefined : state.players[targetIdx].def.id,
    secondaryTargetIdx,
    secondaryTargetPlayerId: secondaryTargetIdx === undefined
      ? undefined : state.players[secondaryTargetIdx].def.id,
    secondaryAnchor,
    carrierIdx,
    runnerIdx,
    runnerPlayerId: runnerIdx === undefined ? undefined : state.players[runnerIdx].def.id,
    runnerAnchor,
  };
}

/** Keeper powers resolve against the shot already on screen. A normal windup
 * would finish only after that shot had crossed the keeper plane. */
function beginPower(state: MatchState, idx: number, strength: number): boolean {
  const power = state.players[idx].def.power;
  if (power === 'ELASTIC_KEEPER' || power === 'GIANT_GK') {
    if (!enemyOnTargetShot(state, idx)) return false;
    activatePower(state, idx, strength);
    return true;
  }
  startWindup(state, idx, strength);
  return true;
}

export function powerTick(state: MatchState, dueInputs: readonly MatchInput[] = []): void {
  for (const player of state.players) {
    if ((player.webbedUntilTick ?? 0) <= state.tick) player.webbedUntilTick = undefined;
    if ((player.portalProtectedUntilTick ?? 0) <= state.tick) player.portalProtectedUntilTick = undefined;
    if (player.forcedMovement !== undefined && player.forcedMovement.untilTick <= state.tick) {
      player.forcedMovement = undefined;
    }
    if ((player.actionLockedUntilTick ?? 0) <= state.tick) {
      player.actionLockedUntilTick = undefined;
      player.actionLockSourceIdx = undefined;
    }
  }
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
        beginPower(state, input.player, TAP_STRENGTH);
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
      const roleTrickle = p.def.role === 'GK' ? 0.04
        : p.def.role === 'DEF' ? 0.06
          : p.def.role === 'MID' ? 0.035
            : GAUGE_TRICKLE;
      addGauge(state, idx, roleTrickle + (defensiveEngagement ? DEFENSIVE_ENGAGEMENT_TRICKLE : 0));
      // Heat is never spent on an unusable window. It remains banked until the
      // authored situation appears, then converts without a second luck check.
      // This runs before movement/possession in ascending player order, so the
      // context and event remain byte-identical for the same replay inputs.
      const zoneThreshold = p.def.role === 'GK' ? GK_ZONE_HEAT_THRESHOLD : ZONE_HEAT_THRESHOLD;
      const keeperAutoShot = p.def.role === 'GK' && p.firePolicy === 'FIRE_WHEN_READY';
      const entryContext = keeperAutoShot ? enemyOnTargetShot(state, idx) : zoneEntryContext(state, idx);
      if (p.zonesOpened < zoneLimit(p) && p.gauge >= zoneThreshold && entryContext) {
        p.powerState = { kind: 'zone', remainingTicks: ZONE_WINDOW_TICKS };
        p.zonesOpened++;
        if (p.zonesOpened > MAX_ZONES_PER_PLAYER && p.encoreState === 'BANKED') {
          p.encoreState = 'CONSUMED';
        }
        p.gauge = 0;
        emit(state, { t: state.tick, kind: 'POWER_READY', player: idx }); // event kind retained; now means Zone entry
      }
    } else if (p.powerState.kind === 'zone') {
      if (p.firePolicy === 'FIRE_WHEN_READY') {
        const blind = p.team === 0 && state.blindAutoHome;
        const keeperPower = p.def.power === 'ELASTIC_KEEPER' || p.def.power === 'GIANT_GK';
        if ((!keeperPower && blind) || inUsefulContext(state, idx)) {
          beginPower(state, idx, CONTEXT_AUTO_STRENGTH);
        }
        // Late in the window, settle for a usable target rather than waste the
        // Zone. Target-requiring powers still only fire when one resolves, so a
        // power with nothing to act on expires like a manual miss.
        else if (p.powerState.remainingTicks <= LATE_WINDOW_TICKS && hasUsableTarget(state, idx)) {
          beginPower(state, idx, LAPSE_STRENGTH);
        }
      }
      // SAVE_FOR_TAP heroes never auto-fire — a missed window only decays heat.
      if (p.powerState.kind === 'zone') {
        const keeperPower = p.def.power === 'ELASTIC_KEEPER' || p.def.power === 'GIANT_GK';
        const liveEnemyAttack = state.ball.kind === 'held'
          && state.players[state.ball.by].team !== p.team;
        // A keeper Zone earned during danger waits for that attack's shot instead
        // of expiring between passes. Watched play still matters because the tap
        // must land on the shot (or arm a 20-tick placement); the underlying Zone
        // should not disappear before that decision is available.
        if (!(keeperPower && liveEnemyAttack)) {
          p.powerState.remainingTicks--;
        }
        if (p.powerState.remainingTicks <= 0) {
          emit(state, { t: state.tick, kind: 'POWER_EXPIRED', player: idx });
          p.gauge = 50;
          p.powerState = { kind: 'idle' };
        }
      }
    } else if (p.powerState.kind === 'armed') {
      const available = p.outUntilTick <= state.tick && !tacklingBusy;
      if (available && inUsefulContext(state, idx)) {
        beginPower(state, idx, ARMED_STRENGTH);
      } else {
        p.powerState.remainingTicks--;
        if (p.powerState.remainingTicks <= 0) {
          // Pressing places a real 20-tick window. If the ideal moment never
          // arrives but the authored play is still broadly alive at its edge,
          // cash it at the armed grade instead of treating a correctly placed
          // press as identical to never watching the match.
          if (available && hasUsableTarget(state, idx)) {
            beginPower(state, idx, ARMED_STRENGTH);
          } else {
            emit(state, { t: state.tick, kind: 'POWER_EXPIRED', player: idx });
            p.gauge = 50;
            p.powerState = { kind: 'idle' };
          }
        }
      }
    } else if (p.powerState.kind === 'winding') {
      if (state.tick >= p.powerState.untilTick) activatePower(state, idx, p.powerState.strength, p.powerState.targetIdx);
    } else if (p.powerState.kind === 'active') {
      if (p.def.power === 'WEB_TRAP') springWebTrap(state, idx);
      if (p.powerState.kind === 'active' && p.def.power === 'ICE_RINK') springIceRink(state, idx);
      if (p.powerState.kind === 'active' && p.def.power === 'SHADOW_MARK') springShadowHunt(state, idx);
      if (p.powerState.kind === 'active' && p.def.power === 'SHADOW_MARK'
        && state.ball.kind === 'held' && state.players[state.ball.by].team === p.team) {
        finishMomentPower(state, idx);
      }
      if (p.powerState.kind === 'active'
        && (p.def.power === 'DECOY_DOUBLE' || p.def.power === 'GRAVITY_WELL')) {
        const carrierIdx = p.powerState.carrierIdx;
        const friendlyAttack = state.ball.kind === 'held'
          ? carrierIdx !== undefined && state.ball.by === carrierIdx
          : state.ball.kind === 'pass' && carrierIdx !== undefined && state.ball.from === carrierIdx;
        if (!friendlyAttack) {
          finishMomentPower(state, idx);
        }
      }
      if (p.powerState.kind === 'active'
        && (p.powerState.commitment === 'THUNDER_SHOT'
          || p.powerState.commitment === 'SPEED_ACTION'
          || p.powerState.commitment === 'BLINK_ACTION'
          || p.powerState.commitment === 'FIRE_RUN'
          || p.powerState.commitment === 'PHASE_ACTION')
        && !(state.ball.kind === 'held' && state.ball.by === idx)) {
        finishMomentPower(state, idx);
      }
      if (p.powerState.kind === 'active'
        && (p.def.power === 'GIANT_GK' || p.def.power === 'ELASTIC_KEEPER')
        && state.ball.kind === 'held' && state.players[state.ball.by].team === p.team) {
        finishMomentPower(state, idx);
      }
      const attackScopedKeeper = p.powerState.kind === 'active'
        && (p.def.power === 'GIANT_GK' || p.def.power === 'ELASTIC_KEEPER')
        && !(state.ball.kind === 'held' && state.players[state.ball.by].team === p.team);
      if (p.powerState.kind === 'active' && !attackScopedKeeper && state.tick >= p.powerState.untilTick) {
        finishMomentPower(state, idx);
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
  SHADOW_MARK: 220,
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
      return 1.15;
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

/** Timing/tier grade with the family calibration divided back out. Geometry
 * uses this value so auto, a good tap, and Tier 3 remain distinguishable
 * without turning an unrelated team stat into a hidden multiplier. */
function activeActivationGrade(player: MatchState['players'][number]): number {
  if (player.powerState.kind !== 'active' || player.def.power === undefined) return 1;
  return player.powerState.strength / familyEffectScale(player.def.power);
}

function activationGrade(
  player: MatchState['players'][number],
  strength: number,
): number {
  return strength * manualTimingScale(strength) * tierEffectScale(player.def.powerTier);
}

function upgradeLift(grade: number): number {
  return Math.max(0, grade - 1.15);
}

function clampEffect(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const AUTO_ACTIVATION_GRADE = CONTEXT_AUTO_STRENGTH;
const MANUAL_ACTIVATION_GRADE = TAP_STRENGTH * 1.15;
const TIER3_MANUAL_ACTIVATION_GRADE = MANUAL_ACTIVATION_GRADE * 1.45;

/** Piecewise calibration through the three measured balance anchors. Armed and
 * lapse grades interpolate naturally between them; values outside the measured
 * range clamp instead of creating a new runaway tier. */
function anchoredEffect(
  grade: number,
  autoValue: number,
  manualValue: number,
  tier3Value: number,
): number {
  if (grade <= MANUAL_ACTIVATION_GRADE) {
    const progress = clampEffect(
      (grade - AUTO_ACTIVATION_GRADE)
        / (MANUAL_ACTIVATION_GRADE - AUTO_ACTIVATION_GRADE),
      0,
      1,
    );
    return autoValue + (manualValue - autoValue) * progress;
  }
  const progress = clampEffect(
    (grade - MANUAL_ACTIVATION_GRADE)
      / (TIER3_MANUAL_ACTIVATION_GRADE - MANUAL_ACTIVATION_GRADE),
    0,
    1,
  );
  return manualValue + (tier3Value - manualValue) * progress;
}

/** The one authored finish earned by an attacking power. This never changes a
 * team stat: it applies only to the hero's committed shot and disappears when
 * that single action resolves. */
export function powerFinishShotProfile(
  state: MatchState,
  idx: number,
): { aimScale: number; powerBonus: number } | null {
  const player = state.players[idx];
  if (!isActive(state, idx) || player.powerState.kind !== 'active') return null;
  const grade = activeActivationGrade(player);
  const commitment = player.powerState.commitment;

  if (player.def.power === 'THUNDER_STRIKE' && commitment === 'THUNDER_SHOT') {
    return {
      aimScale: clampEffect(0.90 - 0.30 * grade, 0.38, 0.66),
      powerBonus: Math.round(70 * player.powerState.strength),
    };
  }

  const authored = player.def.power === 'SUPER_SPEED' && commitment === 'SPEED_ACTION'
    ? { aimScale: anchoredEffect(grade, 0.85, 0.77, 0.74), power: anchoredEffect(grade, 22, 28, 34) }
    : player.def.power === 'BLINK_RUN' && commitment === 'BLINK_ACTION'
      ? { aimScale: anchoredEffect(grade, 0.78, 0.779, 0.76), power: anchoredEffect(grade, 26, 27, 30) }
      : player.def.power === 'FIRE_TORCH' && commitment === 'FIRE_RUN'
        ? { aimScale: anchoredEffect(grade, 0.79, 0.77, 0.60), power: anchoredEffect(grade, 24, 26, 55) }
        : player.def.power === 'PHASE_RUN' && commitment === 'PHASE_ACTION'
          ? { aimScale: anchoredEffect(grade, 0.98, 0.88, 0.78), power: anchoredEffect(grade, 4, 14, 26) }
          : null;
  return authored === null ? null : {
    aimScale: authored.aimScale,
    powerBonus: Math.round(authored.power),
  };
}

function projectedEffectStrength(
  player: MatchState['players'][number],
  strength: number,
): number {
  const power = player.def.power;
  return power === undefined ? strength : strength
    * manualTimingScale(strength)
    * tierEffectScale(player.def.powerTier)
    * familyEffectScale(power);
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
    finishMomentPower(state, idx);
  }
  p.decoyClone = undefined;
  p.webbedUntilTick = undefined;
  p.portalProtectedUntilTick = undefined;
  p.forcedMovement = undefined;
  p.actionLockedUntilTick = undefined;
  p.actionLockSourceIdx = undefined;
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
  const winding = p.powerState.kind === 'winding' ? p.powerState : undefined;
  const capturedTargetIdx = targetIdx ?? winding?.targetIdx;
  const capturedTargetPlayerId = winding?.targetPlayerId;
  const capturedSecondaryTargetIdx = winding?.secondaryTargetIdx;
  const capturedSecondaryTargetPlayerId = winding?.secondaryTargetPlayerId;
  const capturedSecondaryAnchor = winding?.secondaryAnchor === undefined
    ? undefined : { ...winding.secondaryAnchor };
  const capturedCarrierIdx = winding?.carrierIdx;
  const capturedRunnerIdx = winding?.runnerIdx;
  const capturedRunnerPlayerId = winding?.runnerPlayerId;
  const capturedRunnerAnchor = winding?.runnerAnchor === undefined
    ? undefined : { ...winding.runnerAnchor };
  const capturedAnchor = winding !== undefined && p.powerAnchor !== undefined
    ? { ...p.powerAnchor } : undefined;
  const tierScale = tierEffectScale(p.def.powerTier);
  const timingScale = manualTimingScale(strength);
  const effectStrength = projectedEffectStrength(p, strength);
  const friendlyCarrier = state.ball.kind === 'held' && state.players[state.ball.by].team === p.team
    ? state.ball.by : -1;
  const hasDecoyCapture = power === 'DECOY_DOUBLE'
    && capturedCarrierIdx !== undefined
    && capturedTargetIdx !== undefined
    && capturedAnchor !== undefined
    && capturedRunnerIdx !== undefined
    && capturedRunnerAnchor !== undefined;
  const capturedDecoyTargetValid = hasDecoyCapture && capturedTargetIdx !== undefined
    && capturedTargetAvailable(
      state,
      p.team,
      capturedTargetIdx,
      capturedTargetPlayerId,
    );
  // A friendly pass may carry the placed support play forward, but a turnover
  // cancels it. Moving an opponent according to a stale attacking lane can
  // improve their counterattack, so captured geometry never survives a change
  // of team possession.
  const decoyCarrier = power === 'DECOY_DOUBLE' ? friendlyCarrier : -1;
  const decoyMarker = hasDecoyCapture
    ? (capturedDecoyTargetValid ? capturedTargetIdx! : -1)
    : power === 'DECOY_DOUBLE' && decoyCarrier !== -1
    ? bestDecoyMarker(state, friendlyCarrier, DECOY_MARKER_RANGE, effectStrength) : -1;
  const capturedDecoyRunnerValid = hasDecoyCapture && capturedRunnerIdx !== undefined
    && friendlyTargetAvailable(state, p.team, capturedRunnerIdx, capturedRunnerPlayerId)
    && capturedRunnerIdx !== decoyCarrier
    && state.players[capturedRunnerIdx].def.role === 'FWD';
  const decoyRunner = hasDecoyCapture
    ? (capturedDecoyRunnerValid ? capturedRunnerIdx! : -1)
    : power === 'DECOY_DOUBLE' && decoyCarrier !== -1
      ? bestDecoyForward(state, idx, decoyCarrier) : -1;
  const decoyCloneAnchor = hasDecoyCapture
    ? capturedRunnerAnchor
    : power === 'DECOY_DOUBLE' && decoyCarrier !== -1 && decoyMarker !== -1
      ? decoyClonePosition(state, decoyCarrier, decoyMarker, effectStrength)
      : undefined;
  const gravityCaptured = power === 'GRAVITY_WELL'
    && capturedCarrierIdx !== undefined
    && capturedTargetIdx !== undefined
    && capturedAnchor !== undefined;
  const capturedGravityPrimaryValid = gravityCaptured && capturedTargetIdx !== undefined
    && capturedTargetAvailable(
      state,
      p.team,
      capturedTargetIdx,
      capturedTargetPlayerId,
    );
  const capturedGravitySecondaryValid = gravityCaptured
    && capturedSecondaryTargetIdx !== undefined
    && capturedSecondaryAnchor !== undefined
    && capturedTargetAvailable(
      state,
      p.team,
      capturedSecondaryTargetIdx,
      capturedSecondaryTargetPlayerId,
    );
  const capturedGravityRunnerValid = power === 'GRAVITY_WELL'
    && capturedRunnerIdx !== undefined
    && capturedRunnerAnchor !== undefined
    && friendlyTargetAvailable(state, p.team, capturedRunnerIdx, capturedRunnerPlayerId);
  const fireMarkers = power === 'FIRE_TORCH'
    ? relevantTorchMarkers(state, idx, torchAcquisitionRange(p, strength), p.def.powerTier ?? 1)
    : [];
  const rallyTarget = power === 'RALLY_CRY' ? bestEncoreCandidate(state, idx) : -1;
  const staleOffBallContext = (power === 'DECOY_DOUBLE'
      && (decoyCarrier === -1 || decoyMarker === -1 || decoyRunner === -1
        || decoyCloneAnchor === undefined))
    || (power === 'GRAVITY_WELL'
      && (gravityCaptured
        ? friendlyCarrier === -1
          || (!capturedGravityPrimaryValid && !capturedGravitySecondaryValid)
          || !capturedGravityRunnerValid
        : !gravityWellContext(state, idx)));
  const targetlessMoment = (power === 'FIRE_TORCH' && fireMarkers.length === 0)
    || (power === 'RALLY_CRY' && rallyTarget === -1);
  if (staleOffBallContext || targetlessMoment) {
    // These powers promise a live team attack. If the situation disappears
    // during the wind-up, refund the canonical half Heat instead of animating
    // and charging a power that cannot perform its authored action.
    if (p.powerState.kind === 'winding') interruptWindup(state, idx);
    else {
      p.powerState = { kind: 'idle' };
      p.powerAnchor = undefined;
      p.gauge = 50;
    }
    return;
  }
  emit(state, { t: state.tick, kind: 'POWER_FIRED', player: idx, power, strength });
  // Portal Pass resolves completely at activation. Its active state is only a
  // short cooldown/Heat lock, so extending that inert state would make a
  // higher-tier hero strictly worse after the same instantaneous transfer.
  const durationStrength = power === 'PORTAL_PASS' ? 1 : strength * timingScale * tierScale;
  const durationTicks = power === 'SUPER_SPEED'
    ? Math.round(anchoredEffect(durationStrength, 80, 90, 100))
    : power === 'FUTURE_SIGHT'
      ? Math.round(anchoredEffect(durationStrength, 180, 200, 240))
    : power === 'SHADOW_MARK'
      ? SHADOW_BURROW_TICKS + SHADOW_HUNT_TICKS
    : Math.round(DUR[power] * durationStrength);
  p.powerState = {
    kind: 'active',
    untilTick: state.tick + durationTicks,
    strength: effectStrength,
    ...(power === 'SUPER_SPEED' && state.ball.kind === 'held' && state.ball.by === idx
      ? { commitment: 'SPEED_ACTION' as const }
      : power === 'THUNDER_STRIKE' ? { commitment: 'THUNDER_SHOT' as const }
        : power === 'BLINK_RUN' ? { commitment: 'BLINK_ACTION' as const }
          : power === 'FIRE_TORCH' ? { commitment: 'FIRE_RUN' as const }
            : power === 'PHASE_RUN' ? { commitment: 'PHASE_ACTION' as const }
              : power === 'SHADOW_MARK'
                ? { commitment: 'SHADOW_HUNT' as const, armedAtTick: state.tick + SHADOW_BURROW_TICKS }
              : {}),
    ...(capturedRunnerIdx === undefined ? {} : {
      runnerIdx: capturedRunnerIdx,
      runnerPlayerId: capturedRunnerPlayerId,
      runnerAnchor: capturedRunnerAnchor,
    }),
  };
  p.powerAnchor = power === 'WEB_TRAP' && capturedTargetIdx !== undefined
    ? { ...state.players[capturedTargetIdx].pos }
    : power === 'ICE_RINK' && capturedTargetIdx !== undefined
      ? { ...state.players[capturedTargetIdx].pos }
      : (power === 'DECOY_DOUBLE' || power === 'GRAVITY_WELL') && capturedAnchor !== undefined
        ? capturedAnchor
      : power === 'SHADOW_MARK' ? { ...p.pos }
      : power === 'WEB_TRAP' || power === 'ICE_RINK'
        ? { ...p.pos }
        : undefined;
  p.gauge = 0;

  if (power === 'FIRE_TORCH') {
    let longestRemovalUntilTick = state.tick;
    for (const marker of fireMarkers) {
      // Contextual timing earns a brief visible opening against the goal-side
      // marker. Fire's active attacking burst carries the rest of its value;
      // extending 11-v-10 play creates runaway score tails in mismatch games.
      const resistance = state.players[marker].def.attrs.def;
      const matchupAdvantage = p.def.attrs.tec - resistance;
      const matchupHeadroom = clampEffect(
        (FIRE_SATURATED_MATCHUP_ADVANTAGE - matchupAdvantage)
          / (FIRE_SATURATED_MATCHUP_ADVANTAGE - FIRE_FULL_MATCHUP_ADVANTAGE),
        0,
        1,
      );
      const fullRemovalTicks = Math.round(10 * effectStrength);
      const removalTicks = Math.round(
        FIRE_MIN_MARKER_TICKS + (fullRemovalTicks - FIRE_MIN_MARKER_TICKS) * matchupHeadroom,
      );
      const removalUntilTick = state.tick + removalTicks;
      knockOut(state, marker, removalUntilTick, 'ignited');
      // Fire must finish during the same visible opening. Letting the committed
      // run outlive its marker creates extra automatic shots in already-lopsided
      // matches even after the marker has recovered.
      longestRemovalUntilTick = Math.max(longestRemovalUntilTick, removalUntilTick);
      emit(state, { t: state.tick, kind: 'IGNITED', player: marker });
    }
    if (p.powerState.kind === 'active') p.powerState.untilTick = longestRemovalUntilTick;
  } else if (power === 'SUPER_STRENGTH') {
    const stableTarget = capturedTargetIdx !== undefined
      && (capturedTargetPlayerId === undefined
        || state.players[capturedTargetIdx]?.def.id === capturedTargetPlayerId)
      && state.ball.kind === 'held' && state.ball.by === capturedTargetIdx;
    if (p.outUntilTick <= state.tick && stableTarget && capturedTargetIdx !== undefined) {
      const target = state.players[capturedTargetIdx];
      if (target.outUntilTick <= state.tick) {
        p.pos = moveToward(p.pos, target.pos, strengthLandingRange(p, strength));
        const grade = activeActivationGrade(p);
        const flattenTicks = Math.round(90 + 70 * grade + 50 * upgradeLift(grade));
        clearStrengthLock(state, idx, capturedTargetIdx);
        knockOut(state, capturedTargetIdx, state.tick + flattenTicks, 'ko');
        state.ball = { kind: 'held', by: idx };
        emit(state, { t: state.tick, kind: 'TACKLE', by: idx, on: capturedTargetIdx, won: true, style: 'power', contact: true });
      }
    }
    clearStrengthLock(state, idx, capturedTargetIdx);
    finishMomentPower(state, idx);
  } else if (power === 'BLINK_RUN') {
    p.pos = blinkDestination(state, idx, effectStrength);
  } else if (power === 'PORTAL_PASS') {
    if (state.ball.kind === 'held' && state.players[state.ball.by].team === p.team) {
      const destination = portalDestination(state, state.ball.by, effectStrength);
      if (destination !== null) {
        state.players[destination.receiver].pos = destination.pos;
        state.players[destination.receiver].portalProtectedUntilTick = state.tick + PORTAL_PROTECTION_TICKS;
        state.ball = { kind: 'held', by: destination.receiver };
      }
    }
  } else if (power === 'PHASE_RUN') {
    const locked = targetIdx === undefined ? -1 : targetIdx;
    const lockedOpponent = locked !== -1 && state.players[locked].team !== p.team
      && state.players[locked].outUntilTick <= state.tick
      && dist2(state.players[locked].pos, p.pos) < PHASE_REVALIDATE_RANGE * PHASE_REVALIDATE_RANGE;
    const challenger = state.ball.kind === 'held' && state.ball.by === idx
      ? (lockedOpponent ? locked : phaseChallenger(state, idx, PHASE_REVALIDATE_RANGE)) : -1;
    if (challenger !== -1) consumePhaseChallenge(state, idx, challenger);
    else finishMomentPower(state, idx);
  } else if (power === 'GRAVITY_WELL') {
    if (gravityCaptured && capturedTargetIdx !== undefined && friendlyCarrier !== -1
      && p.powerAnchor !== undefined) {
      if (p.powerState.kind === 'active') {
        p.powerState.carrierIdx = friendlyCarrier;
        p.powerState.targetIdx = capturedGravityPrimaryValid ? capturedTargetIdx : undefined;
        p.powerState.secondaryTargetIdx = capturedGravitySecondaryValid
          ? capturedSecondaryTargetIdx : undefined;
        p.powerState.secondaryAnchor = capturedGravitySecondaryValid
          ? capturedSecondaryAnchor : undefined;
        p.powerState.runnerIdx = capturedGravityRunnerValid ? capturedRunnerIdx : undefined;
        p.powerState.runnerPlayerId = capturedGravityRunnerValid ? capturedRunnerPlayerId : undefined;
        p.powerState.runnerAnchor = capturedGravityRunnerValid ? capturedRunnerAnchor : undefined;
      }
      if (capturedGravityPrimaryValid) {
        state.players[capturedTargetIdx].pos = { ...p.powerAnchor };
      }
      if (capturedGravitySecondaryValid && capturedSecondaryTargetIdx !== undefined
        && capturedSecondaryAnchor !== undefined) {
        state.players[capturedSecondaryTargetIdx].pos = capturedSecondaryAnchor;
      }
    } else if (state.ball.kind === 'held' && state.players[state.ball.by].team === p.team) {
      if (p.powerState.kind === 'active') p.powerState.carrierIdx = state.ball.by;
      applyGravityWell(state, idx);
    } else finishMomentPower(state, idx);
  } else if (power === 'DECOY_DOUBLE') {
    // The visible wind-up places a false run. Once placed, a later pass cannot
    // erase the telegraphed lure before it lands; the original attack still
    // owns only the single captured marker and destination.
    const carrier = decoyCarrier;
    const marker = decoyMarker;
    if (carrier !== -1 && marker !== -1) {
      p.powerAnchor = capturedAnchor
        ?? decoyFalseLane(state, carrier, marker, effectStrength);
      if (p.powerState.kind === 'active') {
        p.powerState.targetIdx = marker;
        p.powerState.carrierIdx = carrier;
        const grade = activeActivationGrade(p);
        const reactionStep = Math.round(260 + 320 * grade + 700 * upgradeLift(grade));
        state.players[marker].pos = moveToward(state.players[marker].pos, p.powerAnchor, reactionStep);
        p.decoyClone = {
          pos: { ...decoyCloneAnchor! },
          carrierIdx: carrier,
          receiverIdx: decoyRunner,
          receiverPlayerId: state.players[decoyRunner].def.id,
          untilTick: p.powerState.untilTick,
        };
      }
    } else {
      finishMomentPower(state, idx);
    }
  } else if (power === 'RALLY_CRY') {
    const target = rallyTarget === -1 ? undefined : state.players[rallyTarget];
    if (target !== undefined && target.encoreState === undefined) {
      target.encoreState = 'BANKED';
      target.encoreQueuedRefill = target.powerState.kind !== 'idle';
    }
    finishMomentPower(state, idx);
  }
}

function applyGravityWell(state: MatchState, idx: number): void {
  const hero = state.players[idx];
  if (hero.powerState.kind !== 'active' || state.ball.kind !== 'held'
    || state.players[state.ball.by].team !== hero.team) return;
  const carrier = state.players[state.ball.by];
  const grade = activeActivationGrade(hero);
  for (const candidate of gravityLaneBlockers(state, idx).slice(0, 2)) {
    state.players[candidate].pos = gravityPullDestination(
      state,
      idx,
      state.ball.by,
      candidate,
      grade,
    );
  }
}

function gravityPullDestination(
  state: MatchState,
  _heroIdx: number,
  carrierIdx: number,
  blockerIdx: number,
  grade: number,
): { x: number; y: number } {
  const carrier = state.players[carrierIdx];
  const blocker = state.players[blockerIdx];
  const maxPulse = Math.round(anchoredEffect(grade, 1200, 1400, 1600));
  const distance = Math.sqrt(dist2(blocker.pos, carrier.pos));
  const travel = Math.min(maxPulse, Math.max(0, distance - 220));
  return moveToward(blocker.pos, carrier.pos, travel);
}

function capturedTargetAvailable(
  state: MatchState,
  heroTeam: 0 | 1,
  targetIdx: number,
  expectedPlayerId?: string,
): boolean {
  const target = state.players[targetIdx];
  return target !== undefined
    && target.team !== heroTeam
    && target.def.role !== 'GK'
    && (expectedPlayerId === undefined || target.def.id === expectedPlayerId)
    && target.outUntilTick <= state.tick
    && target.slideTackle === undefined
    && target.tackleRecoveryUntil <= state.tick;
}

function friendlyTargetAvailable(
  state: MatchState,
  team: 0 | 1,
  targetIdx: number,
  expectedPlayerId?: string,
): boolean {
  const target = state.players[targetIdx];
  return target !== undefined
    && target.team === team
    && (expectedPlayerId === undefined || target.def.id === expectedPlayerId)
    && target.outUntilTick <= state.tick
    && target.slideTackle === undefined
    && target.tackleRecoveryUntil <= state.tick;
}

function clearStrengthLock(state: MatchState, sourceIdx: number, targetIdx?: number): void {
  const clear = (idx: number) => {
    const target = state.players[idx];
    if (target?.actionLockSourceIdx !== sourceIdx) return;
    target.actionLockedUntilTick = undefined;
    target.actionLockSourceIdx = undefined;
  };
  if (targetIdx !== undefined) clear(targetIdx);
  else for (let idx = 0; idx < 22; idx += 1) clear(idx);
}

function bestEncoreCandidate(state: MatchState, heroIdx: number): number {
  const hero = state.players[heroIdx];
  let best = -1;
  let bestScore = -Infinity;
  for (let idx = 0; idx < 22; idx += 1) {
    const mate = state.players[idx];
    if (idx === heroIdx || mate.team !== hero.team || mate.def.power === undefined
      || mate.encoreState !== undefined || mate.outUntilTick > state.tick
      || dist2(mate.pos, hero.pos) > RALLY_CRY_RANGE * RALLY_CRY_RANGE) continue;
    const readyScore = mate.powerState.kind === 'zone' || mate.powerState.kind === 'armed' ? 500 : 0;
    const score = mate.zonesOpened * 1000 + readyScore
      + Math.min(200, mate.gauge) + (mate.gauge >= RALLY_CRY_TEAMMATE_HEAT ? 50 : 0);
    if (score > bestScore || (score === bestScore && idx < best)) {
      best = idx;
      bestScore = score;
    }
  }
  return best;
}

function gravityRunner(
  state: MatchState,
  heroIdx: number,
  carrierIdx: number,
  blockerIdx: number,
): { idx: number; pos: { x: number; y: number } } | null {
  const hero = state.players[heroIdx];
  const carrier = state.players[carrierIdx];
  const blocker = state.players[blockerIdx];
  const direction = carrier.team === 0 ? -1 : 1;
  const anchor = {
    x: Math.round(clampEffect(blocker.pos.x, 200, PITCH_W - 200)),
    y: Math.round(clampEffect(blocker.pos.y + direction * 350, 900, PITCH_H - 900)),
  };
  if (attackingProgress(carrier.team, anchor) <= attackingProgress(carrier.team, carrier.pos) + 250) {
    return null;
  }
  let best = -1;
  let bestScore = Infinity;
  for (let idx = 0; idx < 22; idx += 1) {
    const mate = state.players[idx];
    if (idx === heroIdx || idx === carrierIdx || mate.team !== hero.team
      || (mate.def.role !== 'MID' && mate.def.role !== 'FWD')
      || !friendlyTargetAvailable(state, hero.team, idx)) continue;
    const score = dist2(mate.pos, anchor);
    if (score < bestScore || (score === bestScore && idx < best)) {
      best = idx;
      bestScore = score;
    }
  }
  return best === -1 ? null : { idx: best, pos: anchor };
}

function gravityLaneBlockers(state: MatchState, heroIdx: number): number[] {
  const hero = state.players[heroIdx];
  if (state.ball.kind !== 'held' || state.players[state.ball.by].team !== hero.team) return [];
  const carrier = state.players[state.ball.by];
  const goalY = carrier.team === 0 ? 0 : PITCH_H;
  const dy = goalY - carrier.pos.y;
  const candidates: Array<{ idx: number; score: number }> = [];
  for (let idx = 0; idx < 22; idx += 1) {
    const opponent = state.players[idx];
    if (opponent.team === carrier.team || opponent.def.role === 'GK'
      || opponent.outUntilTick > state.tick || opponent.slideTackle !== undefined
      || opponent.tackleRecoveryUntil > state.tick
      || dist2(opponent.pos, hero.pos) >= GRAVITY_WELL_RANGE * GRAVITY_WELL_RANGE) continue;
    const t = dy === 0 ? -1 : (opponent.pos.y - carrier.pos.y) / dy;
    if (t <= 0 || t >= 1) continue;
    const laneX = carrier.pos.x + (PITCH_W / 2 - carrier.pos.x) * t;
    const clearance = Math.abs(opponent.pos.x - laneX);
    if (clearance >= 900) continue;
    candidates.push({ idx, score: clearance + Math.sqrt(dist2(opponent.pos, carrier.pos)) * 0.2 });
  }
  candidates.sort((left, right) => left.score - right.score || left.idx - right.idx);
  return candidates.map(candidate => candidate.idx);
}

function gravityWellContext(state: MatchState, idx: number): boolean {
  const hero = state.players[idx];
  if (state.ball.kind !== 'held' || state.players[state.ball.by].team !== hero.team
    || state.ball.by === idx) return false;
  // The hero plants centrally while a teammate attacks a different lane. The
  // single pull opens the carrier's side instead of compressing the defence
  // around an opponent who already has the ball.
  const blockers = gravityLaneBlockers(state, idx);
  return Math.abs(hero.pos.x - PITCH_W / 2) <= 1200
    && Math.abs(state.players[state.ball.by].pos.x - hero.pos.x) >= 450
    && blockers.length > 0
    && gravityRunner(state, idx, state.ball.by, blockers[0]) !== null;
}

function torchAcquisitionRange(player: MatchState['players'][number], strength: number): number {
  const grade = strength * manualTimingScale(strength) * tierEffectScale(player.def.powerTier);
  // Upgrade potency is the exact one/two/three-defender count. Keep the visual
  // acquisition radius stable so the basic auto-fired version also reaches the
  // approved every-match reliability target instead of losing valid runs merely
  // because its sole marker was a few pixels beyond a hidden tier-one radius.
  return Math.round(anchoredEffect(grade, 1900, 1900, 1900));
}

function isRelevantTorchMarker(
  state: MatchState,
  heroIdx: number,
  markerIdx: number,
  range = TORCH_IGNITE_RANGE,
): boolean {
  const hero = state.players[heroIdx];
  const marker = state.players[markerIdx];
  if (marker.team === hero.team || marker.def.role !== 'DEF' || marker.outUntilTick > state.tick
    || state.ball.kind !== 'held' || state.ball.by !== heroIdx) return false;
  const attackingHalf = hero.team === 0 ? hero.pos.y < PITCH_H / 2 : hero.pos.y > PITCH_H / 2;
  const markerGoalSide = hero.team === 0 ? marker.pos.y <= hero.pos.y : marker.pos.y >= hero.pos.y;
  return attackingHalf && markerGoalSide
    && dist2(marker.pos, hero.pos) < range * range;
}

function relevantTorchMarkers(
  state: MatchState,
  heroIdx: number,
  range = TORCH_IGNITE_RANGE,
  limit = 1,
): number[] {
  const candidates: Array<{ idx: number; score: number }> = [];
  for (let idx = 0; idx < 22; idx += 1) {
    if (!isRelevantTorchMarker(state, heroIdx, idx, range)) continue;
    const marker = state.players[idx];
    const hero = state.players[heroIdx];
    // Prefer the closest marker who is also aligned with the hero's route to goal.
    const score = dist2(marker.pos, hero.pos) + Math.abs(marker.pos.x - hero.pos.x) * 500;
    candidates.push({ idx, score });
  }
  candidates.sort((left, right) => left.score - right.score || left.idx - right.idx);
  return candidates.slice(0, limit).map(candidate => candidate.idx);
}

function relevantTorchMarker(state: MatchState, heroIdx: number, range = TORCH_IGNITE_RANGE): number {
  return relevantTorchMarkers(state, heroIdx, range, 1)[0] ?? -1;
}

function emitPowerTurnover(state: MatchState, heroIdx: number, victimIdx: number): void {
  emit(state, {
    t: state.tick,
    kind: 'TACKLE',
    by: heroIdx,
    on: victimIdx,
    won: true,
    style: 'power',
    contact: false,
  });
}

/** Web and Ice remain visible, interruptible placements after their wind-up.
 * Their first enemy carrier entering the authored area spends the whole power. */
function springWebTrap(state: MatchState, heroIdx: number): void {
  const hero = state.players[heroIdx];
  if (hero.powerState.kind !== 'active' || hero.powerAnchor === undefined
    || state.ball.kind !== 'held') return;
  const victim = state.ball.by;
  const carrier = state.players[victim];
  if (carrier.team === hero.team || carrier.outUntilTick > state.tick
    || dist2(carrier.pos, hero.powerAnchor) >= WEB_TRAP_TRIGGER_RANGE * WEB_TRAP_TRIGGER_RANGE) return;
  carrier.webbedUntilTick = state.tick + WEB_ROOT_TICKS;
  carrier.slideTackle = undefined;
  carrier.tackleRecoveryUntil = 0;
  state.ball = { kind: 'loose', pos: { ...carrier.pos }, vel: { x: 0, y: 0 }, z: 0, vz: 0 };
  emitPowerTurnover(state, heroIdx, victim);
  finishMomentPower(state, heroIdx);
}

function springIceRink(state: MatchState, heroIdx: number): void {
  const hero = state.players[heroIdx];
  if (hero.powerState.kind !== 'active' || hero.powerAnchor === undefined
    || state.ball.kind !== 'held') return;
  const victim = state.ball.by;
  const carrier = state.players[victim];
  if (carrier.team === hero.team || carrier.outUntilTick > state.tick
    || dist2(carrier.pos, hero.powerAnchor) >= ICE_RINK_TRIGGER_RANGE * ICE_RINK_TRIGGER_RANGE) return;
  const backward = carrier.team === 0 ? 1 : -1;
  carrier.forcedMovement = {
    kind: 'ICE_SLIDE',
    untilTick: state.tick + ICE_SLIDE_TICKS,
    step: { x: 0, y: backward * 110 },
  };
  carrier.slideTackle = undefined;
  emit(state, {
    t: state.tick,
    kind: 'TACKLE',
    by: heroIdx,
    on: victim,
    won: false,
    style: 'power',
    contact: false,
  });
  finishMomentPower(state, heroIdx);
}

function springShadowHunt(state: MatchState, heroIdx: number): void {
  const hero = state.players[heroIdx];
  if (hero.powerState.kind !== 'active'
    || hero.powerState.commitment !== 'SHADOW_HUNT'
    || hero.powerState.armedAtTick === undefined
    || state.tick < hero.powerState.armedAtTick
    || hero.powerAnchor === undefined
    || state.ball.kind !== 'held') return;
  const victimIdx = state.ball.by;
  const victim = state.players[victimIdx];
  if (victim.team === hero.team || victim.outUntilTick > state.tick
    || dist2(victim.pos, hero.powerAnchor) > SHADOW_HUNT_RADIUS * SHADOW_HUNT_RADIUS) return;
  const direction = hero.team === 0 ? 1 : -1;
  hero.pos = {
    x: victim.pos.x,
    y: Math.round(clampEffect(victim.pos.y + direction * 120, 200, PITCH_H - 200)),
  };
  state.ball = { kind: 'held', by: heroIdx };
  emitPowerTurnover(state, heroIdx, victimIdx);
  // A successful hunt emerges at the steal; only expiry/cancel returns home.
  hero.powerAnchor = undefined;
  finishMomentPower(state, heroIdx);
}

/** Converts a defensive win into a guaranteed outlet to the furthest-forward
 * teammate who was onside when the steal was read. No teammate is teleported. */
function commitControlledOutlet(state: MatchState, idx: number): void {
  const hero = state.players[idx];
  if (hero.powerState.kind !== 'active') return;
  const target = furthestForwardOnsideTeammate(state, idx);
  if (target === -1) {
    finishMomentPower(state, idx);
    return;
  }
  hero.powerState.targetIdx = target;
  hero.powerState.targetPlayerId = state.players[target].def.id;
  hero.powerState.commitment = 'POWER_OUTLET';
}

function furthestForwardOnsideTeammate(state: MatchState, heroIdx: number): number {
  const hero = state.players[heroIdx];
  const opponentYs = state.players
    .filter(opponent => opponent.team !== hero.team && opponent.outUntilTick <= state.tick)
    .map(opponent => opponent.pos.y)
    .sort((a, b) => hero.team === 0 ? a - b : b - a);
  const secondLast = opponentYs[1] ?? (hero.team === 0 ? 0 : PITCH_H);
  const ballY = state.ball.kind === 'held' ? state.players[state.ball.by].pos.y : state.ball.pos.y;
  const line = hero.team === 0 ? Math.min(ballY, secondLast) : Math.max(ballY, secondLast);
  let best = -1;
  let bestProgress = -Infinity;
  for (let idx = 0; idx < 22; idx += 1) {
    const mate = state.players[idx];
    if (idx === heroIdx || mate.team !== hero.team || mate.def.role === 'GK'
      || !friendlyTargetAvailable(state, hero.team, idx)) continue;
    const inOwnHalf = hero.team === 0 ? mate.pos.y >= PITCH_H / 2 : mate.pos.y <= PITCH_H / 2;
    const onside = inOwnHalf || (hero.team === 0 ? mate.pos.y >= line : mate.pos.y <= line);
    if (!onside) continue;
    const progress = attackingProgress(hero.team, mate.pos);
    if (progress > bestProgress || (progress === bestProgress && idx < best)) {
      best = idx;
      bestProgress = progress;
    }
  }
  return best;
}

/** Future Sight reads one eligible pass, arrives unseen on its receiver, and
 * converts that interception into the already-authored controlled outlet. */
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
      || hero.powerState.kind !== 'active'
      || hero.powerState.commitment === 'POWER_OUTLET'
      || hero.outUntilTick > state.tick || hero.slideTackle !== undefined
      || hero.tackleRecoveryUntil > state.tick) continue;
    const grade = activeActivationGrade(hero);
    const interceptRange = anchoredEffect(grade, 2800, 3100, 3500);
    if (dist2(hero.pos, receiver.pos) > interceptRange * interceptRange) continue;
    const direction = hero.team === 0 ? -1 : 1;
    const escape = Math.round(280 + 100 * grade + 120 * upgradeLift(grade));
    hero.pos = {
      x: receiver.pos.x,
      y: Math.max(300, Math.min(PITCH_H - 300, receiver.pos.y + direction * escape)),
    };
    commitControlledOutlet(state, idx);
    return idx;
  }
  return -1;
}

/** Gust spends on the opponent's next completed pass and redirects it safely
 * to the defending goalkeeper. The engine tags that arrival for a forced punt. */
export function gustDisruptsPass(
  state: MatchState,
  passingTeam: 0 | 1,
  passerIdx: number,
): { hero: number; goalkeeper: number } | null {
  const first = passingTeam === 0 ? 11 : 0;
  for (let idx = first; idx < first + 11; idx += 1) {
    const hero = state.players[idx];
    if (hero.def.power !== 'GUST' || !isActive(state, idx)
      || hero.powerState.kind !== 'active'
      || hero.outUntilTick > state.tick || hero.slideTackle !== undefined
      || hero.tackleRecoveryUntil > state.tick) continue;
    const goalkeeper = hero.team === 0 ? 0 : 11;
    if (!friendlyTargetAvailable(state, hero.team, goalkeeper)) continue;
    emit(state, { t: state.tick, kind: 'GUST_REDIRECT', player: idx, from: passerIdx, to: goalkeeper });
    finishMomentPower(state, idx);
    return { hero: idx, goalkeeper };
  }
  return null;
}

function attackingProgress(team: 0 | 1, pos: { x: number; y: number }): number {
  return team === 0 ? PITCH_H - pos.y : pos.y;
}

function openSpaceAt(state: MatchState, team: 0 | 1, pos: { x: number; y: number }): number {
  let space = 1800;
  for (let idx = 0; idx < 22; idx += 1) {
    const opponent = state.players[idx];
    if (opponent.team === team || opponent.outUntilTick > state.tick) continue;
    space = Math.min(space, Math.sqrt(dist2(opponent.pos, pos)));
  }
  return space;
}

function segmentDistance(
  point: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length2 = dx * dx + dy * dy;
  if (length2 === 0) return Math.sqrt(dist2(point, from));
  const t = Math.max(0, Math.min(1,
    ((point.x - from.x) * dx + (point.y - from.y) * dy) / length2));
  const projection = { x: from.x + dx * t, y: from.y + dy * t };
  return Math.sqrt(dist2(point, projection));
}

function attackLaneClearance(
  state: MatchState,
  team: 0 | 1,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number {
  let clearance = 1800;
  for (let idx = 0; idx < 22; idx += 1) {
    const opponent = state.players[idx];
    if (opponent.team === team || opponent.def.role === 'GK'
      || opponent.outUntilTick > state.tick) continue;
    clearance = Math.min(clearance, segmentDistance(opponent.pos, from, to));
  }
  return clearance;
}

function portalReceiverThreat(
  state: MatchState,
  idx: number,
  pos: { x: number; y: number },
): number {
  const player = state.players[idx];
  const progress = attackingProgress(player.team, pos) / PITCH_H;
  const centrality = 1 - Math.abs(pos.x - PITCH_W / 2) / (PITCH_W / 2);
  const technique = player.def.attrs.sho * 8 + player.def.attrs.tec * 4 + player.def.attrs.pas * 2;
  return progress * progress * 1400
    + Math.max(0, centrality) * 300
    + openSpaceAt(state, player.team, pos) * 0.6
    + technique;
}

function portalChanceScore(
  state: MatchState,
  idx: number,
  pos: { x: number; y: number },
): number {
  const player = state.players[idx];
  const goal = { x: PITCH_W / 2, y: player.team === 0 ? 0 : PITCH_H };
  return portalReceiverThreat(state, idx, pos)
    + attackLaneClearance(state, player.team, pos, goal) * 0.5
    - Math.sqrt(dist2(pos, goal)) * 0.12;
}

/** Portal's receiver and exit are selected together. Every valid exit is ahead
 * of the current carrier; score rewards both gained threat and room to act. */
function portalDestination(
  state: MatchState,
  carrierIdx: number,
  effectStrength: number,
): { receiver: number; pos: { x: number; y: number } } | null {
  const carrier = state.players[carrierIdx];
  const carrierProgress = attackingProgress(carrier.team, carrier.pos);
  const carrierChance = portalChanceScore(state, carrierIdx, carrier.pos);
  const direction = carrier.team === 0 ? -1 : 1;
  const goal = { x: PITCH_W / 2, y: carrier.team === 0 ? 0 : PITCH_H };
  const carrierGoalDistance = Math.sqrt(dist2(carrier.pos, goal));
  const grade = effectStrength / familyEffectScale('PORTAL_PASS');
  const forwardStep = Math.min(2600,
    Math.round(1550 + 650 * grade + 650 * upgradeLift(grade)));
  const lateralReach = Math.round(350 + 180 * grade);
  let best: { receiver: number; pos: { x: number; y: number }; score: number } | null = null;
  for (let idx = carrier.team === 0 ? 0 : 11; idx < (carrier.team === 0 ? 11 : 22); idx += 1) {
    const teammate = state.players[idx];
    if (idx === carrierIdx || teammate.outUntilTick > state.tick
      || teammate.slideTackle !== undefined || teammate.tackleRecoveryUntil > state.tick
      || (teammate.def.role !== 'MID' && teammate.def.role !== 'FWD')) continue;
    for (const laneX of [teammate.pos.x - lateralReach, teammate.pos.x, teammate.pos.x + lateralReach]) {
      const rawY = carrier.pos.y + direction * forwardStep;
      const pos = {
        x: Math.max(150, Math.min(PITCH_W - 150, Math.round(laneX))),
        y: carrier.team === 0
          ? Math.max(1400, Math.min(PITCH_H - 300, Math.round(rawY)))
          : Math.min(PITCH_H - 1400, Math.max(300, Math.round(rawY))),
      };
      const exitProgress = attackingProgress(teammate.team, pos);
      const goalDistance = Math.sqrt(dist2(pos, goal));
      const space = openSpaceAt(state, teammate.team, pos);
      const corridor = attackLaneClearance(state, teammate.team, pos, goal);
      if (exitProgress < carrierProgress + 700
        || goalDistance > 2400 || goalDistance > carrierGoalDistance - 600
        || space < 650 || corridor < 550) continue;
      const score = portalChanceScore(state, idx, pos);
      if (score < carrierChance + 80) continue;
      if (best === null || score > best.score) best = { receiver: idx, pos, score };
    }
  }
  return best === null ? null : { receiver: best.receiver, pos: best.pos };
}

function blinkDestination(state: MatchState, heroIdx: number, effectStrength: number): { x: number; y: number } {
  const hero = state.players[heroIdx];
  const grade = effectStrength / familyEffectScale('BLINK_RUN');
  const geometryGrade = anchoredEffect(grade, 0.85, 0.855, 0.87);
  const defendingTeam: 0 | 1 = hero.team === 0 ? 1 : 0;
  let lastDefenderY = hero.team === 0 ? PITCH_H : 0;
  let found = false;
  for (let idx = defendingTeam === 0 ? 0 : 11; idx < (defendingTeam === 0 ? 11 : 22); idx += 1) {
    const defender = state.players[idx];
    if (defender.def.role === 'GK' || defender.outUntilTick > state.tick) continue;
    if (!found || (hero.team === 0 ? defender.pos.y < lastDefenderY : defender.pos.y > lastDefenderY)) {
      lastDefenderY = defender.pos.y;
      found = true;
    }
  }
  const direction = hero.team === 0 ? -1 : 1;
  const beyondDefender = found
    ? lastDefenderY + direction * Math.round(180 + 180 * geometryGrade)
    : hero.pos.y + direction * Math.round(900 * geometryGrade);
  const forwardFromHero = hero.pos.y + direction * Math.round(350 + 220 * geometryGrade);
  const beyond = hero.team === 0
    ? Math.min(beyondDefender, forwardFromHero)
    : Math.max(beyondDefender, forwardFromHero);
  const y = hero.team === 0
    ? Math.max(900, Math.min(PITCH_H - 300, beyond))
    : Math.min(PITCH_H - 900, Math.max(300, beyond));
  let bestX = hero.pos.x;
  let bestScore = -1;
  for (const x of [hero.pos.x - 700, hero.pos.x, hero.pos.x + 700, PITCH_W / 2]) {
    const candidateX = Math.max(150, Math.min(PITCH_W - 150, Math.round(x)));
    const space = openSpaceAt(state, hero.team, { x: candidateX, y });
    const centrality = PITCH_W / 2 - Math.abs(candidateX - PITCH_W / 2);
    const score = space + centrality * (0.12 + 0.08 * geometryGrade);
    if (score > bestScore) { bestX = candidateX; bestScore = score; }
  }
  return { x: bestX, y };
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

function decoyFalseLane(
  state: MatchState,
  carrierIdx: number,
  markerIdx: number,
  effectStrength: number,
): { x: number; y: number } {
  const carrier = state.players[carrierIdx];
  const marker = state.players[markerIdx];
  const attackingDirection = carrier.team === 0 ? -1 : 1;
  const side = marker.pos.x === carrier.pos.x
    ? (carrier.pos.x <= PITCH_W / 2 ? -1 : 1)
    : Math.sign(marker.pos.x - carrier.pos.x);
  return {
    x: Math.max(150, Math.min(PITCH_W - 150,
      carrier.pos.x + side * Math.round(550 + 300 * effectStrength))),
    y: Math.max(300, Math.min(PITCH_H - 300,
      carrier.pos.y - attackingDirection * Math.round(350 + 50 * effectStrength))),
  };
}

function decoyClonePosition(
  state: MatchState,
  carrierIdx: number,
  markerIdx: number,
  effectStrength: number,
): { x: number; y: number } {
  const carrier = state.players[carrierIdx];
  const marker = state.players[markerIdx];
  const direction = carrier.team === 0 ? -1 : 1;
  const side = Math.sign(carrier.pos.x - marker.pos.x)
    || (carrier.pos.x <= PITCH_W / 2 ? 1 : -1);
  return {
    x: Math.round(clampEffect(carrier.pos.x + side * (500 + 120 * effectStrength), 200, PITCH_W - 200)),
    y: Math.round(clampEffect(carrier.pos.y + direction * (850 + 180 * effectStrength), 900, PITCH_H - 900)),
  };
}

function bestDecoyForward(state: MatchState, heroIdx: number, carrierIdx: number): number {
  const hero = state.players[heroIdx];
  let best = -1;
  let bestScore = -Infinity;
  for (let idx = 0; idx < 22; idx += 1) {
    const mate = state.players[idx];
    if (idx === carrierIdx || idx === heroIdx || mate.team !== hero.team
      || mate.def.role !== 'FWD' || !friendlyTargetAvailable(state, hero.team, idx)) continue;
    const score = attackingProgress(mate.team, mate.pos) * 10
      + mate.def.attrs.sho * 4 + mate.def.attrs.tec * 2;
    if (score > bestScore || (score === bestScore && idx < best)) {
      best = idx;
      bestScore = score;
    }
  }
  return best;
}

function decoyCorridorGain(
  state: MatchState,
  carrierIdx: number,
  markerIdx: number,
  falseLane: { x: number; y: number },
): number {
  const carrier = state.players[carrierIdx];
  const goal = { x: PITCH_W / 2, y: carrier.team === 0 ? 0 : PITCH_H };
  return segmentDistance(falseLane, carrier.pos, goal)
    - segmentDistance(state.players[markerIdx].pos, carrier.pos, goal);
}

/** The defender actually between the carrier and goal, weighted toward the
 * carrier's lane. The false run must materially improve that corridor. */
function bestDecoyMarker(
  state: MatchState,
  carrierIdx: number,
  range: number,
  effectStrength: number,
): number {
  const carrier = state.players[carrierIdx];
  const goal = { x: PITCH_W / 2, y: carrier.team === 0 ? 0 : PITCH_H };
  let best = -1;
  let bestScore = Infinity;
  for (let idx = 0; idx < 22; idx += 1) {
    const opponent = state.players[idx];
    if (opponent.team === carrier.team || opponent.def.role === 'GK'
      || opponent.outUntilTick > state.tick || opponent.slideTackle !== undefined
      || opponent.tackleRecoveryUntil > state.tick) continue;
    const goalSide = carrier.team === 0 ? opponent.pos.y <= carrier.pos.y : opponent.pos.y >= carrier.pos.y;
    const distance = dist2(carrier.pos, opponent.pos);
    if (!goalSide || distance >= range * range) continue;
    const corridorDistance = segmentDistance(opponent.pos, carrier.pos, goal);
    const falseLane = decoyFalseLane(state, carrierIdx, idx, effectStrength);
    const gain = decoyCorridorGain(state, carrierIdx, idx, falseLane);
    if (corridorDistance >= 900 || gain < 300) continue;
    const score = distance + corridorDistance * 1200 - gain * 400;
    if (score < bestScore) { best = idx; bestScore = score; }
  }
  return best;
}

export function speedMultiplier(state: MatchState, idx: number): number {
  const p = state.players[idx];
  // Charging a locked Super Strength target accelerates the pursuit — the windup
  // telegraph is the counterplay, not a guaranteed whiff (Task 12.1/12.2 landing-rate fix).
  if (p.powerState.kind === 'winding' && p.powerState.targetIdx !== undefined) {
    const timing = manualTimingScale(p.powerState.strength);
    return 1 + (PURSUIT_MULT - 1) * p.powerState.strength * timing * tierEffectScale(p.def.powerTier);
  }
  if (!isActive(state, idx)) return 1;
  if (p.powerState.kind !== 'active') return 1;
  const grade = activeActivationGrade(p);
  if (p.def.power === 'SUPER_SPEED') return anchoredEffect(grade, 2.3, 2.65, 3);
  if (p.def.power === 'BLINK_RUN') {
    const geometryGrade = anchoredEffect(grade, 0.85, 0.855, 0.87);
    return 1 + 0.4 * familyEffectScale('BLINK_RUN') * geometryGrade;
  }
  return 1;
}

function strengthLandingRange(player: MatchState['players'][number], strength: number): number {
  return Math.round(STRENGTH_LAND_RANGE
    + 350 * strength * manualTimingScale(strength) * tierEffectScale(player.def.powerTier));
}

/** A marked defender follows Decoy's persistent false lane for the active moment. */
export function decoyPursuitTarget(state: MatchState, markerIdx: number): { x: number; y: number } | null {
  const marker = state.players[markerIdx];
  const first = marker.team === 0 ? 11 : 0;
  for (let heroIdx = first; heroIdx < first + 11; heroIdx += 1) {
    const hero = state.players[heroIdx];
    if (hero.def.power !== 'DECOY_DOUBLE' || hero.powerState.kind !== 'active'
      || hero.powerState.targetIdx !== markerIdx || hero.powerAnchor === undefined
      || !isActive(state, heroIdx)) continue;
    return { ...hero.powerAnchor };
  }
  return null;
}

/** Virtual Decoy receiver offered to the current friendly carrier. */
export function decoyPassOption(
  state: MatchState,
  carrierIdx: number,
): { receiver: number; pos: { x: number; y: number }; receiverPlayerId: string } | null {
  const first = state.players[carrierIdx].team === 0 ? 0 : 11;
  for (let heroIdx = first; heroIdx < first + 11; heroIdx += 1) {
    const hero = state.players[heroIdx];
    const clone = hero.decoyClone;
    if (hero.def.power !== 'DECOY_DOUBLE' || hero.powerState.kind !== 'active'
      || clone === undefined || clone.carrierIdx !== carrierIdx || clone.untilTick <= state.tick
      || !friendlyTargetAvailable(state, hero.team, clone.receiverIdx, clone.receiverPlayerId)) continue;
    return {
      receiver: clone.receiverIdx,
      pos: { ...clone.pos },
      receiverPlayerId: clone.receiverPlayerId,
    };
  }
  return null;
}

/** Successful arrival makes the clone the real hero. A stale/substituted slot
 * fails soft and leaves the original body untouched. */
export function materializeDecoyReceiver(
  state: MatchState,
  receiverIdx: number,
  receiverPlayerId: string,
  arrival: { x: number; y: number },
): boolean {
  const receiver = state.players[receiverIdx];
  if (receiver.def.id !== receiverPlayerId) return false;
  const first = receiver.team === 0 ? 0 : 11;
  let owner = -1;
  for (let heroIdx = first; heroIdx < first + 11; heroIdx += 1) {
    const clone = state.players[heroIdx].decoyClone;
    if (state.players[heroIdx].def.power === 'DECOY_DOUBLE'
      && state.players[heroIdx].powerState.kind === 'active'
      && clone?.receiverIdx === receiverIdx && clone.receiverPlayerId === receiverPlayerId
      && clone.untilTick > state.tick) {
      owner = heroIdx;
      break;
    }
  }
  if (owner === -1) return false;
  receiver.pos = { ...arrival };
  finishMomentPower(state, owner);
  return true;
}

export function cancelDecoyReceiver(
  state: MatchState,
  receiverIdx: number,
  receiverPlayerId: string,
): void {
  const first = state.players[receiverIdx]?.team === 0 ? 0 : 11;
  for (let heroIdx = first; heroIdx < first + 11; heroIdx += 1) {
    const owner = state.players[heroIdx];
    if (owner.decoyClone?.receiverIdx === receiverIdx
      && owner.decoyClone.receiverPlayerId === receiverPlayerId) finishMomentPower(state, heroIdx);
  }
}

/** Gravity's selected runner moves visibly into the opened lane. */
export function gravityRunnerTarget(
  state: MatchState,
  runnerIdx: number,
): { x: number; y: number } | null {
  const team = state.players[runnerIdx].team;
  const first = team === 0 ? 0 : 11;
  for (let heroIdx = first; heroIdx < first + 11; heroIdx += 1) {
    const hero = state.players[heroIdx];
    if (hero.def.power !== 'GRAVITY_WELL' || hero.powerState.kind !== 'active'
      || hero.powerState.runnerIdx !== runnerIdx
      || hero.powerState.runnerPlayerId !== state.players[runnerIdx].def.id
      || hero.powerState.runnerAnchor === undefined || !isActive(state, heroIdx)) continue;
    return { ...hero.powerState.runnerAnchor };
  }
  return null;
}

/** The current carrier's next pass is deliberately aimed at Gravity's runner. */
export function gravityPriorityTarget(state: MatchState, carrierIdx: number): number {
  const team = state.players[carrierIdx].team;
  const first = team === 0 ? 0 : 11;
  for (let heroIdx = first; heroIdx < first + 11; heroIdx += 1) {
    const hero = state.players[heroIdx];
    if (hero.def.power !== 'GRAVITY_WELL' || hero.powerState.kind !== 'active'
      || hero.powerState.carrierIdx !== carrierIdx || hero.powerState.runnerIdx === undefined
      || hero.powerState.runnerPlayerId !== state.players[hero.powerState.runnerIdx]?.def.id
      || !friendlyTargetAvailable(state, team, hero.powerState.runnerIdx)) continue;
    return hero.powerState.runnerIdx;
  }
  return -1;
}

export function consumePortalProtection(state: MatchState, idx: number): void {
  state.players[idx].portalProtectedUntilTick = undefined;
}

export function gustPuntTarget(state: MatchState, goalkeeperIdx: number): number {
  const goalkeeper = state.players[goalkeeperIdx];
  let best = -1;
  let bestProgress = -Infinity;
  for (let idx = 0; idx < 22; idx += 1) {
    const mate = state.players[idx];
    if (idx === goalkeeperIdx || mate.team !== goalkeeper.team || mate.def.role === 'GK'
      || !friendlyTargetAvailable(state, goalkeeper.team, idx)) continue;
    const progress = attackingProgress(mate.team, mate.pos);
    if (progress > bestProgress || (progress === bestProgress && idx < best)) {
      best = idx;
      bestProgress = progress;
    }
  }
  return best;
}

/** Off-ball attack support lasts through the current carrier's next decision,
 * never long enough to become a hidden teamwide duration bonus. */
export function consumeDecoyAction(
  state: MatchState,
  carrierIdx: number,
  preserveDecoyReceiver = -1,
): void {
  const first = state.players[carrierIdx].team === 0 ? 0 : 11;
  for (let heroIdx = first; heroIdx < first + 11; heroIdx += 1) {
    const hero = state.players[heroIdx];
    if ((hero.def.power === 'DECOY_DOUBLE' || hero.def.power === 'GRAVITY_WELL')
      && hero.powerState.kind === 'active'
      && hero.powerState.carrierIdx === carrierIdx) {
      if (hero.def.power === 'DECOY_DOUBLE'
        && hero.decoyClone?.receiverIdx === preserveDecoyReceiver) continue;
      finishMomentPower(state, heroIdx);
    }
  }
}

/** Clears a one-moment effect while retaining the ordinary Heat reset rules. */
export function finishMomentPower(state: MatchState, idx: number): void {
  const player = state.players[idx];
  const encoreRefill = player.encoreQueuedRefill === true;
  if (player.powerState.kind === 'active'
    && player.powerState.commitment === 'SHADOW_HUNT'
    && player.powerAnchor !== undefined) {
    player.pos = { ...player.powerAnchor };
  }
  clearStrengthLock(state, idx);
  player.decoyClone = undefined;
  player.powerState = { kind: 'idle' };
  player.powerAnchor = undefined;
  player.gauge = encoreRefill
    ? Math.max(player.gauge, player.def.role === 'GK' ? GK_ZONE_HEAT_THRESHOLD : ZONE_HEAT_THRESHOLD)
    : 0;
  player.encoreQueuedRefill = undefined;
}

/** Removes every transient reference owned by or pointing at a substituted slot. */
export function cancelPowerReferencesForSubstitution(
  state: MatchState,
  idx: number,
  outgoingPlayerId: string,
): void {
  const outgoing = state.players[idx];
  if (outgoing.powerState.kind === 'winding') interruptWindup(state, idx);
  else if (outgoing.powerState.kind === 'active') finishMomentPower(state, idx);
  for (let ownerIdx = 0; ownerIdx < 22; ownerIdx += 1) {
    if (ownerIdx === idx) continue;
    const owner = state.players[ownerIdx];
    const ps = owner.powerState;
    const ownsDecoyReceiver = owner.decoyClone?.receiverIdx === idx
      && owner.decoyClone.receiverPlayerId === outgoingPlayerId;
    if (ownsDecoyReceiver || ((ps.kind === 'winding' || ps.kind === 'active')
      && ((ps.targetIdx === idx && ('targetPlayerId' in ps ? ps.targetPlayerId : undefined) === outgoingPlayerId)
        || (ps.kind === 'winding' && ps.secondaryTargetIdx === idx
          && ps.secondaryTargetPlayerId === outgoingPlayerId)
        || (ps.runnerIdx === idx && ps.runnerPlayerId === outgoingPlayerId)
        || ps.carrierIdx === idx))) {
      if (ps.kind === 'winding') interruptWindup(state, ownerIdx);
      else finishMomentPower(state, ownerIdx);
    }
  }
  clearStrengthLock(state, idx);
}

/** Kickoffs cancel pitch-local choreography and temporary receiver protections. */
export function clearRestartPowerState(state: MatchState): void {
  for (let idx = 0; idx < 22; idx += 1) {
    const player = state.players[idx];
    player.webbedUntilTick = undefined;
    player.portalProtectedUntilTick = undefined;
    player.forcedMovement = undefined;
    player.actionLockedUntilTick = undefined;
    player.actionLockSourceIdx = undefined;
    player.decoyClone = undefined;
    if (player.powerState.kind === 'winding') interruptWindup(state, idx);
    else if (player.powerState.kind === 'active'
      && (player.def.power === 'DECOY_DOUBLE' || player.def.power === 'GRAVITY_WELL'
        || player.def.power === 'SHADOW_MARK' || player.def.power === 'GUST')) {
      finishMomentPower(state, idx);
    }
  }
}

/** Enemy action selection cannot account for an active Shadow Mark. The real
 * contest still sees the defender, and that first pass/shot/tackle challenge
 * consumes the cloak. */
export function isShadowMarked(state: MatchState, idx: number): boolean {
  return isActive(state, idx) && state.players[idx].def.power === 'SHADOW_MARK';
}

export function consumeShadowMark(state: MatchState, idx: number): boolean {
  if (!isShadowMarked(state, idx)) return false;
  finishMomentPower(state, idx);
  return true;
}

export function clearPowerCommitment(state: MatchState, idx: number): void {
  const powerState = state.players[idx].powerState;
  if (powerState.kind === 'active') powerState.commitment = undefined;
}

/** Elastic is a banked one-shot charge; Giant remains through the whole attack. */
export function consumeKeeperShotCharge(state: MatchState, idx: number): void {
  const player = state.players[idx];
  if (player.def.power === 'ELASTIC_KEEPER' && isActive(state, idx)) finishMomentPower(state, idx);
}

export function dribbleBonus(state: MatchState, carrierIdx: number): number {
  const player = state.players[carrierIdx];
  // Attacking wind-ups preserve the authored run without granting immunity.
  // A clean tackle can still cancel every one of them.
  if (player.powerState.kind === 'winding') {
    if (player.def.power === 'SUPER_SPEED') {
      return Math.round(25 * tierEffectScale(player.def.powerTier));
    }
    const base = player.def.power === 'THUNDER_STRIKE' ? 24
      : player.def.power === 'BLINK_RUN' || player.def.power === 'FIRE_TORCH' ? 20
        : 0;
    if (base > 0) {
      return Math.round(base * player.powerState.strength
        * manualTimingScale(player.powerState.strength)
        * tierEffectScale(player.def.powerTier));
    }
  }
  let bonus = 0;
  if (isActive(state, carrierIdx) && player.powerState.kind === 'active') {
    const power = player.def.power;
    const grade = activeActivationGrade(player);
    if (power === 'SUPER_SPEED') bonus = Math.round(anchoredEffect(grade, 22, 28, 32));
    if (power === 'THUNDER_STRIKE') bonus = Math.round(anchoredEffect(grade, 12, 18, 30));
    if (power === 'FIRE_TORCH') bonus = Math.round(anchoredEffect(grade, 60, 62, 88));
    if (power === 'PHASE_RUN') bonus = Math.round(anchoredEffect(grade, 20, 70, 100));
    if (power === 'BLINK_RUN') {
      const geometryGrade = anchoredEffect(grade, 0.85, 0.855, 0.87);
      bonus = Math.round(25 * familyEffectScale('BLINK_RUN') * geometryGrade);
    }
  }
  return bonus;
}

export function fireSuppressed(state: MatchState, _tacklerIdx: number, carrierIdx: number): boolean {
  // Kept as a compatibility query. Fire Torch removes its marked defender but
  // no longer grants a hidden blanket tackle immunity to the carrier.
  return false;
}

/** Phase Run pays for exactly one avoided challenge, carries visibly through
 * the challenger, then stays committed only through the runner's finish. */
export function consumePhaseChallenge(
  state: MatchState,
  carrierIdx: number,
  challengerIdx: number,
): boolean {
  const carrier = state.players[carrierIdx];
  if (!isActive(state, carrierIdx) || carrier.def.power !== 'PHASE_RUN') return false;
  const challenger = state.players[challengerIdx];
  const direction = carrier.team === 0 ? -1 : 1;
  const grade = activeActivationGrade(carrier);
  const clearDistance = Math.round(anchoredEffect(grade, 300, 650, 800));
  const projected = carrier.pos.y + direction * clearDistance;
  const beyondChallenger = challenger.pos.y + direction * 120;
  const rawY = carrier.team === 0
    ? Math.min(projected, beyondChallenger)
    : Math.max(projected, beyondChallenger);
  const y = carrier.team === 0
    ? Math.max(1200, Math.min(PITCH_H - 300, rawY))
    : Math.min(PITCH_H - 1200, Math.max(300, rawY));
  let best = { x: carrier.pos.x, y };
  let bestScore = -1;
  for (const rawX of [carrier.pos.x - 350, carrier.pos.x, carrier.pos.x + 350, PITCH_W / 2]) {
    const x = Math.round(Math.max(150, Math.min(PITCH_W - 150, rawX)));
    const space = openSpaceAt(state, carrier.team, { x, y });
    const centrality = PITCH_W / 2 - Math.abs(x - PITCH_W / 2);
    const score = space + centrality * 0.15;
    if (score > bestScore) { best = { x, y }; bestScore = score; }
  }
  carrier.pos = best;
  return true;
}

export function defenseBonus(state: MatchState, idx: number): number {
  if (!isActive(state, idx)) return 0;
  const player = state.players[idx];
  if (player.powerState.kind !== 'active') return 0;
  const power = player.def.power;
  if (power === 'SUPER_STRENGTH') return Math.round(40 * player.powerState.strength);
  if (power === 'SHADOW_MARK') return Math.round(60 * player.powerState.strength);
  return 0;
}

export function keeperSaveBonus(state: MatchState, idx: number): number {
  if (!isActive(state, idx)) return 0;
  const player = state.players[idx];
  if (player.powerState.kind !== 'active') return 0;
  const power = player.def.power;
  if (power !== 'ELASTIC_KEEPER' && power !== 'GIANT_GK') return 0;

  // Calibrated anchors keep the basic contextual fire near the balance floor,
  // make a well-placed tap visibly better, and reserve the large save spike for
  // a fully upgraded hero. Elastic stays slightly stronger because it spends
  // its charge on this one shot; Giant can still face another shot if the first
  // attempt stays in play.
  const grade = activeActivationGrade(player);
  const autoGrade = 0.85;
  const manualGrade = 1.15;
  const tier3Grade = manualGrade * 1.45;
  const [autoBonus, manualBonus, tier3Bonus] = power === 'ELASTIC_KEEPER'
    ? [12, 20, 32]
    : [11, 20, 30];
  if (grade <= manualGrade) {
    const timingProgress = clampEffect(
      (grade - autoGrade) / (manualGrade - autoGrade),
      0,
      1,
    );
    return Math.round(autoBonus + (manualBonus - autoBonus) * timingProgress);
  }
  const upgradeProgress = clampEffect(
    (grade - manualGrade) / (tier3Grade - manualGrade),
    0,
    1,
  );
  return Math.round(manualBonus + (tier3Bonus - manualBonus) * upgradeProgress);
}

export function phaseRunPreventsShot(state: MatchState, idx: number): boolean {
  // Retained as a compatibility query for overlays/tests. Phasing prevents one
  // challenge; it never suppresses its own carrier's shot.
  return false;
}
