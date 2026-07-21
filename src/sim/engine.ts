import { BLEND_TICKS, blendedTableTarget, gkTarget, kickoffPos } from './movement-table';
import { clamp, dist, dist2, moveToward, GOAL_CENTER_X, GOAL_W, HALF_TICKS, PITCH_W, PITCH_H, type Vec } from './geometry';
import { emit } from './events';
import { contest, contestProbability } from './contest';
import { addGauge, interruptWindup, speedMultiplier, fireSuppressed, dribbleBonus, defenseBonus, keeperSaveBonus, knockOut, phaseRunPreventsShot, STRENGTH_LOCK_RANGE, futureSightInterceptor } from './powers';
import { energyDrainMultiplier, energyMovementMultiplier, formationTarget, mentalityTarget, type EnergyUse } from './tactics';
import type { Attrs, MatchState, MovementState, SimPlayer } from './types';

export { addGauge, interruptWindup, speedMultiplier, fireSuppressed, dribbleBonus, defenseBonus, knockOut };

export const STANDING_TACKLE_RANGE = 200;
export const SLIDE_TACKLE_MIN_RANGE = 800;
export const SLIDE_TACKLE_MAX_RANGE = 1100;
export const SLIDE_TACKLE_TICKS = 4;
export const SLIDE_TACKLE_SPEED_MULTIPLIER = 4.2;
export const SLIDE_TACKLE_CONDITION_FLOOR = 30;
export const SLIDE_TACKLE_PREFERRED_CONDITION = 80;
export const SLIDE_TACKLE_CONDITION_COST = 0.4;
export const SLIDE_TACKLE_COOLDOWN_TICKS = 40;
export const SLIDE_SUCCESS_RECOVERY_TICKS = 6;
export const SLIDE_MISS_RECOVERY_TICKS = 12;
const SLIDE_CONTACT_RANGE = 50;

export function goalYFor(team: 0 | 1): number {
  return team === 0 ? 0 : PITCH_H;
}

export function isAvailable(state: MatchState, idx: number): boolean {
  const p = state.players[idx];
  return p.outUntilTick <= state.tick && p.slideTackle === undefined && p.tackleRecoveryUntil <= state.tick;
}

function isConscious(state: MatchState, idx: number): boolean {
  return state.players[idx].outUntilTick <= state.tick;
}

/**
 * Condition applies exactly once through this funnel, bottoming out at 75% of
 * the raw attribute. def.attrs stays immutable in production — fatigue/power
 * modifiers belong here (or in the powers queries), never in-place mutation.
 */
export function effectiveStat(state: MatchState, idx: number, stat: keyof Attrs): number {
  const player = state.players[idx];
  // STA determines drain; every other action stat follows the canon curve:
  // full value at 100 condition, down to at most a 25% penalty at zero.
  if (stat === 'sta') return player.def.attrs.sta;
  const conditionScale = 0.75 + 0.25 * (player.condition / 100);
  return Math.max(1, Math.round(player.def.attrs[stat] * conditionScale));
}

/** Authoritative speed: reads power state internally (Task 12 supplies the multiplier). */
export function speedFor(state: MatchState, idx: number): number {
  return Math.round((40 + effectiveStat(state, idx, 'pac')) * speedMultiplier(state, idx));
}

export function ballPos(state: MatchState): Vec {
  const b = state.ball;
  return b.kind === 'held' ? state.players[b.by].pos : b.pos;
}

/** Height in centimetres above the pitch; caught keepers hold the ball at chest height. */
export function ballHeight(state: MatchState): number {
  const b = state.ball;
  return b.kind === 'held' ? (b.caught ? GOALKEEPER_CATCH_HEIGHT : 0) : b.z;
}

export const ORDINARY_CONDITION_COST = 0.0205;
export const SPRINT_CONDITION_COST = 0.058;

export function drainStamina(p: SimPlayer, movedFar: boolean, energyUse: EnergyUse = 'BALANCED'): void {
  // The design-pinned comparison is STA 40 => 1.36x drain and STA 80 =>
  // 1.12x. Condition affects speed plus every contested action exactly once.
  const enduranceScale = 1.6 - p.def.attrs.sta * 0.006;
  const cost = (movedFar ? SPRINT_CONDITION_COST : ORDINARY_CONDITION_COST)
    * enduranceScale
    * energyDrainMultiplier(energyUse);
  p.condition = Math.max(0, p.condition - cost);
}

function drainSlideCondition(p: SimPlayer, energyUse: EnergyUse): void {
  const drainMultiplier = 1 + 0.6 * (100 - p.def.attrs.sta) / 100;
  p.condition = clamp(
    p.condition - SLIDE_TACKLE_CONDITION_COST * drainMultiplier * energyDrainMultiplier(energyUse),
    0,
    100,
  );
}

export function restartKickoff(state: MatchState, toTeam: 0 | 1): void {
  const center = { x: PITCH_W / 2, y: PITCH_H / 2 };
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    // A restart resets ordinary tackle choreography; a genuinely knocked-out,
    // ignited, or dismissed player remains unavailable and is not teleported.
    p.slideTackle = undefined;
    p.tackleRecoveryUntil = 0;
    if (!isConscious(state, i)) continue;
    p.pos = formationTarget(
      p.team,
      i % 11,
      state.tactics[p.team].formation,
      kickoffPos(p.team, i % 11),
    );
  }
  let striker = toTeam === 0 ? 9 : 20;
  if (!isConscious(state, striker)) {
    const base = toTeam === 0 ? 0 : 11;
    for (let s = base + 10; s >= base; s--) {
      if (isConscious(state, s)) { striker = s; break; }
    }
  }
  state.players[striker].pos = { ...center };
  state.ball = { kind: 'held', by: striker };
  // Restart repositioning is a teleport — snap the phase to the kicking team
  // (no blend) and drop the presser lease.
  state.movement = { phase: toTeam, blendFrom: toTeam, blendStartTick: state.tick, presserIdx: -1, presserSinceTick: state.tick };
}

/** Presser hysteresis: once selected, a presser holds the role for at least this many ticks unless unavailable (movement spec — kills per-tick flip-flop between near-equidistant defenders). */
export const PRESSER_LEASE_TICKS = 10;
const CARRIER_SPEED_SCALE = 0.37;
const STRENGTH_ZONE_APPROACH_RANGE = STRENGTH_LOCK_RANGE + 600;

/**
 * Pure: the movement bookkeeping a movement tick would run under the current
 * state — phase turnover (blend restart) + presser lease renewal. movementTick
 * commits the result to state.movement; movementTargets only reads it. A
 * turnover mid-blend re-bases the blend on the interrupted phase pair (the
 * small target discontinuity is smoothed by the movement speed cap).
 */
function resolveMovement(state: MatchState): MovementState {
  const mv = state.movement;
  let { phase, blendFrom, blendStartTick, presserIdx, presserSinceTick } = mv;
  const b = state.ball;
  if (b.kind === 'held') {
    const holderTeam = state.players[b.by].team;
    if (holderTeam !== phase) {
      blendFrom = phase;
      phase = holderTeam;
      blendStartTick = state.tick;
    }
    const leaseValid = presserIdx !== -1 && isAvailable(state, presserIdx)
      && state.players[presserIdx].team !== holderTeam
      && state.tick < presserSinceTick + PRESSER_LEASE_TICKS;
    if (!leaseValid) {
      presserIdx = nearestOpponent(state, b.by);
      presserSinceTick = state.tick;
    }
  }
  // Loose/pass/shot states keep the previous phase and let the lease age out.
  return { phase, blendFrom, blendStartTick, presserIdx, presserSinceTick };
}

/**
 * Turnover-blend stagger per engine slot (1-4 DEF, 5-8 MID, 9-10 FWD):
 * defenders re-shape first, forwards drift last, delays spread 0-9 ticks
 * (slots 6 and 9 deliberately share a delay; full spread matters, not
 * pairwise uniqueness) — the blend exists so all ten don't reverse
 * simultaneously, and a shared start would still pulse every line's
 * velocity in lockstep (accepted deviation, spec disposition record).
 */
const BLEND_DELAY: ReadonlyArray<number> = [0, 0, 2, 3, 1, 4, 6, 8, 5, 6, 9]; // index = engine slot; [0] unused (GK)
function blendDelay(slot: number): number {
  return BLEND_DELAY[slot];
}

/** Fallback (off-ball) target: GK narrows the angle on the goal-center→ball ray; outfielders sample the phase tables with the turnover blend. */
function fallbackTarget(state: MatchState, idx: number, mv: MovementState, ball: Vec): Vec {
  const p = state.players[idx];
  const slot = idx % 11;
  if (slot === 0) return gkTarget(p.team, ball);
  // In the closing minutes, the second forward reacts two ticks later to
  // phase changes. That small fatigue-era separation keeps the shape from
  // reverting to a rigid sheet without scrambling early/mid-match movement.
  const lateShapeLag = state.tick >= HALF_TICKS * 2 - 150 && slot === 9 ? 2 : 0;
  const t = clamp((state.tick - mv.blendStartTick - blendDelay(slot) - lateShapeLag) / BLEND_TICKS, 0, 1);
  const inPossession = mv.phase === p.team;
  const table = blendedTableTarget(p.team, slot, mv.blendFrom === p.team, inPossession, t, ball);
  const formed = formationTarget(p.team, slot, state.tactics[p.team].formation, table, inPossession);
  return mentalityTarget(p.team, slot, state.tactics[p.team].mentality, inPossession, formed);
}

/** The movement priority ladder (unchanged order: carrier → charge lock → presser → receiver → loose chaser → table target). */
function targetFor(state: MatchState, i: number, mv: MovementState, presserIdx: number, ball: Vec): Vec {
  const p = state.players[i];
  const isCarrier = state.ball.kind === 'held' && state.ball.by === i;
  const chargeTarget = p.powerState.kind === 'winding' && p.powerState.targetIdx !== undefined
    ? state.players[p.powerState.targetIdx].pos : null;
  const strengthZoneTarget = p.powerState.kind === 'zone' && p.def.power === 'SUPER_STRENGTH'
    && state.ball.kind === 'held' && state.players[state.ball.by].team !== p.team
    && dist2(state.players[state.ball.by].pos, p.pos) < STRENGTH_ZONE_APPROACH_RANGE * STRENGTH_ZONE_APPROACH_RANGE
    ? state.players[state.ball.by].pos : null;
  const isPassReceiver = state.ball.kind === 'pass' && state.ball.to === i;
  const chaseLoose = state.ball.kind === 'loose' && dist2(p.pos, ball) < 1500 * 1500;
  return isCarrier
    ? carryTarget(state, i)
    : chargeTarget ? chargeTarget
    : strengthZoneTarget ? strengthZoneTarget
    : i === presserIdx || isPassReceiver || chaseLoose ? ball
    : fallbackTarget(state, i, mv, ball);
}

function slideMovementTick(state: MatchState, idx: number): void {
  const p = state.players[idx];
  const slide = p.slideTackle;
  if (!slide) return;
  const before = { ...p.pos };
  const speed = Math.max(1, Math.round(speedFor(state, idx) * SLIDE_TACKLE_SPEED_MULTIPLIER));
  const step = Math.min(speed, slide.remainingDistance);
  p.pos = {
    x: Math.round(clamp(p.pos.x + slide.direction.x * step, 0, PITCH_W)),
    y: Math.round(clamp(p.pos.y + slide.direction.y * step, 0, PITCH_H)),
  };
  slide.previousPos = before;
  slide.remainingDistance = Math.max(0, slide.remainingDistance - dist(before, p.pos));
}

export function movementTick(state: MatchState): void {
  const ball = ballPos(state);
  const mv = resolveMovement(state);
  state.movement = mv;
  const presserIdx = state.ball.kind === 'held' ? mv.presserIdx : -1;
  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    if (!isConscious(state, i)) continue;
    if (p.outUntilTick !== 0) {
      if (p.outUntilTick !== Number.MAX_SAFE_INTEGER) {
        emit(state, { t: state.tick, kind: p.outReason === 'ignited' ? 'EXTINGUISHED' : 'RECOVERED', player: i });
      }
      p.outUntilTick = 0;
      p.outReason = undefined;
    }
    if (p.slideTackle) {
      slideMovementTick(state, i);
      continue;
    }
    if (p.tackleRecoveryUntil > state.tick) continue;
    const target = targetFor(state, i, mv, presserIdx, ball);
    const before = p.pos;
    // A carrier controls the ball while moving and cannot sustain an off-ball
    // sprint. The slower dribble also gives pressing and passing decisions time
    // to read on a 3-4 minute match instead of producing a shot every few seconds.
    const carrying = state.ball.kind === 'held' && state.ball.by === i;
    const movementSpeed = carrying
      ? Math.round(speedFor(state, i) * CARRIER_SPEED_SCALE)
      : Math.round(speedFor(state, i) * energyMovementMultiplier(state.tactics[p.team].energyUse, p.condition));
    p.pos = moveToward(p.pos, target, movementSpeed);
    drainStamina(p, dist2(before, p.pos) > 6400, state.tactics[p.team].energyUse);
  }
}

/**
 * Dev/debug query (renderer overlay): the target each player would steer to if
 * a movement tick ran on the current state. Pure — no state mutation, no rng.
 * Out players report their own position (they don't move).
 */
export function movementTargets(state: MatchState): Vec[] {
  const ball = ballPos(state);
  const mv = resolveMovement(state);
  const presserIdx = state.ball.kind === 'held' ? mv.presserIdx : -1;
  const targets: Vec[] = [];
  for (let i = 0; i < 22; i++) {
    const t = isAvailable(state, i) ? targetFor(state, i, mv, presserIdx, ball) : state.players[i].pos;
    targets.push({ x: t.x, y: t.y }); // copies — never alias live sim positions
  }
  return targets;
}

export const PASS_SPEED = 250;
export const BALL_GRAVITY = 10;
export const BALL_CONTROL_HEIGHT = 150;
export const GOALKEEPER_CATCH_HOLD_TICKS = 6;
export const LIFTED_SHOT_CHANCE = 0.3;

const GOALKEEPER_CATCH_HEIGHT = 90;
const GOALKEEPER_DISTRIBUTION_FLIGHT_TICKS = 12;
const LIFTED_SHOT_GOAL_HEIGHT = 110;

/**
 * Initial vertical speed for semi-implicit Euler (`vz -= g; z += vz`) to
 * arrive at `targetHeight` after `flightTicks`. All values are integer cm/tick.
 */
export function verticalLaunchSpeed(flightTicks: number, targetHeight: number): number {
  const ticks = Math.max(1, Math.round(flightTicks));
  return Math.round((targetHeight + BALL_GRAVITY * ticks * (ticks + 1) / 2) / ticks);
}

/** Advances only the vertical component; the pitch-plane coordinate stays independent. */
export function advanceFlightHeight(ball: { z: number; vz: number }): void {
  if (ball.z === 0 && ball.vz === 0) return;
  ball.vz -= BALL_GRAVITY;
  ball.z = Math.max(0, ball.z + ball.vz);
  if (ball.z === 0 && ball.vz < 0) ball.vz = 0;
}

const DECISION_TICKS = 5;
const OPEN_LANE_CLEARANCE = 800;
const OPEN_SHOT_CLEARANCE = 600;
const PASS_SWITCH_MARGIN = 0.005;
const SHOT_FUN_BIAS = 0.06;
const MIN_SHOT_VALUE = 0.06;
const OBVIOUS_SHOT_DISTANCE = 1800;
const CARRY_TIME_DISCOUNT = 0.7;
const SHOT_KEEPER_MOD = -7;
// Resolve should make sustained pressure visible without turning one strong
// half into an irreversible keeper-collapse cascade. Six keeps repeated shots
// meaningful while preserving a realistic recovery window at halftime.
const RESOLVE_DAMAGE_DIVISOR = 6;
const SHOT_POWER_BASELINE = 60;
const KEEPER_RESOLVE_FLOOR = 0.8;

interface ActionValues {
  shot: number;
  carry: number;
  pass: number;
}

export type AttackingDecision =
  | { kind: 'shoot'; values: ActionValues }
  | { kind: 'carry'; values: ActionValues }
  | { kind: 'pass'; to: number; values: ActionValues };

interface PassOption {
  to: number;
  value: number;
  interceptor: number;
  interceptStat: number;
}

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

/** Forward carry vector with a small deterministic left/centre/right lane choice. */
function carryTarget(state: MatchState, idx: number): Vec {
  const carrier = state.players[idx];
  const direction = carrier.team === 0 ? -1 : 1;
  const y = clamp(carrier.pos.y + direction * 800, 0, PITCH_H);
  const xs = [carrier.pos.x - 600, carrier.pos.x, carrier.pos.x + 600];
  let best = { x: clamp(xs[0], 0, PITCH_W), y };
  let bestScore = -Infinity;

  for (const rawX of xs) {
    const candidate = { x: clamp(rawX, 0, PITCH_W), y };
    let space = 1500;
    for (let i = 0; i < 22; i++) {
      const opponent = state.players[i];
      if (opponent.team === carrier.team || !isAvailable(state, i)) continue;
      space = Math.min(space, dist(opponent.pos, candidate));
    }
    const centrality = GOAL_CENTER_X - Math.abs(candidate.x - GOAL_CENTER_X);
    const score = space + centrality * 0.15;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Distance from p to the strict interior of segment a→b; endpoint pressure is handled separately. */
function interiorSegmentDistance(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const length2 = abx * abx + aby * aby;
  if (length2 === 0) return Infinity;
  const projection = apx * abx + apy * aby;
  if (projection <= 0 || projection >= length2) return Infinity;
  const cross = Math.abs(abx * apy - aby * apx);
  return Math.round(cross / Math.sqrt(length2));
}

/** Nearest available opponent crossing the strict interior of a lane, capped at `openAt`. */
function laneClearance(state: MatchState, team: 0 | 1, from: Vec, to: Vec, openAt: number, includeGoalkeeper: boolean): number {
  let clearance = openAt;
  for (let i = 0; i < 22; i++) {
    const opponent = state.players[i];
    if (opponent.team === team || !isAvailable(state, i)) continue;
    if (!includeGoalkeeper && opponent.def.role === 'GK') continue;
    clearance = Math.min(clearance, interiorSegmentDistance(opponent.pos, from, to));
  }
  return clearance;
}

/** 0..1 proxy for how much of the goal face is usable without transcendental math. */
function goalFacingQuality(pos: Vec, goalY: number): number {
  const depth = Math.abs(pos.y - goalY);
  const outsidePost = Math.max(0, Math.abs(pos.x - GOAL_CENTER_X) - GOAL_W / 2);
  if (depth === 0) return outsidePost === 0 ? 1 : 0.2;
  return clamp(depth / (depth + outsidePost * 2), 0.2, 1);
}

/** Average clearance across left, centre and right aim corridors. */
function shotCorridorQuality(state: MatchState, by: number, pos: Vec): number {
  const shooter = state.players[by];
  const goalY = goalYFor(shooter.team);
  const aimXs = [GOAL_CENTER_X - GOAL_W / 2 + 100, GOAL_CENTER_X, GOAL_CENTER_X + GOAL_W / 2 - 100];
  let total = 0;
  for (const x of aimXs) {
    total += laneClearance(state, shooter.team, pos, { x, y: goalY }, OPEN_SHOT_CLEARANCE, false);
  }
  const openFraction = total / (aimXs.length * OPEN_SHOT_CLEARANCE);
  return 0.2 + openFraction * 0.8; // obstruction discourages; it never pretends physical blocks already exist
}

function hasFrontalPressure(state: MatchState, by: number, pos: Vec): boolean {
  const shooter = state.players[by];
  const goal = { x: GOAL_CENTER_X, y: goalYFor(shooter.team) };
  const goalDx = goal.x - pos.x;
  const goalDy = goal.y - pos.y;
  for (let i = 0; i < 22; i++) {
    const opponent = state.players[i];
    if (opponent.team === shooter.team || !isAvailable(state, i)) continue;
    if (dist2(opponent.pos, pos) >= 400 * 400) continue;
    const opponentDx = opponent.pos.x - pos.x;
    const opponentDy = opponent.pos.y - pos.y;
    if (goalDx * opponentDx + goalDy * opponentDy > 0) return true;
  }
  return false;
}

/** Aim error shared by decision quality and the actual launch. */
function shotSpreadAt(state: MatchState, by: number, pos: Vec, distance: number): number {
  const sho = effectiveStat(state, by, 'sho');
  const base = 500 + (99 - sho) * 8 + Math.round(distance / 4);
  return hasFrontalPressure(state, by, pos) ? Math.round(base * 1.25) : base;
}

/**
 * SHO already improves aim through shotSpreadAt(). Compress only its second
 * contribution to keeper-beating power so a rating gap matters without being
 * counted at full strength twice. Explicit power bonuses remain uncompressed.
 */
function shotPowerAt(state: MatchState, by: number, distance: number): number {
  const sho = effectiveStat(state, by, 'sho');
  return Math.max(1, Math.round(
    SHOT_POWER_BASELINE
      + (sho - SHOT_POWER_BASELINE) / 4
      + shotBonus(state, by)
      - distance / 200,
  ));
}

function keeperResolveScale(resolve: number): number {
  return KEEPER_RESOLVE_FLOOR
    + (1 - KEEPER_RESOLVE_FLOOR) * (resolve / 100);
}

/** Approximate probability that a shot from `pos` scores under the current shot/save model. */
function shotExpectedValue(state: MatchState, by: number, pos: Vec): number {
  const shooter = state.players[by];
  const goal = { x: GOAL_CENTER_X, y: goalYFor(shooter.team) };
  const distance = dist(pos, goal);
  const spread = shotSpreadAt(state, by, pos, distance);
  const onTargetProbability = Math.min(1, (GOAL_W / 2) / spread);
  const power = shotPowerAt(state, by, distance);
  const defendingTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
  const keeperIdx = defendingTeam === 0 ? 0 : 11;
  const resolveScale = keeperResolveScale(state.resolve[defendingTeam]);
  const saveProbability = isAvailable(state, keeperIdx)
    ? contestProbability(effectiveStat(state, keeperIdx, 'ref') * resolveScale, power, SHOT_KEEPER_MOD)
    : 0;
  // The current launch model loses too little quality with distance, so decision
  // quality supplies a smooth 17-42m falloff rather than another hard range cliff.
  const distanceQuality = clamp((5000 - distance) / 2800, 0, 1);
  return onTargetProbability * (1 - saveProbability) * distanceQuality
    * goalFacingQuality(pos, goal.y) * shotCorridorQuality(state, by, pos);
}

/** Future scoring value of retaining the ball at `pos` over the next few seconds. */
function positionThreat(state: MatchState, by: number, pos: Vec): number {
  const player = state.players[by];
  const progress = clamp((player.team === 0 ? PITCH_H - pos.y : pos.y) / PITCH_H, 0, 1);
  const progressCurve = progress * progress;
  const centrality = clamp(1 - Math.abs(pos.x - GOAL_CENTER_X) / GOAL_CENTER_X, 0, 1);
  const skillScale = 0.16 + effectiveStat(state, by, 'sho') / 500;
  const buildupValue = progressCurve * skillScale * (0.75 + centrality * 0.25);
  return Math.max(shotExpectedValue(state, by, pos), buildupValue);
}

function opponentTurnoverCost(state: MatchState, opponent: number): number {
  if (opponent === -1) return 0.04;
  return 0.04 + positionThreat(state, opponent, state.players[opponent].pos) * 0.5;
}

/** Expected completion and the exact contest input used if this pass launches. */
function passContestInputs(state: MatchState, from: number, to: number): { probability: number; interceptor: number; interceptStat: number } {
  const passer = state.players[from];
  const receiver = state.players[to];
  const interceptor = nearestOpponent(state, to);
  if (interceptor === -1) return { probability: 1, interceptor, interceptStat: 1 };

  const marker = state.players[interceptor];
  const receiverSpace = dist(marker.pos, receiver.pos);
  const clearance = laneClearance(state, passer.team, passer.pos, receiver.pos, OPEN_LANE_CLEARANCE, true);
  // Open receivers and clear lanes reduce the defender's effective interception
  // pressure. This aligns the launch contest with the opportunity model until
  // the approved emergent pass-flight resolver replaces pre-rolled outcomes.
  const spaceRelief = clamp(Math.trunc((receiverSpace - 300) / 80), 0, 15);
  const laneRelief = clamp(Math.trunc((clearance - 200) / 80), 0, 8);
  const interceptStat = Math.max(1, effectiveStat(state, interceptor, 'def') - spaceRelief - laneRelief);
  return {
    probability: contestProbability(effectiveStat(state, from, 'pas'), interceptStat, 10),
    interceptor,
    interceptStat,
  };
}

function bestPassOption(state: MatchState, from: number): PassOption | null {
  const passer = state.players[from];
  let best: PassOption | null = null;
  for (let i = 0; i < 22; i++) {
    const mate = state.players[i];
    if (i === from || mate.team !== passer.team || !isAvailable(state, i)) continue;
    const distance2 = dist2(mate.pos, passer.pos);
    if (distance2 < 400 * 400 || distance2 > 3500 * 3500) continue;

    const inputs = passContestInputs(state, from, i);
    const value = inputs.probability * positionThreat(state, i, mate.pos)
      - (1 - inputs.probability) * opponentTurnoverCost(state, inputs.interceptor);
    if (best === null || value > best.value) {
      best = { to: i, value, interceptor: inputs.interceptor, interceptStat: inputs.interceptStat };
    }
  }
  return best;
}

function carryExpectedValue(state: MatchState, carrierIdx: number): number {
  const carrier = state.players[carrierIdx];
  const goal = { x: GOAL_CENTER_X, y: goalYFor(carrier.team) };
  const dribbleSpeed = Math.round(speedFor(state, carrierIdx) * CARRIER_SPEED_SCALE);
  const next = moveToward(carrier.pos, goal, dribbleSpeed * DECISION_TICKS);
  const markerIdx = nearestOpponent(state, carrierIdx);
  if (markerIdx === -1) return positionThreat(state, carrierIdx, next);

  const marker = state.players[markerIdx];
  const markerDistance = dist(marker.pos, carrier.pos);
  const goalDx = goal.x - carrier.pos.x;
  const goalDy = goal.y - carrier.pos.y;
  const markerDx = marker.pos.x - carrier.pos.x;
  const markerDy = marker.pos.y - carrier.pos.y;
  const goalSide = goalDx * markerDx + goalDy * markerDy > 0;
  const proximity = clamp((450 - markerDistance) / 250, 0, 1);
  const directionScale = goalSide ? 1 : 0.25;
  const tackleWin = contestProbability(
    effectiveStat(state, markerIdx, 'def') + defenseBonus(state, markerIdx),
    effectiveStat(state, carrierIdx, 'tec'),
    -dribbleBonus(state, carrierIdx),
  );
  const retainProbability = 1 - tackleWin * proximity * directionScale;
  // Carrying must spend another decision window before cashing in the better
  // position; discount that delay or an unpressured carrier rationally dribbles
  // all the way to the goal line instead of ever taking a good shot.
  return retainProbability * positionThreat(state, carrierIdx, next) * CARRY_TIME_DISCOUNT
    - (1 - retainProbability) * opponentTurnoverCost(state, markerIdx);
}

/** Pure, deterministic carrier choice: all actions share expected attacking value. */
export function attackingDecision(state: MatchState, carrierIdx: number): AttackingDecision {
  const carrier = state.players[carrierIdx];
  const goal = { x: GOAL_CENTER_X, y: goalYFor(carrier.team) };
  const mentality = state.tactics[carrier.team].mentality;
  const shotBias = mentality === 'ATTACK' ? 1.25 : mentality === 'PROTECT' ? 0.82 : 1;
  const carryBias = mentality === 'ATTACK' ? 1.08 : mentality === 'PROTECT' ? 0.86 : 1;
  const passBias = mentality === 'ATTACK' ? 0.94 : mentality === 'PROTECT' ? 1.14 : 1;
  const shot = (carrier.def.role === 'GK' || phaseRunPreventsShot(state, carrierIdx)
    ? 0
    : shotExpectedValue(state, carrierIdx, carrier.pos)) * shotBias;
  const carry = carryExpectedValue(state, carrierIdx) * carryBias;
  const passOption = bestPassOption(state, carrierIdx);
  const pass = passOption === null ? -1 : passOption.value * passBias;
  const values = { shot, carry, pass };
  const corridorQuality = shotCorridorQuality(state, carrierIdx, carrier.pos);
  const obviousShot = carrier.def.role !== 'GK' && !phaseRunPreventsShot(state, carrierIdx)
    && dist(carrier.pos, goal) <= OBVIOUS_SHOT_DISTANCE
    && goalFacingQuality(carrier.pos, goal.y) >= 0.6
    && corridorQuality >= 0.72;
  const inAttackingHalf = carrier.team === 0 ? carrier.pos.y < PITCH_H / 2 : carrier.pos.y > PITCH_H / 2;
  const speedBreakActive = inAttackingHalf && carrier.powerState.kind === 'active' && carrier.def.power === 'SUPER_SPEED';
  // Airborne shots made the old 26 m / 0.65 lane trigger cash a well-timed
  // burst into low-quality attempts. Carry to 22 m and a cleaner lane first.
  const speedBreakShot = speedBreakActive
    && dist(carrier.pos, goal) <= 2200
    && goalFacingQuality(carrier.pos, goal.y) >= 0.6
    && corridorQuality >= 0.7;

  if (obviousShot || speedBreakShot) {
    return { kind: 'shoot', values };
  }
  // A manual Super Speed tap while carrying is a commitment to the break. Keep
  // control through its telegraphed wind-up instead of letting the AI pass the
  // ball away before the player's chosen power can become active.
  if (inAttackingHalf && (carrier.powerState.kind === 'winding' || carrier.powerState.kind === 'active')
    && carrier.def.power === 'SUPER_SPEED') {
    return { kind: 'carry', values };
  }
  if (shot >= MIN_SHOT_VALUE && shot + SHOT_FUN_BIAS * corridorQuality >= Math.max(carry, pass)) {
    return { kind: 'shoot', values };
  }
  if (passOption !== null && pass > carry + PASS_SWITCH_MARGIN) {
    return { kind: 'pass', to: passOption.to, values };
  }
  return { kind: 'carry', values };
}

export function possessionTick(state: MatchState): void {
  const b = state.ball;

  if (b.kind === 'loose') {
    b.pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
    b.vel = { x: Math.trunc(b.vel.x * 0.8), y: Math.trunc(b.vel.y * 0.8) };
    advanceFlightHeight(b);
    if (b.z > BALL_CONTROL_HEIGHT) return;
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
    b.pos = moveToward(b.pos, target, b.speed);
    advanceFlightHeight(b);
    if (dist2(b.pos, target) < 150 * 150) {
      // The 2.5D control gate is simulation truth, not a render trick: a
      // lofted ball can visibly pass over a player's pitch-plane coordinate.
      if (b.z > BALL_CONTROL_HEIGHT) return;
      // A recipient (or interceptor) knocked out mid-flight can't receive the ball
      // unconscious (the audit's phantom-pass bug) — it goes loose at the arrival
      // point instead, same as a failed pass with no interceptor.
      if ((b.willSucceed || b.interceptor !== -1) && isAvailable(state, targetIdx)) {
        state.ball = { kind: 'held', by: targetIdx };
        addGauge(state, targetIdx, 2);
      } else {
        state.ball = { kind: 'loose', pos: { ...b.pos }, vel: { x: 0, y: 0 }, z: b.z, vz: b.vz };
      }
    }
    return;
  }

  if (b.kind !== 'held') return; // 'shot' handled in Task 10
  if (!isAvailable(state, b.by)) return; // unconscious/sliding/recovering carriers do not act
  if (b.releaseAfterTick !== undefined) {
    if (state.tick < b.releaseAfterTick) return;
    const option = bestPassOption(state, b.by);
    if (option !== null) launchPass(state, b.by, option.to, true);
    else state.ball = { kind: 'held', by: b.by };
    return;
  }
  if (state.tick % 5 !== 0) return;

  const carrierIdx = b.by;
  const carrier = state.players[carrierIdx];
  const goal = { x: GOAL_CENTER_X, y: goalYFor(carrier.team) };
  const decision = attackingDecision(state, carrierIdx);

  if (decision.kind === 'shoot') {
    attemptShot(state, carrierIdx, dist(carrier.pos, goal));
    return;
  }

  if (decision.kind === 'pass') {
    launchPass(state, carrierIdx, decision.to, false);
  }
}

export function launchPass(state: MatchState, from: number, to: number, lofted: boolean): void {
  const passer = state.players[from];
  const inputs = passContestInputs(state, from, to);
  const rolledOk = contest(state.rng, effectiveStat(state, from, 'pas'), inputs.interceptStat, 10);
  const predictedInterceptor = futureSightInterceptor(state, passer.team, to);
  const ok = predictedInterceptor === -1 ? rolledOk : false;
  const interceptor = predictedInterceptor === -1 ? inputs.interceptor : predictedInterceptor;
  const targetIdx = ok ? to : (interceptor !== -1 ? interceptor : to);
  const target = state.players[targetIdx].pos;
  const horizontalDistance = dist(passer.pos, target);
  const flightTicks = lofted
    ? Math.max(GOALKEEPER_DISTRIBUTION_FLIGHT_TICKS, Math.ceil(horizontalDistance / PASS_SPEED))
    : Math.max(1, Math.ceil(horizontalDistance / PASS_SPEED));
  const speed = lofted
    ? Math.max(1, Math.ceil(horizontalDistance / flightTicks))
    : PASS_SPEED;
  emit(state, { t: state.tick, kind: 'PASS', from, to, ok });
  state.ball = {
    kind: 'pass',
    pos: { ...passer.pos },
    from,
    to,
    willSucceed: ok,
    interceptor,
    z: 0,
    vz: lofted ? verticalLaunchSpeed(flightTicks, 0) : 0,
    speed,
  };
}

function inOwnDefensiveThird(team: 0 | 1, pos: Vec): boolean {
  return team === 0 ? pos.y >= PITCH_H * 2 / 3 : pos.y <= PITCH_H / 3;
}

function isGoalSideOfCarrier(tackler: SimPlayer, carrier: SimPlayer): boolean {
  const carrierAttackY = carrier.team === 0 ? -1 : 1;
  return (tackler.pos.y - carrier.pos.y) * carrierAttackY >= 0;
}

/**
 * 80% is the preferred band, not a cliff. Below it, the launch range and
 * opportunity narrows; below 50%, only a shorter emergency challenge in the
 * defender's own third is allowed. Under 30%, a player cannot launch at all.
 */
function slideLaunchRange(state: MatchState, tacklerIdx: number, carrierIdx: number): number {
  const tackler = state.players[tacklerIdx];
  // An 8-11 metre slide is a spectacular committed defender tool. Midfielders
  // and forwards keep pressing into standing-tackle range instead of repeatedly
  // abandoning the team shape with the exaggerated long lunge.
  if (tackler.condition < SLIDE_TACKLE_CONDITION_FLOOR) return 0;
  const ownThird = inOwnDefensiveThird(tackler.team, state.players[carrierIdx].pos);
  if (tackler.def.role !== 'DEF') return 0;
  if (!isGoalSideOfCarrier(tackler, state.players[carrierIdx])) return 0;
  if (tackler.condition >= SLIDE_TACKLE_PREFERRED_CONDITION) return SLIDE_TACKLE_MAX_RANGE;
  if (tackler.condition >= 50) return 1000;
  return ownThird ? 900 : 0;
}

function finishSlide(state: MatchState, tacklerIdx: number, won: boolean, contact: boolean): void {
  const tackler = state.players[tacklerIdx];
  const slide = tackler.slideTackle;
  if (!slide) return;
  const targetIdx = slide.targetIdx;
  tackler.slideTackle = undefined;
  tackler.tackleRecoveryUntil = state.tick + (won ? SLIDE_SUCCESS_RECOVERY_TICKS : SLIDE_MISS_RECOVERY_TICKS);
  emit(state, { t: state.tick, kind: 'TACKLE', by: tacklerIdx, on: targetIdx, won, style: 'slide', contact });
  if (won) {
    state.ball = { kind: 'held', by: tacklerIdx };
    addGauge(state, tacklerIdx, 12); // launch + clean win preserves the existing 15-Heat reward
    interruptWindup(state, targetIdx);
  }
}

/** Closest approach of two moving points over the same tick, expressed as 0..1. */
function sweptContactFraction(tacklerFrom: Vec, tacklerTo: Vec, targetFrom: Vec, targetTo: Vec): number | null {
  const startX = tacklerFrom.x - targetFrom.x;
  const startY = tacklerFrom.y - targetFrom.y;
  const velocityX = (tacklerTo.x - tacklerFrom.x) - (targetTo.x - targetFrom.x);
  const velocityY = (tacklerTo.y - tacklerFrom.y) - (targetTo.y - targetFrom.y);
  const speed2 = velocityX * velocityX + velocityY * velocityY;
  const t = speed2 === 0 ? 0 : clamp(-(startX * velocityX + startY * velocityY) / speed2, 0, 1);
  const closestX = startX + velocityX * t;
  const closestY = startY + velocityY * t;
  return closestX * closestX + closestY * closestY <= SLIDE_CONTACT_RANGE * SLIDE_CONTACT_RANGE ? t : null;
}

/** Returns true while a committed slide owns this tick's challenge slot. */
function resolveActiveSlide(state: MatchState): boolean {
  const tacklerIdx = state.players.findIndex(p => p.slideTackle !== undefined);
  if (tacklerIdx === -1) return false;

  const tackler = state.players[tacklerIdx];
  const slide = tackler.slideTackle!;
  const carrierStillTargeted = state.ball.kind === 'held' && state.ball.by === slide.targetIdx
    && isConscious(state, slide.targetIdx);
  const target = state.players[slide.targetIdx];
  const contactFraction = carrierStillTargeted
    ? sweptContactFraction(slide.previousPos, tackler.pos, slide.targetPreviousPos, target.pos)
    : null;
  if (carrierStillTargeted && contactFraction !== null) {
    // Stop at the collision point. The coordinate persists through recovery;
    // the renderer no longer offsets the sprite and snaps it back afterward.
    tackler.pos = {
      x: Math.round(slide.previousPos.x + (tackler.pos.x - slide.previousPos.x) * contactFraction),
      y: Math.round(slide.previousPos.y + (tackler.pos.y - slide.previousPos.y) * contactFraction),
    };
    const won = contest(
      state.rng,
      effectiveStat(state, tacklerIdx, 'def') + defenseBonus(state, tacklerIdx),
      effectiveStat(state, slide.targetIdx, 'tec'),
      -dribbleBonus(state, slide.targetIdx),
    );
    finishSlide(state, tacklerIdx, won, true);
    return true;
  }

  if (state.tick >= slide.untilTick || slide.remainingDistance <= 0) {
    finishSlide(state, tacklerIdx, false, false);
    return true;
  }
  // A committed miss still travels its locked path after the target releases
  // the ball. Stopping on the release tick made far-away slides look like a
  // one-step stumble even though the launch itself came from 8-11 metres.
  slide.targetPreviousPos = { ...target.pos };
  return true;
}

function startSlide(state: MatchState, tacklerIdx: number, carrierIdx: number, distance: number): void {
  const tackler = state.players[tacklerIdx];
  const carrier = state.players[carrierIdx];
  const dx = carrier.pos.x - tackler.pos.x;
  const dy = carrier.pos.y - tackler.pos.y;
  const magnitude = Math.sqrt(dx * dx + dy * dy);
  const direction = magnitude > 0
    ? { x: dx / magnitude, y: dy / magnitude }
    : { x: 0, y: carrier.team === 0 ? -1 : 1 };
  const untilTick = state.tick + SLIDE_TACKLE_TICKS;
  tackler.slideTackle = {
    targetIdx: carrierIdx,
    startTick: state.tick,
    untilTick,
    direction,
    remainingDistance: Math.min(
      SLIDE_TACKLE_MAX_RANGE,
      Math.max(SLIDE_TACKLE_MIN_RANGE, distance + SLIDE_CONTACT_RANGE),
    ),
    previousPos: { ...tackler.pos },
    targetPreviousPos: { ...carrier.pos },
  };
  tackler.tackleCooldownUntil = state.tick + SLIDE_TACKLE_COOLDOWN_TICKS;
  drainSlideCondition(tackler, state.tactics[tackler.team].energyUse);
  addGauge(state, tacklerIdx, 3);
  emit(state, { t: state.tick, kind: 'SLIDE_STARTED', by: tacklerIdx, on: carrierIdx, direction: { ...direction }, untilTick });
}

function standingTackle(state: MatchState, tacklerIdx: number, carrierIdx: number): void {
  const tackler = state.players[tacklerIdx];
  tackler.tackleCooldownUntil = state.tick + 10;
  addGauge(state, tacklerIdx, 3);
  const won = contest(
    state.rng,
    effectiveStat(state, tacklerIdx, 'def') + defenseBonus(state, tacklerIdx),
    effectiveStat(state, carrierIdx, 'tec'),
    -dribbleBonus(state, carrierIdx),
  );
  emit(state, { t: state.tick, kind: 'TACKLE', by: tacklerIdx, on: carrierIdx, won, style: 'standing', contact: true });
  if (won) {
    state.ball = { kind: 'held', by: tacklerIdx };
    addGauge(state, tacklerIdx, 12);
    interruptWindup(state, carrierIdx);
  }
}

export function tackleTick(state: MatchState): void {
  if (resolveActiveSlide(state)) return;
  if (state.ball.kind !== 'held' || !isAvailable(state, state.ball.by)) return;
  const carrierIdx = state.ball.by;
  const carrier = state.players[carrierIdx];

  let standingIdx = -1;
  let standingD2 = STANDING_TACKLE_RANGE * STANDING_TACKLE_RANGE + 1;
  let slideIdx = -1;
  let slideDistance = 0;
  let slideD2 = SLIDE_TACKLE_MAX_RANGE * SLIDE_TACKLE_MAX_RANGE + 1;
  for (let i = 0; i < 22; i++) {
    const defender = state.players[i];
    if (defender.team === carrier.team || !isAvailable(state, i)) continue;
    if (state.tick < defender.tackleCooldownUntil || defender.powerState.kind === 'winding') continue;
    if (fireSuppressed(state, i, carrierIdx)) continue;
    const d2 = dist2(defender.pos, carrier.pos);
    if (d2 <= STANDING_TACKLE_RANGE * STANDING_TACKLE_RANGE && d2 < standingD2) {
      standingIdx = i;
      standingD2 = d2;
      continue;
    }
    if (defender.def.role === 'GK') continue;
    const launchRange = slideLaunchRange(state, i, carrierIdx);
    if (
      launchRange === 0
      || d2 < SLIDE_TACKLE_MIN_RANGE * SLIDE_TACKLE_MIN_RANGE
      || d2 > launchRange * launchRange
      || d2 >= slideD2
    ) continue;
    slideIdx = i;
    slideD2 = d2;
    slideDistance = Math.sqrt(d2);
  }

  if (standingIdx !== -1) standingTackle(state, standingIdx, carrierIdx);
  else if (slideIdx !== -1) startSlide(state, slideIdx, carrierIdx, slideDistance);
}

/** Moment-based shot spikes. Thunder Strike also drains Resolve through the normal save path. */
export function shotBonus(state: MatchState, by: number): number {
  const player = state.players[by];
  return player.powerState.kind === 'active' && player.def.power === 'THUNDER_STRIKE'
    ? Math.round(65 * player.powerState.strength)
    : 0;
}

export function attemptShot(state: MatchState, by: number, distToGoal: number): void {
  const shooter = state.players[by];
  const gy = goalYFor(shooter.team);
  const spread = shotSpreadAt(state, by, shooter.pos, distToGoal);
  const targetX = Math.round(GOAL_CENTER_X + (state.rng() * 2 - 1) * spread);
  const trajectory = state.rng() < LIFTED_SHOT_CHANCE ? 'lifted' : 'driven';
  // distToGoal / 200 (Task 13 pre-flight Lever A, was / 100): the old penalty made
  // shots too easy to save; halving it targets goals/match ~2-3 and save rate ~70-80%.
  const power = shotPowerAt(state, by, distToGoal);
  emit(state, { t: state.tick, kind: 'SHOT', by, power, trajectory });
  addGauge(state, by, 20);
  const dir = gy === 0 ? -1 : 1;
  const flightTicks = Math.max(1, Math.ceil(Math.abs(gy - shooter.pos.y) / 300));
  state.ball = {
    kind: 'shot',
    pos: { ...shooter.pos },
    vel: { x: Math.trunc((targetX - shooter.pos.x) / Math.max(1, distToGoal / 300)), y: 300 * dir },
    by,
    power,
    targetX,
    z: 0,
    vz: trajectory === 'lifted' ? verticalLaunchSpeed(flightTicks, LIFTED_SHOT_GOAL_HEIGHT) : 0,
    trajectory,
    keeperChecked: false,
  };
}

export function shotFlightTick(state: MatchState): void {
  const b = state.ball;
  if (b.kind !== 'shot') return;
  b.pos = { x: b.pos.x + b.vel.x, y: b.pos.y + b.vel.y };
  advanceFlightHeight(b);
  const shooter = state.players[b.by];
  const gy = goalYFor(shooter.team);
  const defendingTeam: 0 | 1 = shooter.team === 0 ? 1 : 0;
  const gkIdx = defendingTeam === 0 ? 0 : 11;
  const onTarget = Math.abs(b.targetX - GOAL_CENTER_X) <= GOAL_W / 2;
  const keeper = state.players[gkIdx];
  const reachedKeeperPlane = gy === 0 ? b.pos.y <= keeper.pos.y : b.pos.y >= keeper.pos.y;

  // Resolve a catch at the goalkeeper, not after the ball has already drawn in
  // the net. This removes the apparent "goal, then bounce out" sequence.
  if (onTarget && !b.keeperChecked && reachedKeeperPlane) {
    b.keeperChecked = true;
    if (isAvailable(state, gkIdx)) {
      const resolveScale = keeperResolveScale(state.resolve[defendingTeam]);
      const saved = contest(
        state.rng,
        effectiveStat(state, gkIdx, 'ref') * resolveScale + keeperSaveBonus(state, gkIdx),
        b.power,
        SHOT_KEEPER_MOD,
      );
      if (saved) {
        state.resolve[defendingTeam] = Math.max(
          0,
          state.resolve[defendingTeam] - Math.round(b.power / RESOLVE_DAMAGE_DIVISOR),
        );
        emit(state, { t: state.tick, kind: 'SAVE', by: gkIdx, resolveLeft: state.resolve[defendingTeam] });
        addGauge(state, gkIdx, 12);
        state.ball = {
          kind: 'held',
          by: gkIdx,
          caught: true,
          releaseAfterTick: state.tick + GOALKEEPER_CATCH_HOLD_TICKS,
        };
        return;
      }
    }
  }

  const crossed = gy === 0 ? b.pos.y <= 0 : b.pos.y >= PITCH_H;
  if (!crossed) return;

  if (!onTarget) {
    emit(state, { t: state.tick, kind: 'MISS', by: b.by });
    restartKickoff(state, defendingTeam);
    return;
  }

  state.score[shooter.team]++;
  emit(state, { t: state.tick, kind: 'GOAL', by: b.by, team: shooter.team });
  restartKickoff(state, defendingTeam);
}
